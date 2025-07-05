/**
 * Dead Code Cleanup Script
 * Identifies and removes unused files, dead code, and obsolete dependencies
 */

const fs = require('fs');
const path = require('path');

// Configuration
const CLEANUP_CONFIG = {
  dryRun: false, // Set to true to see what would be deleted without actually deleting
  verbose: true,
  backupBeforeDelete: true
};

// Files and directories to analyze for cleanup
const ANALYSIS_TARGETS = {
  // Dead code patterns to look for
  deadCodePatterns: [
    /\/\*\s*TODO.*?\*\//g,
    /\/\*\s*FIXME.*?\*\//g,
    /\/\*\s*DEPRECATED.*?\*\//g,
    /console\.log\(/g, // Remove console.logs in production
    /debugger;/g
  ],
  
  // Files that are likely obsolete
  obsoleteFiles: [
    'test_auth_extraction.html',
    'test_automated_oauth.js',
    'test_fyers_comprehensive.js',
    'test_fyers_connection.js',
    'test_fyers_final.js',
    'test_fyers_helpers.js',
    'test_fyers_oauth_flow.js',
    'check-deps.sh',
    'setup.bat',
    'setup.ps1'
  ],
  
  // Directories that might contain dead code
  suspiciousDirectories: [
    'src', // Root src with only 2 files - likely obsolete
    'scripts' // Migration scripts that might be obsolete
  ],
  
  // Duplicate files (same functionality in different places)
  duplicateFiles: [
    {
      original: 'trading-library/src/adapters/ShoonyaAdapter.ts',
      duplicate: 'broker-plugins/shoonya/src/ShoonyaAdapter.ts'
    },
    {
      original: 'trading-library/src/adapters/FyersAdapter.ts', 
      duplicate: 'broker-plugins/fyers/src/FyersAdapter.ts'
    },
    {
      original: 'trading-library/src/core/BaseBrokerPlugin.ts',
      duplicate: 'src/BaseBrokerPlugin.ts'
    },
    {
      original: 'trading-library/src/types/index.ts',
      duplicate: 'src/types.ts'
    }
  ]
};

// Utility functions
function log(message, type = 'info') {
  if (!CLEANUP_CONFIG.verbose && type === 'info') return;
  
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };
  
  console.log(`${colors[type]}[CLEANUP] ${message}${colors.reset}`);
}

function fileExists(filePath) {
  try {
    return fs.existsSync(filePath);
  } catch {
    return false;
  }
}

function isDirectory(filePath) {
  try {
    return fs.statSync(filePath).isDirectory();
  } catch {
    return false;
  }
}

function readFile(filePath) {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return null;
  }
}

function deleteFile(filePath) {
  try {
    if (CLEANUP_CONFIG.dryRun) {
      log(`[DRY RUN] Would delete: ${filePath}`, 'warning');
      return true;
    }
    
    if (CLEANUP_CONFIG.backupBeforeDelete) {
      const backupPath = `${filePath}.backup.${Date.now()}`;
      fs.copyFileSync(filePath, backupPath);
      log(`Backed up to: ${backupPath}`, 'info');
    }
    
    if (isDirectory(filePath)) {
      fs.rmSync(filePath, { recursive: true, force: true });
    } else {
      fs.unlinkSync(filePath);
    }
    
    log(`Deleted: ${filePath}`, 'success');
    return true;
  } catch (error) {
    log(`Failed to delete ${filePath}: ${error.message}`, 'error');
    return false;
  }
}

// Analysis functions
function analyzeObsoleteFiles() {
  log('🔍 Analyzing obsolete files...', 'info');
  const obsoleteFound = [];
  
  ANALYSIS_TARGETS.obsoleteFiles.forEach(fileName => {
    if (fileExists(fileName)) {
      obsoleteFound.push(fileName);
      log(`Found obsolete file: ${fileName}`, 'warning');
    }
  });
  
  return obsoleteFound;
}

function analyzeDuplicateFiles() {
  log('🔍 Analyzing duplicate files...', 'info');
  const duplicatesFound = [];
  
  ANALYSIS_TARGETS.duplicateFiles.forEach(({ original, duplicate }) => {
    if (fileExists(original) && fileExists(duplicate)) {
      const originalContent = readFile(original);
      const duplicateContent = readFile(duplicate);
      
      // Check if files are similar (not exact match due to imports)
      if (originalContent && duplicateContent) {
        const similarity = calculateSimilarity(originalContent, duplicateContent);
        if (similarity > 0.8) { // 80% similar
          duplicatesFound.push({
            original,
            duplicate,
            similarity: Math.round(similarity * 100)
          });
          log(`Found duplicate: ${duplicate} (${Math.round(similarity * 100)}% similar to ${original})`, 'warning');
        }
      }
    }
  });
  
  return duplicatesFound;
}

function calculateSimilarity(str1, str2) {
  // Simple similarity calculation based on common lines
  const lines1 = str1.split('\n').filter(line => line.trim().length > 0);
  const lines2 = str2.split('\n').filter(line => line.trim().length > 0);
  
  let commonLines = 0;
  lines1.forEach(line1 => {
    if (lines2.some(line2 => line1.trim() === line2.trim())) {
      commonLines++;
    }
  });
  
  return commonLines / Math.max(lines1.length, lines2.length);
}

