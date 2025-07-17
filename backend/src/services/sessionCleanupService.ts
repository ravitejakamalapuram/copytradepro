/**
 * SESSION CLEANUP SERVICE
 * Handles cleanup of expired sessions, cached data, and resource management
 */

import { logger } from '../utils/logger';

interface CacheEntry {
  key: string;
  data: any;
  timestamp: Date;
  ttl: number; // Time to live in milliseconds
  accessCount: number;
  lastAccessed: Date;
}

interface SessionInfo {
  sessionId: string;
  userId: string;
  createdAt: Date;
  lastActivity: Date;
  isActive: boolean;
  brokerConnections: string[];
}

class SessionCleanupService {
  private cache: Map<string, CacheEntry> = new Map();
  private sessions: Map<string, SessionInfo> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 300000; // 5 minutes
  private readonly DEFAULT_SESSION_TTL = 3600000; // 1 hour
  private readonly DEFAULT_CACHE_TTL = 600000; // 10 minutes
  private readonly MAX_CACHE_SIZE = 1000;
  private readonly MAX_CACHE_MEMORY = 100 * 1024 * 1024; // 100MB

  constructor() {
    this.startCleanupScheduler();
  }

  /**
   * Start the cleanup scheduler
   */
  private startCleanupScheduler(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    this.cleanupInterval = setInterval(() => {
      this.performCleanup();
    }, this.CLEANUP_INTERVAL);

    logger.info('Session cleanup scheduler started');
  }

  /**
   * Perform comprehensive cleanup
   */
  private async performCleanup(): Promise<void> {
    try {
      const startTime = Date.now();
      
      // Cleanup expired cache entries
      const expiredCacheCount = this.cleanupExpiredCache();
      
      // Cleanup expired sessions
      const expiredSessionCount = this.cleanupExpiredSessions();
      
      // Cleanup oversized cache
      const oversizedCacheCount = this.cleanupOversizedCache();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const duration = Date.now() - startTime;
      
      logger.info('Cleanup completed', {
        duration,
        expiredCache: expiredCacheCount,
        expiredSessions: expiredSessionCount,
        oversizedCache: oversizedCacheCount,
        totalCacheEntries: this.cache.size,
        totalSessions: this.sessions.size
      });
    } catch (error) {
      logger.error('Error during cleanup:', error);
    }
  }

  /**
   * Cleanup expired cache entries
   */
  private cleanupExpiredCache(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now.getTime() - entry.timestamp.getTime();
      if (age > entry.ttl) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Cleanup expired sessions
   */
  private cleanupExpiredSessions(): number {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      const inactiveTime = now.getTime() - session.lastActivity.getTime();
      if (inactiveTime > this.DEFAULT_SESSION_TTL || !session.isActive) {
        this.sessions.delete(sessionId);
        cleanedCount++;
        
        logger.debug(`Cleaned up expired session: ${sessionId}`);
      }
    }

    return cleanedCount;
  }

  /**
   * Cleanup oversized cache using LRU strategy
   */
  private cleanupOversizedCache(): number {
    let cleanedCount = 0;

    // Check cache size limit
    if (this.cache.size > this.MAX_CACHE_SIZE) {
      const entriesToRemove = this.cache.size - this.MAX_CACHE_SIZE;
      const sortedEntries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

      for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
        const entry = sortedEntries[i];
        if (entry) {
          const [key] = entry;
          this.cache.delete(key);
          cleanedCount++;
        }
      }
    }

    // Check memory usage (approximate)
    const estimatedMemory = this.getEstimatedCacheMemory();
    if (estimatedMemory > this.MAX_CACHE_MEMORY) {
      const entriesToRemove = Math.ceil(this.cache.size * 0.2); // Remove 20%
      const sortedEntries = Array.from(this.cache.entries())
        .sort(([, a], [, b]) => a.lastAccessed.getTime() - b.lastAccessed.getTime());

      for (let i = 0; i < entriesToRemove && i < sortedEntries.length; i++) {
        const entry = sortedEntries[i];
        if (entry) {
          const [key] = entry;
          this.cache.delete(key);
          cleanedCount++;
        }
      }
    }

