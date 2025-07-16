/**
 * OAuth State Manager
 * Manages OAuth state persistence during authentication flows
 * Handles state storage, validation, and cleanup for secure OAuth flows
 */

import crypto from 'crypto';

export interface OAuthState {
  userId: string;
  brokerName: string;
  accountId: string;
  credentials: any;
  timestamp: number;
  expiresAt: number;
  redirectUri?: string | undefined;
}

export class OAuthStateManager {
  private static instance: OAuthStateManager;
  private stateStore: Map<string, OAuthState> = new Map();
  private readonly STATE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes

  private constructor() {
    // Clean up expired states every 5 minutes
    setInterval(() => {
      this.cleanupExpiredStates();
    }, 5 * 60 * 1000);
  }

  static getInstance(): OAuthStateManager {
    if (!OAuthStateManager.instance) {
      OAuthStateManager.instance = new OAuthStateManager();
    }
    return OAuthStateManager.instance;
  }

  /**
   * Generate a secure state token for OAuth flow
   */
  generateStateToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  /**
   * Store OAuth state for later retrieval
   */
  storeState(
    stateToken: string,
    userId: string,
    brokerName: string,
    accountId: string,
    credentials: any,
    redirectUri?: string
  ): void {
    const now = Date.now();
    const state: OAuthState = {
      userId,
      brokerName,
      accountId,
      credentials,
      timestamp: now,
      expiresAt: now + this.STATE_EXPIRY_MS,
      redirectUri
    };

    this.stateStore.set(stateToken, state);
    console.log(`📝 OAuth state stored for ${brokerName} with token: ${stateToken.substring(0, 8)}...`);
  }

  /**
   * Retrieve and validate OAuth state
   */
  retrieveState(stateToken: string): OAuthState | null {
    const state = this.stateStore.get(stateToken);
    
    if (!state) {
      console.log(`❌ OAuth state not found for token: ${stateToken.substring(0, 8)}...`);
      return null;
    }

    // Check if state has expired
    if (Date.now() > state.expiresAt) {
      console.log(`⏰ OAuth state expired for token: ${stateToken.substring(0, 8)}...`);
      this.stateStore.delete(stateToken);
      return null;
    }

    console.log(`✅ OAuth state retrieved for ${state.brokerName} with token: ${stateToken.substring(0, 8)}...`);
    return state;
  }

  /**
   * Remove OAuth state after successful completion
   */
  removeState(stateToken: string): void {
    const removed = this.stateStore.delete(stateToken);
    if (removed) {
      console.log(`🗑️ OAuth state removed for token: ${stateToken.substring(0, 8)}...`);
    }
  }

  /**
   * Clean up expired states
   */
  private cleanupExpiredStates(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [token, state] of this.stateStore.entries()) {
      if (now > state.expiresAt) {
        this.stateStore.delete(token);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedCount} expired OAuth states`);
    }
  }

  /**
   * Get current state count for debugging
   */
  getStateCount(): number {
    return this.stateStore.size;
  }

  /**
   * Debug method to list all active states
   */
  debugListStates(): void {
    console.log(`📊 OAuth State Manager - Active states: ${this.stateStore.size}`);
    
    for (const [token, state] of this.stateStore.entries()) {
      const timeLeft = Math.max(0, state.expiresAt - Date.now());
      console.log(`  🔗 ${token.substring(0, 8)}...: ${state.brokerName} | User: ${state.userId} | Expires in: ${Math.round(timeLeft / 1000)}s`);
    }
  }
}

// Export singleton instance
export const oauthStateManager = OAuthStateManager.getInstance();