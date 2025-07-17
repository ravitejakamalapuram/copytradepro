#!/usr/bin/env node

/**
 * Design System Validation Script
 * Validates that all CSS files use design tokens consistently
 * and checks for hardcoded values that should be replaced
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Patterns to check for hardcoded values
const HARDCODED_PATTERNS = {
  colors: /(?:color|background|border-color):\s*(?:#[0-9a-fA-F]{3,6}|rgb\(|rgba\(|hsl\()/g,
  spacing: /(?:padding|margin|gap|top|right|bottom|left|width|height):\s*(?:\d+px|\d+rem|\d+em)(?!\s*\/)/g,
  borderRadius: /border-radius:\s*(?:\d+px|\d+rem|\d+em)/g,
  fontSize: /font-size:\s*(?:\d+px|\d+rem|\d+em)/g,
  shadows: /box-shadow:\s*(?!var\()/g
};

// Required design tokens
const REQUIRED_TOKENS = [
  '--color-profit',
  '--color-loss',
  '--color-neutral',
  '--bg-primary',
  '--bg-secondary',
  '--bg-surface',
  '--text-primary',
  '--text-secondary',
  '--space-1',
  '--space-2',
  '--space-3',
  '--space-4',
  '--radius-sm',
  '--radius-md',
  '--radius-lg',
  '--font-sans',
  '--font-mono'
];

class DesignSystemValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.cssFiles = [];
  }

  // Find all CSS files in the project
  findCSSFiles(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory() && !file.startsWith('.') && file !== 'node_modules') {
        this.findCSSFiles(filePath);
      } else if (file.endsWith('.css')) {
        this.cssFiles.push(filePath);
      }
    }
  }

  // Check for hardcoded values in CSS files
  checkHardcodedValues(filePath, content) {
    const relativePath = path.relative(process.cwd(), filePath);
    
    for (const [type, pattern] of Object.entries(HARDCODED_PATTERNS)) {
      const matches = content.match(pattern);
      if (matches) {
        matches.forEach(match => {
          // Skip certain exceptions
          if (this.isException(match, type)) return;
          
          this.warnings.push({
            file: relativePath,
            type: 'hardcoded-value',
            category: type,
            message: `Hardcoded ${type} found: ${match}`,
            suggestion: `Consider using a design token instead`
          });
        });
      }
    }
  }

  // Check if a hardcoded value is an acceptable exception
  isException(match, type) {
    const exceptions = {
      colors: [
        'transparent',
        'inherit',
        'currentColor',
        'white',
        'black'
      ],
      spacing: [
        '0px',
        '0rem',
        '0em',
        '100%',
        'auto'
      ]
    };

    return exceptions[type]?.some(exception => match.includes(exception));
  }

  // Check if design tokens are properly defined
  checkDesignTokens(content) {
    const missingTokens = REQUIRED_TOKENS.filter(token => 
      !content.includes(token)
    );

    if (missingTokens.length > 0) {
      this.errors.push({
        type: 'missing-tokens',
        message: `Missing required design tokens: ${missingTokens.join(', ')}`,
        file: 'design-system.css'
      });
    }
  }

  // Check for CSS custom property usage
  checkTokenUsage(filePath, content) {
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Skip design-system.css as it defines the tokens
    if (relativePath.includes('design-system.css')) return;

    const varUsage = (content.match(/var\(--[\w-]+\)/g) || []).length;
    const totalProperties = (content.match(/[\w-]+:\s*[^;]+;/g) || []).length;
    
    if (totalProperties > 10 && varUsage / totalProperties < 0.3) {
      this.warnings.push({
        file: relativePath,
        type: 'low-token-usage',
        message: `Low design token usage: ${varUsage}/${totalProperties} properties use tokens`,
        suggestion: 'Consider using more design tokens for consistency'
      });
    }
  }

  // Check for duplicate CSS rules
  checkDuplicates(filePath, content) {
    const relativePath = path.relative(process.cwd(), filePath);
    const selectors = content.match(/[^{}]+(?=\s*\{)/g) || [];
    const duplicates = selectors.filter((selector, index) => 
      selectors.indexOf(selector.trim()) !== index
    );

    if (duplicates.length > 0) {
      this.warnings.push({
        file: relativePath,
        type: 'duplicate-selectors',
        message: `Duplicate selectors found: ${[...new Set(duplicates)].join(', ')}`,
        suggestion: 'Consolidate duplicate selectors'
      });
    }
  }

  // Validate accessibility requirements
  checkAccessibility(filePath, content) {
    const relativePath = path.relative(process.cwd(), filePath);
    
    // Check for focus states
    const interactiveSelectors = content.match(/\.(btn|button|link|interactive)[^{]*\{/g) || [];
    const focusStates = content.match(/:focus[^{]*\{/g) || [];
    
    if (interactiveSelectors.length > 0 && focusStates.length === 0) {
      this.warnings.push({
        file: relativePath,
        type: 'missing-focus-states',
        message: 'Interactive elements found without focus states',
        suggestion: 'Add :focus styles for accessibility'
      });
    }

    // Check for proper contrast tokens
    if (content.includes('color:') && !content.includes('--text-') && !content.includes('var(')) {
      this.warnings.push({
        file: relativePath,
        type: 'hardcoded-text-color',
        message: 'Hardcoded text colors may not meet contrast requirements',
        suggestion: 'Use semantic text color tokens'
      });
    }
  }

  // Run all validations
  validate() {
    console.log('🔍 Validating Design System...\n');

    // Determine the correct base path
    const basePath = process.cwd().includes('frontend') ? '../..' : './frontend/src';

    // Find all CSS files
    this.findCSSFiles(basePath);

    // Read and validate design system file
    const designSystemPath = path.join(__dirname, 'design-system.css');
    if (fs.existsSync(designSystemPath)) {
      const designSystemContent = fs.readFileSync(designSystemPath, 'utf8');
      this.checkDesignTokens(designSystemContent);
    } else {
      this.errors.push({
        type: 'missing-file',
        message: 'design-system.css not found',
        file: 'design-system.css'
      });
    }

    // Validate each CSS file
    this.cssFiles.forEach(filePath => {
      const content = fs.readFileSync(filePath, 'utf8');
      
      this.checkHardcodedValues(filePath, content);
      this.checkTokenUsage(filePath, content);
      this.checkDuplicates(filePath, content);
      this.checkAccessibility(filePath, content);
    });

    this.generateReport();
  }

  // Generate validation report
  generateReport() {
    console.log('📊 Design System Validation Report\n');
    console.log(`Files checked: ${this.cssFiles.length}`);
    console.log(`Errors: ${this.errors.length}`);
    console.log(`Warnings: ${this.warnings.length}\n`);

    if (this.errors.length > 0) {
      console.log('❌ ERRORS:');
      this.errors.forEach(error => {
        console.log(`  • ${error.message} (${error.file})`);
      });
      console.log('');
    }

    if (this.warnings.length > 0) {
      console.log('⚠️  WARNINGS:');
      this.warnings.forEach(warning => {
        console.log(`  • ${warning.message} (${warning.file})`);
        if (warning.suggestion) {
          console.log(`    💡 ${warning.suggestion}`);
        }
      });
      console.log('');
    }

    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ All validations passed! Design system is consistent.');
    } else if (this.errors.length === 0) {
      console.log('✅ No critical errors found. Consider addressing warnings for better consistency.');
    } else {
      console.log('❌ Critical errors found. Please fix before proceeding.');
      process.exit(1);
    }
  }
}

// Run validation if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const validator = new DesignSystemValidator();
  validator.validate();
}

export default DesignSystemValidator;
