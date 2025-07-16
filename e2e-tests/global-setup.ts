import { chromium, FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalSetup(config: FullConfig) {
  console.log('🚀 Starting E2E test setup...');
  
  // Create test data directory
  const testDataDir = path.join(__dirname, 'test-data');
  if (!fs.existsSync(testDataDir)) {
    fs.mkdirSync(testDataDir, { recursive: true });
  }

  // Setup test database
  await setupTestDatabase();
  
  // Create test user accounts
  await createTestUsers();
  
  console.log('✅ E2E test setup completed');
}

async function setupTestDatabase() {
  // Copy the main database to a test database
  const mainDbPath = path.join(__dirname, '../backend/data/users.db');
  const testDbPath = path.join(__dirname, 'test-data/test-users.db');
  
  if (fs.existsSync(mainDbPath)) {
    fs.copyFileSync(mainDbPath, testDbPath);
  }
  
  // Set environment variable for test database
  process.env.TEST_DB_PATH = testDbPath;
}

async function createTestUsers() {
  // Create test users for different scenarios
  const testUsers = [
    {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    },
    {
      email: 'test.admin@example.com', 
      password: 'AdminPassword123!',
      role: 'admin'
    },
    {
      email: 'test.error@example.com',
      password: 'ErrorPassword123!',
      role: 'trader'
    }
  ];

  // Store test user data for tests
  const testDataPath = path.join(__dirname, 'test-data/users.json');
  fs.writeFileSync(testDataPath, JSON.stringify(testUsers, null, 2));
}

export default globalSetup;