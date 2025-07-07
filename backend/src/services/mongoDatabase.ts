import mongoose, { Schema, Document, Model } from 'mongoose';
import crypto from 'crypto';
import {
  IDatabaseAdapter,
  User,
  CreateUserData,
  UpdateUserData,
  ConnectedAccount,
  CreateConnectedAccountData,
  OrderHistory,
  CreateOrderHistoryData,
  OrderFilters
} from '../interfaces/IDatabaseAdapter';

// MongoDB Document Interfaces
interface UserDocument extends Document {
  email: string;
  name: string;
  password: string;
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
  status: 'SUBMITTED' | 'PENDING' | 'EXECUTED' | 'REJECTED' | 'CANCELLED' | 'PARTIALLY_FILLED' | 'FAILED';
  exchange: string;
  product_type: string;
  remarks: string;
  executed_at: Date;
  created_at: Date;
  // New fields for failed order tracking
  error_type?: string;
  error_code?: string;
  error_message?: string;
  retryable?: boolean;
  action_required?: string;
  retry_count?: number;
  raw_response?: string;
}

// MongoDB Schemas
const UserSchema = new Schema<UserDocument>({
  email: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  password: { type: String, required: true },
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
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
});

const OrderHistorySchema = new Schema<OrderHistoryDocument>({
  user_id: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  account_id: { type: Schema.Types.ObjectId, ref: 'ConnectedAccount', required: true },
  broker_name: { type: String, required: true },
  broker_order_id: { type: String, required: true, index: true },
  symbol: { type: String, required: true },
  action: { type: String, enum: ['BUY', 'SELL'], required: true },
  quantity: { type: Number, required: true },
  price: { type: Number, required: true },
  order_type: { type: String, enum: ['MARKET', 'LIMIT', 'SL-LIMIT', 'SL-MARKET'], required: true },
  status: {
    type: String,
    enum: ['SUBMITTED', 'PENDING', 'EXECUTED', 'REJECTED', 'CANCELLED', 'PARTIALLY_FILLED', 'FAILED'],
    default: 'SUBMITTED'
  },
  exchange: { type: String, default: 'NSE' },
  product_type: { type: String, default: 'C' },
  remarks: { type: String, default: '' },
  executed_at: { type: Date, required: true },
  created_at: { type: Date, default: Date.now },
  // New fields for failed order tracking
  error_type: { type: String },
  error_code: { type: String },
  error_message: { type: String },
  retryable: { type: Boolean, default: false },
  action_required: { type: String },
  retry_count: { type: Number, default: 0 },
  raw_response: { type: String }
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
      const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/copytrade';
      
      console.log('🔗 Connecting to MongoDB...');
      await mongoose.connect(mongoUri);
      
      console.log('✅ MongoDB connected successfully');
      console.log('📊 Database:', mongoose.connection.db?.databaseName);

      // Run migrations
      await this.runMigrations();

      this.isInitialized = true;
    } catch (error) {
      console.error('🚨 MongoDB connection failed:', error);
      throw error;
    }
  }

  private async runMigrations(): Promise<void> {
    try {
      const { runMigration } = await import('../migrations/001_allow_multiple_broker_accounts');
      await runMigration('mongodb');
    } catch (error) {
      console.error('🚨 Migration failed:', error);
      // Don't throw - allow app to continue with existing schema
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

  isConnected(): boolean {
    return this.isInitialized && mongoose.connection.readyState === 1;
  }

  // Encryption helpers
  private encrypt(text: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(this.encryptionKey, 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
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

    // Handle account_id properly - if it's populated (object), use the _id, otherwise use as string
    let accountId: string;
    if (typeof accountData === 'object' && accountData && accountData._id) {
      accountId = accountData._id.toString();
    } else if (typeof doc.account_id === 'string') {
      accountId = doc.account_id;
    } else if (doc.account_id && typeof doc.account_id.toString === 'function') {
      accountId = doc.account_id.toString();
    } else {
      // Fallback for corrupted data
      console.warn('⚠️ Corrupted account_id data found:', doc.account_id);
      accountId = 'unknown';
    }

    const result: any = {
      id: (doc._id as mongoose.Types.ObjectId).toString(),
      user_id: doc.user_id.toString(),
      account_id: accountId,
      broker_name: doc.broker_name,
      broker_order_id: doc.broker_order_id,
      symbol: doc.symbol,
      action: doc.action,
      quantity: doc.quantity,
      price: doc.price,
      order_type: doc.order_type,
      status: doc.status,
      exchange: doc.exchange,
      product_type: doc.product_type,
      remarks: doc.remarks,
      executed_at: doc.executed_at.toISOString(),
      created_at: doc.created_at.toISOString()
    };

    // Add error tracking fields only if they exist
    if (doc.error_type) result.error_type = doc.error_type;
    if (doc.error_code) result.error_code = doc.error_code;
    if (doc.error_message) result.error_message = doc.error_message;
    if (doc.retryable !== undefined) result.retryable = doc.retryable;
    if (doc.action_required) result.action_required = doc.action_required;
    if (doc.retry_count !== undefined) result.retry_count = doc.retry_count;
    if (doc.raw_response) result.raw_response = doc.raw_response;

    // Debug logging for orders with FAILED or REJECTED status
    if (doc.status === 'FAILED' || doc.status === 'REJECTED') {
      console.log('🔍 MongoDB Debug - Failed/Rejected Order:', {
        broker_order_id: doc.broker_order_id,
        status: doc.status,
        error_type: doc.error_type,
        error_code: doc.error_code,
        error_message: doc.error_message,
        hasErrorMessage: !!doc.error_message,
        errorMessageLength: doc.error_message ? doc.error_message.length : 0
      });
    }

    // Add account information if populated
    if (accountInfo) result.account_info = accountInfo;

    return result;
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

  async findUserByEmail(email: string): Promise<User | null> {
    try {
      const user = await this.UserModel.findOne({ email });
      return user ? this.userDocToInterface(user) : null;
    } catch (error) {
      console.error('🚨 Failed to find user by email:', error);
      return null;
    }
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
      console.log('💾 Creating connected account in MongoDB:', {
        broker_name: accountData.broker_name,
        account_id: accountData.account_id,
        user_name: accountData.user_name,
        exchanges: accountData.exchanges,
        products: accountData.products
      });

      const encryptedCredentials = this.encrypt(JSON.stringify(accountData.credentials));

      const accountDoc = new this.ConnectedAccountModel({
        user_id: new mongoose.Types.ObjectId(accountData.user_id.toString()),
        broker_name: accountData.broker_name,
        account_id: accountData.account_id,
        user_name: accountData.user_name,
        email: accountData.email,
        broker_display_name: accountData.broker_display_name,
        exchanges: JSON.stringify(accountData.exchanges),
        products: JSON.stringify(accountData.products),
        encrypted_credentials: encryptedCredentials
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
      console.log('🔍 Fetching connected accounts for user:', userId);

      const accounts = await this.ConnectedAccountModel.find({
        user_id: new mongoose.Types.ObjectId(userId)
      }).sort({ created_at: -1 });

      console.log(`📊 Found ${accounts.length} connected accounts in database`);

      const transformedAccounts = accounts.map(account => this.connectedAccountDocToInterface(account));

      console.log('🔄 Transformed accounts:', transformedAccounts.map(acc => ({
        id: acc.id,
        broker_name: acc.broker_name,
        account_id: acc.account_id,
        user_name: acc.user_name
      })));

      return transformedAccounts;
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

      if (accountData.credentials) {
        updateData.encrypted_credentials = this.encrypt(JSON.stringify(accountData.credentials));
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
        // Include error tracking fields
        error_type: orderData.error_type,
        error_code: orderData.error_code,
        error_message: orderData.error_message,
        retryable: orderData.retryable,
        action_required: orderData.action_required,
        retry_count: orderData.retry_count || 0,
        raw_response: orderData.raw_response
      });

      const savedOrder = await orderDoc.save();
      console.log('✅ Order history created successfully:', orderData.broker_order_id);

      // Debug logging for failed/rejected orders
      if (orderData.status === 'FAILED' || orderData.status === 'REJECTED') {
        console.log('💾 Failed order saved with error details:', {
          broker_order_id: orderData.broker_order_id,
          status: orderData.status,
          error_type: orderData.error_type,
          error_code: orderData.error_code,
          error_message: orderData.error_message,
          retryable: orderData.retryable
        });
      }

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

  async updateOrderStatus(id: string, status: 'SUBMITTED' | 'PENDING' | 'EXECUTED' | 'REJECTED' | 'CANCELLED' | 'PARTIALLY_FILLED' | 'FAILED'): Promise<boolean> {
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

  async updateOrderStatusByBrokerOrderId(brokerOrderId: string, status: 'SUBMITTED' | 'PENDING' | 'EXECUTED' | 'REJECTED' | 'CANCELLED' | 'PARTIALLY_FILLED' | 'FAILED'): Promise<boolean> {
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