    return cleanedCount;
  }

  /**
   * Estimate cache memory usage
   */
  private getEstimatedCacheMemory(): number {
    let totalSize = 0;
    
    for (const entry of this.cache.values()) {
      // Rough estimation of memory usage
      totalSize += JSON.stringify(entry.data).length * 2; // UTF-16 encoding
      totalSize += 200; // Overhead for metadata
    }
    
    return totalSize;
  }

  /**
   * Add or update cache entry
   */
  setCache(key: string, data: any, ttl: number = this.DEFAULT_CACHE_TTL): void {
    const entry: CacheEntry = {
      key,
      data,
      timestamp: new Date(),
      ttl,
      accessCount: 0,
      lastAccessed: new Date()
    };

    this.cache.set(key, entry);
  }

  /**
   * Get cache entry
   */
  getCache(key: string): any | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    const age = Date.now() - entry.timestamp.getTime();
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = new Date();
    
    return entry.data;
  }

  /**
   * Remove cache entry
   */
  removeCache(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clearCache(): void {
    this.cache.clear();
    logger.info('Cache cleared');
  }

  /**
   * Register session
   */
  registerSession(sessionId: string, userId: string): void {
    const session: SessionInfo = {
      sessionId,
      userId,
      createdAt: new Date(),
      lastActivity: new Date(),
      isActive: true,
      brokerConnections: []
    };

    this.sessions.set(sessionId, session);
    logger.debug(`Session registered: ${sessionId}`);
  }

  /**
   * Update session activity
   */
  updateSessionActivity(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.lastActivity = new Date();
    }
  }

  /**
   * Add broker connection to session
   */
  addBrokerConnection(sessionId: string, connectionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session && !session.brokerConnections.includes(connectionId)) {
      session.brokerConnections.push(connectionId);
    }
  }

  /**
   * Remove broker connection from session
   */
  removeBrokerConnection(sessionId: string, connectionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.brokerConnections = session.brokerConnections.filter(id => id !== connectionId);
    }
  }

  /**
   * Deactivate session
   */
  deactivateSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.isActive = false;
      session.lastActivity = new Date();
      logger.debug(`Session deactivated: ${sessionId}`);
    }
  }

  /**
   * Get session info
   */
  getSession(sessionId: string): SessionInfo | null {
    return this.sessions.get(sessionId) || null;
  }

  /**
   * Get active sessions for user
   */
  getUserSessions(userId: string): SessionInfo[] {
    return Array.from(this.sessions.values())
      .filter(session => session.userId === userId && session.isActive);
  }

  /**
   * Force cleanup now
   */
  async forceCleanup(): Promise<void> {
    await this.performCleanup();
  }

  /**
   * Get cleanup statistics
   */
  getStats() {
    const now = new Date();
    const cacheStats = {
      totalEntries: this.cache.size,
      estimatedMemory: this.getEstimatedCacheMemory(),
      oldestEntry: this.getOldestCacheEntry(),
      mostAccessed: this.getMostAccessedCacheEntry()
    };

    const sessionStats = {
      totalSessions: this.sessions.size,
      activeSessions: Array.from(this.sessions.values()).filter(s => s.isActive).length,
      oldestSession: this.getOldestSession(),
      averageSessionAge: this.getAverageSessionAge()
    };

    return {
      cache: cacheStats,
      sessions: sessionStats,
      cleanup: {
        isRunning: this.cleanupInterval !== null,
        interval: this.CLEANUP_INTERVAL,
        lastRun: now
      }
    };
  }

  /**
   * Get oldest cache entry
   */
  private getOldestCacheEntry(): { key: string; age: number } | null {
    if (this.cache.size === 0) return null;

    const now = new Date();
    let oldest: { key: string; age: number } | null = null;

    for (const [key, entry] of this.cache.entries()) {
      const age = now.getTime() - entry.timestamp.getTime();
      if (!oldest || age > oldest.age) {
        oldest = { key, age };
      }
    }

    return oldest;
  }

  /**
   * Get most accessed cache entry
   */
  private getMostAccessedCacheEntry(): { key: string; accessCount: number } | null {
    if (this.cache.size === 0) return null;

    let mostAccessed: { key: string; accessCount: number } | null = null;

    for (const [key, entry] of this.cache.entries()) {
      if (!mostAccessed || entry.accessCount > mostAccessed.accessCount) {
        mostAccessed = { key, accessCount: entry.accessCount };
      }
    }

    return mostAccessed;
  }

  /**
   * Get oldest session
   */
  private getOldestSession(): { sessionId: string; age: number } | null {
    if (this.sessions.size === 0) return null;

    const now = new Date();
    let oldest: { sessionId: string; age: number } | null = null;

    for (const [sessionId, session] of this.sessions.entries()) {
      const age = now.getTime() - session.createdAt.getTime();
      if (!oldest || age > oldest.age) {
        oldest = { sessionId, age };
      }
    }

    return oldest;
  }

  /**
   * Get average session age
   */
  private getAverageSessionAge(): number {
    if (this.sessions.size === 0) return 0;

    const now = new Date();
    let totalAge = 0;

    for (const session of this.sessions.values()) {
      totalAge += now.getTime() - session.createdAt.getTime();
    }

    return totalAge / this.sessions.size;
  }

  /**
   * Shutdown cleanup service
   */
  shutdown(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.cache.clear();
    this.sessions.clear();
    
    logger.info('Session cleanup service shutdown');
  }
}

// Create singleton instance
export const sessionCleanupService = new SessionCleanupService();
export default sessionCleanupService;