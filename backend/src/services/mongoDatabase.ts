import mongoose, { Schema, Document, Model } from 'mongoose';
import * as crypto from 'crypto';
import {
  IDatabaseAdapter,
  User,
  CreateUserData,
  UpdateUserData,
  ConnectedAccount,
  CreateConnectedAccountData,
  OrderHistory,
  CreateOrderHistoryData,
  OrderFilters,
  AccountStatus
} from '../interfaces/IDatabaseAdapter';

// MongoDB Document Interfaces
interface UserDocument extends Document {
  email: string;
  name: string;
  password: string;
  role?: string;
  created_at: Date;
  updated_at: Date;
}

interface ConnectedAccountDocument extends Document {
  user_id: mongoose.Types.ObjectId;
  broker_name: string;
  account_id: string;
  user_name: string;
  email: string;
  broker_display_name: string;
  exchanges: string;
  products: string;
  encrypted_credentials: string;
  account_status: string; // 'ACTIVE' | 'INACTIVE' | 'PROCEED_TO_OAUTH'
  token_expiry_time: Date | null; // Access token expiry (null for infinity like Shoonya)
  refresh_token_expiry_time: Date | null; // Refresh token expiry (for OAuth brokers like Fyers)
  created_at: Date;
  updated_at: Date;
}

interface OrderHistoryDocument extends Document {
  user_id: mongoose.Types.ObjectId;
  account_id: mongoose.Types.ObjectId;
  broker_name: string;
  broker_order_id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  status: 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED' | 'FAILED';
  exchange: string;
  product_type: string;
  remarks: string;
  executed_at: Date;
  created_at: Date;
  // Enhanced fields for comprehensive order updates
  executed_quantity?: number;
  average_price?: number;
  rejection_reason?: string;
  last_updated?: Date;
  // Enhanced fields for error handling and retry functionality
  error_message?: string;
  error_code?: string;
  error_type?: 'NETWORK' | 'BROKER' | 'VALIDATION' | 'AUTH' | 'SYSTEM' | 'MARKET';
  retry_count?: number;
  max_retries?: number;
  last_retry_at?: Date;
  is_retryable?: boolean;
  failure_reason?: string;
}

