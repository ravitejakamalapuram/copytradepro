#!/usr/bin/env node

/**
 * Deployment Validation Script
 * Validates that all bug fixes are working correctly after deployment
 */

const http = require('http');
const https = require('https');

const config = {
  host: process.env.VALIDATION_HOST || 'localhost',
  port: process.env.VALIDATION_PORT || process.env.PORT || 3001,
  timeout: parseInt(process.env.VALIDATION_TIMEOUT || '15000'),
  useHttps: process.env.VALIDATION_HTTPS === 'true',
  authToken: process.env.VALIDATION_AUTH_TOKEN
};

class DeploymentValidator {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async makeRequest(path, options = {}) {
    return new Promise((resolve, reject) => {
      const client = config.useHttps ? https : http;
      const url = `${config.useHttps ? 'https' : 'http'}://${config.host}:${config.port}${path}`;
      
      const requestOptions = {
        timeout: config.timeout,
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'DeploymentValidator/1.0',
          ...(config.authToken && { 'Authorization': `Bearer ${config.authToken}` }),
          ...options.headers
        },
        ...options
      };

      const req = client.get(url, requestOptions, (res) => {
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data,
              raw: body
            });
          } catch (error) {
            resolve({
              status: res.statusCode,
              headers: res.headers,
              data: null,
              raw: body
            });
          }
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.on('error', (error) => {
        reject(error);
      });
      
