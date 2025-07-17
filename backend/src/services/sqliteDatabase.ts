import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { AccountStatus } from '../interfaces/IDatabaseAdapter';

export interface User {
  id: number;
  email: string;
  name: string;
  password: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserData {
  email: string;
  name: string;
  password: string;
}

export interface UpdateUserData {
  email?: string;
  name?: string;
  password?: string;
}

export interface ConnectedAccount {
  id: number;
  user_id: number;
  broker_name: string;
  account_id: string;
  user_name: string;
  email: string;
  broker_display_name: string;
  exchanges: string; // JSON string
  products: string; // JSON string
  encrypted_credentials: string; // Encrypted JSON
  account_status: AccountStatus; // 'ACTIVE' | 'INACTIVE' | 'PROCEED_TO_OAUTH'
  token_expiry_time: string | null; // ISO string or null for infinity (Shoonya)
  created_at: string;
  updated_at: string;
}

export interface CreateConnectedAccountData {
  user_id: number;
  broker_name: string;
  account_id: string;
  user_name: string;
  email: string;
  broker_display_name: string;
  exchanges: string[];
  products: any[];
  credentials: any; // Will be encrypted before storage
  account_status: string; // 'ACTIVE' | 'INACTIVE' | 'PROCEED_TO_OAUTH'
  token_expiry_time?: string | null; // ISO string or null for infinity (Shoonya)
}

export interface OrderHistory {
  id: number;
  user_id: number;
  account_id: number;
  broker_name: string;
  broker_order_id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  status: 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED';
  exchange: string;
  product_type: string;
  remarks: string;
  executed_at: string;
  created_at: string;
}

export interface CreateOrderHistoryData {
  user_id: number;
  account_id: number;
  broker_name: string;
  broker_order_id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  order_type: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  status?: 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED';
  exchange?: string;
  product_type?: string;
  remarks?: string;
  executed_at: string;
}

export class SQLiteUserDatabase {
  private db: Database.Database;
  private dbPath: string;
  private encryptionKey: string;

  constructor() {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dbPath = path.join(dataDir, 'users.db');
    this.db = new Database(this.dbPath);

    // Initialize encryption key from environment or generate one
    this.encryptionKey = process.env.JWT_SECRET || 'default-encryption-key-change-in-production';

    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = memory');

    this.initializeDatabase();
    console.log('✅ SQLite database initialized at:', this.dbPath);
  }

  // Encryption utilities for storing sensitive data
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
    const parts = encryptedText.split(':');
    if (parts.length !== 2) {
      throw new Error('Invalid encrypted data format');
    }
    const [ivHex, encrypted] = parts;
    if (!ivHex || !encrypted) {
      throw new Error('Invalid encrypted data format');
    }
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(algorithm, key, iv);

    let decrypted = decipher.update(encrypted, 'hex', 'utf8') as string;
    decrypted += decipher.final('utf8') as string;

    return decrypted;
  }

  private async runMigrations(): Promise<void> {
    try {
      const { runMigration } = await import('../migrations/001_allow_multiple_broker_accounts');
      await runMigration('sqlite', this.db);
    } catch (error) {
      console.error('🚨 Migration failed:', error);
      // Don't throw - allow app to continue with existing schema
    }
  }

