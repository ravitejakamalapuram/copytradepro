import { FullConfig } from '@playwright/test';
import path from 'path';
import fs from 'fs';

async function globalTeardown(config: FullConfig) {
  console.log('🧹 Starting E2E test cleanup...');
  
  // Clean up test data
  const testDataDir = path.join(__dirname, 'test-data');
  if (fs.existsSync(testDataDir)) {
    fs.rmSync(testDataDir, { recursive: true, force: true });
  }
  
  // Clean up any temporary files
  const tempFiles = [
    path.join(__dirname, 'test-results'),
    path.join(__dirname, 'playwright-report')
  ];
  
  tempFiles.forEach(file => {
    if (fs.existsSync(file)) {
      fs.rmSync(file, { recursive: true, force: true });
    }
  });
  
  console.log('✅ E2E test cleanup completed');
}

export default globalTeardown;