function analyzeDeadCodeInFiles() {
  log('🔍 Analyzing dead code patterns...', 'info');
  const deadCodeFound = [];
  
  function scanDirectory(dir) {
    try {
      const items = fs.readdirSync(dir);
      
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        
        if (isDirectory(fullPath) && !item.includes('node_modules') && !item.includes('.git')) {
          scanDirectory(fullPath);
        } else if (item.endsWith('.ts') || item.endsWith('.js')) {
          const content = readFile(fullPath);
          if (content) {
            ANALYSIS_TARGETS.deadCodePatterns.forEach(pattern => {
              const matches = content.match(pattern);
              if (matches) {
                deadCodeFound.push({
                  file: fullPath,
                  pattern: pattern.toString(),
                  matches: matches.length
                });
              }
            });
          }
        }
      });
    } catch (error) {
      // Ignore permission errors
    }
  }
  
  scanDirectory('.');
  return deadCodeFound;
}

function analyzeUnusedDependencies() {
  log('🔍 Analyzing unused dependencies...', 'info');
  const unusedDeps = [];
  
  // Check main package.json
  const packageJsonPath = 'package.json';
  if (fileExists(packageJsonPath)) {
    const packageJson = JSON.parse(readFile(packageJsonPath));
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    
    Object.keys(dependencies).forEach(dep => {
      // Simple check - look for import/require statements
      const isUsed = checkDependencyUsage(dep);
      if (!isUsed) {
        unusedDeps.push({
          package: packageJsonPath,
          dependency: dep,
          version: dependencies[dep]
        });
      }
    });
  }
  
  return unusedDeps;
}

function checkDependencyUsage(depName) {
  // Simple usage check - scan for import/require statements
  function scanForUsage(dir) {
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        
        if (isDirectory(fullPath) && !item.includes('node_modules') && !item.includes('.git')) {
          if (scanForUsage(fullPath)) return true;
        } else if (item.endsWith('.ts') || item.endsWith('.js')) {
          const content = readFile(fullPath);
          if (content && (
            content.includes(`from '${depName}'`) ||
            content.includes(`from "${depName}"`) ||
            content.includes(`require('${depName}')`) ||
            content.includes(`require("${depName}")`)
          )) {
            return true;
          }
        }
      }
    } catch {
      // Ignore errors
    }
    return false;
  }
  
  return scanForUsage('.');
}

function analyzeEmptyDirectories() {
  log('🔍 Analyzing empty directories...', 'info');
  const emptyDirs = [];
  
  function scanForEmptyDirs(dir) {
    try {
      const items = fs.readdirSync(dir);
      
      if (items.length === 0) {
        emptyDirs.push(dir);
        return;
      }
      
      items.forEach(item => {
        const fullPath = path.join(dir, item);
        if (isDirectory(fullPath) && !item.includes('node_modules') && !item.includes('.git')) {
          scanForEmptyDirs(fullPath);
        }
      });
    } catch {
      // Ignore errors
    }
  }
  
  scanForEmptyDirs('.');
  return emptyDirs;
}

// Main cleanup function
async function performCleanup() {
  log('🧹 Starting Dead Code Cleanup...', 'info');
  log('=' .repeat(50), 'info');
  
  const cleanupResults = {
    obsoleteFiles: [],
    duplicateFiles: [],
    deadCodePatterns: [],
    unusedDependencies: [],
    emptyDirectories: [],
    deletedFiles: 0,
    errors: []
  };
  
  try {
    // 1. Analyze obsolete files
    cleanupResults.obsoleteFiles = analyzeObsoleteFiles();
    
    // 2. Analyze duplicate files
    cleanupResults.duplicateFiles = analyzeDuplicateFiles();
    
    // 3. Analyze dead code patterns
    cleanupResults.deadCodePatterns = analyzeDeadCodeInFiles();
    
    // 4. Analyze unused dependencies
    cleanupResults.unusedDependencies = analyzeUnusedDependencies();
    
    // 5. Analyze empty directories
    cleanupResults.emptyDirectories = analyzeEmptyDirectories();
    
    // Perform cleanup
    log('\n🗑️  Performing cleanup...', 'info');
    
    // Delete obsolete files
    cleanupResults.obsoleteFiles.forEach(file => {
      if (deleteFile(file)) {
        cleanupResults.deletedFiles++;
      }
    });
    
    // Delete duplicate files (keep original, remove duplicate)
    cleanupResults.duplicateFiles.forEach(({ duplicate }) => {
      if (deleteFile(duplicate)) {
        cleanupResults.deletedFiles++;
      }
    });
    
    // Delete empty directories
    cleanupResults.emptyDirectories.forEach(dir => {
      if (deleteFile(dir)) {
        cleanupResults.deletedFiles++;
      }
    });
    
  } catch (error) {
    cleanupResults.errors.push(error.message);
    log(`Cleanup error: ${error.message}`, 'error');
  }
  
  // Report results
  log('\n📊 Cleanup Results:', 'info');
  log(`Obsolete files found: ${cleanupResults.obsoleteFiles.length}`, 'info');
  log(`Duplicate files found: ${cleanupResults.duplicateFiles.length}`, 'info');
  log(`Dead code patterns found: ${cleanupResults.deadCodePatterns.length}`, 'info');
  log(`Unused dependencies found: ${cleanupResults.unusedDependencies.length}`, 'info');
  log(`Empty directories found: ${cleanupResults.emptyDirectories.length}`, 'info');
  log(`Files deleted: ${cleanupResults.deletedFiles}`, 'success');
  
  if (cleanupResults.errors.length > 0) {
    log(`Errors encountered: ${cleanupResults.errors.length}`, 'error');
    cleanupResults.errors.forEach(error => log(`  - ${error}`, 'error'));
  }
  
  return cleanupResults;
}

// Export for use in other files
module.exports = { performCleanup, CLEANUP_CONFIG };

// Run cleanup if this file is executed directly
if (require.main === module) {
  performCleanup()
    .then(results => {
      log('🎉 Cleanup completed successfully!', 'success');
      process.exit(0);
    })
    .catch(error => {
      log(`Cleanup failed: ${error.message}`, 'error');
      process.exit(1);
    });
}
