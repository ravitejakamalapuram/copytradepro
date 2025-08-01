#!/usr/bin/env node

/**
 * Database Schema Creation Script
 * Creates all necessary database schemas and indexes for the standardized symbol management system
 */

const mongoose = require('mongoose');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

// Import the initialization script
const { initializeSymbolDatabase } = require('../dist/scripts/initializeSymbolDatabase');

class DatabaseSchemaCreator {
  constructor() {
    this.mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/copytrade';
    this.retryAttempts = 3;
    this.retryDelay = 5000;
  }

  async connectWithRetry(attempt = 1) {
    try {
      console.log(`🔌 Attempting to connect to MongoDB (attempt ${attempt}/${this.retryAttempts})...`);
      console.log(`📍 MongoDB URI: ${this.mongoUri.replace(/\/\/.*@/, '//***:***@')}`);
      
      await mongoose.connect(this.mongoUri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 10000,
      });
      
      console.log('✅ Connected to MongoDB successfully');
      return true;
    } catch (error) {
      console.error(`❌ MongoDB connection attempt ${attempt} failed:`, error.message);
      
      if (attempt < this.retryAttempts) {
        console.log(`⏳ Retrying in ${this.retryDelay / 1000} seconds...`);
        await this.sleep(this.retryDelay);
        return this.connectWithRetry(attempt + 1);
      } else {
        throw new Error(`Failed to connect to MongoDB after ${this.retryAttempts} attempts`);
      }
    }
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async createIndexes() {
    console.log('🔍 Creating database indexes...');
    
    try {
      const db = mongoose.connection.db;
      
      // Create indexes for standardized symbols collection
      const symbolsCollection = db.collection('standardizedsymbols');
      
      console.log('📊 Creating indexes for standardized symbols...');
      
      // Basic indexes
      await symbolsCollection.createIndex({ tradingSymbol: 1 }, { background: true });
      await symbolsCollection.createIndex({ displayName: 1 }, { background: true });
      await symbolsCollection.createIndex({ instrumentType: 1 }, { background: true });
      await symbolsCollection.createIndex({ exchange: 1 }, { background: true });
      await symbolsCollection.createIndex({ isActive: 1 }, { background: true });
      await symbolsCollection.createIndex({ lastUpdated: -1 }, { background: true });
      await symbolsCollection.createIndex({ source: 1 }, { background: true });
      
      // Compound indexes for queries
      await symbolsCollection.createIndex({ 
        instrumentType: 1, 
        exchange: 1, 
        isActive: 1 
      }, { background: true });
      
      await symbolsCollection.createIndex({ 
        underlying: 1, 
        instrumentType: 1, 
        expiryDate: 1, 
        isActive: 1 
      }, { background: true });
      
      await symbolsCollection.createIndex({ 
        underlying: 1, 
        expiryDate: 1, 
        strikePrice: 1, 
        optionType: 1, 
        isActive: 1 
      }, { background: true });
      
      // Text search index
      await symbolsCollection.createIndex({ 
        displayName: 'text', 
        tradingSymbol: 'text', 
        companyName: 'text' 
      }, { background: true });
      
      // Unique constraints
      await symbolsCollection.createIndex({ 
        tradingSymbol: 1, 
        exchange: 1, 
        instrumentType: 1 
      }, { 
        unique: true, 
        background: true,
        partialFilterExpression: { instrumentType: 'EQUITY' }
      });
      
      await symbolsCollection.createIndex({ 
        tradingSymbol: 1, 
        exchange: 1, 
        expiryDate: 1, 
        strikePrice: 1, 
        optionType: 1 
      }, { 
        unique: true, 
        background: true,
        partialFilterExpression: { instrumentType: { $in: ['OPTION', 'FUTURE'] } }
      });
      
      console.log('✅ Standardized symbols indexes created');
      
      // Create indexes for processing logs collection
      const logsCollection = db.collection('symbolprocessinglogs');
      
      console.log('📊 Creating indexes for processing logs...');
      
      await logsCollection.createIndex({ processType: 1 }, { background: true });
      await logsCollection.createIndex({ status: 1 }, { background: true });
      await logsCollection.createIndex({ source: 1 }, { background: true });
      await logsCollection.createIndex({ startedAt: -1 }, { background: true });
      await logsCollection.createIndex({ completedAt: -1 }, { background: true });
      
      console.log('✅ Processing logs indexes created');
      
      // Verify indexes were created
      const symbolIndexes = await symbolsCollection.indexes();
      const logIndexes = await logsCollection.indexes();
      
      console.log(`📋 Created ${symbolIndexes.length} indexes for symbols collection`);
      console.log(`📋 Created ${logIndexes.length} indexes for logs collection`);
      
      return true;
    } catch (error) {
      console.error('❌ Failed to create indexes:', error);
      throw error;
    }
  }

  async validateSchema() {
    console.log('🔍 Validating database schema...');
    
    try {
      const db = mongoose.connection.db;
      
      // Check if collections exist
      const collections = await db.listCollections().toArray();
      const collectionNames = collections.map(c => c.name);
      
      const requiredCollections = ['standardizedsymbols', 'symbolprocessinglogs'];
      const missingCollections = requiredCollections.filter(name => 
        !collectionNames.includes(name)
      );
      
      if (missingCollections.length > 0) {
        console.log(`⚠️ Missing collections: ${missingCollections.join(', ')}`);
        console.log('📝 Collections will be created automatically when first document is inserted');
      } else {
        console.log('✅ All required collections exist');
      }
      
      // Validate indexes
      for (const collectionName of requiredCollections) {
        if (collectionNames.includes(collectionName)) {
          const indexes = await db.collection(collectionName).indexes();
          console.log(`📊 ${collectionName}: ${indexes.length} indexes`);
          
          indexes.forEach(index => {
            console.log(`   - ${index.name}: ${JSON.stringify(index.key)}`);
          });
        }
      }
      
      console.log('✅ Schema validation completed');
      return true;
    } catch (error) {
      console.error('❌ Schema validation failed:', error);
      throw error;
    }
  }

  async createSchema() {
    console.log('🚀 Starting database schema creation...');
    
    try {
      // Connect to database
      await this.connectWithRetry();
      
      // Create indexes
      await this.createIndexes();
      
      // Validate schema
      await this.validateSchema();
      
      // Run the symbol database initialization
      console.log('🔧 Running symbol database initialization...');
      await initializeSymbolDatabase();
      
      console.log('✅ Database schema creation completed successfully!');
      return true;
    } catch (error) {
      console.error('🚨 Database schema creation failed:', error);
      throw error;
    } finally {
      if (mongoose.connection.readyState === 1) {
        await mongoose.connection.close();
        console.log('🔌 Database connection closed');
      }
    }
  }
}

// Run schema creation if this script is executed directly
if (require.main === module) {
  const creator = new DatabaseSchemaCreator();
  
  creator.createSchema()
    .then(() => {
      console.log('🎉 Schema creation completed successfully!');
      process.exit(0);
    })
    .catch((error) => {
      console.error('🚨 Schema creation failed:', error);
      process.exit(1);
    });
}

module.exports = DatabaseSchemaCreator;