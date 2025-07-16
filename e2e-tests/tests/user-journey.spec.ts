import { test, expect } from '@playwright/test';
import { LoginPage } from '../pages/LoginPage';
import { DashboardPage } from '../pages/DashboardPage';
import { TestHelpers } from '../utils/test-helpers';

test.describe('Complete User Journey Tests', () => {
  let loginPage: LoginPage;
  let dashboardPage: DashboardPage;
  let helpers: TestHelpers;

  test.beforeEach(async ({ page }) => {
    loginPage = new LoginPage(page);
    dashboardPage = new DashboardPage(page);
    helpers = new TestHelpers(page);
  });

  test('Complete user journey: Registration to Order Execution', async ({ page }) => {
    // Step 1: Navigate to application
    await page.goto('/');
    await helpers.waitForNetworkIdle();

    // Step 2: User Registration (if not already registered)
    const testUsers = TestHelpers.getTestUsers();
    const testUser = testUsers.find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    // Step 3: Login
    await loginPage.goto();
    await loginPage.loginWithValidation(testUser.email, testUser.password);
    await loginPage.expectLoginSuccess();

    // Step 4: Dashboard verification
    await dashboardPage.waitForDashboardLoad();
    
    // Verify dashboard elements are loaded
    await expect(dashboardPage.portfolioSummary).toBeVisible();
    await expect(dashboardPage.navigationMenu).toBeVisible();

    // Step 5: Account Setup
    const initialAccountCount = await dashboardPage.getAccountCount();
    
    if (initialAccountCount === 0) {
      await dashboardPage.addAccount();
      
      // Fill account setup form (mock broker credentials)
      await page.selectOption('[data-testid="broker-select"]', 'fyers');
      await helpers.fillField('[data-testid="client-id"]', 'TEST_CLIENT_ID');
      await helpers.fillField('[data-testid="secret-key"]', 'TEST_SECRET_KEY');
      await helpers.fillField('[data-testid="redirect-uri"]', 'http://localhost:3000/auth-callback');
      
      await helpers.clickAndWait('[data-testid="save-account"]');
      
      // Should redirect back to dashboard
      await page.waitForURL(/\/dashboard/);
      await dashboardPage.waitForDashboardLoad();
    }

    // Step 6: Account Activation
    const accountCount = await dashboardPage.getAccountCount();
    expect(accountCount).toBeGreaterThan(0);

    // Check if account needs activation
    const accountStatus = await dashboardPage.checkAccountStatus(0);
    if (accountStatus.includes('inactive') || accountStatus.includes('pending')) {
      await dashboardPage.activateAccount(0);
      
      // Wait for activation to complete
      await page.waitForFunction(() => {
        const statusEl = document.querySelector('[data-testid="account-status"]');
        return statusEl?.textContent?.includes('active');
      }, { timeout: 15000 });
    }

    // Step 7: Navigate to Trading
    await dashboardPage.navigateToTrading();
    
    // Verify trading page loads
    await expect(page.locator('[data-testid="trading-form"]')).toBeVisible();
    await expect(page.locator('[data-testid="symbol-search"]')).toBeVisible();

    // Step 8: Place a Test Order
    await helpers.fillField('[data-testid="symbol-search"]', 'TCS');
    await page.waitForTimeout(1000); // Wait for search results
    
    // Select first search result
    await page.locator('[data-testid="symbol-result"]').first().click();
    
    // Fill order form
    await page.selectOption('[data-testid="action-select"]', 'BUY');
    await helpers.fillField('[data-testid="quantity-input"]', '10');
    await page.selectOption('[data-testid="order-type-select"]', 'LIMIT');
    await helpers.fillField('[data-testid="price-input"]', '3500');
    
    // Select account for order
    await page.check('[data-testid="account-checkbox"]');
    
    // Submit order
    await helpers.clickAndWait('[data-testid="place-order-button"]');
    
    // Verify order confirmation
    await expect(page.locator('[data-testid="order-confirmation"]')).toBeVisible();
    
    // Step 9: Verify Order in Orders Page
    await dashboardPage.navigateToOrders();
    
    // Check that order appears in orders list
    await expect(page.locator('[data-testid="order-item"]').first()).toBeVisible();
    
    // Verify order details
    const orderSymbol = await page.locator('[data-testid="order-symbol"]').first().textContent();
    expect(orderSymbol).toContain('TCS');

    // Step 10: Portfolio Verification
    await dashboardPage.navigateToPortfolio();
    
    // Verify portfolio page loads
    await expect(page.locator('[data-testid="portfolio-table"]')).toBeVisible();

    // Take final screenshot
    await helpers.takeScreenshot('user-journey-complete');
  });

  test('Multi-account order placement journey', async ({ page }) => {
    const testUser = TestHelpers.getTestUsers().find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    // Login
    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await dashboardPage.waitForDashboardLoad();

    // Ensure we have multiple accounts (mock scenario)
    const accountCount = await dashboardPage.getAccountCount();
    
    if (accountCount < 2) {
      // Add second account
      await dashboardPage.addAccount();
      await page.selectOption('[data-testid="broker-select"]', 'shoonya');
      await helpers.fillField('[data-testid="user-id"]', 'TEST_USER_ID');
      await helpers.fillField('[data-testid="password"]', 'TEST_PASSWORD');
      await helpers.fillField('[data-testid="vendor-code"]', 'TEST_VENDOR');
      await helpers.clickAndWait('[data-testid="save-account"]');
      await dashboardPage.waitForDashboardLoad();
    }

    // Navigate to trading
    await dashboardPage.navigateToTrading();

    // Place order on multiple accounts
    await helpers.fillField('[data-testid="symbol-search"]', 'RELIANCE');
    await page.waitForTimeout(1000);
    await page.locator('[data-testid="symbol-result"]').first().click();

    // Fill order details
    await page.selectOption('[data-testid="action-select"]', 'BUY');
    await helpers.fillField('[data-testid="quantity-input"]', '5');
    await page.selectOption('[data-testid="order-type-select"]', 'MARKET');

    // Select multiple accounts
    const accountCheckboxes = page.locator('[data-testid="account-checkbox"]');
    const checkboxCount = await accountCheckboxes.count();
    
    for (let i = 0; i < Math.min(checkboxCount, 2); i++) {
      await accountCheckboxes.nth(i).check();
    }

    // Place order
    await helpers.clickAndWait('[data-testid="place-order-button"]');

    // Verify order confirmation shows results for multiple accounts
    await expect(page.locator('[data-testid="order-confirmation"]')).toBeVisible();
    
    const confirmationItems = page.locator('[data-testid="confirmation-item"]');
    const confirmationCount = await confirmationItems.count();
    expect(confirmationCount).toBeGreaterThanOrEqual(2);

    await helpers.takeScreenshot('multi-account-order-complete');
  });

  test('Account management workflow', async ({ page }) => {
    const testUser = TestHelpers.getTestUsers().find(u => u.role === 'trader') || {
      email: 'test.trader@example.com',
      password: 'TestPassword123!',
      role: 'trader'
    };

    await loginPage.goto();
    await loginPage.login(testUser.email, testUser.password);
    await dashboardPage.waitForDashboardLoad();

    // Test account deactivation and reactivation
    const initialAccountCount = await dashboardPage.getAccountCount();
    
    if (initialAccountCount > 0) {
      // Deactivate account
      const deactivateButton = page.locator('[data-testid="deactivate-account"]').first();
      if (await deactivateButton.isVisible()) {
        await deactivateButton.click();
        
        // Confirm deactivation
        await page.locator('[data-testid="confirm-deactivate"]').click();
        await helpers.waitForNetworkIdle();
        
        // Verify account is deactivated
        const status = await dashboardPage.checkAccountStatus(0);
        expect(status).toContain('inactive');
        
        // Reactivate account
        await dashboardPage.activateAccount(0);
        
        // Verify account is active again
        await page.waitForFunction(() => {
          const statusEl = document.querySelector('[data-testid="account-status"]');
          return statusEl?.textContent?.includes('active');
        });
      }
    }

    await helpers.takeScreenshot('account-management-complete');
  });
});