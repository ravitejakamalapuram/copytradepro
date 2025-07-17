import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Performance and Load Tests', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    helpers = new TestHelpers(page);
  });

  test('Page load performance benchmarks', async ({ page }) => {
    const testUser = TestHelpers.getTestUsers().find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    // Test login page performance
    const loginStartTime = Date.now();
    await loginPage.goto();
    const loginLoadTime = Date.now() - loginStartTime;
    
    expect(loginLoadTime).toBeLessThan(3000); // Should load within 3 seconds
    
    const loginMetrics = await helpers.measurePageLoad();
    expect(loginMetrics.firstContentfulPaint).toBeLessThan(2000);

    // Test dashboard performance after login
    const dashboardStartTime = Date.now();
    await loginPage.login(testUser.email, testUser.password);
    await dashboardPage.waitForDashboardLoad();
    const dashboardLoadTime = Date.now() - dashboardStartTime;
    
    expect(dashboardLoadTime).toBeLessThan(5000); // Should load within 5 seconds
    
    const dashboardMetrics = await helpers.measurePageLoad();
    expect(dashboardMetrics.firstContentfulPaint).toBeLessThan(3000);

    // Test trading page performance
    const tradingStartTime = Date.now();
    await dashboardPage.navigateToTrading();
    await page.waitForSelector('[data-testid="trading-form"]');
    const tradingLoadTime = Date.now() - tradingStartTime;
    
    expect(tradingLoadTime).toBeLessThan(4000);

    console.log('Performance Metrics:', {
      loginLoadTime,
      dashboardLoadTime,
      tradingLoadTime,
      loginMetrics,
      dashboardMetrics
    });

    await helpers.takeScreenshot('performance-test-complete');
  });

  test('Memory usage monitoring', async ({ page }) => {
    const testUser = TestHelpers.getTestUsers().find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await dashboardPage.waitForDashboardLoad();

    const initialMemory = await helpers.getMemoryUsage();
    console.log('Initial memory usage:', initialMemory);

    // Navigate through different pages to test memory usage
    const pages = [
      { name: 'Portfolio', action: () => dashboardPage.navigateToPortfolio() },
      { name: 'Orders', action: () => dashboardPage.navigateToOrders() },
      { name: 'Trading', action: () => dashboardPage.navigateToTrading() },
      { name: 'Dashboard', action: () => dashboardPage.goto() }
    ];

    const memoryReadings: { page: string; memory: number }[] = [];

    for (const pageInfo of pages) {
      await pageInfo.action();
      await page.waitForTimeout(2000); // Allow page to fully load
      
      const memory = await helpers.getMemoryUsage();
      memoryReadings.push({ page: pageInfo.name, memory });
      
      console.log(`${pageInfo.name} memory usage:`, memory);
      
      // Memory should not grow excessively (more than 50MB increase)
      const memoryIncrease = memory - initialMemory;
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024); // 50MB
    }

    // Test memory cleanup after navigation
    await page.waitForTimeout(5000); // Allow garbage collection
    const finalMemory = await helpers.getMemoryUsage();
    
    // Memory should not have grown significantly after navigation cycle
    const totalIncrease = finalMemory - initialMemory;
    expect(totalIncrease).toBeLessThan(30 * 1024 * 1024); // 30MB

    console.log('Memory readings:', memoryReadings);
    console.log('Final memory usage:', finalMemory);
  });

  test('Concurrent user simulation', async ({ browser }) => {
    const testUsers = TestHelpers.getTestUsers();
    const concurrentUsers = 3;
    
    const userPromises = Array.from({ length: concurrentUsers }, async (_, index) => {
      const context = await browser.newContext();
      const page = await context.newPage();
      
      const userLoginPage = new LoginPage(page);
      const userDashboardPage = new DashboardPage(page);
      const userHelpers = new TestHelpers(page);
      
      const testUser = testUsers[index % testUsers.length] || {
        email: `test.user${index}@example.com`,
        password: 'TestPassword123!',
        role: 'trader'
      };

      try {
        // Simulate user journey
        await userLoginPage.goto();
        await userLoginPage.login(testUser.email, testUser.password);
        await userDashboardPage.waitForDashboardLoad();
        
        // Simulate user activity
        await userDashboardPage.navigateToTrading();
        await page.waitForTimeout(1000);
        
        await userDashboardPage.navigateToPortfolio();
        await page.waitForTimeout(1000);
        
        await userDashboardPage.navigateToOrders();
        await page.waitForTimeout(1000);
        
        return { success: true, user: index };
      } catch (error) {
        console.error(`User ${index} failed:`, error);
        return { success: false, user: index, error };
      } finally {
        await context.close();
      }
    });

    const results = await Promise.all(userPromises);
    
    // All users should complete successfully
    const successfulUsers = results.filter(r => r.success).length;
    const failedUsers = results.filter(r => !r.success);
    
    console.log(`Concurrent users test: ${successfulUsers}/${concurrentUsers} successful`);
    
    if (failedUsers.length > 0) {
      console.log('Failed users:', failedUsers);
    }
    
    expect(successfulUsers).toBe(concurrentUsers);
  });

  test('API response time under load', async ({ page }) => {
    const testUser = TestHelpers.getTestUsers().find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await dashboardPage.waitForDashboardLoad();

    // Monitor API response times
    const apiTimes: { url: string; duration: number }[] = [];
    
    page.on('response', response => {
      if (response.url().includes('/api/')) {
        const timing = response.timing();
        apiTimes.push({
          url: response.url(),
          duration: timing.responseEnd
        });
      }
    });

    // Generate API load by navigating and refreshing data
    const loadTestActions = [
      () => dashboardPage.navigateToPortfolio(),
      () => dashboardPage.refreshData(),
      () => dashboardPage.navigateToOrders(),
      () => dashboardPage.refreshData(),
      () => dashboardPage.navigateToTrading(),
      () => page.reload(),
      () => dashboardPage.goto(),
      () => dashboardPage.refreshData()
    ];

    for (const action of loadTestActions) {
      await action();
      await page.waitForTimeout(1000);
    }

    // Analyze API response times
    const avgResponseTime = apiTimes.reduce((sum, api) => sum + api.duration, 0) / apiTimes.length;
    const maxResponseTime = Math.max(...apiTimes.map(api => api.duration));
    
    console.log('API Performance:', {
      totalRequests: apiTimes.length,
      avgResponseTime,
      maxResponseTime,
      slowRequests: apiTimes.filter(api => api.duration > 2000)
    });

    // API responses should be reasonably fast
    expect(avgResponseTime).toBeLessThan(2000); // Average under 2 seconds
    expect(maxResponseTime).toBeLessThan(5000); // Max under 5 seconds
  });

  test('WebSocket performance under high message volume', async ({ page }) => {
    const testUser = TestHelpers.getTestUsers().find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await dashboardPage.waitForDashboardLoad();

    // Navigate to trading page (which should have real-time data)
    await dashboardPage.navigateToTrading();

    let messageCount = 0;
    let totalLatency = 0;

    // Monitor WebSocket messages
    page.on('websocket', ws => {
      ws.on('framereceived', event => {
        messageCount++;
        
        // Simulate message processing time
        const processingStart = Date.now();
        
        // Parse message (simulate real processing)
        try {
          const data = JSON.parse(event.payload.toString());
          if (data.timestamp) {
            const latency = Date.now() - data.timestamp;
            totalLatency += latency;
          }
        } catch (e) {
          // Ignore parsing errors for test
        }
      });
    });

    // Wait for WebSocket messages to accumulate
    await page.waitForTimeout(10000); // 10 seconds

    const avgLatency = messageCount > 0 ? totalLatency / messageCount : 0;
    
    console.log('WebSocket Performance:', {
      messageCount,
      avgLatency,
      messagesPerSecond: messageCount / 10
    });

    // Should handle reasonable message volume
    expect(messageCount).toBeGreaterThan(0);
    if (avgLatency > 0) {
      expect(avgLatency).toBeLessThan(1000); // Average latency under 1 second
    }
  });

  test('Large dataset handling performance', async ({ page }) => {
    const testUser = TestHelpers.getTestUsers().find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await dashboardPage.waitForDashboardLoad();

    // Test portfolio page with large dataset
    await dashboardPage.navigateToPortfolio();
    
    const startTime = Date.now();
    await page.waitForSelector('[data-testid="portfolio-table"]');
    const loadTime = Date.now() - startTime;
    
    // Should load large datasets reasonably quickly
    expect(loadTime).toBeLessThan(5000);

    // Test scrolling performance with large lists
    const portfolioTable = page.locator('[data-testid="portfolio-table"]');
    
    if (await portfolioTable.isVisible()) {
      const scrollStartTime = Date.now();
      
      // Simulate scrolling through large dataset
      for (let i = 0; i < 10; i++) {
        await page.keyboard.press('PageDown');
        await page.waitForTimeout(100);
      }
      
      const scrollTime = Date.now() - scrollStartTime;
      
      // Scrolling should be smooth
      expect(scrollTime).toBeLessThan(3000);
    }

    // Test orders page with large dataset
    await dashboardPage.navigateToOrders();
    
    const ordersStartTime = Date.now();
    await page.waitForSelector('[data-testid="orders-table"], [data-testid="order-item"]');
    const ordersLoadTime = Date.now() - ordersStartTime;
    
    expect(ordersLoadTime).toBeLessThan(5000);

    console.log('Large dataset performance:', {
      portfolioLoadTime: loadTime,
      ordersLoadTime,
      scrollPerformance: scrollTime
    });
  });
});