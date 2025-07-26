#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔍 Checking for missing dependencies...');

// Common missing dependencies and their fixes
const commonFixes = {
  backend: {
    'node-cron': '^3.0.3',
    '@types/node-cron': '^3.0.11'
  },
  frontend: {
    // Add common frontend missing deps here if needed
  }
};

function installMissingDeps(packagePath, deps) {
  const packageJsonPath = path.join(packagePath, 'package.json');
  
  if (!fs.existsSync(packageJsonPath)) {
    console.log(`❌ No package.json found in ${packagePath}`);
    return;
  }
  
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };
  
  const missingDeps = [];
  const missingDevDeps = [];
  
  for (const [dep, version] of Object.entries(deps)) {
    if (!allDeps[dep]) {
      if (dep.startsWith('@types/')) {
        missingDevDeps.push(`${dep}@${version}`);
      } else {
        missingDeps.push(`${dep}@${version}`);
      }
    }
  }
  
  if (missingDeps.length > 0) {
    console.log(`📦 Installing missing dependencies in ${packagePath}:`, missingDeps);
    try {
      execSync(`cd ${packagePath} && npm install ${missingDeps.join(' ')}`, { stdio: 'inherit' });
    } catch (error) {
      console.error(`❌ Failed to install dependencies in ${packagePath}`);
    }
  }
  
  if (missingDevDeps.length > 0) {
    console.log(`🔧 Installing missing dev dependencies in ${packagePath}:`, missingDevDeps);
    try {
      execSync(`cd ${packagePath} && npm install --save-dev ${missingDevDeps.join(' ')}`, { stdio: 'inherit' });
    } catch (error) {
      console.error(`❌ Failed to install dev dependencies in ${packagePath}`);
    }
  }
  
  if (missingDeps.length === 0 && missingDevDeps.length === 0) {
    console.log(`✅ No missing dependencies in ${packagePath}`);
  }
}

// Check and fix backend dependencies
installMissingDeps('backend', commonFixes.backend);

// Check and fix frontend dependencies
installMissingDeps('frontend', commonFixes.frontend);

console.log('✅ Dependency check complete!');