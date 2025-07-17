/**
 * Feature Flag Service
 * Manages feature flags for controlled deployments and A/B testing
 */

import { logger } from '../utils/logger';

export interface FeatureFlag {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  rolloutPercentage: number;
  conditions?: {
    userIds?: string[];
    environments?: string[];
    dateRange?: {
      start: Date;
      end: Date;
    };
  };
  createdAt: Date;
  updatedAt: Date;
}

export class FeatureFlagService {
  private flags: Map<string, FeatureFlag> = new Map();
  private userOverrides: Map<string, Map<string, boolean>> = new Map();

  constructor() {
    this.initializeDefaultFlags();
  }

  /**
   * Initialize default feature flags for bug fixes
   */
  private initializeDefaultFlags(): void {
    const defaultFlags: Omit<FeatureFlag, 'createdAt' | 'updatedAt'>[] = [
      {
        id: 'enhanced-error-handling',
        name: 'Enhanced Error Handling',
        description: 'Enable enhanced error handling and classification system',
        enabled: true,
        rolloutPercentage: 100
      },
      {
        id: 'production-monitoring',
        name: 'Production Monitoring',
        description: 'Enable production monitoring and alerting system',
        enabled: true,
        rolloutPercentage: 100
      },
      {
        id: 'improved-broker-session-management',
        name: 'Improved Broker Session Management',
        description: 'Enable improved broker session management and health monitoring',
        enabled: true,
        rolloutPercentage: 100
      },
      {
        id: 'react-error-boundaries',
        name: 'React Error Boundaries',
        description: 'Enable React error boundaries for better error handling',
        enabled: true,
        rolloutPercentage: 100
      },
      {
        id: 'websocket-reconnection-improvements',
        name: 'WebSocket Reconnection Improvements',
        description: 'Enable improved WebSocket reconnection logic',
        enabled: true,
        rolloutPercentage: 100
      },
      {
        id: 'performance-optimizations',
        name: 'Performance Optimizations',
        description: 'Enable performance optimizations and memory leak fixes',
        enabled: true,
        rolloutPercentage: 100
      },
      {
        id: 'gradual-rollout-mode',
        name: 'Gradual Rollout Mode',
        description: 'Enable gradual rollout of all bug fixes (for testing)',
        enabled: false,
        rolloutPercentage: 10,
        conditions: {
          environments: ['staging', 'production']
        }
      }
    ];

    defaultFlags.forEach(flag => {
      this.addFlag({
        ...flag,
        createdAt: new Date(),
        updatedAt: new Date()
      });
    });

    logger.info('Feature flags initialized', {
      component: 'FEATURE_FLAGS',
      operation: 'INITIALIZE',
      flagCount: defaultFlags.length
    });
  }

  /**
   * Add or update a feature flag
   */
  addFlag(flag: FeatureFlag): void {
    this.flags.set(flag.id, flag);
    logger.info('Feature flag added/updated', {
      component: 'FEATURE_FLAGS',
      operation: 'ADD_FLAG',
      flagId: flag.id,
      enabled: flag.enabled,
      rolloutPercentage: flag.rolloutPercentage
    });
  }

  /**
   * Remove a feature flag
   */
  removeFlag(flagId: string): boolean {
    const removed = this.flags.delete(flagId);
    if (removed) {
      logger.info('Feature flag removed', {
        component: 'FEATURE_FLAGS',
        operation: 'REMOVE_FLAG',
        flagId
      });
    }
    return removed;
  }

  /**
   * Check if a feature is enabled for a user
   */
  isEnabled(flagId: string, userId?: string, context?: any): boolean {
    const flag = this.flags.get(flagId);
    
    if (!flag) {
      logger.debug('Feature flag not found', {
        component: 'FEATURE_FLAGS',
        operation: 'CHECK_FLAG',
        flagId
      });
      return false;
    }

    // Check if flag is globally disabled
    if (!flag.enabled) {
      return false;
    }

    // Check user-specific override
    if (userId && this.userOverrides.has(userId)) {
      const userFlags = this.userOverrides.get(userId)!;
      if (userFlags.has(flagId)) {
        return userFlags.get(flagId)!;
      }
    }

    // Check conditions
    if (flag.conditions) {
      // Check user ID whitelist
      if (flag.conditions.userIds && userId) {
        if (!flag.conditions.userIds.includes(userId)) {
          return false;
        }
      }

      // Check environment
      if (flag.conditions.environments) {
        const currentEnv = process.env.NODE_ENV || 'development';
        if (!flag.conditions.environments.includes(currentEnv)) {
          return false;
        }
      }

      // Check date range
      if (flag.conditions.dateRange) {
        const now = new Date();
        if (now < flag.conditions.dateRange.start || now > flag.conditions.dateRange.end) {
          return false;
        }
      }
    }

    // Check rollout percentage
    if (flag.rolloutPercentage < 100) {
      const hash = this.hashUserId(userId || 'anonymous', flagId);
      const userPercentile = hash % 100;
      return userPercentile < flag.rolloutPercentage;
    }

    return true;
  }

