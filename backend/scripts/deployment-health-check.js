#!/usr/bin/env node

/**
 * Deployment Health Check Script
 * Comprehensive health check specifically for deployment validation
 * Focuses on symbol management system components
 */

const http = require('http');
const https = require('https');
const mongoose = require('mongoose');
require('dotenv').config();

const config = {
    host: process.env.HEALTH_CHECK_HOST || 'localhost',
    port: process.env.HEALTH_CHECK_PORT || process.env.PORT || 3001,
    timeout: parseInt(process.env.HEALTH_CHECK_TIMEOUT || '15000'),
    retries: parseInt(process.env.HEALTH_CHECK_RETRIES || '3'),
    retryDelay: parseInt(process.env.HEALTH_CHECK_RETRY_DELAY || '3000'),
    useHttps: process.env.HEALTH_CHECK_HTTPS === 'true',
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/copytrade'
};

class DeploymentHealthChecker {
    constructor() {
        this.results = [];
        this.startTime = Date.now();
    }

    async makeRequest(path, options = {}) {
        return new Promise((resolve, reject) => {
            const client = config.useHttps ? https : http;
            const url = `${config.useHttps ? 'https' : 'http'}://${config.host}:${config.port}${path}`;

            const req = client.get(url, { timeout: config.timeout, ...options }, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    try {
                        const data = JSON.parse(body);
                        resolve({ status: res.statusCode, data, raw: body });
                    } catch (error) {
                        resolve({ status: res.statusCode, data: null, raw: body });
                    }
                });
            });

            req.on('timeout', () => {
                req.destroy();
                reject(new Error('Request timeout'));
            });

