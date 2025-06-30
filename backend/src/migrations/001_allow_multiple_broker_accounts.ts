import { Database } from 'better-sqlite3';
import mongoose from 'mongoose';

/**
 * Migration: Allow Multiple Broker Accounts Per User
 * 
 * Changes the unique constraint from (user_id, broker_name) to (user_id, broker_name, account_id)
 * This allows users to have multiple accounts with the same broker (e.g., multiple Shoonya accounts)
 */

export async function migrateSQLite(db: Database): Promise<void> {
  console.log('🔄 Running migration: Allow multiple broker accounts per user (SQLite)');
  
  try {
    // Start transaction
    db.exec('BEGIN TRANSACTION');
    
    // Check if the old constraint exists
    const tableInfo = db.prepare("PRAGMA table_info(connected_accounts)").all();
    const hasOldConstraint = db.prepare(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' AND name='connected_accounts' 
      AND sql LIKE '%UNIQUE(user_id, broker_name)%'
    `).get();
    
    if (hasOldConstraint) {
      console.log('📝 Found old constraint, recreating table...');
      
      // Create backup table
      db.exec(`
        CREATE TABLE connected_accounts_backup AS 
        SELECT * FROM connected_accounts
      `);
      
      // Drop old table
      db.exec('DROP TABLE connected_accounts');
      
      // Create new table with updated constraint
      db.exec(`
        CREATE TABLE connected_accounts (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id INTEGER NOT NULL,
          broker_name TEXT NOT NULL,
          account_id TEXT NOT NULL,
          user_name TEXT NOT NULL,
          email TEXT NOT NULL,
          broker_display_name TEXT NOT NULL,
          exchanges TEXT NOT NULL,
          products TEXT NOT NULL,
          encrypted_credentials TEXT NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
          UNIQUE(user_id, broker_name, account_id)
        )
      `);
      
      // Restore data
      db.exec(`
        INSERT INTO connected_accounts (
          id, user_id, broker_name, account_id, user_name, email,
          broker_display_name, exchanges, products, encrypted_credentials,
          created_at, updated_at
        )
        SELECT 
          id, user_id, broker_name, account_id, user_name, email,
          broker_display_name, exchanges, products, encrypted_credentials,
          created_at, updated_at
        FROM connected_accounts_backup
      `);
      
      // Drop backup table
      db.exec('DROP TABLE connected_accounts_backup');
      
      console.log('✅ SQLite migration completed successfully');
    } else {
      console.log('✅ SQLite table already has correct constraint');
    }
    
    // Commit transaction
    db.exec('COMMIT');
    
  } catch (error) {
    console.error('🚨 SQLite migration failed:', error);
    db.exec('ROLLBACK');
    throw error;
  }
}

export async function migrateMongoDB(): Promise<void> {
  console.log('🔄 Running migration: Allow multiple broker accounts per user (MongoDB)');
  
  try {
    const db = mongoose.connection.db;
    if (!db) {
      throw new Error('MongoDB connection not available');
    }
    
    // Check if old index exists
    const collection = db.collection('connectedaccounts');
    const indexes = await collection.indexes();
    
    const oldIndexExists = indexes.some(index => 
      index.name === 'user_id_1_broker_name_1' && 
      index.unique === true &&
      Object.keys(index.key).length === 2
    );
    
    if (oldIndexExists) {
      console.log('📝 Found old index, updating...');
      
      // Drop old index
      await collection.dropIndex('user_id_1_broker_name_1');
      console.log('🗑️ Dropped old unique index');
      
      // Create new index
      await collection.createIndex(
        { user_id: 1, broker_name: 1, account_id: 1 }, 
        { unique: true, name: 'user_id_1_broker_name_1_account_id_1' }
      );
      console.log('✅ Created new unique index');
    } else {
      console.log('✅ MongoDB collection already has correct index');
    }
    
    console.log('✅ MongoDB migration completed successfully');
    
  } catch (error) {
    console.error('🚨 MongoDB migration failed:', error);
    throw error;
  }
}

export async function runMigration(dbType: 'sqlite' | 'mongodb', sqliteDb?: Database): Promise<void> {
  console.log(`🚀 Starting migration for ${dbType.toUpperCase()}`);
  
  if (dbType === 'sqlite' && sqliteDb) {
    await migrateSQLite(sqliteDb);
  } else if (dbType === 'mongodb') {
    await migrateMongoDB();
  } else {
    throw new Error(`Invalid migration parameters: dbType=${dbType}, sqliteDb=${!!sqliteDb}`);
  }
  
  console.log(`🎉 Migration completed for ${dbType.toUpperCase()}`);
}
