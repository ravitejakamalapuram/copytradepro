import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Error Recovery and Resilience Tests', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    helpers = new TestHelpers(page);
  });

  test('Network failure recovery during login', async ({ page }) => {
    await loginPage.goto();

    // Simulate network failure for login API
    await helpers.simulateNetworkFailure('**/api/auth/login');

    const testUser = TestHelpers.getTestUsers().find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    // Attempt login - should fail
    await loginPage.login(testUser.email, testUser.password);
    
    // Should show network error message
    await loginPage.expectLoginError('network');
    
    // Remove network failure simulation
    await page.unroute('**/api/auth/login');
    
    // Retry login - should succeed
    await loginPage.login(testUser.email, testUser.password);
    await loginPage.expectLoginSuccess();

    await helpers.takeScreenshot('network-failure-recovery');
  });

  test('API timeout handling and retry', async ({ page }) => {
    const testUser = TestHelpers.getTestUsers().find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await dashboardPage.waitForDashboardLoad();

    // Simulate slow API responses
    await page.route('**/api/portfolio/**', async route => {
      await new Promise(resolve => setTimeout(resolve, 5000)); // 5s delay
      await route.continue();
    });

    // Navigate to portfolio - should show loading state
    await dashboardPage.navigateToPortfolio();
    
    // Verify loading indicator is shown
    await expect(page.locator('[data-testid="loading-spinner"]')).toBeVisible();
    
    // Wait for timeout and retry mechanism
    await page.waitForTimeout(6000);
    
    // Should show retry option or error message
    const retryButton = page.locator('[data-testid="retry-button"]');
    const errorMessage = page.locator('[data-testid="error-message"]');
    
    const hasRetry = await retryButton.isVisible();
    const hasError = await errorMessage.isVisible();
    
    expect(hasRetry || hasError).toBeTruthy();

    if (hasRetry) {
      // Test retry functionality
      await retryButton.click();
      await helpers.waitForNetworkIdle();
    }

    await helpers.takeScreenshot('api-timeout-handling');
  });

  test('WebSocket connection failure and reconnection', async ({ page }) => {
    const testUser = TestHelpers.getTestUsers().find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await dashboardPage.waitForDashboardLoad();

    // Monitor WebSocket connection status
    let wsConnected = false;
    page.on('websocket', ws => {
      ws.on('open', () => { wsConnected = true; });
      ws.on('close', () => { wsConnected = false; });
    });

    // Navigate to a page that uses real-time data
    await dashboardPage.navigateToTrading();
    
    // Wait for WebSocket connection
    await page.waitForTimeout(2000);
    
    // Simulate WebSocket disconnection by going offline
    await page.context().setOffline(true);
    await page.waitForTimeout(1000);
    
    // Should show connection status indicator
    const connectionStatus = page.locator('[data-testid="connection-status"]');
    if (await connectionStatus.isVisible()) {
      const statusText = await connectionStatus.textContent();
      expect(statusText).toMatch(/offline|disconnected|reconnecting/i);
    }

    // Go back online
    await page.context().setOffline(false);
    
    // Should automatically reconnect
    await page.waitForTimeout(3000);
    
    // Verify reconnection
    if (await connectionStatus.isVisible()) {
      await page.waitForFunction(() => {
        const statusEl = document.querySelector('[data-testid="connection-status"]');
        return statusEl?.textContent?.match(/online|connected/i);
      }, { timeout: 10000 });
    }

    await helpers.takeScreenshot('websocket-reconnection');
  });

  test('Form validation and error handling', async ({ page }) => {
    const testUser = TestHelpers.getTestUsers().find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await dashboardPage.waitForDashboardLoad();
    await dashboardPage.navigateToTrading();

    // Test invalid form submissions
    const testCases = [
      {
        name: 'Empty symbol',
        symbol: '',
        quantity: '10',
        price: '100',
        expectedError: 'symbol'
      },
      {
        name: 'Invalid quantity',
        symbol: 'TCS',
        quantity: '0',
        price: '100',
        expectedError: 'quantity'
      },
      {
        name: 'Invalid price',
        symbol: 'TCS',
        quantity: '10',
        price: '0',
        expectedError: 'price'
      }
    ];

    for (const testCase of testCases) {
      // Clear form
      await page.locator('[data-testid="symbol-search"]').fill('');
      await page.locator('[data-testid="quantity-input"]').fill('');
      await page.locator('[data-testid="price-input"]').fill('');

      // Fill form with test data
      if (testCase.symbol) {
        await helpers.fillField('[data-testid="symbol-search"]', testCase.symbol);
      }
      if (testCase.quantity) {
        await helpers.fillField('[data-testid="quantity-input"]', testCase.quantity);
      }
      if (testCase.price) {
        await helpers.fillField('[data-testid="price-input"]', testCase.price);
      }

      // Try to submit
      await page.locator('[data-testid="place-order-button"]').click();

      // Should show validation error
      const errors = await helpers.checkForErrors();
      const hasExpectedError = errors.some(error => 
        error.toLowerCase().includes(testCase.expectedError.toLowerCase())
      );
      
      expect(hasExpectedError).toBeTruthy();
      
      await helpers.takeScreenshot(`form-validation-${testCase.name.replace(/\s+/g, '-')}`);
    }
  });

  test('Broker API error handling', async ({ page }) => {
    const testUser = TestHelpers.getTestUsers().find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await dashboardPage.waitForDashboardLoad();

    // Simulate broker API errors
    await page.route('**/api/broker/orders', route => {
      route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Insufficient funds',
          code: 'INSUFFICIENT_FUNDS',
          message: 'Your account does not have sufficient funds for this order'
        })
      });
    });

    await dashboardPage.navigateToTrading();

    // Fill and submit order form
    await helpers.fillField('[data-testid="symbol-search"]', 'TCS');
    await page.waitForTimeout(500);
    await page.locator('[data-testid="symbol-result"]').first().click();
    
    await page.selectOption('[data-testid="action-select"]', 'BUY');
    await helpers.fillField('[data-testid="quantity-input"]', '1000'); // Large quantity
    await page.selectOption('[data-testid="order-type-select"]', 'MARKET');
    
    // Select account
    await page.check('[data-testid="account-checkbox"]');
    
    // Submit order
    await page.locator('[data-testid="place-order-button"]').click();
    
    // Should show user-friendly error message
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();
    
    const errorText = await page.locator('[data-testid="error-message"]').textContent();
    expect(errorText).toMatch(/insufficient funds|not enough balance/i);

    await helpers.takeScreenshot('broker-api-error-handling');
  });

  test('Session expiry and re-authentication', async ({ page }) => {
    const testUser = TestHelpers.getTestUsers().find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await dashboardPage.waitForDashboardLoad();

    // Simulate session expiry
    await page.route('**/api/**', route => {
      if (route.request().url().includes('/auth/')) {
        route.continue();
      } else {
        route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Session expired',
            code: 'SESSION_EXPIRED'
          })
        });
      }
    });

    // Try to navigate to a protected page
    await dashboardPage.navigateToPortfolio();

    // Should redirect to login or show re-authentication modal
    const isRedirectedToLogin = page.url().includes('/login');
    const hasReauthModal = await page.locator('[data-testid="reauth-modal"]').isVisible();
    
    expect(isRedirectedToLogin || hasReauthModal).toBeTruthy();

    if (hasReauthModal) {
      // Re-authenticate through modal
      await helpers.fillField('[data-testid="reauth-password"]', testUser.password);
      await page.locator('[data-testid="reauth-submit"]').click();
      await helpers.waitForNetworkIdle();
    } else {
      // Re-login
      await loginPage.login(testUser.email, testUser.password);
    }

    // Should be able to access protected content again
    await dashboardPage.navigateToPortfolio();
    await expect(page.locator('[data-testid="portfolio-table"]')).toBeVisible();

    await helpers.takeScreenshot('session-expiry-recovery');
  });

  test('Component error boundary recovery', async ({ page }) => {
    const testUser = TestHelpers.getTestUsers().find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await dashboardPage.waitForDashboardLoad();

    // Inject JavaScript error to trigger error boundary
    await page.evaluate(() => {
      // Simulate a component crash
      const portfolioElement = document.querySelector('[data-testid="portfolio-summary"]');
      if (portfolioElement) {
        // Trigger an error in React component
        (portfolioElement as any).__reactInternalInstance = null;
        portfolioElement.dispatchEvent(new Event('error'));
      }
    });

    // Should show error boundary fallback UI
    const errorBoundary = page.locator('[data-testid="error-boundary"]');
    const retryButton = page.locator('[data-testid="error-retry"]');
    
    if (await errorBoundary.isVisible()) {
      expect(await errorBoundary.textContent()).toMatch(/something went wrong|error occurred/i);
      
      if (await retryButton.isVisible()) {
        await retryButton.click();
        await helpers.waitForNetworkIdle();
        
        // Should recover and show normal content
        await expect(dashboardPage.portfolioSummary).toBeVisible();
      }
    }

    await helpers.takeScreenshot('error-boundary-recovery');
  });
});