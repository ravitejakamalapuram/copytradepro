#!/usr/bin/env node

/**
 * Copy environment files to dist directory
 * This script ensures .env files are available in the production build
 */

const fs = require('fs');
const path = require('path');

const sourceDir = path.join(__dirname, '..');
const distDir = path.join(__dirname, '..', 'dist');

// Environment files to copy
const envFiles = ['.env', '.env.example', '.env.production', '.env.local'];

console.log('📁 Copying environment files to dist directory...');

// Ensure dist directory exists
if (!fs.existsSync(distDir)) {
  fs.mkdirSync(distDir, { recursive: true });
  console.log('✅ Created dist directory');
}

let copiedCount = 0;

envFiles.forEach(envFile => {
  const sourcePath = path.join(sourceDir, envFile);
  const destPath = path.join(distDir, envFile);
  
  if (fs.existsSync(sourcePath)) {
    try {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ Copied ${envFile} to dist/`);
      copiedCount++;
    } catch (error) {
      console.warn(`⚠️ Failed to copy ${envFile}:`, error.message);
    }
  } else {
    console.log(`ℹ️ ${envFile} not found, skipping`);
  }
});

if (copiedCount > 0) {
  console.log(`🎉 Successfully copied ${copiedCount} environment file(s) to dist directory`);
} else {
  console.log('ℹ️ No environment files found to copy');
}

// Also copy any other important config files
const configFiles = ['monitoring.config.json'];

configFiles.forEach(configFile => {
  const sourcePath = path.join(sourceDir, configFile);
  const destPath = path.join(distDir, configFile);
  
  if (fs.existsSync(sourcePath)) {
    try {
      fs.copyFileSync(sourcePath, destPath);
      console.log(`✅ Copied ${configFile} to dist/`);
    } catch (error) {
      console.warn(`⚠️ Failed to copy ${configFile}:`, error.message);
    }
  }
});

console.log('📦 Environment file copying complete!');