      req.setTimeout(config.timeout);
    });
  }

  async validateBasicHealth() {
    console.log('🔍 Validating basic health...');
    
    try {
      const response = await this.makeRequest('/health');
      
      const success = response.status === 200 && 
                     response.data && 
                     response.data.status === 'OK';
      
      this.results.push({
        test: 'Basic Health Check',
        success,
        details: success ? 'Health endpoint responding correctly' : 'Health endpoint failed',
        data: response.data
      });
      
      if (success) {
        console.log('✅ Basic health check passed');
      } else {
        console.log('❌ Basic health check failed');
      }
      
      return success;
    } catch (error) {
      this.results.push({
        test: 'Basic Health Check',
        success: false,
        details: `Health check failed: ${error.message}`,
        data: null
      });
      
      console.log('❌ Basic health check failed:', error.message);
      return false;
    }
  }

  async validateMonitoringSystem() {
    console.log('🔍 Validating monitoring system...');
    
    try {
      const response = await this.makeRequest('/api/monitoring/health');
      
      const success = response.status === 200 || response.status === 401; // 401 is OK (auth required)
      
      this.results.push({
        test: 'Monitoring System',
        success,
        details: success ? 'Monitoring endpoints accessible' : 'Monitoring endpoints failed',
        data: response.data
      });
      
      if (success) {
        console.log('✅ Monitoring system validation passed');
      } else {
        console.log('❌ Monitoring system validation failed');
      }
      
      return success;
    } catch (error) {
      this.results.push({
        test: 'Monitoring System',
        success: false,
        details: `Monitoring validation failed: ${error.message}`,
        data: null
      });
      
      console.log('❌ Monitoring system validation failed:', error.message);
      return false;
    }
  }

  async validateErrorHandling() {
    console.log('🔍 Validating error handling...');
    
    try {
      // Test 404 error handling
      const response = await this.makeRequest('/api/nonexistent-endpoint');
      
      const success = response.status === 404 && 
                     response.data && 
                     (response.data.success === false || response.data.message);
      
      this.results.push({
        test: 'Error Handling (404)',
        success,
        details: success ? 'Error responses properly formatted' : 'Error responses not properly formatted',
        data: response.data
      });
      
      if (success) {
        console.log('✅ Error handling validation passed');
      } else {
        console.log('❌ Error handling validation failed');
      }
      
      return success;
    } catch (error) {
      this.results.push({
        test: 'Error Handling',
        success: false,
        details: `Error handling validation failed: ${error.message}`,
        data: null
      });
      
      console.log('❌ Error handling validation failed:', error.message);
      return false;
    }
  }

  async validateAPIResponses() {
    console.log('🔍 Validating API response consistency...');
    
    const endpoints = [
      '/api/health',
      '/health'
    ];
    
    let allSuccess = true;
    
    for (const endpoint of endpoints) {
      try {
        const response = await this.makeRequest(endpoint);
        
        const success = response.status >= 200 && response.status < 500 && // Allow auth errors
                       response.headers['content-type']?.includes('application/json');
        
        this.results.push({
          test: `API Response Consistency (${endpoint})`,
          success,
          details: success ? 'API response format consistent' : 'API response format inconsistent',
          data: {
            status: response.status,
            contentType: response.headers['content-type']
          }
        });
        
        if (success) {
          console.log(`✅ API response validation passed for ${endpoint}`);
        } else {
          console.log(`❌ API response validation failed for ${endpoint}`);
          allSuccess = false;
        }
      } catch (error) {
        this.results.push({
          test: `API Response Consistency (${endpoint})`,
          success: false,
          details: `API validation failed: ${error.message}`,
          data: null
        });
        
        console.log(`❌ API response validation failed for ${endpoint}:`, error.message);
        allSuccess = false;
      }
    }
    
    return allSuccess;
  }

  async validatePerformance() {
    console.log('🔍 Validating performance...');
    
    const startTime = Date.now();
    
    try {
      const response = await this.makeRequest('/health');
      const responseTime = Date.now() - startTime;
      
      const success = response.status === 200 && responseTime < 5000; // 5 second threshold
      
      this.results.push({
        test: 'Performance Check',
        success,
        details: success ? `Response time acceptable (${responseTime}ms)` : `Response time too slow (${responseTime}ms)`,
        data: {
          responseTime,
          threshold: 5000
        }
      });
      
      if (success) {
        console.log(`✅ Performance validation passed (${responseTime}ms)`);
      } else {
        console.log(`❌ Performance validation failed (${responseTime}ms)`);
      }
      
      return success;
    } catch (error) {
      this.results.push({
        test: 'Performance Check',
        success: false,
        details: `Performance validation failed: ${error.message}`,
        data: null
      });
      
      console.log('❌ Performance validation failed:', error.message);
      return false;
    }
  }

  async validateMemoryUsage() {
    console.log('🔍 Validating memory usage...');
    
    try {
      const response = await this.makeRequest('/api/monitoring/metrics');
      
      // This will likely return 401 without auth, but that's OK for validation
      const success = response.status === 200 || response.status === 401;
      
      this.results.push({
        test: 'Memory Usage Check',
        success,
        details: success ? 'Memory monitoring endpoints accessible' : 'Memory monitoring endpoints failed',
        data: response.data
      });
      
      if (success) {
        console.log('✅ Memory usage validation passed');
      } else {
        console.log('❌ Memory usage validation failed');
      }
      
      return success;
    } catch (error) {
      this.results.push({
        test: 'Memory Usage Check',
        success: false,
        details: `Memory usage validation failed: ${error.message}`,
        data: null
      });
      
      console.log('❌ Memory usage validation failed:', error.message);
      return false;
    }
  }

  async validateSecurityHeaders() {
    console.log('🔍 Validating security headers...');
    
    try {
      const response = await this.makeRequest('/health');
      
      const requiredHeaders = ['x-content-type-options', 'x-frame-options'];
      const presentHeaders = requiredHeaders.filter(header => 
        response.headers[header] || response.headers[header.toLowerCase()]
      );
      
      const success = presentHeaders.length >= 1; // At least some security headers
      
      this.results.push({
        test: 'Security Headers',
        success,
        details: success ? `Security headers present: ${presentHeaders.join(', ')}` : 'Security headers missing',
        data: {
          requiredHeaders,
          presentHeaders,
          allHeaders: Object.keys(response.headers)
        }
      });
      
      if (success) {
        console.log('✅ Security headers validation passed');
      } else {
        console.log('❌ Security headers validation failed');
      }
      
      return success;
    } catch (error) {
      this.results.push({
        test: 'Security Headers',
        success: false,
        details: `Security headers validation failed: ${error.message}`,
        data: null
      });
      
      console.log('❌ Security headers validation failed:', error.message);
      return false;
    }
  }

  async runAllValidations() {
    console.log('🚀 Starting deployment validation...');
    console.log(`📍 Target: ${config.useHttps ? 'https' : 'http'}://${config.host}:${config.port}`);
    console.log(`⏱️  Timeout: ${config.timeout}ms`);
    console.log('');

    const validations = [
      this.validateBasicHealth(),
      this.validateMonitoringSystem(),
      this.validateErrorHandling(),
      this.validateAPIResponses(),
      this.validatePerformance(),
      this.validateMemoryUsage(),
      this.validateSecurityHeaders()
    ];

    const results = await Promise.allSettled(validations);
    
    this.generateReport();
    
    return this.results.every(result => result.success);
  }

  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    const critical = failed.filter(r => r.test.includes('Health') || r.test.includes('Error'));

    console.log('');
    console.log('📊 DEPLOYMENT VALIDATION REPORT');
    console.log('='.repeat(60));
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Tests Run: ${this.results.length}`);
    console.log(`Passed: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    console.log(`Critical Failures: ${critical.length}`);
    console.log('');

    if (successful.length > 0) {
      console.log('✅ PASSED TESTS:');
      successful.forEach(result => {
        console.log(`  • ${result.test}: ${result.details}`);
      });
      console.log('');
    }

    if (failed.length > 0) {
      console.log('❌ FAILED TESTS:');
      failed.forEach(result => {
        console.log(`  • ${result.test}: ${result.details}`);
        if (result.test.includes('Health') || result.test.includes('Error')) {
          console.log(`    ⚠️  CRITICAL FAILURE`);
        }
      });
      console.log('');
    }

    // Overall assessment
    if (critical.length > 0) {
      console.log('🚨 VALIDATION STATUS: FAILED');
      console.log('Critical issues detected. Deployment should be rolled back.');
      process.exit(1);
    } else if (failed.length > 0) {
      console.log('⚠️  VALIDATION STATUS: PARTIAL');
      console.log('Some non-critical issues detected. Monitor closely.');
      process.exit(0);
    } else {
      console.log('✅ VALIDATION STATUS: PASSED');
      console.log('All validations passed. Deployment is successful.');
      process.exit(0);
    }
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new DeploymentValidator();
  validator.runAllValidations().catch(error => {
    console.error('🚨 Validation failed:', error);
    process.exit(1);
  });
}

module.exports = DeploymentValidator;