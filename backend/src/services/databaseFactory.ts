import { IDatabaseAdapter } from '../interfaces/IDatabaseAdapter';
import { MongoDatabase } from './mongoDatabase';

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
    console.log('🔧 Initializing MongoDB database adapter...');

    const adapter = new MongoDatabase();

    // Initialize the adapter
    await adapter.initialize();

    // Verify connection
    if (!adapter.isConnected()) {
      throw new Error('Failed to connect to MongoDB database');
    }

    console.log('✅ MongoDB database adapter initialized successfully');
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
   * Get the current database type
   */
  static getDatabaseType(): string {
    return 'mongodb';
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
