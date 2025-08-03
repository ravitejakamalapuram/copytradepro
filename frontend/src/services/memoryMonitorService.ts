/**
 * MEMORY MONITOR SERVICE
 * Monitors and manages frontend memory usage and performance
 */

interface MemoryInfo {
  usedJSHeapSize: number;
  totalJSHeapSize: number;
  jsHeapSizeLimit: number;
  timestamp: Date;
}

interface PerformanceMetrics {
  memoryUsage: MemoryInfo | null;
  componentCount: number;
  eventListenerCount: number;
  webSocketConnections: number;
  cacheSize: number;
  timestamp: Date;
}

interface MemoryAlert {
  type: 'warning' | 'critical';
  message: string;
  threshold: number;
  currentValue: number;
  timestamp: Date;
}

class MemoryMonitorService {
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MONITORING_INTERVAL = 30000; // 30 seconds
  private readonly WARNING_THRESHOLD = 0.8; // 80% of heap limit
  private readonly CRITICAL_THRESHOLD = 0.9; // 90% of heap limit
  private memoryHistory: MemoryInfo[] = [];
  private readonly MAX_HISTORY_SIZE = 100;
  private alertCallbacks: ((alert: MemoryAlert) => void)[] = [];
  private isMonitoring = false;

  /**
   * Start memory monitoring
   */
  startMonitoring(): void {
    if (this.isMonitoring) return;

    this.isMonitoring = true;
    
    this.monitoringInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.MONITORING_INTERVAL);

