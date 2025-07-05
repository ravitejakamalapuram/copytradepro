/**
 * Comprehensive Lint and TypeScript Issues Checker
 * Checks all TypeScript files for compilation errors, lint issues, and code quality problems
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const CHECK_CONFIG = {
  verbose: true,
  checkTypeScript: true,
  checkESLint: true,
  checkCodeQuality: true,
  checkImports: true,
  fixableIssues: true
};

// Directories to check
const CHECK_TARGETS = [
  'broker-plugins/shoonya/src',
  'broker-plugins/fyers/src', 
  'trading-library/src',
  'backend/src',
  'frontend/src'
];

// Results tracking
let checkResults = {
  totalFiles: 0,
  tsErrors: [],
  lintErrors: [],
  codeQualityIssues: [],
  importIssues: [],
  warnings: [],
  summary: {
    typescript: { errors: 0, warnings: 0 },
    eslint: { errors: 0, warnings: 0 },
    codeQuality: { errors: 0, warnings: 0 },
    imports: { errors: 0, warnings: 0 }
  }
};

// Utility functions
function log(message, type = 'info') {
  const colors = {
    info: '\x1b[36m',
    success: '\x1b[32m',
    warning: '\x1b[33m',
    error: '\x1b[31m',
    reset: '\x1b[0m'
  };
  
  console.log(`${colors[type]}[LINT-CHECK] ${message}${colors.reset}`);
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

function runCommand(command, cwd = process.cwd()) {
  try {
    const result = execSync(command, { 
      cwd, 
      encoding: 'utf8',
      stdio: 'pipe'
    });
    return { success: true, output: result };
  } catch (error) {
    return { 
      success: false, 
      output: error.stdout || '', 
      error: error.stderr || error.message 
    };
  }
}

// TypeScript checking
function checkTypeScriptInDirectory(dir) {
  log(`Checking TypeScript in ${dir}...`, 'info');
  
  if (!fileExists(dir)) {
    log(`Directory ${dir} does not exist, skipping`, 'warning');
    return;
  }

  // Check if there's a tsconfig.json
  const tsconfigPath = path.join(dir, '../tsconfig.json');
  const hasTsConfig = fileExists(tsconfigPath) || fileExists(path.join(dir, 'tsconfig.json'));
  
  if (!hasTsConfig) {
    log(`No tsconfig.json found for ${dir}, using default settings`, 'warning');
  }

  // Run TypeScript compiler
  const tsCommand = hasTsConfig 
    ? 'npx tsc --noEmit --strict'
    : 'npx tsc --noEmit --strict --target es2020 --module commonjs --esModuleInterop --skipLibCheck';
    
  const result = runCommand(tsCommand, path.dirname(dir));
  
  if (!result.success) {
    const errors = result.error.split('\n').filter(line => line.trim());
    errors.forEach(error => {
      if (error.includes('error TS')) {
        checkResults.tsErrors.push({
          directory: dir,
          error: error.trim()
        });
        checkResults.summary.typescript.errors++;
      } else if (error.includes('warning') || error.includes('TS')) {
        checkResults.warnings.push({
          directory: dir,
          type: 'typescript',
          message: error.trim()
        });
        checkResults.summary.typescript.warnings++;
      }
    });
  } else {
    log(`TypeScript check passed for ${dir}`, 'success');
  }
}

// ESLint checking
function checkESLintInDirectory(dir) {
  log(`Checking ESLint in ${dir}...`, 'info');
  
  // Look for ESLint config
  const eslintConfigs = [
    '.eslintrc.js',
    '.eslintrc.json', 
    '.eslintrc.yaml',
    '.eslintrc.yml',
    'eslint.config.js'
  ];
  
  let hasESLintConfig = false;
  for (const config of eslintConfigs) {
    if (fileExists(config) || fileExists(path.join(dir, config))) {
      hasESLintConfig = true;
      break;
    }
  }
  
  if (!hasESLintConfig) {
    log(`No ESLint config found for ${dir}, skipping ESLint check`, 'warning');
    return;
  }
  
  const result = runCommand(`npx eslint ${dir} --ext .ts,.js`, process.cwd());
  
  if (!result.success) {
    const errors = result.error.split('\n').filter(line => line.trim());
    errors.forEach(error => {
      if (error.includes('error')) {
        checkResults.lintErrors.push({
          directory: dir,
          error: error.trim()
        });
        checkResults.summary.eslint.errors++;
      } else if (error.includes('warning')) {
        checkResults.warnings.push({
          directory: dir,
          type: 'eslint',
          message: error.trim()
        });
        checkResults.summary.eslint.warnings++;
      }
    });
  } else {
    log(`ESLint check passed for ${dir}`, 'success');
  }
}

// Code quality checking
function checkCodeQualityInDirectory(dir) {
  log(`Checking code quality in ${dir}...`, 'info');
  
  function scanDirectory(dirPath) {
    try {
      const items = fs.readdirSync(dirPath);
      
      items.forEach(item => {
        const fullPath = path.join(dirPath, item);
        
        if (isDirectory(fullPath) && !item.includes('node_modules')) {
          scanDirectory(fullPath);
        } else if (item.endsWith('.ts') || item.endsWith('.js')) {
          checkFileQuality(fullPath);
        }
      });
    } catch (error) {
      // Ignore permission errors
    }
  }
  
  function checkFileQuality(filePath) {
    const content = readFile(filePath);
    if (!content) return;
    
    checkResults.totalFiles++;
    
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();
      
      // Check for console.log statements
      if (trimmedLine.includes('console.log(') && !trimmedLine.startsWith('//')) {
        checkResults.codeQualityIssues.push({
          file: filePath,
          line: lineNum,
          issue: 'console.log statement found',
          severity: 'warning'
        });
        checkResults.summary.codeQuality.warnings++;
      }
      
      // Check for debugger statements
      if (trimmedLine.includes('debugger;')) {
        checkResults.codeQualityIssues.push({
          file: filePath,
          line: lineNum,
          issue: 'debugger statement found',
          severity: 'error'
        });
        checkResults.summary.codeQuality.errors++;
      }
      
      // Check for TODO/FIXME comments
      if (trimmedLine.includes('TODO') || trimmedLine.includes('FIXME')) {
        checkResults.codeQualityIssues.push({
          file: filePath,
          line: lineNum,
          issue: 'TODO/FIXME comment found',
          severity: 'info'
        });
      }
      
      // Check for any type usage
      if (trimmedLine.includes(': any') && !trimmedLine.startsWith('//')) {
        checkResults.codeQualityIssues.push({
          file: filePath,
          line: lineNum,
          issue: 'any type usage found',
          severity: 'warning'
        });
        checkResults.summary.codeQuality.warnings++;
      }
      
      // Check for empty catch blocks
      if (trimmedLine === 'catch {' || trimmedLine === 'catch (error) {') {
        const nextLine = lines[index + 1];
        if (nextLine && nextLine.trim() === '}') {
          checkResults.codeQualityIssues.push({
            file: filePath,
            line: lineNum,
            issue: 'empty catch block found',
            severity: 'warning'
          });
          checkResults.summary.codeQuality.warnings++;
        }
      }
    });
    
    // Check for unused imports (basic check)
    const imports = content.match(/import\s+.*?\s+from\s+['"][^'"]+['"]/g) || [];
    imports.forEach(importStatement => {
      const match = importStatement.match(/import\s+(?:\{([^}]+)\}|\*\s+as\s+(\w+)|(\w+))/);
      if (match) {
        const importedItems = match[1] ? match[1].split(',').map(s => s.trim()) : [match[2] || match[3]];
        importedItems.forEach(item => {
          const cleanItem = item.replace(/\s+as\s+\w+/, '').trim();
          if (cleanItem && !content.includes(cleanItem.split(' ')[0])) {
            // This is a basic check - might have false positives
            checkResults.importIssues.push({
              file: filePath,
              issue: `Potentially unused import: ${cleanItem}`,
              severity: 'info'
            });
          }
        });
      }
    });
  }
  
  scanDirectory(dir);
}

// Main checking function
async function runLintAndTSCheck() {
  log('🔍 Starting Comprehensive Lint and TypeScript Check', 'info');
  log('=' .repeat(60), 'info');
  
  for (const target of CHECK_TARGETS) {
    if (!fileExists(target)) {
      log(`Target ${target} does not exist, skipping`, 'warning');
      continue;
    }
    
    log(`\n📁 Checking ${target}...`, 'info');
    
    if (CHECK_CONFIG.checkTypeScript) {
      checkTypeScriptInDirectory(target);
    }
    
    if (CHECK_CONFIG.checkESLint) {
      checkESLintInDirectory(target);
    }
    
    if (CHECK_CONFIG.checkCodeQuality) {
      checkCodeQualityInDirectory(target);
    }
  }
  
  // Generate report
  log('\n📊 LINT AND TYPESCRIPT CHECK RESULTS', 'info');
  log('=' .repeat(60), 'info');
  
  log(`Total files checked: ${checkResults.totalFiles}`, 'info');
  
  // TypeScript errors
  if (checkResults.tsErrors.length > 0) {
    log(`\n❌ TypeScript Errors (${checkResults.tsErrors.length}):`, 'error');
    checkResults.tsErrors.forEach(error => {
      log(`  ${error.directory}: ${error.error}`, 'error');
    });
  } else {
    log('\n✅ No TypeScript errors found!', 'success');
  }
  
  // ESLint errors
  if (checkResults.lintErrors.length > 0) {
    log(`\n❌ ESLint Errors (${checkResults.lintErrors.length}):`, 'error');
    checkResults.lintErrors.forEach(error => {
      log(`  ${error.directory}: ${error.error}`, 'error');
    });
  } else {
    log('\n✅ No ESLint errors found!', 'success');
  }
  
  // Code quality issues
  if (checkResults.codeQualityIssues.length > 0) {
    log(`\n⚠️  Code Quality Issues (${checkResults.codeQualityIssues.length}):`, 'warning');
    const errorIssues = checkResults.codeQualityIssues.filter(i => i.severity === 'error');
    const warningIssues = checkResults.codeQualityIssues.filter(i => i.severity === 'warning');
    const infoIssues = checkResults.codeQualityIssues.filter(i => i.severity === 'info');
    
    if (errorIssues.length > 0) {
      log(`  Errors (${errorIssues.length}):`, 'error');
      errorIssues.forEach(issue => {
        log(`    ${issue.file}:${issue.line} - ${issue.issue}`, 'error');
      });
    }
    
    if (warningIssues.length > 0) {
      log(`  Warnings (${warningIssues.length}):`, 'warning');
      warningIssues.forEach(issue => {
        log(`    ${issue.file}:${issue.line} - ${issue.issue}`, 'warning');
      });
    }
    
    if (infoIssues.length > 0) {
      log(`  Info (${infoIssues.length}):`, 'info');
      infoIssues.slice(0, 10).forEach(issue => { // Limit to first 10
        log(`    ${issue.file}:${issue.line} - ${issue.issue}`, 'info');
      });
      if (infoIssues.length > 10) {
        log(`    ... and ${infoIssues.length - 10} more`, 'info');
      }
    }
  } else {
    log('\n✅ No code quality issues found!', 'success');
  }
  
  // Summary
  log('\n📈 SUMMARY:', 'info');
  log(`TypeScript: ${checkResults.summary.typescript.errors} errors, ${checkResults.summary.typescript.warnings} warnings`, 
       checkResults.summary.typescript.errors > 0 ? 'error' : 'success');
  log(`ESLint: ${checkResults.summary.eslint.errors} errors, ${checkResults.summary.eslint.warnings} warnings`,
       checkResults.summary.eslint.errors > 0 ? 'error' : 'success');
  log(`Code Quality: ${checkResults.summary.codeQuality.errors} errors, ${checkResults.summary.codeQuality.warnings} warnings`,
       checkResults.summary.codeQuality.errors > 0 ? 'error' : 'success');
  
  const totalErrors = checkResults.summary.typescript.errors + 
                     checkResults.summary.eslint.errors + 
                     checkResults.summary.codeQuality.errors;
                     
  const totalWarnings = checkResults.summary.typescript.warnings + 
                       checkResults.summary.eslint.warnings + 
                       checkResults.summary.codeQuality.warnings;
  
  log(`\n🎯 OVERALL: ${totalErrors} errors, ${totalWarnings} warnings`, 
       totalErrors > 0 ? 'error' : (totalWarnings > 0 ? 'warning' : 'success'));
  
  if (totalErrors === 0 && totalWarnings === 0) {
    log('🎉 All checks passed! Code is clean and ready for production.', 'success');
  } else if (totalErrors === 0) {
    log('✅ No critical errors found. Review warnings for improvements.', 'warning');
  } else {
    log('❌ Critical errors found. Please fix before proceeding.', 'error');
  }
  
  return totalErrors === 0;
}

// Export for use in other files
module.exports = { runLintAndTSCheck, CHECK_CONFIG };

// Run check if this file is executed directly
if (require.main === module) {
  runLintAndTSCheck()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Lint and TS check failed:', error);
      process.exit(1);
    });
}
