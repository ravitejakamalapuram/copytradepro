#!/usr/bin/env node

/**
 * Environment Configuration Management Script
 * Manages environment configuration for different deployment environments
 */

const fs = require('fs');
const path = require('path');

class EnvironmentManager {
  constructor() {
    this.envPath = path.join(__dirname, '../.env');
    this.examplePath = path.join(__dirname, '../.env.example');
    this.productionPath = path.join(__dirname, '../.env.production');
    this.environments = ['development', 'staging', 'production'];
  }

  // Read environment file
  readEnvFile(filePath) {
    if (!fs.existsSync(filePath)) {
      return {};
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const env = {};
    
    content.split('\n').forEach(line => {
      line = line.trim();
      if (line && !line.startsWith('#')) {
        const [key, ...valueParts] = line.split('=');
        if (key && valueParts.length > 0) {
          env[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    
    return env;
  }

  // Write environment file
  writeEnvFile(filePath, env) {
    const lines = [];
    
    // Add header
    lines.push('# Environment Configuration');
    lines.push(`# Generated on: ${new Date().toISOString()}`);
    lines.push('');
    
    // Group related configurations
    const groups = {
      'Environment': ['NODE_ENV', 'PORT', 'FRONTEND_URL'],
      'Security': ['JWT_SECRET', 'ENCRYPTION_KEY'],
      'Database': ['MONGODB_URI'],
      'Symbol Management': [
        'UPSTOX_API_KEY', 'UPSTOX_API_SECRET', 'UPSTOX_REDIRECT_URI',
        'OPTIONS_DATA_REFRESH_TIME', 'OPTIONS_CLEANUP_EXPIRED', 'OPTIONS_MAX_EXPIRY_DAYS'
      ],
      'Broker APIs': [
        'SHOONYA_VENDOR_CODE', 'SHOONYA_IMEI', 'SHOONYA_API_KEY', 'SHOONYA_AUTH_TOKEN',
        'FYERS_CLIENT_ID', 'FYERS_SECRET_KEY', 'FYERS_REDIRECT_URI'
      ],
      'Notifications': ['VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_EMAIL'],
      'Logging': ['LOG_LEVEL', 'ENABLE_REQUEST_LOGGING'],
      'Rate Limiting': ['RATE_LIMIT_WINDOW_MS', 'RATE_LIMIT_MAX_REQUESTS'],
      'CORS': ['ALLOWED_ORIGINS']
    };
    
    Object.entries(groups).forEach(([groupName, keys]) => {
      lines.push(`# ${groupName}`);
      
      keys.forEach(key => {
        if (env[key] !== undefined) {
          lines.push(`${key}=${env[key]}`);
        }
      });
      
      lines.push('');
    });
    
    // Add any remaining keys
    const usedKeys = new Set(Object.values(groups).flat());
    const remainingKeys = Object.keys(env).filter(key => !usedKeys.has(key));
    
    if (remainingKeys.length > 0) {
      lines.push('# Additional Configuration');
      remainingKeys.forEach(key => {
        lines.push(`${key}=${env[key]}`);
      });
      lines.push('');
    }
    
    fs.writeFileSync(filePath, lines.join('\n'));
  }

  // Get environment-specific configuration
  getEnvironmentConfig(environment) {
    const baseConfig = {
      development: {
        NODE_ENV: 'development',
        PORT: '3001',
        FRONTEND_URL: 'http://localhost:5173',
        LOG_LEVEL: 'debug',
        ENABLE_REQUEST_LOGGING: 'true',
        RATE_LIMIT_WINDOW_MS: '900000',
        RATE_LIMIT_MAX_REQUESTS: '1000',
        ALLOWED_ORIGINS: 'http://localhost:5173,http://localhost:3000',
        OPTIONS_DATA_REFRESH_TIME: '08:00',
        OPTIONS_CLEANUP_EXPIRED: 'true',
        OPTIONS_MAX_EXPIRY_DAYS: '90'
      },
      staging: {
        NODE_ENV: 'staging',
        PORT: '3002',
        FRONTEND_URL: 'https://staging-copytrade.onrender.com',
        LOG_LEVEL: 'info',
        ENABLE_REQUEST_LOGGING: 'true',
        RATE_LIMIT_WINDOW_MS: '900000',
        RATE_LIMIT_MAX_REQUESTS: '500',
        ALLOWED_ORIGINS: 'https://staging-copytrade.onrender.com',
        OPTIONS_DATA_REFRESH_TIME: '08:00',
        OPTIONS_CLEANUP_EXPIRED: 'true',
        OPTIONS_MAX_EXPIRY_DAYS: '90'
      },
      production: {
        NODE_ENV: 'production',
        PORT: '3001',
        FRONTEND_URL: 'https://copytrade-pro.onrender.com',
        LOG_LEVEL: 'info',
        ENABLE_REQUEST_LOGGING: 'false',
        RATE_LIMIT_WINDOW_MS: '900000',
        RATE_LIMIT_MAX_REQUESTS: '100',
        ALLOWED_ORIGINS: 'https://copytrade-pro.onrender.com',
        OPTIONS_DATA_REFRESH_TIME: '08:00',
        OPTIONS_CLEANUP_EXPIRED: 'true',
        OPTIONS_MAX_EXPIRY_DAYS: '90'
      }
    };
    
    return baseConfig[environment] || {};
  }

  // Create environment file for specific environment
  createEnvironment(environment) {
    console.log(`🔧 Creating environment configuration for: ${environment}`);
    
    if (!this.environments.includes(environment)) {
      throw new Error(`Invalid environment: ${environment}. Valid options: ${this.environments.join(', ')}`);
    }
    
    // Read existing configuration
    let existingConfig = {};
    if (fs.existsSync(this.envPath)) {
      existingConfig = this.readEnvFile(this.envPath);
      console.log('📖 Reading existing configuration...');
    } else if (fs.existsSync(this.examplePath)) {
      existingConfig = this.readEnvFile(this.examplePath);
      console.log('📖 Reading example configuration...');
    }
    
    // Get environment-specific overrides
    const envConfig = this.getEnvironmentConfig(environment);
    
    // Merge configurations (environment-specific overrides existing)
    const finalConfig = { ...existingConfig, ...envConfig };
    
    // Ensure required fields have placeholder values
    const requiredFields = {
      JWT_SECRET: 'your-super-secure-jwt-secret-key-here-minimum-32-characters',
      MONGODB_URI: 'mongodb://localhost:27017/copytrade',
      ENCRYPTION_KEY: 'your-32-character-encryption-key-here'
    };
    
    Object.entries(requiredFields).forEach(([key, defaultValue]) => {
      if (!finalConfig[key] || finalConfig[key].includes('your-') || finalConfig[key].includes('placeholder')) {
        finalConfig[key] = defaultValue;
      }
    });
    
    // Write the configuration
    this.writeEnvFile(this.envPath, finalConfig);
    
    console.log(`✅ Environment configuration created: ${this.envPath}`);
    console.log(`📋 Environment: ${environment}`);
    console.log(`📋 Port: ${finalConfig.PORT}`);
    console.log(`📋 Log Level: ${finalConfig.LOG_LEVEL}`);
    
    return finalConfig;
  }

  // Validate environment configuration
  validateEnvironment() {
    console.log('🔍 Validating environment configuration...');
    
    if (!fs.existsSync(this.envPath)) {
      throw new Error('Environment file not found. Run with --create first.');
    }
    
    const config = this.readEnvFile(this.envPath);
    const issues = [];
    
    // Check required fields
    const requiredFields = [
      'NODE_ENV', 'PORT', 'JWT_SECRET', 'MONGODB_URI', 'ENCRYPTION_KEY'
    ];
    
    requiredFields.forEach(field => {
      if (!config[field]) {
        issues.push(`Missing required field: ${field}`);
      } else if (config[field].includes('your-') || config[field].includes('placeholder')) {
        issues.push(`Field needs to be configured: ${field}`);
      }
    });
    
    // Check field formats
    if (config.PORT && isNaN(parseInt(config.PORT))) {
      issues.push('PORT must be a number');
    }
    
    if (config.JWT_SECRET && config.JWT_SECRET.length < 32) {
      issues.push('JWT_SECRET should be at least 32 characters long');
    }
    
    if (config.MONGODB_URI && !config.MONGODB_URI.startsWith('mongodb://') && !config.MONGODB_URI.startsWith('mongodb+srv://')) {
      issues.push('MONGODB_URI should start with mongodb:// or mongodb+srv://');
    }
    
    // Report results
    if (issues.length > 0) {
      console.log('❌ Environment validation failed:');
      issues.forEach(issue => {
        console.log(`   - ${issue}`);
      });
      return false;
    } else {
      console.log('✅ Environment validation passed');
      console.log(`📋 Configuration for: ${config.NODE_ENV || 'unknown'} environment`);
      return true;
    }
  }

  // Show current configuration (without sensitive values)
  showConfiguration() {
    console.log('📋 Current Environment Configuration:');
    
    if (!fs.existsSync(this.envPath)) {
      console.log('❌ No environment file found');
      return;
    }
    
    const config = this.readEnvFile(this.envPath);
    const sensitiveFields = ['JWT_SECRET', 'ENCRYPTION_KEY', 'API_KEY', 'SECRET', 'TOKEN', 'PASSWORD'];
    
    Object.entries(config).forEach(([key, value]) => {
      const isSensitive = sensitiveFields.some(field => key.includes(field));
      const displayValue = isSensitive ? '***HIDDEN***' : value;
      console.log(`   ${key}=${displayValue}`);
    });
  }

  // Backup current environment
  backupEnvironment() {
    if (!fs.existsSync(this.envPath)) {
      console.log('❌ No environment file to backup');
      return;
    }
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(__dirname, `../.env.backup.${timestamp}`);
    
    fs.copyFileSync(this.envPath, backupPath);
    console.log(`✅ Environment backed up to: ${backupPath}`);
    
    return backupPath;
  }
}

// CLI interface
function main() {
  const args = process.argv.slice(2);
  const command = args[0];
  const environment = args[1];
  
  const manager = new EnvironmentManager();
  
  try {
    switch (command) {
      case '--create':
      case '-c':
        if (!environment) {
          console.error('❌ Environment required. Usage: --create <environment>');
          console.error(`   Valid environments: ${manager.environments.join(', ')}`);
          process.exit(1);
        }
        manager.createEnvironment(environment);
        break;
        
      case '--validate':
      case '-v':
        const isValid = manager.validateEnvironment();
        process.exit(isValid ? 0 : 1);
        break;
        
      case '--show':
      case '-s':
        manager.showConfiguration();
        break;
        
      case '--backup':
      case '-b':
        manager.backupEnvironment();
        break;
        
      case '--help':
      case '-h':
      default:
        console.log('Environment Configuration Management');
        console.log('');
        console.log('Usage:');
        console.log('  node manage-environment.js --create <environment>  Create environment config');
        console.log('  node manage-environment.js --validate              Validate current config');
        console.log('  node manage-environment.js --show                  Show current config');
        console.log('  node manage-environment.js --backup                Backup current config');
        console.log('  node manage-environment.js --help                  Show this help');
        console.log('');
        console.log('Environments:');
        console.log(`  ${manager.environments.join(', ')}`);
        console.log('');
        console.log('Examples:');
        console.log('  node manage-environment.js --create production');
        console.log('  node manage-environment.js --validate');
        break;
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

// Run CLI if this script is executed directly
if (require.main === module) {
  main();
}

module.exports = EnvironmentManager;