    console.log('🔍 Memory monitoring started');
  }

  /**
   * Stop memory monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    this.isMonitoring = false;
    console.log('🔍 Memory monitoring stopped');
  }

  /**
   * Check current memory usage
   */
  private checkMemoryUsage(): void {
    const memoryInfo = this.getMemoryInfo();
    if (!memoryInfo) return;

    // Add to history
    this.memoryHistory.push(memoryInfo);
    if (this.memoryHistory.length > this.MAX_HISTORY_SIZE) {
      this.memoryHistory.shift();
    }

    // Check for memory alerts
    this.checkMemoryAlerts(memoryInfo);

    // Log memory usage periodically
    if (this.memoryHistory.length % 10 === 0) {
      console.log('📊 Memory usage:', {
        used: `${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        total: `${(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
        usage: `${((memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit) * 100).toFixed(1)}%`
      });
    }
  }

  /**
   * Get current memory information
   */
  getMemoryInfo(): MemoryInfo | null {
    if (!('memory' in performance)) {
      return null;
    }

    const memory = (performance as any).memory;
    return {
      usedJSHeapSize: memory.usedJSHeapSize,
      totalJSHeapSize: memory.totalJSHeapSize,
      jsHeapSizeLimit: memory.jsHeapSizeLimit,
      timestamp: new Date()
    };
  }

  /**
   * Check for memory alerts
   */
  private checkMemoryAlerts(memoryInfo: MemoryInfo): void {
    const usageRatio = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;

    if (usageRatio >= this.CRITICAL_THRESHOLD) {
      this.triggerAlert({
        type: 'critical',
        message: 'Critical memory usage detected. Consider refreshing the page.',
        threshold: this.CRITICAL_THRESHOLD,
        currentValue: usageRatio,
        timestamp: new Date()
      });
    } else if (usageRatio >= this.WARNING_THRESHOLD) {
      this.triggerAlert({
        type: 'warning',
        message: 'High memory usage detected. Some features may be slower.',
        threshold: this.WARNING_THRESHOLD,
        currentValue: usageRatio,
        timestamp: new Date()
      });
    }
  }

  /**
   * Trigger memory alert
   */
  private triggerAlert(alert: MemoryAlert): void {
    console.warn(`🚨 Memory Alert [${alert.type.toUpperCase()}]:`, alert.message, {
      threshold: `${(alert.threshold * 100).toFixed(1)}%`,
      current: `${(alert.currentValue * 100).toFixed(1)}%`
    });

    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Error in memory alert callback:', error);
      }
    });
  }

  /**
   * Subscribe to memory alerts
   */
  onAlert(callback: (alert: MemoryAlert) => void): () => void {
    this.alertCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index > -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get performance metrics
   */
  getPerformanceMetrics(): PerformanceMetrics {
    const memoryInfo = this.getMemoryInfo();
    
    return {
      memoryUsage: memoryInfo,
      componentCount: this.getComponentCount(),
      eventListenerCount: this.getEventListenerCount(),
      webSocketConnections: this.getWebSocketConnectionCount(),
      cacheSize: this.getCacheSize(),
      timestamp: new Date()
    };
  }

  /**
   * Estimate component count (approximate)
   */
  private getComponentCount(): number {
    // This is an approximation based on DOM elements with React fiber properties
    const elements = document.querySelectorAll('[data-reactroot], [data-react-*]');
    return elements.length;
  }

  /**
   * Estimate event listener count (approximate)
   */
  private getEventListenerCount(): number {
    // This is a rough estimate - actual count is not easily accessible
    const elements = document.querySelectorAll('*');
    let listenerCount = 0;
    
    elements.forEach(element => {
      // Check for common event attributes
      const eventAttributes = ['onclick', 'onchange', 'onsubmit', 'onload', 'onerror'];
      eventAttributes.forEach(attr => {
        if (element.hasAttribute(attr)) {
          listenerCount++;
        }
      });
    });
    
    return listenerCount;
  }

  /**
   * Get WebSocket connection count
   */
  private getWebSocketConnectionCount(): number {
    // This would need to be tracked by the WebSocket services
    // For now, return 0 as placeholder
    return 0;
  }

  /**
   * Estimate cache size
   */
  private getCacheSize(): number {
    let totalSize = 0;
    
    // Check localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          totalSize += (key.length + (value?.length || 0)) * 2; // UTF-16
        }
      }
    } catch {
      // localStorage might not be available
    }
    
    // Check sessionStorage
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          const value = sessionStorage.getItem(key);
          totalSize += (key.length + (value?.length || 0)) * 2; // UTF-16
        }
      }
    } catch {
      // sessionStorage might not be available
    }
    
    return totalSize;
  }

  /**
   * Force garbage collection (if available)
   */
  forceGarbageCollection(): boolean {
    if ('gc' in window && typeof (window as any).gc === 'function') {
      try {
        (window as any).gc();
        console.log('🗑️ Forced garbage collection');
        return true;
      } catch (error) {
        console.warn('Failed to force garbage collection:', error);
        return false;
      }
    }
    
    console.warn('Garbage collection not available');
    return false;
  }

  /**
   * Clear browser caches
   */
  async clearCaches(): Promise<void> {
    try {
      // Clear localStorage (keep essential items)
      const essentialKeys = ['token', 'userId', 'theme'];
      const keysToRemove: string[] = [];
      
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && !essentialKeys.includes(key)) {
          keysToRemove.push(key);
        }
      }
      
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      // Clear sessionStorage
      sessionStorage.clear();
      
      // Clear caches if available
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(
          cacheNames.map(cacheName => caches.delete(cacheName))
        );
      }
      
      console.log('🧹 Browser caches cleared');
    } catch (error) {
      console.error('Failed to clear caches:', error);
    }
  }

  /**
   * Get memory usage trend
   */
  getMemoryTrend(): 'increasing' | 'decreasing' | 'stable' | 'unknown' {
    if (this.memoryHistory.length < 5) return 'unknown';
    
    const recent = this.memoryHistory.slice(-5);
    const first = recent[0].usedJSHeapSize;
    const last = recent[recent.length - 1].usedJSHeapSize;
    
    const change = (last - first) / first;
    
    if (change > 0.1) return 'increasing';
    if (change < -0.1) return 'decreasing';
    return 'stable';
  }

  /**
   * Get memory statistics
   */
  getStats() {
    const currentMemory = this.getMemoryInfo();
    const trend = this.getMemoryTrend();
    
    return {
      isMonitoring: this.isMonitoring,
      currentMemory,
      trend,
      historySize: this.memoryHistory.length,
      alertSubscribers: this.alertCallbacks.length,
      thresholds: {
        warning: this.WARNING_THRESHOLD,
        critical: this.CRITICAL_THRESHOLD
      }
    };
  }

  /**
   * Detect potential memory leaks
   */
  detectMemoryLeaks(): {
    hasLeaks: boolean;
    leakIndicators: string[];
    recommendations: string[];
  } {
    const leakIndicators: string[] = [];
    const recommendations: string[] = [];

    if (this.memoryHistory.length < 10) {
      return { hasLeaks: false, leakIndicators, recommendations };
    }

    const recent = this.memoryHistory.slice(-10);
    const oldest = recent[0];
    const newest = recent[recent.length - 1];
    
    // Check for consistent memory growth
    const growthRate = (newest.usedJSHeapSize - oldest.usedJSHeapSize) / oldest.usedJSHeapSize;
    
    if (growthRate > 0.2) { // 20% growth
      leakIndicators.push(`Memory usage increased by ${(growthRate * 100).toFixed(1)}% in recent samples`);
      recommendations.push('Consider clearing unused data or refreshing the page');
    }

    // Check for high memory usage
    const currentUsageRatio = newest.usedJSHeapSize / newest.jsHeapSizeLimit;
    if (currentUsageRatio > 0.8) {
      leakIndicators.push(`High memory usage: ${(currentUsageRatio * 100).toFixed(1)}%`);
      recommendations.push('Close unused tabs or refresh the page');
    }

    // Check for DOM node count (approximate)
    const domNodeCount = document.querySelectorAll('*').length;
    if (domNodeCount > 5000) {
      leakIndicators.push(`High DOM node count: ${domNodeCount} elements`);
      recommendations.push('Check for components that are not properly unmounting');
    }

    // Check for event listeners (approximate)
    const eventListenerCount = this.getEventListenerCount();
    if (eventListenerCount > 500) {
      leakIndicators.push(`High event listener count: ${eventListenerCount} listeners`);
      recommendations.push('Ensure event listeners are properly removed on component unmount');
    }

    return {
      hasLeaks: leakIndicators.length > 0,
      leakIndicators,
      recommendations
    };
  }

  /**
   * Perform emergency cleanup
   */
  performEmergencyCleanup(): {
    success: boolean;
    actions: string[];
    memoryFreed: number;
  } {
    const actions: string[] = [];
    const beforeMemory = this.getMemoryInfo();
    
    try {
      // Clear browser caches
      this.clearCaches();
      actions.push('Cleared browser caches');

      // Force garbage collection if available
      if (this.forceGarbageCollection()) {
        actions.push('Forced garbage collection');
      }

      // Clear large objects from memory (if any global cleanup is available)
      if ((window as any).clearAppCache) {
        (window as any).clearAppCache();
        actions.push('Cleared application cache');
      }

      // Trigger resource manager cleanup
      if ((window as any).resourceManager) {
        const cleanedCount = (window as any).resourceManager.cleanupStale(30000); // 30 seconds
        if (cleanedCount > 0) {
          actions.push(`Cleaned up ${cleanedCount} stale resources`);
        }
      }

      const afterMemory = this.getMemoryInfo();
      const memoryFreed = beforeMemory && afterMemory 
        ? beforeMemory.usedJSHeapSize - afterMemory.usedJSHeapSize 
        : 0;

      return {
        success: true,
        actions,
        memoryFreed
      };
    } catch (error) {
      console.error('Emergency cleanup failed:', error);
      return {
        success: false,
        actions,
        memoryFreed: 0
      };
    }
  }

  /**
   * Get detailed memory report
   */
  getDetailedMemoryReport() {
    const currentMemory = this.getMemoryInfo();
    const leakDetection = this.detectMemoryLeaks();
    const trend = this.getMemoryTrend();
    
    return {
      timestamp: new Date(),
      memory: currentMemory,
      trend,
      leakDetection,
      performance: this.getPerformanceMetrics(),
      recommendations: this.getMemoryRecommendations()
    };
  }

  /**
   * Get memory optimization recommendations
   */
  private getMemoryRecommendations(): string[] {
    const recommendations: string[] = [];
    const currentMemory = this.getMemoryInfo();
    
    if (!currentMemory) {
      recommendations.push('Memory API not available - consider using a modern browser');
      return recommendations;
    }

    const usageRatio = currentMemory.usedJSHeapSize / currentMemory.jsHeapSizeLimit;
    
    if (usageRatio > 0.9) {
      recommendations.push('Critical: Refresh the page immediately');
      recommendations.push('Close other browser tabs');
      recommendations.push('Restart the browser if issues persist');
    } else if (usageRatio > 0.7) {
      recommendations.push('Consider refreshing the page');
      recommendations.push('Close unused components or pages');
      recommendations.push('Clear browser cache');
    } else if (usageRatio > 0.5) {
      recommendations.push('Monitor memory usage closely');
      recommendations.push('Consider periodic page refreshes for long sessions');
    }

    const trend = this.getMemoryTrend();
    if (trend === 'increasing') {
      recommendations.push('Memory usage is trending upward - monitor for leaks');
      recommendations.push('Check for components that may not be cleaning up properly');
    }

    return recommendations;
  }

  /**
   * Auto-cleanup based on memory pressure
   */
  autoCleanup(): boolean {
    const currentMemory = this.getMemoryInfo();
    if (!currentMemory) return false;

    const usageRatio = currentMemory.usedJSHeapSize / currentMemory.jsHeapSizeLimit;
    
    // Trigger cleanup at 85% memory usage
    if (usageRatio > 0.85) {
      console.warn('🚨 High memory pressure detected, performing auto-cleanup');
      const result = this.performEmergencyCleanup();
      
      if (result.success) {
        console.log('✅ Auto-cleanup completed:', result.actions);
        return true;
      }
    }
    
    return false;
  }

  /**
   * Shutdown memory monitor
   */
  shutdown(): void {
    this.stopMonitoring();
    this.memoryHistory = [];
    this.alertCallbacks = [];
    console.log('🔍 Memory monitor shutdown');
  }
}

// Create singleton instance
export const memoryMonitorService = new MemoryMonitorService();
export default memoryMonitorService;