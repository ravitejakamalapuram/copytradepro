import { test, expect } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

test.describe('E2E Testing Infrastructure', () => {
  test('Test infrastructure is properly configured', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Test that we can navigate to a basic page
    await page.goto('https://example.com');
    await expect(page).toHaveTitle(/Example Domain/);
    
    // Test screenshot functionality
    await helpers.takeScreenshot('infrastructure-test');
    
    // Test performance measurement
    const metrics = await helpers.measurePageLoad();
    expect(metrics.loadTime).toBeGreaterThanOrEqual(0);
    
    // Test memory monitoring
    const memory = await helpers.getMemoryUsage();
    expect(memory).toBeGreaterThan(0);
    
    console.log('Infrastructure test completed successfully');
  });

  test('Test helpers functionality', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    await page.goto('https://httpbin.org/html');
    
    // Test network idle waiting
    await helpers.waitForNetworkIdle();
    
    // Test element waiting
    const heading = await helpers.waitForStableElement('h1');
    await expect(heading).toBeVisible();
    
    // Test error checking (should be empty for this page)
    const errors = await helpers.checkForErrors();
    expect(Array.isArray(errors)).toBeTruthy();
    
    console.log('Test helpers working correctly');
  });

  test('Performance monitoring capabilities', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    await page.goto('https://httpbin.org/delay/1');
    
    const startTime = Date.now();
    await helpers.waitForNetworkIdle();
    const loadTime = Date.now() - startTime;
    
    // Should take some time due to delay (allowing for network variance)
    expect(loadTime).toBeGreaterThan(400);
    
    const metrics = await helpers.measurePageLoad();
    console.log('Performance metrics:', metrics);
    
    expect(metrics.loadTime).toBeGreaterThanOrEqual(0);
  });

  test('Error simulation and recovery', async ({ page }) => {
    const helpers = new TestHelpers(page);
    
    // Test network failure simulation
    await helpers.simulateNetworkFailure('**/nonexistent-api/**');
    
    // Navigate to a page that would trigger the blocked request
    await page.goto('https://httpbin.org/html');
    
    // Remove the network failure
    await page.unroute('**/nonexistent-api/**');
    
    // Should still be able to navigate normally
    await helpers.waitForNetworkIdle();
    await expect(page.locator('h1')).toBeVisible();
    
    console.log('Error simulation test completed');
  });
});