            req.on('error', reject);
            req.setTimeout(config.timeout);
        });
    }

    async checkDatabaseConnection() {
        console.log('🔍 Checking database connection...');

        try {
            await mongoose.connect(config.mongoUri, {
                serverSelectionTimeoutMS: 10000,
                connectTimeoutMS: 10000
            });

            const db = mongoose.connection.db;
            await db.admin().ping();

            this.results.push({
                test: 'Database Connection',
                success: true,
                details: 'MongoDB connection successful',
                data: { uri: config.mongoUri.replace(/\/\/.*@/, '//***:***@') }
            });

            console.log('✅ Database connection successful');
            return true;
        } catch (error) {
            this.results.push({
                test: 'Database Connection',
                success: false,
                details: `Database connection failed: ${error.message}`,
                data: null
            });

            console.log('❌ Database connection failed:', error.message);
            return false;
        } finally {
            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.close();
            }
        }
    }

    async checkSymbolDatabase() {
        console.log('🔍 Checking symbol database...');

        try {
            await mongoose.connect(config.mongoUri);
            const db = mongoose.connection.db;

            // Check if symbol collections exist
            const collections = await db.listCollections().toArray();
            const collectionNames = collections.map(c => c.name);

            const requiredCollections = ['standardizedsymbols', 'symbolprocessinglogs'];
            const missingCollections = requiredCollections.filter(name =>
                !collectionNames.includes(name)
            );

            if (missingCollections.length > 0) {
                this.results.push({
                    test: 'Symbol Database Schema',
                    success: false,
                    details: `Missing collections: ${missingCollections.join(', ')}`,
                    data: { missingCollections, existingCollections: collectionNames }
                });

                console.log('❌ Symbol database schema incomplete');
                return false;
            }

            // Check symbol data
            const symbolsCollection = db.collection('standardizedsymbols');
            const symbolCount = await symbolsCollection.countDocuments();
            const activeSymbolCount = await symbolsCollection.countDocuments({ isActive: true });

            this.results.push({
                test: 'Symbol Database Data',
                success: symbolCount > 0,
                details: `Found ${symbolCount} symbols (${activeSymbolCount} active)`,
                data: { totalSymbols: symbolCount, activeSymbols: activeSymbolCount }
            });

            if (symbolCount > 0) {
                console.log(`✅ Symbol database contains ${symbolCount} symbols`);
                return true;
            } else {
                console.log('❌ Symbol database is empty');
                return false;
            }

        } catch (error) {
            this.results.push({
                test: 'Symbol Database',
                success: false,
                details: `Symbol database check failed: ${error.message}`,
                data: null
            });

            console.log('❌ Symbol database check failed:', error.message);
            return false;
        } finally {
            if (mongoose.connection.readyState === 1) {
                await mongoose.connection.close();
            }
        }
    }

    async checkSymbolEndpoints() {
        console.log('🔍 Checking symbol API endpoints...');

        const endpoints = [
            { path: '/api/symbols/health', name: 'Symbol Health', critical: true },
            { path: '/api/symbols/search?query=NIFTY', name: 'Symbol Search', critical: true },
            { path: '/api/symbols/statistics', name: 'Symbol Statistics', critical: false }
        ];

        let allSuccess = true;

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.path);
                const success = response.status >= 200 && response.status < 400;

                this.results.push({
                    test: endpoint.name,
                    success,
                    details: success ? `${endpoint.name} responding (${response.status})` : `${endpoint.name} failed (${response.status})`,
                    data: { status: response.status, response: response.data }
                });

                if (success) {
                    console.log(`✅ ${endpoint.name}: ${response.status}`);
                } else {
                    console.log(`❌ ${endpoint.name}: ${response.status}`);
                    if (endpoint.critical) {
                        allSuccess = false;
                    }
                }

            } catch (error) {
                this.results.push({
                    test: endpoint.name,
                    success: false,
                    details: `${endpoint.name} failed: ${error.message}`,
                    data: null
                });

                console.log(`❌ ${endpoint.name}: ${error.message}`);
                if (endpoint.critical) {
                    allSuccess = false;
                }
            }
        }

        return allSuccess;
    }

    async checkSystemHealth() {
        console.log('🔍 Checking system health endpoints...');

        const endpoints = [
            { path: '/health', name: 'Basic Health', critical: true },
            { path: '/api/health', name: 'API Health', critical: true },
            { path: '/api/monitoring/health', name: 'Monitoring Health', critical: false }
        ];

        let allSuccess = true;

        for (const endpoint of endpoints) {
            try {
                const response = await this.makeRequest(endpoint.path);
                const success = response.status >= 200 && response.status < 400;

                this.results.push({
                    test: endpoint.name,
                    success,
                    details: success ? `${endpoint.name} responding (${response.status})` : `${endpoint.name} failed (${response.status})`,
                    data: { status: response.status, response: response.data }
                });

                if (success) {
                    console.log(`✅ ${endpoint.name}: ${response.status}`);
                } else {
                    console.log(`❌ ${endpoint.name}: ${response.status}`);
                    if (endpoint.critical) {
                        allSuccess = false;
                    }
                }

            } catch (error) {
                this.results.push({
                    test: endpoint.name,
                    success: false,
                    details: `${endpoint.name} failed: ${error.message}`,
                    data: null
                });

                console.log(`❌ ${endpoint.name}: ${error.message}`);
                if (endpoint.critical) {
                    allSuccess = false;
                }
            }
        }

        return allSuccess;
    }

    async runAllChecks() {
        console.log('🚀 Starting deployment health checks...');
        console.log(`📍 Target: ${config.useHttps ? 'https' : 'http'}://${config.host}:${config.port}`);
        console.log(`🗄️  Database: ${config.mongoUri.replace(/\/\/.*@/, '//***:***@')}`);
        console.log('');

        const checks = [
            { name: 'Database Connection', fn: () => this.checkDatabaseConnection() },
            { name: 'Symbol Database', fn: () => this.checkSymbolDatabase() },
            { name: 'System Health', fn: () => this.checkSystemHealth() },
            { name: 'Symbol Endpoints', fn: () => this.checkSymbolEndpoints() }
        ];

        let overallSuccess = true;

        for (const check of checks) {
            console.log(`\n🔧 Running ${check.name} checks...`);
            try {
                const success = await check.fn();
                if (!success) {
                    overallSuccess = false;
                }
            } catch (error) {
                console.log(`❌ ${check.name} check failed:`, error.message);
                overallSuccess = false;
            }
        }

        this.generateReport();
        return overallSuccess;
    }

    generateReport() {
        const totalDuration = Date.now() - this.startTime;
        const successful = this.results.filter(r => r.success);
        const failed = this.results.filter(r => !r.success);
        const critical = failed.filter(r =>
            r.test.includes('Database') ||
            r.test.includes('Basic Health') ||
            r.test.includes('API Health') ||
            r.test.includes('Symbol Health') ||
            r.test.includes('Symbol Search')
        );

        console.log('\n📊 DEPLOYMENT HEALTH CHECK REPORT');
        console.log('='.repeat(60));
        console.log(`Total Duration: ${totalDuration}ms`);
        console.log(`Tests Run: ${this.results.length}`);
        console.log(`Passed: ${successful.length}`);
        console.log(`Failed: ${failed.length}`);
        console.log(`Critical Failures: ${critical.length}`);
        console.log('');

        if (successful.length > 0) {
            console.log('✅ PASSED CHECKS:');
            successful.forEach(result => {
                console.log(`  • ${result.test}: ${result.details}`);
            });
            console.log('');
        }

        if (failed.length > 0) {
            console.log('❌ FAILED CHECKS:');
            failed.forEach(result => {
                console.log(`  • ${result.test}: ${result.details}`);
                if (critical.includes(result)) {
                    console.log(`    ⚠️  CRITICAL FAILURE`);
                }
            });
            console.log('');
        }

        // Overall assessment
        if (critical.length > 0) {
            console.log('🚨 DEPLOYMENT STATUS: FAILED');
            console.log('Critical components are not working. Deployment should be rolled back.');
            process.exit(1);
        } else if (failed.length > 0) {
            console.log('⚠️  DEPLOYMENT STATUS: DEGRADED');
            console.log('Some non-critical components have issues. Monitor closely.');
            process.exit(0);
        } else {
            console.log('✅ DEPLOYMENT STATUS: HEALTHY');
            console.log('All deployment health checks passed successfully.');
            process.exit(0);
        }
    }
}

// Run health checks if this script is executed directly
if (require.main === module) {
    const checker = new DeploymentHealthChecker();
    checker.runAllChecks().catch(error => {
        console.error('🚨 Deployment health check failed:', error);
        process.exit(1);
    });
}

module.exports = DeploymentHealthChecker;