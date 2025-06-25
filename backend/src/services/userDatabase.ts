import fs from 'fs/promises';
import path from 'path';

export interface User {
  id: string;
  email: string;
  name: string;
  password: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserData {
  users: User[];
  lastId: number;
}

export class UserDatabase {
  private dbPath: string;
  private lockFile: string;

  constructor() {
    // Create data directory if it doesn't exist
    const dataDir = path.join(process.cwd(), 'data');
    this.dbPath = path.join(dataDir, 'users.json');
    this.lockFile = path.join(dataDir, 'users.lock');
    this.ensureDataDirectory();
  }

  private async ensureDataDirectory(): Promise<void> {
    try {
      const dataDir = path.dirname(this.dbPath);
      await fs.mkdir(dataDir, { recursive: true });
      
      // Initialize database file if it doesn't exist
      try {
        await fs.access(this.dbPath);
      } catch {
        const initialData: UserData = {
          users: [],
          lastId: 0,
        };
        await fs.writeFile(this.dbPath, JSON.stringify(initialData, null, 2));
        console.log('✅ User database initialized at:', this.dbPath);
      }
    } catch (error) {
      console.error('🚨 Failed to initialize user database:', error);
      throw error;
    }
  }

  private async acquireLock(): Promise<void> {
    let attempts = 0;
    const maxAttempts = 50;
    
    while (attempts < maxAttempts) {
      try {
        await fs.writeFile(this.lockFile, process.pid.toString(), { flag: 'wx' });
        return;
      } catch (error: any) {
        if (error.code === 'EEXIST') {
          // Lock file exists, wait and retry
          await new Promise(resolve => setTimeout(resolve, 10));
          attempts++;
        } else {
          throw error;
        }
      }
    }
    
    throw new Error('Failed to acquire database lock after maximum attempts');
  }

  private async releaseLock(): Promise<void> {
    try {
      await fs.unlink(this.lockFile);
    } catch (error) {
      // Lock file might not exist, which is fine
    }
  }

  private async readDatabase(): Promise<UserData> {
    try {
      const data = await fs.readFile(this.dbPath, 'utf-8');
      const parsed = JSON.parse(data);
      
      // Convert date strings back to Date objects
      parsed.users = parsed.users.map((user: any) => ({
        ...user,
        createdAt: new Date(user.createdAt),
        updatedAt: new Date(user.updatedAt),
      }));
      
      return parsed;
    } catch (error) {
      console.error('🚨 Failed to read user database:', error);
      throw new Error('Database read error');
    }
  }

  private async writeDatabase(data: UserData): Promise<void> {
    try {
      await fs.writeFile(this.dbPath, JSON.stringify(data, null, 2));
    } catch (error) {
      console.error('🚨 Failed to write user database:', error);
      throw new Error('Database write error');
    }
  }

  async createUser(userData: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    await this.acquireLock();
    
    try {
      const db = await this.readDatabase();
      
      // Check if user already exists
      const existingUser = db.users.find(user => user.email === userData.email);
      if (existingUser) {
        throw new Error('User already exists with this email');
      }
      
      // Create new user
      const newUser: User = {
        id: (db.lastId + 1).toString(),
        ...userData,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      
      db.users.push(newUser);
      db.lastId += 1;
      
      await this.writeDatabase(db);
      
      console.log('✅ User created successfully:', newUser.email);
      return newUser;
    } finally {
      await this.releaseLock();
    }
  }

  async findUserByEmail(email: string): Promise<User | null> {
    await this.acquireLock();
    
    try {
      const db = await this.readDatabase();
      const user = db.users.find(user => user.email === email);
      return user || null;
    } finally {
      await this.releaseLock();
    }
  }

  async findUserById(id: string): Promise<User | null> {
    await this.acquireLock();
    
    try {
      const db = await this.readDatabase();
      const user = db.users.find(user => user.id === id);
      return user || null;
    } finally {
      await this.releaseLock();
    }
  }

  async updateUser(id: string, updates: Partial<Omit<User, 'id' | 'createdAt'>>): Promise<User | null> {
    await this.acquireLock();

    try {
      const db = await this.readDatabase();
      const userIndex = db.users.findIndex(user => user.id === id);

      if (userIndex === -1) {
        return null;
      }

      const currentUser = db.users[userIndex];
      if (!currentUser) {
        return null;
      }

      db.users[userIndex] = {
        id: currentUser.id,
        email: updates.email ?? currentUser.email,
        name: updates.name ?? currentUser.name,
        password: updates.password ?? currentUser.password,
        createdAt: currentUser.createdAt,
        updatedAt: new Date(),
      };
      
      await this.writeDatabase(db);

      const updatedUser = db.users[userIndex];
      console.log('✅ User updated successfully:', updatedUser?.email || 'Unknown');
      return updatedUser || null;
    } finally {
      await this.releaseLock();
    }
  }

  async deleteUser(id: string): Promise<boolean> {
    await this.acquireLock();
    
    try {
      const db = await this.readDatabase();
      const userIndex = db.users.findIndex(user => user.id === id);
      
      if (userIndex === -1) {
        return false;
      }

      const deletedUser = db.users[userIndex];
      db.users.splice(userIndex, 1);

      await this.writeDatabase(db);

      console.log('✅ User deleted successfully:', deletedUser?.email || 'Unknown');
      return true;
    } finally {
      await this.releaseLock();
    }
  }

  async getAllUsers(): Promise<User[]> {
    await this.acquireLock();
    
    try {
      const db = await this.readDatabase();
      return db.users;
    } finally {
      await this.releaseLock();
    }
  }

  async getUserCount(): Promise<number> {
    await this.acquireLock();
    
    try {
      const db = await this.readDatabase();
      return db.users.length;
    } finally {
      await this.releaseLock();
    }
  }

  // Backup functionality
  async createBackup(): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(path.dirname(this.dbPath), `users-backup-${timestamp}.json`);
    
    await this.acquireLock();
    
    try {
      const db = await this.readDatabase();
      await fs.writeFile(backupPath, JSON.stringify(db, null, 2));
      console.log('✅ Database backup created:', backupPath);
      return backupPath;
    } finally {
      await this.releaseLock();
    }
  }
}

// Singleton instance
export const userDatabase = new UserDatabase();
