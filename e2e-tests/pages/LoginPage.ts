import { Page, Locator } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

export class LoginPage {
  private helpers: TestHelpers;

  // Locators
  readonly emailInput: Locator;
  readonly passwordInput: Locator;
  readonly loginButton: Locator;
  readonly registerLink: Locator;
  readonly errorMessage: Locator;
  readonly loadingSpinner: Locator;

  constructor(private page: Page) {
    this.helpers = new TestHelpers(page);
    
    // Initialize locators
    this.emailInput = page.locator('[data-testid="email-input"], input[type="email"]');
    this.passwordInput = page.locator('[data-testid="password-input"], input[type="password"]');
    this.loginButton = page.locator('[data-testid="login-button"], button[type="submit"]');
    this.registerLink = page.locator('[data-testid="register-link"], a[href*="register"]');
    this.errorMessage = page.locator('[data-testid="error-message"], .error-message');
    this.loadingSpinner = page.locator('[data-testid="loading-spinner"], .loading-spinner');
  }

  async goto() {
    await this.page.goto('/login');
    await this.helpers.waitForNetworkIdle();
  }

  async login(email: string, password: string) {
    await this.helpers.fillField(this.emailInput.first().locator('xpath=.'), email);
    await this.helpers.fillField(this.passwordInput.first().locator('xpath=.'), password);
    await this.loginButton.first().click();
    await this.helpers.waitForNetworkIdle();
  }

  async loginWithValidation(email: string, password: string) {
    await this.helpers.fillField(this.emailInput.first().locator('xpath=.'), email, true);
    await this.helpers.fillField(this.passwordInput.first().locator('xpath=.'), password, true);
    
    // Check if login button is enabled
    await this.page.waitForFunction(() => {
      const button = document.querySelector('[data-testid="login-button"], button[type="submit"]') as HTMLButtonElement;
      return button && !button.disabled;
    });
    
    await this.loginButton.first().click();
    await this.helpers.waitForNetworkIdle();
  }

  async expectLoginSuccess() {
    // Should redirect to dashboard or account setup
    await this.page.waitForURL(/\/(dashboard|account-setup)/);
  }

  async expectLoginError(expectedError?: string) {
    await this.errorMessage.first().waitFor({ state: 'visible' });
    if (expectedError) {
      await this.page.waitForFunction(
        (error) => {
          const errorEl = document.querySelector('[data-testid="error-message"], .error-message');
          return errorEl?.textContent?.includes(error);
        },
        expectedError
      );
    }
  }

  async goToRegister() {
    await this.registerLink.first().click();
    await this.page.waitForURL(/\/register/);
  }

  async isLoading(): Promise<boolean> {
    return await this.loadingSpinner.first().isVisible();
  }
}