  private initializeDatabase(): void {
    // Create users table with proper constraints
    const createUsersTable = `
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL COLLATE NOCASE,
        name TEXT NOT NULL,
        password TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Create indexes for better performance
    const createEmailIndex = `
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email 
      ON users(email COLLATE NOCASE)
    `;

    const createNameIndex = `
      CREATE INDEX IF NOT EXISTS idx_users_name 
      ON users(name)
    `;

    // Create trigger to update updated_at timestamp
    const createUpdateTrigger = `
      CREATE TRIGGER IF NOT EXISTS update_users_timestamp
      AFTER UPDATE ON users
      BEGIN
        UPDATE users SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `;

    // Create connected_accounts table
    const createConnectedAccountsTable = `
      CREATE TABLE IF NOT EXISTS connected_accounts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        broker_name TEXT NOT NULL,
        account_id TEXT NOT NULL,
        user_name TEXT NOT NULL,
        email TEXT NOT NULL,
        broker_display_name TEXT NOT NULL,
        exchanges TEXT NOT NULL, -- JSON array as string
        products TEXT NOT NULL, -- JSON array as string
        encrypted_credentials TEXT NOT NULL, -- Encrypted credentials JSON
        account_status TEXT NOT NULL DEFAULT 'INACTIVE' CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'PROCEED_TO_OAUTH')),
        token_expiry_time DATETIME DEFAULT NULL, -- NULL for infinity (Shoonya)
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, broker_name, account_id) -- Prevent duplicate account IDs per user, allow multiple accounts per broker
      )
    `;

    // Create indexes for connected_accounts
    const createAccountsUserIndex = `
      CREATE INDEX IF NOT EXISTS idx_connected_accounts_user_id
      ON connected_accounts(user_id)
    `;

    const createAccountsBrokerIndex = `
      CREATE INDEX IF NOT EXISTS idx_connected_accounts_broker
      ON connected_accounts(user_id, broker_name)
    `;

    // Create trigger to update connected_accounts updated_at timestamp
    const createAccountsUpdateTrigger = `
      CREATE TRIGGER IF NOT EXISTS update_connected_accounts_timestamp
      AFTER UPDATE ON connected_accounts
      BEGIN
        UPDATE connected_accounts SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `;

    // Create order_history table
    const createOrderHistoryTable = `
      CREATE TABLE IF NOT EXISTS order_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        account_id INTEGER NOT NULL,
        broker_name TEXT NOT NULL,
        broker_order_id TEXT NOT NULL,
        symbol TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
        quantity INTEGER NOT NULL,
        price REAL,
        order_type TEXT NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'SL-LIMIT', 'SL-MARKET', 'BRACKET', 'COVER', 'ICEBERG', 'TRAILING_SL')),
        status TEXT NOT NULL DEFAULT 'PLACED' CHECK (status IN ('PLACED', 'PENDING', 'EXECUTED', 'CANCELLED', 'REJECTED', 'PARTIALLY_FILLED')),
        exchange TEXT NOT NULL DEFAULT 'NSE',
        product_type TEXT NOT NULL DEFAULT 'C',
        remarks TEXT,
        executed_at DATETIME NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (account_id) REFERENCES connected_accounts(id) ON DELETE CASCADE
      )
    `;

    // Create indexes for order_history
    const createOrderHistoryUserIndex = `
      CREATE INDEX IF NOT EXISTS idx_order_history_user_id
      ON order_history(user_id)
    `;

    const createOrderHistoryAccountIndex = `
      CREATE INDEX IF NOT EXISTS idx_order_history_account_id
      ON order_history(account_id)
    `;

    const createOrderHistoryDateIndex = `
      CREATE INDEX IF NOT EXISTS idx_order_history_executed_at
      ON order_history(executed_at DESC)
    `;

    // Create push_subscriptions table
    const createPushSubscriptionsTable = `
      CREATE TABLE IF NOT EXISTS push_subscriptions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        endpoint TEXT NOT NULL,
        p256dh_key TEXT NOT NULL,
        auth_key TEXT NOT NULL,
        user_agent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, endpoint)
      )
    `;

    // Create order_templates table for saving order templates
    const createOrderTemplatesTable = `
      CREATE TABLE IF NOT EXISTS order_templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        symbol TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
        quantity INTEGER NOT NULL,
        order_type TEXT NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'SL-LIMIT', 'SL-MARKET', 'BRACKET', 'COVER', 'ICEBERG', 'TRAILING_SL')),
        price REAL,
        trigger_price REAL,
        stop_loss REAL,
        take_profit REAL,
        exchange TEXT NOT NULL DEFAULT 'NSE',
        product_type TEXT NOT NULL DEFAULT 'C',
        validity TEXT NOT NULL DEFAULT 'DAY' CHECK (validity IN ('DAY', 'IOC', 'GTD')),
        iceberg_quantity INTEGER,
        trail_amount REAL,
        trail_percent REAL,
        is_active BOOLEAN DEFAULT 1,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    // Create advanced_orders table for complex order types
    const createAdvancedOrdersTable = `
      CREATE TABLE IF NOT EXISTS advanced_orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        parent_order_id INTEGER,
        order_group_id TEXT,
        symbol TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('BUY', 'SELL')),
        quantity INTEGER NOT NULL,
        order_type TEXT NOT NULL CHECK (order_type IN ('MARKET', 'LIMIT', 'SL-LIMIT', 'SL-MARKET', 'BRACKET', 'COVER', 'ICEBERG', 'TRAILING_SL')),
        price REAL,
        trigger_price REAL,
        stop_loss REAL,
        take_profit REAL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACTIVE', 'TRIGGERED', 'EXECUTED', 'CANCELLED', 'EXPIRED')),
        exchange TEXT NOT NULL DEFAULT 'NSE',
        product_type TEXT NOT NULL DEFAULT 'C',
        validity TEXT NOT NULL DEFAULT 'DAY' CHECK (validity IN ('DAY', 'IOC', 'GTD')),
        expiry_date DATETIME,
        iceberg_quantity INTEGER,
        iceberg_executed INTEGER DEFAULT 0,
        trail_amount REAL,
        trail_percent REAL,
        trail_trigger_price REAL,
        condition_type TEXT CHECK (condition_type IN ('PRICE_ABOVE', 'PRICE_BELOW', 'TIME_BASED', 'VOLUME_BASED')),
        condition_value REAL,
        is_bracket_order BOOLEAN DEFAULT 0,
        bracket_stop_loss REAL,
        bracket_take_profit REAL,
        remarks TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        executed_at DATETIME,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (parent_order_id) REFERENCES advanced_orders(id) ON DELETE CASCADE
      )
    `;

    // Create order_modifications table for tracking order changes
    const createOrderModificationsTable = `
      CREATE TABLE IF NOT EXISTS order_modifications (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        order_id INTEGER NOT NULL,
        broker_order_id TEXT NOT NULL,
        modification_type TEXT NOT NULL CHECK (modification_type IN ('PRICE', 'QUANTITY', 'TRIGGER_PRICE', 'STOP_LOSS', 'TAKE_PROFIT', 'CANCEL')),
        old_value REAL,
        new_value REAL,
        status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED')),
        error_message TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      )
    `;

    // Create indexes for push_subscriptions
    const createPushSubscriptionsUserIndex = `
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id
      ON push_subscriptions(user_id)
    `;

    const createPushSubscriptionsEndpointIndex = `
      CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint
      ON push_subscriptions(endpoint)
    `;

    // Create notification_preferences table
    const createNotificationPreferencesTable = `
      CREATE TABLE IF NOT EXISTS notification_preferences (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        push_enabled BOOLEAN DEFAULT 1,
        email_enabled BOOLEAN DEFAULT 0,
        sms_enabled BOOLEAN DEFAULT 0,
        order_status_changes BOOLEAN DEFAULT 1,
        order_executions BOOLEAN DEFAULT 1,
        order_rejections BOOLEAN DEFAULT 1,
        portfolio_alerts BOOLEAN DEFAULT 1,
        market_alerts BOOLEAN DEFAULT 0,
        quiet_hours_enabled BOOLEAN DEFAULT 0,
        quiet_hours_start TEXT DEFAULT '22:00',
        quiet_hours_end TEXT DEFAULT '08:00',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id)
      )
    `;

    // Create index for notification_preferences
    const createNotificationPreferencesUserIndex = `
      CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id
      ON notification_preferences(user_id)
    `;

    // Create trigger to update notification_preferences updated_at timestamp
    const createNotificationPreferencesUpdateTrigger = `
      CREATE TRIGGER IF NOT EXISTS update_notification_preferences_timestamp
      AFTER UPDATE ON notification_preferences
      BEGIN
        UPDATE notification_preferences SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
      END
    `;

    try {
      this.db.exec(createUsersTable);
      this.db.exec(createEmailIndex);
      this.db.exec(createNameIndex);
      this.db.exec(createUpdateTrigger);
      this.db.exec(createConnectedAccountsTable);
      this.db.exec(createAccountsUserIndex);
      this.db.exec(createAccountsBrokerIndex);
      this.db.exec(createAccountsUpdateTrigger);
      this.db.exec(createOrderHistoryTable);
      this.db.exec(createOrderHistoryUserIndex);
      this.db.exec(createOrderHistoryAccountIndex);
      this.db.exec(createOrderHistoryDateIndex);
      this.db.exec(createPushSubscriptionsTable);
      this.db.exec(createPushSubscriptionsUserIndex);
      this.db.exec(createPushSubscriptionsEndpointIndex);
      this.db.exec(createOrderTemplatesTable);
      this.db.exec(createAdvancedOrdersTable);
      this.db.exec(createOrderModificationsTable);
      this.db.exec(createNotificationPreferencesTable);
      this.db.exec(createNotificationPreferencesUserIndex);
      this.db.exec(createNotificationPreferencesUpdateTrigger);
      console.log('✅ Database tables and indexes created successfully');
    } catch (error) {
      console.error('🚨 Failed to initialize database:', error);
      throw error;
    }
  }

  // Create a new user
  createUser(userData: CreateUserData): User {
    const insertUser = this.db.prepare(`
      INSERT INTO users (email, name, password)
      VALUES (?, ?, ?)
    `);

    try {
      const result = insertUser.run(userData.email, userData.name, userData.password);
      const userId = result.lastInsertRowid as number;
      
      const user = this.findUserById(userId);
      if (!user) {
        throw new Error('Failed to retrieve created user');
      }

      console.log('✅ User created successfully:', user.email);
      return user;
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('User already exists with this email');
      }
      console.error('🚨 Failed to create user:', error);
      throw error;
    }
  }

  // Find user by email
  findUserByEmail(email: string): User | null {
    const selectUser = this.db.prepare(`
      SELECT * FROM users WHERE email = ? COLLATE NOCASE
    `);

    try {
      const user = selectUser.get(email) as User | undefined;
      return user || null;
    } catch (error) {
      console.error('🚨 Failed to find user by email:', error);
      throw error;
    }
  }

  // Find user by ID
  findUserById(id: number): User | null {
    const selectUser = this.db.prepare(`
      SELECT * FROM users WHERE id = ?
    `);

    try {
      const user = selectUser.get(id) as User | undefined;
      return user || null;
    } catch (error) {
      console.error('🚨 Failed to find user by ID:', error);
      throw error;
    }
  }

  // Update user
  updateUser(id: number, updates: UpdateUserData): User | null {
    const user = this.findUserById(id);
    if (!user) {
      return null;
    }

    const updateFields: string[] = [];
    const updateValues: any[] = [];

    if (updates.email !== undefined) {
      updateFields.push('email = ?');
      updateValues.push(updates.email);
    }
    if (updates.name !== undefined) {
      updateFields.push('name = ?');
      updateValues.push(updates.name);
    }
    if (updates.password !== undefined) {
      updateFields.push('password = ?');
      updateValues.push(updates.password);
    }

    if (updateFields.length === 0) {
      return user; // No updates needed
    }

    updateValues.push(id); // Add ID for WHERE clause

    const updateUser = this.db.prepare(`
      UPDATE users SET ${updateFields.join(', ')} WHERE id = ?
    `);

    try {
      const result = updateUser.run(...updateValues);
      
      if (result.changes === 0) {
        return null;
      }

      const updatedUser = this.findUserById(id);
      console.log('✅ User updated successfully:', updatedUser?.email);
      return updatedUser;
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error('Email already exists');
      }
      console.error('🚨 Failed to update user:', error);
      throw error;
    }
  }

  // Delete user
  deleteUser(id: number): boolean {
    const deleteUser = this.db.prepare(`
      DELETE FROM users WHERE id = ?
    `);

    try {
      const result = deleteUser.run(id);
      const deleted = result.changes > 0;
      
      if (deleted) {
        console.log('✅ User deleted successfully, ID:', id);
      }
      
      return deleted;
    } catch (error) {
      console.error('🚨 Failed to delete user:', error);
      throw error;
    }
  }

  // Get all users
  getAllUsers(): User[] {
    const selectAllUsers = this.db.prepare(`
      SELECT * FROM users ORDER BY created_at DESC
    `);

    try {
      return selectAllUsers.all() as User[];
    } catch (error) {
      console.error('🚨 Failed to get all users:', error);
      throw error;
    }
  }

  // Get user count
  getUserCount(): number {
    const countUsers = this.db.prepare(`
      SELECT COUNT(*) as count FROM users
    `);

    try {
      const result = countUsers.get() as { count: number };
      return result.count;
    } catch (error) {
      console.error('🚨 Failed to get user count:', error);
      throw error;
    }
  }

  // Search users by name or email
  searchUsers(query: string): User[] {
    const searchUsers = this.db.prepare(`
      SELECT * FROM users 
      WHERE name LIKE ? OR email LIKE ? 
      ORDER BY created_at DESC
    `);

    try {
      const searchPattern = `%${query}%`;
      return searchUsers.all(searchPattern, searchPattern) as User[];
    } catch (error) {
      console.error('🚨 Failed to search users:', error);
      throw error;
    }
  }

  // Create database backup
  createBackup(): string {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(path.dirname(this.dbPath), `users-backup-${timestamp}.db`);

    try {
      this.db.backup(backupPath);
      console.log('✅ Database backup created:', backupPath);
      return backupPath;
    } catch (error) {
      console.error('🚨 Failed to create backup:', error);
      throw error;
    }
  }

  // Get database statistics
  getStats(): { userCount: number; dbSize: string; lastBackup?: string } {
    try {
      const userCount = this.getUserCount();
      const stats = fs.statSync(this.dbPath);
      const dbSize = `${(stats.size / 1024).toFixed(2)} KB`;

      return {
        userCount,
        dbSize,
      };
    } catch (error) {
      console.error('🚨 Failed to get database stats:', error);
      throw error;
    }
  }

  // Close database connection
  close(): void {
    try {
      this.db.close();
      console.log('✅ Database connection closed');
    } catch (error) {
      console.error('🚨 Failed to close database:', error);
    }
  }

  // Execute raw SQL (for advanced operations)
  executeRaw(sql: string, params: any[] = []): any {
    try {
      const stmt = this.db.prepare(sql);
      return stmt.all(...params);
    } catch (error) {
      console.error('🚨 Failed to execute raw SQL:', error);
      throw error;
    }
  }

  // ==================== CONNECTED ACCOUNTS METHODS ====================

  // Create a connected account
  createConnectedAccount(accountData: CreateConnectedAccountData): ConnectedAccount {
    const insertAccount = this.db.prepare(`
      INSERT OR REPLACE INTO connected_accounts (
        user_id, broker_name, account_id, user_name, email,
        broker_display_name, exchanges, products, encrypted_credentials,
        account_status, token_expiry_time
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      // Encrypt credentials before storing
      const encryptedCredentials = this.encrypt(JSON.stringify(accountData.credentials));

      const result = insertAccount.run(
        accountData.user_id,
        accountData.broker_name,
        accountData.account_id,
        accountData.user_name,
        accountData.email,
        accountData.broker_display_name,
        JSON.stringify(accountData.exchanges),
        JSON.stringify(accountData.products),
        encryptedCredentials,
        accountData.account_status,
        accountData.token_expiry_time
      );

      const accountId = result.lastInsertRowid as number;
      const account = this.getConnectedAccountById(accountId);

      if (!account) {
        throw new Error('Failed to retrieve created connected account');
      }

      console.log('✅ Connected account created successfully:', accountData.broker_name);
      return account;
    } catch (error: any) {
      if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
        throw new Error(`Account already exists for ${accountData.broker_name}`);
      }
      console.error('🚨 Failed to create connected account:', error);
      throw error;
    }
  }

  // Get connected account by ID
  getConnectedAccountById(id: number): ConnectedAccount | null {
    const selectAccount = this.db.prepare(`
      SELECT * FROM connected_accounts WHERE id = ?
    `);

    try {
      return selectAccount.get(id) as ConnectedAccount || null;
    } catch (error) {
      console.error('🚨 Failed to get connected account by ID:', error);
      throw error;
    }
  }

  // Get connected account by broker account ID
  getConnectedAccountByAccountId(accountId: string): ConnectedAccount | null {
    const selectAccount = this.db.prepare(`
      SELECT * FROM connected_accounts WHERE account_id = ?
    `);

    try {
      return selectAccount.get(accountId) as ConnectedAccount || null;
    } catch (error) {
      console.error('🚨 Failed to get connected account by account ID:', error);
      throw error;
    }
  }

  // Get all connected accounts for a user
  getConnectedAccountsByUserId(userId: number): ConnectedAccount[] {
    const selectAccounts = this.db.prepare(`
      SELECT * FROM connected_accounts
      WHERE user_id = ?
      ORDER BY created_at DESC
    `);

    try {
      return selectAccounts.all(userId) as ConnectedAccount[];
    } catch (error) {
      console.error('🚨 Failed to get connected accounts by user ID:', error);
      throw error;
    }
  }

  // Get decrypted credentials for an account
  getAccountCredentials(accountId: number): any | null {
    const selectAccount = this.db.prepare(`
      SELECT encrypted_credentials FROM connected_accounts WHERE id = ?
    `);

    try {
      const result = selectAccount.get(accountId) as { encrypted_credentials: string } | undefined;
      if (!result) {
        return null;
      }

      const decryptedCredentials = this.decrypt(result.encrypted_credentials);
      return JSON.parse(decryptedCredentials);
    } catch (error) {
      console.error('🚨 Failed to get account credentials:', error);
      throw error;
    }
  }

  // Note: updateAccountStatus method removed - we no longer store active status in database
  // Active status is always determined by real-time session validation

  // Delete connected account
  deleteConnectedAccount(accountId: number): boolean {
    const deleteAccount = this.db.prepare(`
      DELETE FROM connected_accounts WHERE id = ?
    `);

    try {
      const result = deleteAccount.run(accountId);
      const deleted = result.changes > 0;

      if (deleted) {
        console.log('✅ Connected account deleted successfully, ID:', accountId);
      }

      return deleted;
    } catch (error) {
      console.error('🚨 Failed to delete connected account:', error);
      throw error;
    }
  }



  // Get connected account by user and broker
  getConnectedAccountByUserAndBroker(userId: number, brokerName: string): ConnectedAccount | null {
    const selectAccount = this.db.prepare(`
      SELECT * FROM connected_accounts
      WHERE user_id = ? AND broker_name = ?
    `);

    try {
      return selectAccount.get(userId, brokerName) as ConnectedAccount || null;
    } catch (error) {
      console.error('🚨 Failed to get connected account by user and broker:', error);
      throw error;
    }
  }

  // ==================== ORDER HISTORY METHODS ====================

  // Create order history record
  createOrderHistory(orderData: CreateOrderHistoryData): OrderHistory {
    const insertOrder = this.db.prepare(`
      INSERT INTO order_history (
        user_id, account_id, broker_name, broker_order_id, symbol, action,
        quantity, price, order_type, status, exchange, product_type, remarks, executed_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const result = insertOrder.run(
        orderData.user_id,
        orderData.account_id,
        orderData.broker_name,
        orderData.broker_order_id,
        orderData.symbol,
        orderData.action,
        orderData.quantity,
        orderData.price,
        orderData.order_type,
        orderData.status || 'EXECUTED',
        orderData.exchange || 'NSE',
        orderData.product_type || 'C',
        orderData.remarks || '',
        orderData.executed_at
      );

      const orderId = result.lastInsertRowid as number;
      const order = this.getOrderHistoryById(orderId);

      if (!order) {
        throw new Error('Failed to retrieve created order history');
      }

      console.log('✅ Order history created successfully:', orderData.broker_order_id);
      return order;
    } catch (error: any) {
      console.error('🚨 Failed to create order history:', error);
      throw error;
    }
  }

  // Get order history for a user
  getOrderHistory(userId: number): OrderHistory[] {
    const getOrders = this.db.prepare(`
      SELECT * FROM order_history
      WHERE user_id = ?
      ORDER BY executed_at DESC
    `);

    try {
      return getOrders.all(userId) as OrderHistory[];
    } catch (error) {
      console.error('Failed to get order history:', error);
      return [];
    }
  }

  // Get all order history (for monitoring service)
  getAllOrderHistory(): OrderHistory[] {
    const getOrders = this.db.prepare(`
      SELECT * FROM order_history
      ORDER BY executed_at DESC
    `);

    try {
      return getOrders.all() as OrderHistory[];
    } catch (error) {
      console.error('Failed to get all order history:', error);
      return [];
    }
  }

  // Get order history by ID
  getOrderHistoryById(id: number): OrderHistory | null {
    const selectOrder = this.db.prepare(`
      SELECT * FROM order_history WHERE id = ?
    `);

    try {
      return selectOrder.get(id) as OrderHistory || null;
    } catch (error) {
      console.error('🚨 Failed to get order history by ID:', error);
      throw error;
    }
  }

  // Get order history for a user
  getOrderHistoryByUserId(userId: number, limit: number = 50, offset: number = 0): OrderHistory[] {
    const selectOrders = this.db.prepare(`
      SELECT * FROM order_history
      WHERE user_id = ?
      ORDER BY executed_at DESC, created_at DESC
      LIMIT ? OFFSET ?
    `);

    try {
      return selectOrders.all(userId, limit, offset) as OrderHistory[];
    } catch (error) {
      console.error('🚨 Failed to get order history by user ID:', error);
      throw error;
    }
  }

  // Get order history for a specific account
  getOrderHistoryByAccountId(accountId: number, limit: number = 50, offset: number = 0): OrderHistory[] {
    const selectOrders = this.db.prepare(`
      SELECT * FROM order_history
      WHERE account_id = ?
      ORDER BY executed_at DESC, created_at DESC
      LIMIT ? OFFSET ?
    `);

    try {
      return selectOrders.all(accountId, limit, offset) as OrderHistory[];
    } catch (error) {
      console.error('🚨 Failed to get order history by account ID:', error);
      throw error;
    }
  }

  // Get order count for a user
  getOrderCountByUserId(userId: number): number {
    const countOrders = this.db.prepare(`
      SELECT COUNT(*) as count FROM order_history WHERE user_id = ?
    `);

    try {
      const result = countOrders.get(userId) as { count: number };
      return result.count;
    } catch (error) {
      console.error('🚨 Failed to get order count by user ID:', error);
      throw error;
    }
  }

  // Get database instance for advanced operations
  getDatabase(): any {
    return this.db;
  }

  // Execute transaction
  executeTransaction(callback: () => void): void {
    this.db.transaction(callback)();
  }

  // Update order status (for when we get actual execution updates)
  updateOrderStatus(brokerOrderId: string, status: 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED', executedPrice?: number): boolean {
    const updateOrder = this.db.prepare(`
      UPDATE order_history
      SET status = ?, price = COALESCE(?, price)
      WHERE broker_order_id = ?
    `);

    try {
      const result = updateOrder.run(status, executedPrice, brokerOrderId);
      const updated = result.changes > 0;

      if (updated) {
        console.log(`✅ Order status updated: ${brokerOrderId} -> ${status}`);
      }

      return updated;
    } catch (error) {
      console.error('🚨 Failed to update order status:', error);
      throw error;
    }
  }

  // Get order by broker order ID
  getOrderByBrokerOrderId(brokerOrderId: string): OrderHistory | null {
    const selectOrder = this.db.prepare(`
      SELECT * FROM order_history WHERE broker_order_id = ?
    `);

    try {
      return selectOrder.get(brokerOrderId) as OrderHistory || null;
    } catch (error) {
      console.error('🚨 Failed to get order by broker order ID:', error);
      throw error;
    }
  }

  // Get order history with filters and search
  getOrderHistoryByUserIdWithFilters(
    userId: number | string,
    limit: number = 50,
    offset: number = 0,
    filters: {
      status?: string;
      symbol?: string;
      brokerName?: string;
      accountIds?: string[]; // Array of account IDs to filter by
      startDate?: string;
      endDate?: string;
      action?: 'BUY' | 'SELL';
      search?: string;
    }
  ): OrderHistory[] {
    // Convert string userId to number for SQLite
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    let query = `
      SELECT oh.*, ca.broker_name as account_broker_name, ca.account_id as broker_account_id
      FROM order_history oh
      LEFT JOIN connected_accounts ca ON oh.account_id = ca.id
      WHERE oh.user_id = ?
    `;
    const params: any[] = [numericUserId];

    // Add filters
    if (filters.status) {
      query += ` AND oh.status = ?`;
      params.push(filters.status);
    }

    if (filters.symbol) {
      query += ` AND oh.symbol LIKE ?`;
      params.push(`%${filters.symbol}%`);
    }

    if (filters.brokerName) {
      query += ` AND oh.broker_name = ?`;
      params.push(filters.brokerName);
    }

    // Account-based filtering - filter by specific account IDs
    if (filters.accountIds && filters.accountIds.length > 0) {
      const accountPlaceholders = filters.accountIds.map(() => '?').join(',');
      query += ` AND oh.account_id IN (${accountPlaceholders})`;
      params.push(...filters.accountIds.map(id => parseInt(id)));
    }

    if (filters.action) {
      query += ` AND oh.action = ?`;
      params.push(filters.action);
    }

    // Improved date filtering - use both executed_at and created_at
    if (filters.startDate) {
      query += ` AND (oh.executed_at >= ? OR (oh.executed_at IS NULL AND oh.created_at >= ?))`;
      params.push(filters.startDate, filters.startDate);
    }

    if (filters.endDate) {
      // Add one day to endDate to include the entire end date
      const endDateTime = new Date(filters.endDate);
      endDateTime.setDate(endDateTime.getDate() + 1);
      const endDateStr = endDateTime.toISOString();
      
      query += ` AND (oh.executed_at < ? OR (oh.executed_at IS NULL AND oh.created_at < ?))`;
      params.push(endDateStr, endDateStr);
    }

    // Enhanced search functionality
    if (filters.search) {
      query += ` AND (
        oh.symbol LIKE ? OR
        oh.broker_order_id LIKE ? OR
        CAST(oh.id as TEXT) LIKE ? OR
        oh.remarks LIKE ? OR
        ca.account_id LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Improved ordering - prioritize recent orders
    query += ` ORDER BY 
      COALESCE(oh.executed_at, oh.created_at) DESC, 
      oh.id DESC 
      LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    const selectOrders = this.db.prepare(query);

    try {
      const results = selectOrders.all(...params) as (OrderHistory & {
        account_broker_name?: string;
        broker_account_id?: string;
      })[];

      // Clean up the results and ensure consistency
      return results.map(order => ({
        id: order.id,
        user_id: order.user_id,
        account_id: order.account_id,
        broker_name: order.broker_name,
        broker_order_id: order.broker_order_id,
        symbol: order.symbol,
        action: order.action,
        quantity: order.quantity,
        price: order.price,
        order_type: order.order_type,
        status: order.status,
        exchange: order.exchange,
        product_type: order.product_type,
        remarks: order.remarks,
        executed_at: order.executed_at,
        created_at: order.created_at
      }));
    } catch (error) {
      console.error('🚨 Failed to get filtered order history:', error);
      throw error;
    }
  }

  // Get order count with filters and search
  getOrderCountByUserIdWithFilters(
    userId: number | string,
    filters: {
      status?: string;
      symbol?: string;
      brokerName?: string;
      accountIds?: string[]; // Array of account IDs to filter by
      startDate?: string;
      endDate?: string;
      action?: 'BUY' | 'SELL';
      search?: string;
    }
  ): number {
    // Convert string userId to number for SQLite
    const numericUserId = typeof userId === 'string' ? parseInt(userId) : userId;
    let query = `
      SELECT COUNT(*) as count FROM order_history oh
      LEFT JOIN connected_accounts ca ON oh.account_id = ca.id
      WHERE oh.user_id = ?
    `;
    const params: any[] = [numericUserId];

    // Add same filters as getOrderHistoryByUserIdWithFilters
    if (filters.status) {
      query += ` AND oh.status = ?`;
      params.push(filters.status);
    }

    if (filters.symbol) {
      query += ` AND oh.symbol LIKE ?`;
      params.push(`%${filters.symbol}%`);
    }

    if (filters.brokerName) {
      query += ` AND oh.broker_name = ?`;
      params.push(filters.brokerName);
    }

    // Account-based filtering
    if (filters.accountIds && filters.accountIds.length > 0) {
      const accountPlaceholders = filters.accountIds.map(() => '?').join(',');
      query += ` AND oh.account_id IN (${accountPlaceholders})`;
      params.push(...filters.accountIds.map(id => parseInt(id)));
    }

    if (filters.action) {
      query += ` AND oh.action = ?`;
      params.push(filters.action);
    }

    // Improved date filtering - use both executed_at and created_at
    if (filters.startDate) {
      query += ` AND (oh.executed_at >= ? OR (oh.executed_at IS NULL AND oh.created_at >= ?))`;
      params.push(filters.startDate, filters.startDate);
    }

    if (filters.endDate) {
      // Add one day to endDate to include the entire end date
      const endDateTime = new Date(filters.endDate);
      endDateTime.setDate(endDateTime.getDate() + 1);
      const endDateStr = endDateTime.toISOString();
      
      query += ` AND (oh.executed_at < ? OR (oh.executed_at IS NULL AND oh.created_at < ?))`;
      params.push(endDateStr, endDateStr);
    }

    // Enhanced search functionality
    if (filters.search) {
      query += ` AND (
        oh.symbol LIKE ? OR
        oh.broker_order_id LIKE ? OR
        CAST(oh.id as TEXT) LIKE ? OR
        oh.remarks LIKE ? OR
        ca.account_id LIKE ?
      )`;
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm);
    }

    const countQuery = this.db.prepare(query);

    try {
      const result = countQuery.get(...params) as { count: number };
      return result.count;
    } catch (error) {
      console.error('🚨 Failed to get filtered order count:', error);
      throw error;
    }
  }

  // Get search suggestions for autocomplete
  getOrderSearchSuggestions(
    userId: number,
    searchTerm: string,
    limit: number = 10
  ): Array<{ value: string; type: 'symbol' | 'order_id' | 'broker_order_id' }> {
    const suggestions: Array<{ value: string; type: 'symbol' | 'order_id' | 'broker_order_id' }> = [];

    try {
      // Get unique symbols that match
      const symbolQuery = this.db.prepare(`
        SELECT DISTINCT symbol
        FROM order_history
        WHERE user_id = ? AND symbol LIKE ?
        ORDER BY symbol
        LIMIT ?
      `);
      const symbols = symbolQuery.all(userId, `%${searchTerm}%`, Math.ceil(limit / 3)) as Array<{ symbol: string }>;
      symbols.forEach(row => {
        suggestions.push({ value: row.symbol, type: 'symbol' });
      });

      // Get broker order IDs that match
      const brokerOrderQuery = this.db.prepare(`
        SELECT DISTINCT broker_order_id
        FROM order_history
        WHERE user_id = ? AND broker_order_id LIKE ?
        ORDER BY created_at DESC
        LIMIT ?
      `);
      const brokerOrders = brokerOrderQuery.all(userId, `%${searchTerm}%`, Math.ceil(limit / 3)) as Array<{ broker_order_id: string }>;
      brokerOrders.forEach(row => {
        suggestions.push({ value: row.broker_order_id, type: 'broker_order_id' });
      });

      // Get internal order IDs that match (if numeric search)
      if (/^\d+$/.test(searchTerm)) {
        const orderIdQuery = this.db.prepare(`
          SELECT DISTINCT id
          FROM order_history
          WHERE user_id = ? AND CAST(id as TEXT) LIKE ?
          ORDER BY created_at DESC
          LIMIT ?
        `);
        const orderIds = orderIdQuery.all(userId, `%${searchTerm}%`, Math.ceil(limit / 3)) as Array<{ id: number }>;
        orderIds.forEach(row => {
          suggestions.push({ value: row.id.toString(), type: 'order_id' });
        });
      }

      return suggestions.slice(0, limit);
    } catch (error) {
      console.error('🚨 Failed to get search suggestions:', error);
      return [];
    }
  }

  // Push Subscription Methods
  savePushSubscription(subscription: any): boolean {
    const insertSubscription = this.db.prepare(`
      INSERT OR REPLACE INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key, user_agent)
      VALUES (?, ?, ?, ?, ?)
    `);

    try {
      const result = insertSubscription.run(
        subscription.userId,
        subscription.endpoint,
        subscription.keys.p256dh,
        subscription.keys.auth,
        subscription.userAgent || null
      );

      console.log('✅ Push subscription saved successfully for user:', subscription.userId);
      return result.changes > 0;
    } catch (error) {
      console.error('🚨 Failed to save push subscription:', error);
      return false;
    }
  }

  getUserPushSubscriptions(userId: string): any[] {
    const selectSubscriptions = this.db.prepare(`
      SELECT endpoint, p256dh_key, auth_key, user_agent, created_at
      FROM push_subscriptions
      WHERE user_id = ?
    `);

    try {
      const subscriptions = selectSubscriptions.all(userId) as any[];
      return subscriptions.map(sub => ({
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh_key,
          auth: sub.auth_key
        },
        userAgent: sub.user_agent,
        createdAt: sub.created_at
      }));
    } catch (error) {
      console.error('🚨 Failed to get push subscriptions:', error);
      return [];
    }
  }

  removePushSubscription(userId: string, endpoint?: string): boolean {
    let query = 'DELETE FROM push_subscriptions WHERE user_id = ?';
    let params = [userId];

    if (endpoint) {
      query += ' AND endpoint = ?';
      params.push(endpoint);
    }

    const deleteSubscription = this.db.prepare(query);

    try {
      const result = deleteSubscription.run(...params);
      console.log('✅ Push subscription removed for user:', userId);
      return result.changes > 0;
    } catch (error) {
      console.error('🚨 Failed to remove push subscription:', error);
      return false;
    }
  }

  // Notification Preferences Methods
  saveUserNotificationPreferences(preferences: any): boolean {
    const insertPreferences = this.db.prepare(`
      INSERT OR REPLACE INTO notification_preferences (
        user_id, push_enabled, email_enabled, sms_enabled,
        order_status_changes, order_executions, order_rejections,
        portfolio_alerts, market_alerts, quiet_hours_enabled,
        quiet_hours_start, quiet_hours_end
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    try {
      const result = insertPreferences.run(
        preferences.userId,
        preferences.pushEnabled ? 1 : 0,
        preferences.emailEnabled ? 1 : 0,
        preferences.smsEnabled ? 1 : 0,
        preferences.orderStatusChanges ? 1 : 0,
        preferences.orderExecutions ? 1 : 0,
        preferences.orderRejections ? 1 : 0,
        preferences.portfolioAlerts ? 1 : 0,
        preferences.marketAlerts ? 1 : 0,
        preferences.quietHours?.enabled ? 1 : 0,
        preferences.quietHours?.startTime || '22:00',
        preferences.quietHours?.endTime || '08:00'
      );

      console.log('✅ Notification preferences saved for user:', preferences.userId);
      return result.changes > 0;
    } catch (error) {
      console.error('🚨 Failed to save notification preferences:', error);
      return false;
    }
  }

  getUserNotificationPreferences(userId: string): any | null {
    const selectPreferences = this.db.prepare(`
      SELECT * FROM notification_preferences WHERE user_id = ?
    `);

    try {
      const prefs = selectPreferences.get(userId) as any;

      if (!prefs) {
        return null;
      }

      return {
        userId: prefs.user_id,
        pushEnabled: Boolean(prefs.push_enabled),
        emailEnabled: Boolean(prefs.email_enabled),
        smsEnabled: Boolean(prefs.sms_enabled),
        orderStatusChanges: Boolean(prefs.order_status_changes),
        orderExecutions: Boolean(prefs.order_executions),
        orderRejections: Boolean(prefs.order_rejections),
        portfolioAlerts: Boolean(prefs.portfolio_alerts),
        marketAlerts: Boolean(prefs.market_alerts),
        quietHours: {
          enabled: Boolean(prefs.quiet_hours_enabled),
          startTime: prefs.quiet_hours_start,
          endTime: prefs.quiet_hours_end
        },
        createdAt: prefs.created_at,
        updatedAt: prefs.updated_at
      };
    } catch (error) {
      console.error('🚨 Failed to get notification preferences:', error);
      return null;
    }
  }

  healthCheck(): boolean {
    try {
      // Simple check to see if database is accessible
      const result = this.db.prepare('SELECT 1').get();
      return result !== undefined;
    } catch (error) {
      console.error('🚨 SQLite health check failed:', error);
      return false;
    }
  }
}

// Singleton instance
export const userDatabase = new SQLiteUserDatabase();
