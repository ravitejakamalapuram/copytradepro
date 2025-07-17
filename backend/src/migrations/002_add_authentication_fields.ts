import Database from 'better-sqlite3';
import { MongoDatabase } from '../services/mongoDatabase';

/**
 * Migration 002: Add Authentication Fields
 * Adds account_status and token_expiry_time fields to connected_accounts table
 * for enhanced authentication flow support
 */

export function up(db: Database.Database): void {
  console.log('🔄 Running migration 002: Add authentication fields...');

  try {
    // Check if columns already exist
    const tableInfo = db.prepare("PRAGMA table_info(connected_accounts)").all() as any[];
    const hasAccountStatus = tableInfo.some(col => col.name === 'account_status');
    const hasTokenExpiry = tableInfo.some(col => col.name === 'token_expiry_time');

    if (hasAccountStatus && hasTokenExpiry) {
      console.log('✅ Authentication fields already exist, skipping migration');
      return;
    }

    // Add account_status column if it doesn't exist
    if (!hasAccountStatus) {
      db.exec(`
        ALTER TABLE connected_accounts 
        ADD COLUMN account_status TEXT NOT NULL DEFAULT 'INACTIVE' 
        CHECK (account_status IN ('ACTIVE', 'INACTIVE', 'PROCEED_TO_OAUTH'))
      `);
      console.log('✅ Added account_status column');
    }

    // Add token_expiry_time column if it doesn't exist
    if (!hasTokenExpiry) {
      db.exec(`
        ALTER TABLE connected_accounts 
        ADD COLUMN token_expiry_time DATETIME DEFAULT NULL
      `);
      console.log('✅ Added token_expiry_time column');
    }

    // Update existing accounts to have proper status
    // Set Shoonya accounts to ACTIVE (they don't expire)
    // Set Fyers accounts to INACTIVE (they need re-authentication)
    db.exec(`
      UPDATE connected_accounts 
      SET account_status = CASE 
        WHEN broker_name = 'shoonya' THEN 'ACTIVE'
        WHEN broker_name = 'fyers' THEN 'INACTIVE'
        ELSE 'INACTIVE'
      END
      WHERE account_status = 'INACTIVE'
    `);

    // Set token_expiry_time to NULL for Shoonya (infinity)
    // Fyers accounts will remain NULL until they authenticate
    db.exec(`
      UPDATE connected_accounts 
      SET token_expiry_time = NULL
      WHERE broker_name = 'shoonya'
    `);

    console.log('✅ Migration 002 completed successfully');
  } catch (error) {
    console.error('❌ Migration 002 failed:', error);
    throw error;
  }
}

export function down(db: Database.Database): void {
  console.log('🔄 Rolling back migration 002: Remove authentication fields...');

  try {
    // Note: SQLite doesn't support DROP COLUMN directly
    // We would need to recreate the table without these columns
    // For now, we'll just log a warning
    console.log('⚠️ SQLite does not support DROP COLUMN. Manual cleanup required.');
    console.log('⚠️ To fully rollback, you would need to recreate the connected_accounts table');
  } catch (error) {
    console.error('❌ Migration 002 rollback failed:', error);
    throw error;
  }
}

/**
 * MongoDB Migration Support
 * Updates MongoDB collections to include the new fields
 */
export async function upMongo(mongoDb: MongoDatabase): Promise<void> {
  console.log('🔄 Running MongoDB migration 002: Add authentication fields...');

  try {
    // MongoDB is schema-less, but we should update existing documents
    // to have the new fields with default values
    
    // Update existing accounts to have proper status
    const updateResult = await mongoDb['ConnectedAccountModel'].updateMany(
      { account_status: { $exists: false } },
      {
        $set: {
          account_status: 'INACTIVE',
          token_expiry_time: null
        }
      }
    );

    // Set Shoonya accounts to ACTIVE (they don't expire)
    await mongoDb['ConnectedAccountModel'].updateMany(
      { broker_name: 'shoonya' },
      {
        $set: {
          account_status: 'ACTIVE',
          token_expiry_time: null
        }
      }
    );

    console.log(`✅ MongoDB migration 002 completed. Updated ${updateResult.modifiedCount} documents`);
  } catch (error) {
    console.error('❌ MongoDB migration 002 failed:', error);
    throw error;
  }
}

export async function downMongo(mongoDb: MongoDatabase): Promise<void> {
  console.log('🔄 Rolling back MongoDB migration 002: Remove authentication fields...');

  try {
    // Remove the new fields from all documents
    await mongoDb['ConnectedAccountModel'].updateMany(
      {},
      {
        $unset: {
          account_status: '',
          token_expiry_time: ''
        }
      }
    );

    console.log('✅ MongoDB migration 002 rollback completed');
  } catch (error) {
    console.error('❌ MongoDB migration 002 rollback failed:', error);
    throw error;
  }
}
