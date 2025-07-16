#!/usr/bin/env node

/**
 * Health Check Script
 * Comprehensive health check for production deployment validation
 */

const http = require('http');
const https = require('https');

const config = {
  host: process.env.HEALTH_CHECK_HOST || 'localhost',
  port: process.env.HEALTH_CHECK_PORT || process.env.PORT || 3001,
  timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '10000'),
  retries: parseInt(process.env.HEALTH_CHECK_RETRIES || '3'),
  retryDelay: parseInt(process.env.HEALTH_CHECK_RETRY_DELAY || '2000'),
  useHttps: process.env.HEALTH_CHECK_HTTPS === 'true'
};

const endpoints = [
  { path: '/health', name: 'Basic Health Check', critical: true },
  { path: '/api/health', name: 'API Health Check', critical: true },
  { path: '/api/monitoring/health', name: 'Monitoring Health Check', critical: false }
];

class HealthChecker {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async checkEndpoint(endpoint, attempt = 1) {
    return new Promise((resolve) => {
      const client = config.useHttps ? https : http;
      const url = `${config.useHttps ? 'https' : 'http'}://${config.host}:${config.port}${endpoint.path}`;
      
      console.log(`🔍 Checking ${endpoint.name} (${url}) - Attempt ${attempt}/${config.retries}`);
      
      const startTime = Date.now();
      const req = client.get(url, { timeout: config.timeout }, (res) => {
        const duration = Date.now() - startTime;
        let body = '';
        
        res.on('data', (chunk) => {
          body += chunk;
        });
        
        res.on('end', () => {
          const result = {
            endpoint: endpoint.name,
            path: endpoint.path,
            status: res.statusCode,
            duration,
            success: res.statusCode >= 200 && res.statusCode < 300,
            critical: endpoint.critical,
            attempt,
            response: this.parseResponse(body),
            error: null
          };
          
          if (result.success) {
            console.log(`✅ ${endpoint.name}: ${res.statusCode} (${duration}ms)`);
          } else {
            console.log(`❌ ${endpoint.name}: ${res.statusCode} (${duration}ms)`);
          }
          
          resolve(result);
        });
      });
      
      req.on('timeout', () => {
        req.destroy();
        const result = {
          endpoint: endpoint.name,
          path: endpoint.path,
          status: 0,
          duration: config.timeout,
          success: false,
          critical: endpoint.critical,
          attempt,
          response: null,
          error: 'Request timeout'
        };
        
        console.log(`⏰ ${endpoint.name}: Timeout after ${config.timeout}ms`);
        resolve(result);
      });
      
      req.on('error', (error) => {
        const duration = Date.now() - startTime;
        const result = {
          endpoint: endpoint.name,
          path: endpoint.path,
          status: 0,
          duration,
          success: false,
          critical: endpoint.critical,
          attempt,
          response: null,
          error: error.message
        };
        
        console.log(`🚨 ${endpoint.name}: ${error.message} (${duration}ms)`);
        resolve(result);
      });
      
      req.setTimeout(config.timeout);
    });
  }

  parseResponse(body) {
    try {
      return JSON.parse(body);
    } catch (error) {
      return { raw: body.substring(0, 200) };
    }
  }

  async checkWithRetries(endpoint) {
    let lastResult = null;
    
    for (let attempt = 1; attempt <= config.retries; attempt++) {
      lastResult = await this.checkEndpoint(endpoint, attempt);
      
      if (lastResult.success) {
        break;
      }
      
      if (attempt < config.retries) {
        console.log(`⏳ Retrying in ${config.retryDelay}ms...`);
        await this.sleep(config.retryDelay);
      }
    }
    
    return lastResult;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async runHealthChecks() {
    console.log('🏥 Starting health checks...');
    console.log(`📍 Target: ${config.useHttps ? 'https' : 'http'}://${config.host}:${config.port}`);
    console.log(`⏱️  Timeout: ${config.timeout}ms, Retries: ${config.retries}`);
    console.log('');

    for (const endpoint of endpoints) {
      const result = await this.checkWithRetries(endpoint);
      this.results.push(result);
      console.log('');
    }

    this.generateReport();
  }

  generateReport() {
    const totalDuration = Date.now() - this.startTime;
    const successful = this.results.filter(r => r.success);
    const failed = this.results.filter(r => !r.success);
    const criticalFailed = failed.filter(r => r.critical);

    console.log('📊 HEALTH CHECK REPORT');
    console.log('='.repeat(50));
    console.log(`Total Duration: ${totalDuration}ms`);
    console.log(`Endpoints Checked: ${this.results.length}`);
    console.log(`Successful: ${successful.length}`);
    console.log(`Failed: ${failed.length}`);
    console.log(`Critical Failures: ${criticalFailed.length}`);
    console.log('');

    if (successful.length > 0) {
      console.log('✅ SUCCESSFUL CHECKS:');
      successful.forEach(result => {
        console.log(`  • ${result.endpoint}: ${result.status} (${result.duration}ms)`);
        if (result.response && result.response.status) {
          console.log(`    Status: ${result.response.status}`);
        }
        if (result.response && result.response.uptime) {
          console.log(`    Uptime: ${Math.floor(result.response.uptime)}s`);
        }
      });
      console.log('');
    }

    if (failed.length > 0) {
      console.log('❌ FAILED CHECKS:');
      failed.forEach(result => {
        console.log(`  • ${result.endpoint}: ${result.error || `HTTP ${result.status}`} (${result.duration}ms)`);
        if (result.critical) {
          console.log(`    ⚠️  CRITICAL FAILURE`);
        }
      });
      console.log('');
    }

    // Overall health assessment
    if (criticalFailed.length > 0) {
      console.log('🚨 OVERALL STATUS: UNHEALTHY');
      console.log('Critical endpoints are failing. Deployment should be rolled back.');
      process.exit(1);
    } else if (failed.length > 0) {
      console.log('⚠️  OVERALL STATUS: DEGRADED');
      console.log('Some non-critical endpoints are failing. Monitor closely.');
      process.exit(0);
    } else {
      console.log('✅ OVERALL STATUS: HEALTHY');
      console.log('All endpoints are responding correctly.');
      process.exit(0);
    }
  }
}

// Run health checks if this script is executed directly
if (require.main === module) {
  const checker = new HealthChecker();
  checker.runHealthChecks().catch(error => {
    console.error('🚨 Health check failed:', error);
    process.exit(1);
  });
}

module.exports = HealthChecker;