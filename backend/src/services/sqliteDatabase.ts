import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

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
  is_active: boolean;
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
  is_active: boolean;
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
        is_active BOOLEAN DEFAULT true,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
        UNIQUE(user_id, broker_name) -- One account per broker per user
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

    try {
      this.db.exec(createUsersTable);
      this.db.exec(createEmailIndex);
      this.db.exec(createNameIndex);
      this.db.exec(createUpdateTrigger);
      this.db.exec(createConnectedAccountsTable);
      this.db.exec(createAccountsUserIndex);
      this.db.exec(createAccountsBrokerIndex);
      this.db.exec(createAccountsUpdateTrigger);
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
        broker_display_name, exchanges, products, encrypted_credentials, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
        accountData.is_active ? 1 : 0
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

  // Update account active status
  updateAccountStatus(accountId: number, isActive: boolean): boolean {
    const updateAccount = this.db.prepare(`
      UPDATE connected_accounts
      SET is_active = ?
      WHERE id = ?
    `);

    try {
      const result = updateAccount.run(isActive ? 1 : 0, accountId);
      const updated = result.changes > 0;

      if (updated) {
        console.log('✅ Account status updated successfully, ID:', accountId, 'Active:', isActive);
      }

      return updated;
    } catch (error) {
      console.error('🚨 Failed to update account status:', error);
      throw error;
    }
  }

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
}

// Singleton instance
export const userDatabase = new SQLiteUserDatabase();