// MongoDB Schemas
const UserSchema = new Schema<UserDocument>({
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
  role: { type: String, default: 'user' },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const ConnectedAccountSchema = new Schema<ConnectedAccountDocument>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  broker_name: { type: String, required: true },
  account_id: { type: String, required: true },
  user_name: { type: String, required: true },
  email: { type: String, required: true },
  broker_display_name: { type: String, required: true },
  exchanges: { type: String, required: true }, // JSON string
  products: { type: String, required: true }, // JSON string
  encrypted_credentials: { type: String, required: true },
  account_status: { type: String, required: true, enum: ['ACTIVE', 'INACTIVE', 'PROCEED_TO_OAUTH'], default: 'INACTIVE' },
  token_expiry_time: { type: Date, default: null }, // Access token expiry (null for infinity like Shoonya)
  refresh_token_expiry_time: { type: Date, default: null }, // Refresh token expiry (for OAuth brokers like Fyers)
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const OrderHistorySchema = new Schema<OrderHistoryDocument>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  account_id: { type: Schema.Types.ObjectId, ref: 'ConnectedAccount', required: true },
  broker_name: { type: String, required: true },
  broker_order_id: { type: String, required: true },
  symbol: { type: String, required: true },
  action: { type: String, enum: ['BUY', 'SELL'], required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  order_type: { type: String, enum: ['MARKET', 'LIMIT', 'SL-LIMIT', 'SL-MARKET'], required: true },
  status: {
    type: String,
    enum: ['PLACED', 'PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED', 'PARTIALLY_FILLED', 'FAILED'],
    default: 'PLACED'
  },
  exchange: { type: String, default: 'NSE' },
  product_type: { type: String, default: 'C' },
  remarks: { type: String, default: '' },
  executed_at: { type: Date, required: true },
  created_at: { type: Date, default: Date.now },
  // Enhanced fields for comprehensive order updates
  executed_quantity: { type: Number, default: 0 },
  average_price: { type: Number, default: 0 },
  rejection_reason: { type: String },
  last_updated: { type: Date, default: Date.now },
  // Enhanced fields for error handling and retry functionality
  error_message: { type: String },
  error_code: { type: String },
  error_type: {
    type: String,
    enum: ['NETWORK', 'BROKER', 'VALIDATION', 'AUTH', 'SYSTEM', 'MARKET']
  },
  retry_count: { type: Number, default: 0 },
  max_retries: { type: Number, default: 3 },
  last_retry_at: { type: Date },
  is_retryable: { type: Boolean, default: false },
  failure_reason: { type: String }
});

// Add compound indexes
// Allow multiple accounts per broker, but prevent duplicate account IDs per user
ConnectedAccountSchema.index({ user_id: 1, broker_name: 1, account_id: 1 }, { unique: true });
OrderHistorySchema.index({ user_id: 1, created_at: -1 });
OrderHistorySchema.index({ broker_order_id: 1 });

// Update timestamps middleware
UserSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

ConnectedAccountSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

export class MongoDatabase implements IDatabaseAdapter {
  private UserModel: Model<UserDocument>;
  private ConnectedAccountModel: Model<ConnectedAccountDocument>;
  private OrderHistoryModel: Model<OrderHistoryDocument>;
  private encryptionKey: string;
  private isInitialized: boolean = false;

  constructor() {
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'default-encryption-key-change-in-production';
    
    // Initialize models
    this.UserModel = mongoose.model<UserDocument>('User', UserSchema);
    this.ConnectedAccountModel = mongoose.model<ConnectedAccountDocument>('ConnectedAccount', ConnectedAccountSchema);
    this.OrderHistoryModel = mongoose.model<OrderHistoryDocument>('OrderHistory', OrderHistorySchema);
  }

  async initialize(): Promise<void> {
    try {
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/copytradepro';
      
      console.log('🔗 Connecting to MongoDB...');
      await mongoose.connect(mongoUri);
      
      console.log('✅ MongoDB connected successfully');
      console.log('📊 Database:', mongoose.connection.db?.databaseName);

      this.isInitialized = true;
    } catch (error) {
      console.error('🚨 MongoDB connection failed:', error);
      throw error;
    }
  }



  async close(): Promise<void> {
    try {
      await mongoose.connection.close();
      this.isInitialized = false;
      console.log('✅ MongoDB connection closed');
    } catch (error) {
      console.error('🚨 Error closing MongoDB connection:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      if (!this.isInitialized) {
        return false;
      }
      // Check if mongoose connection is ready
      return mongoose.connection.readyState === 1;
    } catch (error) {
      console.error('🚨 MongoDB health check failed:', error);
      return false;
    }
  }

  isConnected(): boolean {
    return this.isInitialized && mongoose.connection.readyState === 1;
  }

  // Encryption helpers
  private encrypt(text: any): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    const plain: string = typeof text === 'string' ? text : JSON.stringify(text ?? {});

    let encrypted = cipher.update(plain, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const [ivHex, encrypted] = encryptedText.split(':');

    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted text format');
    }

    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  // Public method to decrypt credentials for compatibility layer
  public decryptCredentials(encryptedText: string): string {
    return this.decrypt(encryptedText);
  }

  // Document to interface converters
  private userDocToInterface(doc: UserDocument): User {
    return {
      id: (doc._id as mongoose.Types.ObjectId).toString(),
      email: doc.email,
      name: doc.name,
      password: doc.password,
      role: doc.role || 'user',
      created_at: doc.created_at.toISOString(),
      updated_at: doc.updated_at.toISOString()
    };
  }

  private connectedAccountDocToInterface(doc: ConnectedAccountDocument): ConnectedAccount {
    return {
      id: (doc._id as mongoose.Types.ObjectId).toString(),
      user_id: doc.user_id.toString(),
      broker_name: doc.broker_name,
      account_id: doc.account_id,
      user_name: doc.user_name,
      email: doc.email,
      broker_display_name: doc.broker_display_name,
      exchanges: doc.exchanges,
      products: doc.products,
      encrypted_credentials: doc.encrypted_credentials,
      account_status: doc.account_status as AccountStatus,
      token_expiry_time: doc.token_expiry_time ? doc.token_expiry_time.toISOString() : null,
      refresh_token_expiry_time: doc.refresh_token_expiry_time ? doc.refresh_token_expiry_time.toISOString() : null,
      created_at: doc.created_at.toISOString(),
      updated_at: doc.updated_at.toISOString()
    };
  }

  private orderHistoryDocToInterface(doc: OrderHistoryDocument): OrderHistory {
    // Handle populated account data
    const accountData = (doc as any).account_id;
    const accountInfo = accountData && typeof accountData === 'object' && accountData.account_id
      ? {
          account_id: accountData.account_id,
          user_name: accountData.user_name,
          email: accountData.email
        }
      : null;

    return {
      id: (doc._id as mongoose.Types.ObjectId).toString(),
      user_id: doc.user_id ? doc.user_id.toString() : '',
      account_id: doc.account_id ? (typeof doc.account_id === 'string' ? doc.account_id : doc.account_id.toString()) : '',
      broker_name: doc.broker_name || '',
      broker_order_id: doc.broker_order_id || '',
      symbol: doc.symbol || '',
      action: (doc.action as 'BUY' | 'SELL') || 'BUY',
      quantity: doc.quantity || 0,
      price: doc.price || 0,
      order_type: (doc.order_type as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET') || 'MARKET',
      status: (doc.status as 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED' | 'FAILED') || 'PLACED',
      exchange: doc.exchange || '',
      product_type: doc.product_type || '',
      remarks: doc.remarks || '',
      executed_at: doc.executed_at ? doc.executed_at.toISOString() : new Date().toISOString(),
      created_at: doc.created_at ? doc.created_at.toISOString() : new Date().toISOString(),
      // Enhanced fields for comprehensive order updates
      executed_quantity: doc.executed_quantity || undefined,
      average_price: doc.average_price || undefined,
      rejection_reason: doc.rejection_reason || undefined,
      last_updated: doc.last_updated ? doc.last_updated.toISOString() : undefined,
      // Enhanced fields for error handling and retry functionality
      error_message: doc.error_message || undefined,
      error_code: doc.error_code || undefined,
      error_type: doc.error_type || undefined,
      retry_count: doc.retry_count || undefined,
      max_retries: doc.max_retries || undefined,
      last_retry_at: doc.last_retry_at ? doc.last_retry_at.toISOString() : undefined,
      is_retryable: doc.is_retryable || undefined,
      failure_reason: doc.failure_reason || undefined,
      // Add account information if populated
      ...(accountInfo && { account_info: accountInfo })
    };
  }

  // User Management Methods
  async createUser(userData: CreateUserData): Promise<User> {
    try {
      const userDoc = new this.UserModel(userData);
      const savedUser = await userDoc.save();
      
      console.log('✅ User created successfully:', userData.email);
      return this.userDocToInterface(savedUser);
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error('User already exists with this email');
      }
      console.error('🚨 Failed to create user:', error);
      throw error;
    }
  }

  async findUserById(id: string): Promise<User | null> {
    try {
      const user = await this.UserModel.findById(id);
      return user ? this.userDocToInterface(user) : null;
    } catch (error) {
      console.error('🚨 Failed to find user by ID:', error);
      return null;
    }
  }

  // Alias for backward compatibility
  async getUserById(id: number | string): Promise<User | null> {
    return this.findUserById(id.toString());
  }

  async findUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.UserModel.findOne({ email });
      return user ? this.userDocToInterface(user) : null;
    } catch (error) {
      console.error('🚨 Failed to find user by email:', error);
      return null;
    }
  }

  // Alias for backward compatibility
  async getUserByEmail(email: string): Promise<User | null> {
    return this.findUserByEmail(email);
  }

  async updateUser(id: string, userData: UpdateUserData): Promise<User | null> {
    try {
      const updatedUser = await this.UserModel.findByIdAndUpdate(
        id,
        { ...userData, updated_at: new Date() },
        { new: true }
      );
      return updatedUser ? this.userDocToInterface(updatedUser) : null;
    } catch (error) {
      console.error('🚨 Failed to update user:', error);
      return null;
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    try {
      const result = await this.UserModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('🚨 Failed to delete user:', error);
      return false;
    }
  }

  async getUserCount(): Promise<number> {
    try {
      return await this.UserModel.countDocuments();
    } catch (error) {
      console.error('🚨 Failed to get user count:', error);
      return 0;
    }
  }

  async searchUsers(query: string): Promise<User[]> {
    try {
      const users = await this.UserModel.find({
        $or: [
          { name: { $regex: query, $options: 'i' } },
          { email: { $regex: query, $options: 'i' } }
        ]
      }).sort({ created_at: -1 });

      return users.map(user => this.userDocToInterface(user));
    } catch (error) {
      console.error('🚨 Failed to search users:', error);
      return [];
    }
  }

  // Connected Accounts Management
  async createConnectedAccount(accountData: CreateConnectedAccountData): Promise<ConnectedAccount> {
    try {
      const encryptedCredentials = this.encrypt(
        typeof accountData.credentials === 'undefined' ? {} : JSON.stringify(accountData.credentials)
      );

      const accountDoc = new this.ConnectedAccountModel({
        user_id: new mongoose.Types.ObjectId(accountData.user_id.toString()),
        broker_name: accountData.broker_name,
        account_id: accountData.account_id,
        user_name: accountData.user_name,
        email: accountData.email,
        broker_display_name: accountData.broker_display_name,
        exchanges: JSON.stringify(accountData.exchanges),
        products: JSON.stringify(accountData.products),
        encrypted_credentials: encryptedCredentials,
        account_status: accountData.account_status,
        token_expiry_time: accountData.token_expiry_time ? new Date(accountData.token_expiry_time) : null,
        refresh_token_expiry_time: accountData.refresh_token_expiry_time ? new Date(accountData.refresh_token_expiry_time) : null
      });

      const savedAccount = await accountDoc.save();
      console.log('✅ Connected account created successfully:', accountData.account_id);
      return this.connectedAccountDocToInterface(savedAccount);
    } catch (error: any) {
      if (error.code === 11000) {
        throw new Error('Account already exists for this broker');
      }
      console.error('🚨 Failed to create connected account:', error);
      throw error;
    }
  }

  async getConnectedAccountsByUserId(userId: string): Promise<ConnectedAccount[]> {
    try {
      const accounts = await this.ConnectedAccountModel.find({
        user_id: new mongoose.Types.ObjectId(userId)
      }).sort({ created_at: -1 });

      return accounts.map(account => this.connectedAccountDocToInterface(account));
    } catch (error) {
      console.error('🚨 Failed to get connected accounts:', error);
      return [];
    }
  }

  async getConnectedAccountById(id: string): Promise<ConnectedAccount | null> {
    try {
      const account = await this.ConnectedAccountModel.findById(id);
      return account ? this.connectedAccountDocToInterface(account) : null;
    } catch (error) {
      console.error('🚨 Failed to get connected account by ID:', error);
      return null;
    }
  }

  async updateConnectedAccount(id: string, accountData: Partial<CreateConnectedAccountData>): Promise<ConnectedAccount | null> {
    try {
      const updateData: any = { ...accountData, updated_at: new Date() };

      if (Object.prototype.hasOwnProperty.call(accountData, 'credentials')) {
        updateData.encrypted_credentials = this.encrypt(
          typeof accountData.credentials === 'undefined' ? {} : JSON.stringify(accountData.credentials)
        );
        delete updateData.credentials;
      }

      if (accountData.exchanges) {
        updateData.exchanges = JSON.stringify(accountData.exchanges);
      }

      if (accountData.products) {
        updateData.products = JSON.stringify(accountData.products);
      }

      const updatedAccount = await this.ConnectedAccountModel.findByIdAndUpdate(
        id,
        updateData,
        { new: true }
      );

      return updatedAccount ? this.connectedAccountDocToInterface(updatedAccount) : null;
    } catch (error) {
      console.error('🚨 Failed to update connected account:', error);
      return null;
    }
  }

  async deleteConnectedAccount(id: string): Promise<boolean> {
    try {
      const result = await this.ConnectedAccountModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('🚨 Failed to delete connected account:', error);
      return false;
    }
  }

  async getAccountCredentials(id: string): Promise<any> {
    try {
      const account = await this.ConnectedAccountModel.findById(id);
      if (!account) {
        return null;
      }

      // Decrypt and return credentials
      const decryptedCredentials = this.decrypt(account.encrypted_credentials);
      return JSON.parse(decryptedCredentials);
    } catch (error) {
      console.error('🚨 Failed to get account credentials:', error);
      return null;
    }
  }

  // Order History Management
  async createOrderHistory(orderData: CreateOrderHistoryData): Promise<OrderHistory> {
    try {
      const orderDoc = new this.OrderHistoryModel({
        user_id: new mongoose.Types.ObjectId(orderData.user_id.toString()),
        account_id: new mongoose.Types.ObjectId(orderData.account_id.toString()),
        broker_name: orderData.broker_name,
        broker_order_id: orderData.broker_order_id,
        symbol: orderData.symbol,
        action: orderData.action,
        quantity: orderData.quantity,
        price: orderData.price,
        order_type: orderData.order_type,
        status: orderData.status || 'PLACED',
        exchange: orderData.exchange || 'NSE',
        product_type: orderData.product_type || 'C',
        remarks: orderData.remarks || '',
        executed_at: new Date(orderData.executed_at),
        // Enhanced fields for error handling and retry functionality
        error_message: orderData.error_message,
        error_code: orderData.error_code,
        error_type: orderData.error_type,
        retry_count: orderData.retry_count || 0,
        max_retries: orderData.max_retries || 3,
        last_retry_at: orderData.last_retry_at ? new Date(orderData.last_retry_at) : undefined,
        is_retryable: orderData.is_retryable || false,
        failure_reason: orderData.failure_reason
      });

      const savedOrder = await orderDoc.save();
      console.log('✅ Order history created successfully:', orderData.broker_order_id);
      return this.orderHistoryDocToInterface(savedOrder);
    } catch (error) {
      console.error('🚨 Failed to create order history:', error);
      throw error;
    }
  }

  async getOrderHistoryById(id: string): Promise<OrderHistory | null> {
    try {
      const order = await this.OrderHistoryModel.findById(id);
      return order ? this.orderHistoryDocToInterface(order) : null;
    } catch (error) {
      console.error('🚨 Failed to get order history by ID:', error);
      return null;
    }
  }

  async getOrderHistoryByBrokerOrderId(brokerOrderId: string): Promise<OrderHistory | null> {
    try {
      const order = await this.OrderHistoryModel.findOne({ broker_order_id: brokerOrderId });
      return order ? this.orderHistoryDocToInterface(order) : null;
    } catch (error) {
      console.error('🚨 Failed to get order history by broker order ID:', error);
      return null;
    }
  }

  async getOrderHistoryByUserId(userId: number | string, limit: number = 50, offset: number = 0): Promise<OrderHistory[]> {
    try {
      // Convert userId to string if it's a number (for compatibility)
      const userIdStr = typeof userId === 'number' ? userId.toString() : userId;
      const orders = await this.OrderHistoryModel
        .find({ user_id: new mongoose.Types.ObjectId(userIdStr) })
        .sort({ executed_at: -1, created_at: -1 })
        .limit(limit)
        .skip(offset);

      return orders.map(order => this.orderHistoryDocToInterface(order));
    } catch (error) {
      console.error('🚨 Failed to get order history by user ID:', error);
      return [];
    }
  }

  async getOrderHistoryByUserIdWithFilters(
    userId: number | string,
    limit: number = 50,
    offset: number = 0,
    filters: OrderFilters = {}
  ): Promise<OrderHistory[]> {
    try {
      // Convert userId to string if it's a number (for compatibility)
      const userIdStr = typeof userId === 'number' ? userId.toString() : userId;
      const query: any = { user_id: new mongoose.Types.ObjectId(userIdStr) };

      // Add filters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.symbol) {
        query.symbol = { $regex: filters.symbol, $options: 'i' };
      }

      if (filters.brokerName) {
        query.broker_name = filters.brokerName;
      }

      if (filters.action) {
        query.action = filters.action;
      }

      if (filters.startDate || filters.endDate) {
        query.executed_at = {};
        if (filters.startDate) {
          query.executed_at.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.executed_at.$lte = new Date(filters.endDate);
        }
      }

      if (filters.search) {
        query.$or = [
          { symbol: { $regex: filters.search, $options: 'i' } },
          { broker_order_id: { $regex: filters.search, $options: 'i' } },
          { remarks: { $regex: filters.search, $options: 'i' } }
        ];
      }

      const orders = await this.OrderHistoryModel
        .find(query)
        .populate('account_id', 'account_id user_name email') // Populate account details
        .sort({ executed_at: -1, created_at: -1 })
        .limit(limit)
        .skip(offset);

      return orders.map(order => this.orderHistoryDocToInterface(order));
    } catch (error) {
      console.error('🚨 Failed to get filtered order history:', error);
      return [];
    }
  }

  async updateOrderStatus(id: string, status: string): Promise<boolean> {
    try {
      const result = await this.OrderHistoryModel.findByIdAndUpdate(
        id,
        { status },
        { new: true }
      );
      return !!result;
    } catch (error) {
      console.error('🚨 Failed to update order status:', error);
      return false;
    }
  }

  async updateOrderStatusByBrokerOrderId(brokerOrderId: string, status: string): Promise<boolean> {
    try {
      const result = await this.OrderHistoryModel.findOneAndUpdate(
        { broker_order_id: brokerOrderId },
        { status },
        { new: true }
      );
      return !!result;
    } catch (error) {
      console.error('🚨 Failed to update order status by broker order ID:', error);
      return false;
    }
  }

  async updateOrderWithError(id: string, errorData: {
    status: string;
    error_message?: string;
    error_code?: string;
    error_type?: 'NETWORK' | 'BROKER' | 'VALIDATION' | 'AUTH' | 'SYSTEM' | 'MARKET';
    failure_reason?: string;
    is_retryable?: boolean;
  }): Promise<boolean> {
    try {
      const result = await this.OrderHistoryModel.findByIdAndUpdate(
        id,
        {
          status: errorData.status,
          error_message: errorData.error_message,
          error_code: errorData.error_code,
          error_type: errorData.error_type,
          failure_reason: errorData.failure_reason,
          is_retryable: errorData.is_retryable || false
        },
        { new: true }
      );
      return !!result;
    } catch (error) {
      console.error('🚨 Failed to update order with error:', error);
      return false;
    }
  }

  /**
   * Comprehensive order update method that can update multiple fields atomically
   * @param id - Order ID (MongoDB ObjectId string)
   * @param updateData - Fields to update
   */
  async updateOrderComprehensive(id: string, updateData: {
    status?: string;
    executed_quantity?: number;
    average_price?: number;
    rejection_reason?: string;
    error_message?: string;
    error_code?: string;
    error_type?: 'NETWORK' | 'BROKER' | 'VALIDATION' | 'AUTH' | 'SYSTEM' | 'MARKET';
    failure_reason?: string;
    is_retryable?: boolean;
    last_updated?: Date;
  }): Promise<OrderHistory | null> {
    try {
      // Prepare update object with only defined fields
      const updateFields: any = {};
      
      if (updateData.status !== undefined) updateFields.status = updateData.status;
      if (updateData.executed_quantity !== undefined) updateFields.executed_quantity = updateData.executed_quantity;
      if (updateData.average_price !== undefined) updateFields.average_price = updateData.average_price;
      if (updateData.rejection_reason !== undefined) updateFields.rejection_reason = updateData.rejection_reason;
      if (updateData.error_message !== undefined) updateFields.error_message = updateData.error_message;
      if (updateData.error_code !== undefined) updateFields.error_code = updateData.error_code;
      if (updateData.error_type !== undefined) updateFields.error_type = updateData.error_type;
      if (updateData.failure_reason !== undefined) updateFields.failure_reason = updateData.failure_reason;
      if (updateData.is_retryable !== undefined) updateFields.is_retryable = updateData.is_retryable;
      
      // Always update the last_updated timestamp
      updateFields.last_updated = updateData.last_updated || new Date();

      const result = await this.OrderHistoryModel.findByIdAndUpdate(
        id,
        updateFields,
        { new: true, runValidators: true }
      );

      if (result) {
        console.log(`✅ Order ${id} updated comprehensively with fields:`, Object.keys(updateFields));
        return this.orderHistoryDocToInterface(result);
      }
      
      console.warn(`⚠️ Order ${id} not found for comprehensive update`);
      return null;
    } catch (error) {
      console.error('🚨 Failed to update order comprehensively:', error);
      return null;
    }
  }

  async incrementOrderRetryCount(id: string): Promise<boolean> {
    try {
      const result = await this.OrderHistoryModel.findByIdAndUpdate(
        id,
        {
          $inc: { retry_count: 1 },
          last_retry_at: new Date()
        },
        { new: true }
      );
      return !!result;
    } catch (error) {
      console.error('🚨 Failed to increment retry count:', error);
      return false;
    }
  }

  async deleteOrderHistory(id: string): Promise<boolean> {
    try {
      const result = await this.OrderHistoryModel.findByIdAndDelete(id);
      return !!result;
    } catch (error) {
      console.error('🚨 Failed to delete order history:', error);
      return false;
    }
  }

  async getAllOrderHistory(limit: number = 100, offset: number = 0): Promise<OrderHistory[]> {
    try {
      const orders = await this.OrderHistoryModel
        .find({})
        .sort({ executed_at: -1, created_at: -1 })
        .limit(limit)
        .skip(offset);

      return orders.map(order => this.orderHistoryDocToInterface(order));
    } catch (error) {
      console.error('🚨 Failed to get all order history:', error);
      return [];
    }
  }

  async getOrderCountByUserIdWithFilters(userId: number | string, filters: OrderFilters = {}): Promise<number> {
    try {
      // Convert userId to string if it's a number (for compatibility)
      const userIdStr = typeof userId === 'number' ? userId.toString() : userId;
      const query: any = { user_id: new mongoose.Types.ObjectId(userIdStr) };

      // Add same filters as getOrderHistoryByUserIdWithFilters
      if (filters.status) {
        query.status = filters.status;
      }

      if (filters.symbol) {
        query.symbol = { $regex: filters.symbol, $options: 'i' };
      }

      if (filters.brokerName) {
        query.broker_name = filters.brokerName;
      }

      if (filters.action) {
        query.action = filters.action;
      }

      if (filters.startDate || filters.endDate) {
        query.executed_at = {};
        if (filters.startDate) {
          query.executed_at.$gte = new Date(filters.startDate);
        }
        if (filters.endDate) {
          query.executed_at.$lte = new Date(filters.endDate);
        }
      }

      if (filters.search) {
        query.$or = [
          { symbol: { $regex: filters.search, $options: 'i' } },
          { broker_order_id: { $regex: filters.search, $options: 'i' } },
          { remarks: { $regex: filters.search, $options: 'i' } }
        ];
      }

      return await this.OrderHistoryModel.countDocuments(query);
    } catch (error) {
      console.error('🚨 Failed to get order count:', error);
      return 0;
    }
  }

  // Notification Preferences
  async saveUserNotificationPreferences(preferences: any): Promise<boolean> {
    // For now, return true - can implement notification preferences collection later
    console.log('📱 Notification preferences saved (placeholder):', preferences.userId);
    return true;
  }

  async getUserNotificationPreferences(userId: string): Promise<any> {
    // For now, return default preferences - can implement notification preferences collection later
    return {
      userId,
      pushEnabled: true,
      emailEnabled: true,
      smsEnabled: false,
      orderStatusChanges: true,
      orderExecutions: true,
      orderRejections: true,
      portfolioAlerts: true,
      marketAlerts: false,
      quietHours: {
        enabled: false,
        startTime: '22:00',
        endTime: '08:00'
      }
    };
  }
}
