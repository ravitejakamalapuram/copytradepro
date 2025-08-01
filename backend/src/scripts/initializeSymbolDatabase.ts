#!/usr/bin/env node

/**
 * Symbol Database Initialization Script
 * 
 * This script initializes the symbol database schema and creates necessary indexes.
 * It should be run once during deployment or when setting up a new environment.
 */

import mongoose from 'mongoose';
import { SymbolDatabaseService } from '../services/symbolDatabaseService';
import { MongoDatabase } from '../services/mongoDatabase';

async function initializeSymbolDatabase() {
  console.log('🚀 Starting Symbol Database Initialization...');
  
  try {
    // Initialize main database connection
    const database = new MongoDatabase();
    await database.initialize();
    
    console.log('✅ Main database connection established');
    
    // Initialize symbol database service
    const symbolDbService = new SymbolDatabaseService();
    await symbolDbService.initialize();
    
    console.log('✅ Symbol database service initialized');
    
    // Get database statistics
    const stats = await symbolDbService.getStatistics();
    console.log('📊 Current Symbol Database Statistics:');
    console.log(`   Total Symbols: ${stats.totalSymbols}`);
    console.log(`   Active Symbols: ${stats.activeSymbols}`);
    console.log(`   By Type:`, stats.symbolsByType);
    console.log(`   By Exchange:`, stats.symbolsByExchange);
    
    // Create a test processing log to verify the schema
    const testLog = await symbolDbService.createProcessingLog({
      processType: 'VALIDATION',
      source: 'initialization_script',
      status: 'COMPLETED',
      totalProcessed: 0,
      validSymbols: 0,
      invalidSymbols: 0,
      newSymbols: 0,
      updatedSymbols: 0,
      completedAt: new Date().toISOString()
    });
    
    console.log('✅ Test processing log created:', testLog.id);
    
    // List all collections to verify schema creation
    if (mongoose.connection.db) {
      const collections = await mongoose.connection.db.listCollections().toArray();
      const symbolCollections = collections.filter(col => 
        col.name.includes('symbol') || col.name.includes('Symbol')
      );
      
      console.log('📋 Symbol-related collections:');
      symbolCollections.forEach(col => {
        console.log(`   - ${col.name}`);
      });
      
      // Verify indexes
      const symbolIndexes = await mongoose.connection.db.collection('standardizedsymbols').indexes();
      console.log('🔍 Symbol collection indexes:');
      symbolIndexes.forEach(index => {
        console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
      });
    } else {
      console.log('⚠️ Database connection not available for collection inspection');
    }
    
    console.log('✅ Symbol Database Initialization completed successfully!');
    
  } catch (error) {
    console.error('🚨 Symbol Database Initialization failed:', error);
    process.exit(1);
  } finally {
    // Close database connection
    await mongoose.connection.close();
    console.log('🔌 Database connection closed');
    process.exit(0);
  }
}

// Run the initialization if this script is executed directly
if (require.main === module) {
  initializeSymbolDatabase();
}

export { initializeSymbolDatabase };