  /**
   * Hash user ID for consistent rollout percentage
   */
  private hashUserId(userId: string, flagId: string): number {
    const str = `${userId}:${flagId}`;
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash);
  }

  /**
   * Set user-specific override
   */
  setUserOverride(userId: string, flagId: string, enabled: boolean): void {
    if (!this.userOverrides.has(userId)) {
      this.userOverrides.set(userId, new Map());
    }
    
    this.userOverrides.get(userId)!.set(flagId, enabled);
    
    logger.info('User override set', {
      component: 'FEATURE_FLAGS',
      operation: 'SET_USER_OVERRIDE',
      userId,
      flagId,
      enabled
    });
  }

  /**
   * Remove user-specific override
   */
  removeUserOverride(userId: string, flagId: string): void {
    if (this.userOverrides.has(userId)) {
      this.userOverrides.get(userId)!.delete(flagId);
      
      // Clean up empty user override maps
      if (this.userOverrides.get(userId)!.size === 0) {
        this.userOverrides.delete(userId);
      }
    }
    
    logger.info('User override removed', {
      component: 'FEATURE_FLAGS',
      operation: 'REMOVE_USER_OVERRIDE',
      userId,
      flagId
    });
  }

  /**
   * Get all feature flags
   */
  getAllFlags(): FeatureFlag[] {
    return Array.from(this.flags.values());
  }

  /**
   * Get feature flag by ID
   */
  getFlag(flagId: string): FeatureFlag | undefined {
    return this.flags.get(flagId);
  }

  /**
   * Update flag rollout percentage
   */
  updateRolloutPercentage(flagId: string, percentage: number): boolean {
    const flag = this.flags.get(flagId);
    if (!flag) {
      return false;
    }

    flag.rolloutPercentage = Math.max(0, Math.min(100, percentage));
    flag.updatedAt = new Date();
    
    logger.info('Flag rollout percentage updated', {
      component: 'FEATURE_FLAGS',
      operation: 'UPDATE_ROLLOUT',
      flagId,
      rolloutPercentage: flag.rolloutPercentage
    });
    
    return true;
  }

  /**
   * Enable/disable flag
   */
  toggleFlag(flagId: string, enabled: boolean): boolean {
    const flag = this.flags.get(flagId);
    if (!flag) {
      return false;
    }

    flag.enabled = enabled;
    flag.updatedAt = new Date();
    
    logger.info('Flag toggled', {
      component: 'FEATURE_FLAGS',
      operation: 'TOGGLE_FLAG',
      flagId,
      enabled
    });
    
    return true;
  }

  /**
   * Get flag statistics
   */
  getFlagStats(): { [flagId: string]: { enabled: boolean; rolloutPercentage: number; userOverrides: number } } {
    const stats: { [flagId: string]: { enabled: boolean; rolloutPercentage: number; userOverrides: number } } = {};
    
    for (const [flagId, flag] of this.flags) {
      let userOverrideCount = 0;
      for (const userFlags of this.userOverrides.values()) {
        if (userFlags.has(flagId)) {
          userOverrideCount++;
        }
      }
      
      stats[flagId] = {
        enabled: flag.enabled,
        rolloutPercentage: flag.rolloutPercentage,
        userOverrides: userOverrideCount
      };
    }
    
    return stats;
  }

  /**
   * Gradual rollout helper - increase rollout percentage gradually
   */
  async gradualRollout(flagId: string, targetPercentage: number, stepSize: number = 10, intervalMs: number = 300000): Promise<void> {
    const flag = this.flags.get(flagId);
    if (!flag) {
      throw new Error(`Flag ${flagId} not found`);
    }

    const currentPercentage = flag.rolloutPercentage;
    if (currentPercentage >= targetPercentage) {
      logger.info('Flag already at or above target percentage', {
        component: 'FEATURE_FLAGS',
        operation: 'GRADUAL_ROLLOUT',
        flagId,
        currentPercentage,
        targetPercentage
      });
      return;
    }

    logger.info('Starting gradual rollout', {
      component: 'FEATURE_FLAGS',
      operation: 'GRADUAL_ROLLOUT',
      flagId,
      currentPercentage,
      targetPercentage,
      stepSize,
      intervalMs
    });

    let nextPercentage = currentPercentage + stepSize;
    
    while (nextPercentage <= targetPercentage) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
      
      this.updateRolloutPercentage(flagId, Math.min(nextPercentage, targetPercentage));
      
      logger.info('Rollout percentage increased', {
        component: 'FEATURE_FLAGS',
        operation: 'GRADUAL_ROLLOUT',
        flagId,
        newPercentage: Math.min(nextPercentage, targetPercentage)
      });
      
      if (nextPercentage >= targetPercentage) {
        break;
      }
      
      nextPercentage += stepSize;
    }

    logger.info('Gradual rollout completed', {
      component: 'FEATURE_FLAGS',
      operation: 'GRADUAL_ROLLOUT',
      flagId,
      finalPercentage: flag.rolloutPercentage
    });
  }
}

// Export singleton instance
export const featureFlagService = new FeatureFlagService();