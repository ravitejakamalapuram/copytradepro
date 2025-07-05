#!/usr/bin/env node

/**
 * Simple setup script for CopyTrade Pro
 * No complex shell scripting - just Node.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Setting up CopyTrade Pro...\n');

// Check Node.js version
const nodeVersion = process.version;
const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0]);

if (majorVersion < 18) {
  console.error('❌ Node.js 18 or higher is required. Current version:', nodeVersion);
  process.exit(1);
}

console.log('✅ Node.js version check passed:', nodeVersion);

// Function to run command safely
function runCommand(command, cwd = process.cwd()) {
  try {
    console.log(`📦 Running: ${command}`);
    execSync(command, { 
      cwd, 
      stdio: 'inherit',
      encoding: 'utf8'
    });
    return true;
  } catch (error) {
    console.error(`❌ Failed to run: ${command}`);
    console.error(error.message);
    return false;
  }
}

// Check if directory exists
function dirExists(dir) {
  return fs.existsSync(dir) && fs.statSync(dir).isDirectory();
}

// Main setup process
async function setup() {
  try {
    // 1. Install root dependencies
    console.log('\n📦 Installing root dependencies...');
    if (!runCommand('npm install')) {
      throw new Error('Failed to install root dependencies');
    }

    // 2. Install backend dependencies
    console.log('\n📦 Installing backend dependencies...');
    if (!dirExists('backend')) {
      throw new Error('Backend directory not found');
    }
    if (!runCommand('npm install', 'backend')) {
      throw new Error('Failed to install backend dependencies');
    }

    // 3. Install frontend dependencies
    console.log('\n📦 Installing frontend dependencies...');
    if (!dirExists('frontend')) {
      throw new Error('Frontend directory not found');
    }
    if (!runCommand('npm install', 'frontend')) {
      throw new Error('Failed to install frontend dependencies');
    }

    // 4. Build backend
    console.log('\n🔨 Building backend...');
    if (!runCommand('npm run build', 'backend')) {
      throw new Error('Failed to build backend');
    }

    // 5. Build frontend
    console.log('\n🔨 Building frontend...');
    if (!runCommand('npm run build', 'frontend')) {
      throw new Error('Failed to build frontend');
    }

    // 6. Copy frontend to backend public
    console.log('\n📁 Copying frontend build to backend...');
    if (!runCommand('npm run copy:frontend')) {
      console.warn('⚠️  Failed to copy frontend build, but continuing...');
    }

    // 7. Check environment file
    console.log('\n🔧 Checking environment configuration...');
    const envPath = path.join('backend', '.env');
    if (!fs.existsSync(envPath)) {
      console.log('📝 Creating sample .env file...');
      const sampleEnv = `# CopyTrade Pro Environment Configuration
PORT=3001
NODE_ENV=development

# Database Configuration (choose one)
# For SQLite (default)
DATABASE_TYPE=sqlite
DATABASE_PATH=./data/copytrade.db

# For MongoDB (uncomment to use)
# DATABASE_TYPE=mongodb
# MONGODB_URI=mongodb://localhost:27017/copytrade

# JWT Secret (change in production)
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# CORS Configuration
CORS_ORIGIN=http://localhost:5173

# Broker API Keys (add your credentials)
# Shoonya
SHOONYA_USER_ID=
SHOONYA_PASSWORD=
SHOONYA_VENDOR_CODE=
SHOONYA_API_KEY=
SHOONYA_IMEI=
SHOONYA_TOTP_SECRET=

# Fyers
FYERS_CLIENT_ID=
FYERS_SECRET_KEY=
FYERS_REDIRECT_URI=

# Notification Settings
ENABLE_NOTIFICATIONS=true
`;
      fs.writeFileSync(envPath, sampleEnv);
      console.log('✅ Sample .env file created at backend/.env');
      console.log('📝 Please update it with your broker credentials');
    } else {
      console.log('✅ Environment file already exists');
    }

    console.log('\n🎉 Setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Update backend/.env with your broker credentials');
    console.log('2. Run "npm run dev" to start development servers');
    console.log('3. Run "npm start" to start production server');
    console.log('\n🌐 Development URLs:');
    console.log('- Frontend: http://localhost:5173');
    console.log('- Backend: http://localhost:3001');

  } catch (error) {
    console.error('\n❌ Setup failed:', error.message);
    console.log('\n🔧 Manual setup steps:');
    console.log('1. npm install');
    console.log('2. cd backend && npm install');
    console.log('3. cd ../frontend && npm install');
    console.log('4. cd .. && npm run build');
    process.exit(1);
  }
}

// Run setup
if (require.main === module) {
  setup();
}

module.exports = { setup };
