#!/usr/bin/env node

/**
 * Simple development server starter
 * No complex shell scripting - just Node.js
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🚀 Starting CopyTrade Pro in development mode...\n');

// Check if dependencies are installed
function checkDependencies() {
  const checks = [
    { dir: 'node_modules', name: 'root dependencies' },
    { dir: 'backend/node_modules', name: 'backend dependencies' },
    { dir: 'frontend/node_modules', name: 'frontend dependencies' }
  ];

  for (const check of checks) {
    if (!fs.existsSync(check.dir)) {
      console.error(`❌ ${check.name} not installed. Run "npm run install" first.`);
      return false;
    }
  }
  return true;
}

// Check if backend is built
function checkBackendBuild() {
  if (!fs.existsSync('backend/dist')) {
    console.warn('⚠️  Backend not built. Building now...');
    return false;
  }
  return true;
}

// Start a process
function startProcess(command, args, cwd, name, color) {
  const process = spawn(command, args, {
    cwd,
    stdio: 'pipe',
    shell: true
  });

  // Color codes
  const colors = {
    backend: '\x1b[34m', // Blue
    frontend: '\x1b[36m', // Cyan
    reset: '\x1b[0m'
  };

  const colorCode = colors[color] || colors.reset;

  process.stdout.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${colorCode}[${name}]${colors.reset} ${line}`);
    });
  });

  process.stderr.on('data', (data) => {
    const lines = data.toString().split('\n').filter(line => line.trim());
    lines.forEach(line => {
      console.log(`${colorCode}[${name}]${colors.reset} ${line}`);
    });
  });

  process.on('close', (code) => {
    console.log(`${colorCode}[${name}]${colors.reset} Process exited with code ${code}`);
  });

  return process;
}

// Main function
async function startDev() {
  try {
    // Check dependencies
    if (!checkDependencies()) {
      console.log('\n🔧 Installing dependencies...');
      const { execSync } = require('child_process');
      execSync('npm run install:all', { stdio: 'inherit' });
    }

    // Check backend build
    if (!checkBackendBuild()) {
      console.log('🔨 Building backend...');
      const { execSync } = require('child_process');
      execSync('npm run build:backend', { stdio: 'inherit' });
    }

    console.log('✅ All checks passed. Starting development servers...\n');

    // Start backend
    console.log('🔵 Starting backend server...');
    const backendProcess = startProcess('npm', ['run', 'dev'], 'backend', 'BACKEND', 'backend');

    // Wait a bit for backend to start
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Start frontend
    console.log('🔷 Starting frontend server...');
    const frontendProcess = startProcess('npm', ['run', 'dev'], 'frontend', 'FRONTEND', 'frontend');

    console.log('\n🎉 Development servers started!');
    console.log('🌐 Frontend: http://localhost:5173');
    console.log('🌐 Backend: http://localhost:3001');
    console.log('\n💡 Press Ctrl+C to stop both servers\n');

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      console.log('\n🛑 Shutting down development servers...');
      backendProcess.kill('SIGTERM');
      frontendProcess.kill('SIGTERM');
      
      setTimeout(() => {
        console.log('✅ Development servers stopped');
        process.exit(0);
      }, 1000);
    });

    // Keep the process alive
    process.stdin.resume();

  } catch (error) {
    console.error('❌ Failed to start development servers:', error.message);
    console.log('\n🔧 Manual start commands:');
    console.log('Terminal 1: cd backend && npm run dev');
    console.log('Terminal 2: cd frontend && npm run dev');
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  startDev();
}

module.exports = { startDev };
