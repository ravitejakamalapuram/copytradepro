#!/usr/bin/env node

/**
 * Simple build script for CopyTrade Pro
 * No complex shell scripting - just Node.js
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔨 Building CopyTrade Pro for production...\n');

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

// Create directory if it doesn't exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`📁 Created directory: ${dir}`);
  }
}

// Copy directory recursively
function copyDir(src, dest) {
  try {
    if (!fs.existsSync(src)) {
      console.warn(`⚠️  Source directory ${src} does not exist`);
      return false;
    }

    ensureDir(dest);
    
    const items = fs.readdirSync(src);
    
    for (const item of items) {
      const srcPath = path.join(src, item);
      const destPath = path.join(dest, item);
      
      if (fs.statSync(srcPath).isDirectory()) {
        copyDir(srcPath, destPath);
      } else {
        fs.copyFileSync(srcPath, destPath);
      }
    }
    
    console.log(`📁 Copied ${src} to ${dest}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to copy ${src} to ${dest}:`, error.message);
    return false;
  }
}

// Main build function
async function build() {
  try {
    console.log('🧹 Cleaning previous builds...');
    
    // Clean previous builds
    const dirsToClean = ['backend/dist', 'frontend/dist', 'backend/public'];
    for (const dir of dirsToClean) {
      if (fs.existsSync(dir)) {
        fs.rmSync(dir, { recursive: true, force: true });
        console.log(`🗑️  Cleaned ${dir}`);
      }
    }

    // Check dependencies
    console.log('\n📦 Checking dependencies...');
    const requiredDirs = ['backend/node_modules', 'frontend/node_modules'];
    for (const dir of requiredDirs) {
      if (!dirExists(dir)) {
        console.log(`📦 Installing dependencies for ${dir.split('/')[0]}...`);
        if (!runCommand('npm install', dir.split('/')[0])) {
          throw new Error(`Failed to install dependencies for ${dir.split('/')[0]}`);
        }
      }
    }

    // Build backend
    console.log('\n🔨 Building backend...');
    if (!dirExists('backend')) {
      throw new Error('Backend directory not found');
    }
    
    if (!runCommand('npm run build', 'backend')) {
      throw new Error('Backend build failed');
    }

    // Verify backend build
    if (!dirExists('backend/dist')) {
      throw new Error('Backend build output not found');
    }
    console.log('✅ Backend build completed');

    // Build frontend
    console.log('\n🔨 Building frontend...');
    if (!dirExists('frontend')) {
      throw new Error('Frontend directory not found');
    }
    
    if (!runCommand('npm run build', 'frontend')) {
      throw new Error('Frontend build failed');
    }

    // Verify frontend build
    if (!dirExists('frontend/dist')) {
      throw new Error('Frontend build output not found');
    }
    console.log('✅ Frontend build completed');

    // Copy frontend build to backend public directory
    console.log('\n📁 Setting up production files...');
    ensureDir('backend/public');
    
    if (copyDir('frontend/dist', 'backend/public')) {
      console.log('✅ Frontend files copied to backend/public');
    } else {
      console.warn('⚠️  Failed to copy frontend files, but build can continue');
    }

    // Create production package.json
    console.log('\n📝 Creating production package.json...');
    const backendPackage = JSON.parse(fs.readFileSync('backend/package.json', 'utf8'));
    
    const prodPackage = {
      name: backendPackage.name,
      version: backendPackage.version,
      description: backendPackage.description,
      main: backendPackage.main,
      scripts: {
        start: backendPackage.scripts.start,
        "health-check": backendPackage.scripts["health-check"] || "curl -f http://localhost:$PORT/health || exit 1"
      },
      dependencies: backendPackage.dependencies,
      engines: {
        node: ">=18.0.0",
        npm: ">=8.0.0"
      }
    };

    fs.writeFileSync('backend/package-prod.json', JSON.stringify(prodPackage, null, 2));
    console.log('✅ Production package.json created');

    // Build summary
    console.log('\n🎉 Build completed successfully!');
    console.log('\n📋 Build output:');
    console.log('- Backend: backend/dist/');
    console.log('- Frontend: backend/public/');
    console.log('- Production package: backend/package-prod.json');
    
    console.log('\n🚀 Deployment instructions:');
    console.log('1. Copy backend/ directory to your server');
    console.log('2. Run: npm install --production');
    console.log('3. Set environment variables');
    console.log('4. Run: npm start');
    
    console.log('\n🌐 Or use the deployment guide: DEPLOYMENT_GUIDE.md');

  } catch (error) {
    console.error('\n❌ Build failed:', error.message);
    console.log('\n🔧 Manual build steps:');
    console.log('1. cd backend && npm run build');
    console.log('2. cd ../frontend && npm run build');
    console.log('3. mkdir -p backend/public');
    console.log('4. cp -r frontend/dist/* backend/public/');
    process.exit(1);
  }
}

// Run build if called directly
if (require.main === module) {
  build();
}

module.exports = { build };
