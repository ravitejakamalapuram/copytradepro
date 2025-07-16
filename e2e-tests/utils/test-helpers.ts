import { Page, expect } from '@playwright/test';
import fs from 'fs';
import path from 'path';

export interface TestUser {
  email: string;
  password: string;
  role: string;
}

export class TestHelpers {
  constructor(private page: Page) {}

  /**
   * Load test users from JSON file
   */
  static getTestUsers(): TestUser[] {
    const usersPath = path.join(__dirname, '../test-data/users.json');
    if (fs.existsSync(usersPath)) {
      return JSON.parse(fs.readFileSync(usersPath, 'utf-8'));
    }
    return [];
  }

  /**
   * Wait for network to be idle
   */
  async waitForNetworkIdle(timeout = 5000) {
    await this.page.waitForLoadState('networkidle', { timeout });
  }

  /**
   * Wait for element to be visible and stable
   */
  async waitForStableElement(selector: string, timeout = 10000) {
    const element = this.page.locator(selector);
    await element.waitFor({ state: 'visible', timeout });
    await this.page.waitForTimeout(100); // Small delay for stability
    return element;
  }

  /**
   * Take screenshot with timestamp
   */
  async takeScreenshot(name: string) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    await this.page.screenshot({ 
      path: `test-results/screenshots/${name}-${timestamp}.png`,
      fullPage: true 
    });
  }

  /**
   * Check for console errors
   */
  async checkConsoleErrors(): Promise<string[]> {
    const errors: string[] = [];
    this.page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    return errors;
  }

  /**
   * Simulate network conditions
   */
  async simulateSlowNetwork() {
    await this.page.route('**/*', async route => {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1s delay
      await route.continue();
    });
  }

  /**
   * Simulate network failure
   */
  async simulateNetworkFailure(urlPattern: string) {
    await this.page.route(urlPattern, route => route.abort('failed'));
  }

  /**
   * Wait for API response
   */
  async waitForApiResponse(urlPattern: string, timeout = 10000) {
    return await this.page.waitForResponse(
      response => response.url().includes(urlPattern) && response.status() === 200,
      { timeout }
    );
  }

  /**
   * Fill form field with validation
   */
  async fillField(selector: string, value: string, shouldValidate = true) {
    const field = await this.waitForStableElement(selector);
    await field.fill(value);
    
    if (shouldValidate) {
      // Trigger validation by blurring the field
      await field.blur();
      await this.page.waitForTimeout(500); // Wait for validation
    }
  }

  /**
   * Click button and wait for response
   */
  async clickAndWait(selector: string, waitForSelector?: string) {
    const button = await this.waitForStableElement(selector);
    await button.click();
    
    if (waitForSelector) {
      await this.waitForStableElement(waitForSelector);
    } else {
      await this.waitForNetworkIdle();
    }
  }

  /**
   * Check for error messages
   */
  async checkForErrors(): Promise<string[]> {
    const errorSelectors = [
      '[data-testid="error-message"]',
      '.error-message',
      '.alert-error',
      '[role="alert"]'
    ];

    const errors: string[] = [];
    for (const selector of errorSelectors) {
      const elements = await this.page.locator(selector).all();
      for (const element of elements) {
        if (await element.isVisible()) {
          errors.push(await element.textContent() || '');
        }
      }
    }
    return errors;
  }

  /**
   * Measure page load performance
   */
  async measurePageLoad(): Promise<{
    loadTime: number;
    domContentLoaded: number;
    firstContentfulPaint: number;
  }> {
    const performanceMetrics = await this.page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0] as PerformanceNavigationTiming;
      const paint = performance.getEntriesByType('paint');
      
      return {
        loadTime: navigation.loadEventEnd - navigation.loadEventStart,
        domContentLoaded: navigation.domContentLoadedEventEnd - navigation.domContentLoadedEventStart,
        firstContentfulPaint: paint.find(p => p.name === 'first-contentful-paint')?.startTime || 0
      };
    });

    return performanceMetrics;
  }

  /**
   * Monitor memory usage
   */
  async getMemoryUsage(): Promise<number> {
    return await this.page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });
  }
}