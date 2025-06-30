import { IDatabaseAdapter } from '../interfaces/IDatabaseAdapter';
import { MongoDatabase } from './mongoDatabase';
import { SQLiteAdapter } from './sqliteAdapter';

/**
 * Database Factory
 * Creates and manages database adapter instances based on configuration
 */
export class DatabaseFactory {
  private static instance: IDatabaseAdapter | null = null;

  /**
   * Get the database adapter instance (Singleton pattern)
   * @returns IDatabaseAdapter instance
   */
  static async getInstance(): Promise<IDatabaseAdapter> {
    if (!DatabaseFactory.instance) {
      DatabaseFactory.instance = await DatabaseFactory.createAdapter();
    }
    return DatabaseFactory.instance;
  }

  /**
   * Create a new database adapter based on configuration
   * @returns IDatabaseAdapter instance
   */
  private static async createAdapter(): Promise<IDatabaseAdapter> {
    const databaseType = process.env.DATABASE_TYPE?.toLowerCase() || 'mongodb';
    
    console.log(`🔧 Initializing ${databaseType.toUpperCase()} database adapter...`);

    let adapter: IDatabaseAdapter;

    switch (databaseType) {
      case 'mongodb':
      case 'mongo':
        adapter = new MongoDatabase();
        break;
      
      case 'sqlite':
        adapter = new SQLiteAdapter();
        break;
      
      default:
        console.warn(`⚠️ Unknown database type: ${databaseType}. Falling back to MongoDB.`);
        adapter = new MongoDatabase();
        break;
    }

    // Initialize the adapter
    await adapter.initialize();

    // Verify connection
    if (!adapter.isConnected()) {
      throw new Error(`Failed to connect to ${databaseType} database`);
    }

    console.log(`✅ ${databaseType.toUpperCase()} database adapter initialized successfully`);
    return adapter;
  }

  /**
   * Close the database connection and reset instance
   */
  static async closeConnection(): Promise<void> {
    if (DatabaseFactory.instance) {
      await DatabaseFactory.instance.close();
      DatabaseFactory.instance = null;
      console.log('✅ Database connection closed');
    }
  }

  /**
   * Reset the instance (useful for testing)
   */
  static reset(): void {
    DatabaseFactory.instance = null;
  }

  /**
   * Get the current database type from environment
   */
  static getDatabaseType(): string {
    return process.env.DATABASE_TYPE?.toLowerCase() || 'mongodb';
  }

  /**
   * Check if the database is connected
   */
  static isConnected(): boolean {
    return DatabaseFactory.instance?.isConnected() || false;
  }
}

// Export a singleton instance for easy access
let databaseInstance: IDatabaseAdapter | null = null;

export const getDatabase = async (): Promise<IDatabaseAdapter> => {
  if (!databaseInstance) {
    databaseInstance = await DatabaseFactory.getInstance();
  }
  return databaseInstance;
};

// Export for backward compatibility
export const userDatabase = {
  async getInstance(): Promise<IDatabaseAdapter> {
    return getDatabase();
  }
};

// Graceful shutdown handler
process.on('SIGINT', async () => {
  console.log('\n🔄 Gracefully shutting down database connection...');
  await DatabaseFactory.closeConnection();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n🔄 Gracefully shutting down database connection...');
  await DatabaseFactory.closeConnection();
  process.exit(0);
});
