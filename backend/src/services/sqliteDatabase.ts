import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

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

export class SQLiteUserDatabase {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    // Ensure data directory exists
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.dbPath = path.join(dataDir, 'users.db');
    this.db = new Database(this.dbPath);
    
    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = NORMAL');
    this.db.pragma('cache_size = 1000');
    this.db.pragma('temp_store = memory');
    
    this.initializeDatabase();
    console.log('✅ SQLite database initialized at:', this.dbPath);
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

    try {
      this.db.exec(createUsersTable);
      this.db.exec(createEmailIndex);
      this.db.exec(createNameIndex);
      this.db.exec(createUpdateTrigger);
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
}

// Singleton instance
export const userDatabase = new SQLiteUserDatabase();
