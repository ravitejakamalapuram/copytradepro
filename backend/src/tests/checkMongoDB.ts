/**
 * Direct MongoDB check to see what collections and data exist
 */

import mongoose from 'mongoose';

async function checkMongoDB() {
  console.log('🔍 Checking MongoDB directly...');
  
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb+srv://ravitejakamalapuram01:nHxzjl4H7U11TK9D@ravipersonal.fypwvrt.mongodb.net/?retryWrites=true&w=majority&appName=raviPersonal';
    
    console.log('🔗 Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    
    console.log('✅ Connected to MongoDB');
    
    // Get database name
    const dbName = mongoose.connection.db?.databaseName;
    console.log(`📊 Database: ${dbName}`);
    
    // List all collections
    const collections = await mongoose.connection.db?.listCollections().toArray();
    console.log(`\n📋 Collections found: ${collections?.length || 0}`);
    
    if (collections && collections.length > 0) {
      for (const collection of collections) {
        console.log(`\n📁 Collection: ${collection.name}`);
        
        // Get document count
        const count = await mongoose.connection.db?.collection(collection.name).countDocuments();
        console.log(`   Documents: ${count}`);
        
        // Get sample documents
        if (count && count > 0) {
          const samples = await mongoose.connection.db?.collection(collection.name).find({}).limit(3).toArray();
          console.log('   Sample documents:');
          samples?.forEach((doc, index) => {
            console.log(`   ${index + 1}. ${JSON.stringify(doc, null, 2).substring(0, 200)}...`);
          });
        }
      }
    }
    
    // Check specifically for order-related collections
    console.log('\n🎯 Checking for order-related data...');
    
    const orderCollections = ['orders', 'orderhistory', 'order_history', 'trades', 'transactions'];
    
    for (const collectionName of orderCollections) {
      try {
        const count = await mongoose.connection.db?.collection(collectionName).countDocuments();
        if (count && count > 0) {
          console.log(`✅ Found ${count} documents in ${collectionName}`);
          
          // Get sample
          const sample = await mongoose.connection.db?.collection(collectionName).findOne({});
          console.log(`Sample from ${collectionName}:`, JSON.stringify(sample, null, 2));
        }
      } catch (error) {
        // Collection doesn't exist, that's fine
      }
    }
    
    // Check for user-related collections
    console.log('\n👥 Checking for user-related data...');
    
    const userCollections = ['users', 'accounts', 'connected_accounts', 'connectedaccounts'];
    
    for (const collectionName of userCollections) {
      try {
        const count = await mongoose.connection.db?.collection(collectionName).countDocuments();
        if (count && count > 0) {
          console.log(`✅ Found ${count} documents in ${collectionName}`);
          
          // Get sample
          const sample = await mongoose.connection.db?.collection(collectionName).findOne({});
          console.log(`Sample from ${collectionName}:`, JSON.stringify(sample, null, 2));
        }
      } catch (error) {
        // Collection doesn't exist, that's fine
      }
    }
    
  } catch (error: any) {
    console.error('🚨 MongoDB check failed:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await mongoose.disconnect();
    console.log('🔌 Disconnected from MongoDB');
  }
}

// Export for manual testing
export { checkMongoDB };

// Run if called directly
if (require.main === module) {
  checkMongoDB()
    .then(() => {
      console.log('\n🎉 MongoDB check completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('💥 MongoDB check failed:', error);
      process.exit(1);
    });
}