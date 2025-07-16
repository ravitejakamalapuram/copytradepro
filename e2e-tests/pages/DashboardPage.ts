import { Page, Locator } from '@playwright/test';
import { TestHelpers } from '../utils/test-helpers';

export class DashboardPage {
  private helpers: TestHelpers;

  // Locators
  readonly accountCards: Locator;
  readonly addAccountButton: Locator;
  readonly portfolioSummary: Locator;
  readonly recentOrders: Locator;
  readonly marketData: Locator;
  readonly navigationMenu: Locator;
  readonly userProfile: Locator;
  readonly logoutButton: Locator;

  constructor(private page: Page) {
    this.helpers = new TestHelpers(page);
    
    this.accountCards = page.locator('[data-testid="account-card"]');
    this.addAccountButton = page.locator('[data-testid="add-account-button"]');
    this.portfolioSummary = page.locator('[data-testid="portfolio-summary"]');
    this.recentOrders = page.locator('[data-testid="recent-orders"]');
    this.marketData = page.locator('[data-testid="market-data"]');
    this.navigationMenu = page.locator('[data-testid="navigation-menu"]');
    this.userProfile = page.locator('[data-testid="user-profile"]');
    this.logoutButton = page.locator('[data-testid="logout-button"]');
  }

  async goto() {
    await this.page.goto('/dashboard');
    await this.helpers.waitForNetworkIdle();
  }

  async waitForDashboardLoad() {
    await this.portfolioSummary.waitFor({ state: 'visible' });
    await this.helpers.waitForNetworkIdle();
  }

  async getAccountCount(): Promise<number> {
    return await this.accountCards.count();
  }

  async addAccount() {
    await this.addAccountButton.click();
    await this.page.waitForURL(/\/account-setup/);
  }

  async navigateToOrders() {
    await this.page.locator('[data-testid="nav-orders"], a[href*="orders"]').click();
    await this.page.waitForURL(/\/orders/);
  }

  async navigateToPortfolio() {
    await this.page.locator('[data-testid="nav-portfolio"], a[href*="portfolio"]').click();
    await this.page.waitForURL(/\/portfolio/);
  }

  async navigateToTrading() {
    await this.page.locator('[data-testid="nav-trading"], a[href*="trading"]').click();
    await this.page.waitForURL(/\/trading/);
  }

  async logout() {
    await this.userProfile.click();
    await this.logoutButton.click();
    await this.page.waitForURL(/\/login/);
  }

  async checkAccountStatus(accountIndex: number): Promise<string> {
    const account = this.accountCards.nth(accountIndex);
    const statusElement = account.locator('[data-testid="account-status"]');
    return await statusElement.textContent() || '';
  }

  async activateAccount(accountIndex: number) {
    const account = this.accountCards.nth(accountIndex);
    const activateButton = account.locator('[data-testid="activate-account"]');
    await activateButton.click();
    await this.helpers.waitForNetworkIdle();
  }

  async getPortfolioValue(): Promise<string> {
    const valueElement = this.portfolioSummary.locator('[data-testid="portfolio-value"]');
    return await valueElement.textContent() || '0';
  }

  async getRecentOrdersCount(): Promise<number> {
    const orderItems = this.recentOrders.locator('[data-testid="order-item"]');
    return await orderItems.count();
  }

  async refreshData() {
    const refreshButton = this.page.locator('[data-testid="refresh-button"]');
    await refreshButton.click();
    await this.helpers.waitForNetworkIdle();
  }
}