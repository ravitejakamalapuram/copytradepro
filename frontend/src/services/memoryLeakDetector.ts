/**
 * MEMORY LEAK DETECTOR SERVICE
 * Advanced memory leak detection and automatic cleanup
 */

import { memoryMonitorService } from './memoryMonitorService';
import { resourceManager } from '../utils/resourceManager';

interface LeakDetectionResult {
  hasLeaks: boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  leakTypes: string[];
  affectedComponents: string[];
  recommendations: string[];
  autoCleanupPerformed: boolean;
}

interface ComponentMemoryProfile {
  componentId: string;
  resourceCount: number;
  memoryEstimate: number;
  lastActivity: Date;
  leakRisk: 'low' | 'medium' | 'high';
}

class MemoryLeakDetector {
  private detectionInterval: NodeJS.Timeout | null = null;
  private readonly DETECTION_INTERVAL = 60000; // 1 minute
  private componentProfiles: Map<string, ComponentMemoryProfile> = new Map();
  private leakHistory: LeakDetectionResult[] = [];
  private readonly MAX_HISTORY_SIZE = 50;
  private isRunning = false;

  /**
   * Start memory leak detection
   */
  startDetection(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    
    this.detectionInterval = setInterval(() => {
      this.performLeakDetection();
    }, this.DETECTION_INTERVAL);

    console.log('🔍 Memory leak detection started');
  }

  /**
   * Stop memory leak detection
   */
  stopDetection(): void {
    if (this.detectionInterval) {
      clearInterval(this.detectionInterval);
      this.detectionInterval = null;
    }
    
    this.isRunning = false;
    console.log('🔍 Memory leak detection stopped');
  }

  /**
   * Perform comprehensive leak detection
   */
  private async performLeakDetection(): Promise<LeakDetectionResult> {
    const result: LeakDetectionResult = {
      hasLeaks: false,
      severity: 'low',
      leakTypes: [],
      affectedComponents: [],
      recommendations: [],
      autoCleanupPerformed: false
    };

    try {
      // Update component profiles
      this.updateComponentProfiles();

      // Check for various types of memory leaks
      await this.checkDOMLeaks(result);
      await this.checkEventListenerLeaks(result);
      await this.checkTimerLeaks(result);
      await this.checkWebSocketLeaks(result);
      await this.checkCacheLeaks(result);
      await this.checkComponentLeaks(result);

      // Determine overall severity
      result.severity = this.calculateSeverity(result);
      result.hasLeaks = result.leakTypes.length > 0;

      // Perform automatic cleanup if needed
      if (result.severity === 'high' || result.severity === 'critical') {
        result.autoCleanupPerformed = await this.performAutoCleanup(result);
      }

      // Add to history
      this.leakHistory.push(result);
      if (this.leakHistory.length > this.MAX_HISTORY_SIZE) {
        this.leakHistory.shift();
      }

      // Log results if leaks detected
      if (result.hasLeaks) {
        console.warn('🚨 Memory leaks detected:', result);
      }

    } catch (error) {
      console.error('Error during leak detection:', error);
    }

    return result;
  }

  /**
   * Update component memory profiles
   */
  private updateComponentProfiles(): void {
    const resourceStats = resourceManager.getStats();
    
    // Clear old profiles
    this.componentProfiles.clear();

    // Create profiles for active components
    for (const [componentId, resourceIds] of (resourceManager as any).componentResources.entries()) {
      const profile: ComponentMemoryProfile = {
        componentId,
        resourceCount: resourceIds.size,
        memoryEstimate: this.estimateComponentMemory(resourceIds.size),
        lastActivity: new Date(),
        leakRisk: this.assessLeakRisk(resourceIds.size)
      };

      this.componentProfiles.set(componentId, profile);
    }
  }

  /**
   * Check for DOM-related memory leaks
   */
  private async checkDOMLeaks(result: LeakDetectionResult): Promise<void> {
    const domNodeCount = document.querySelectorAll('*').length;
    const detachedNodes = this.findDetachedNodes();

    if (domNodeCount > 10000) {
      result.leakTypes.push('excessive_dom_nodes');
      result.recommendations.push(`High DOM node count: ${domNodeCount}. Consider virtual scrolling or pagination.`);
    }

    if (detachedNodes.length > 100) {
      result.leakTypes.push('detached_dom_nodes');
      result.recommendations.push(`${detachedNodes.length} detached DOM nodes found. Check component cleanup.`);
    }
  }

  /**
   * Check for event listener leaks
   */
  private async checkEventListenerLeaks(result: LeakDetectionResult): Promise<void> {
    const listenerCount = this.estimateEventListenerCount();
    
    if (listenerCount > 1000) {
      result.leakTypes.push('excessive_event_listeners');
      result.recommendations.push(`High event listener count: ${listenerCount}. Ensure proper cleanup on unmount.`);
    }
  }

  /**
   * Check for timer leaks (setInterval, setTimeout)
   */
  private async checkTimerLeaks(result: LeakDetectionResult): Promise<void> {
    const resourceStats = resourceManager.getStats();
    const timerCount = (resourceStats.resourcesByType.timeout || 0) + (resourceStats.resourcesByType.interval || 0);
    
    if (timerCount > 50) {
      result.leakTypes.push('excessive_timers');
      result.recommendations.push(`High timer count: ${timerCount}. Check for uncleaned intervals/timeouts.`);
    }
  }

  /**
   * Check for WebSocket connection leaks
   */
  private async checkWebSocketLeaks(result: LeakDetectionResult): Promise<void> {
    const resourceStats = resourceManager.getStats();
    const websocketCount = resourceStats.resourcesByType.websocket || 0;
    
    if (websocketCount > 10) {
      result.leakTypes.push('excessive_websockets');
      result.recommendations.push(`High WebSocket count: ${websocketCount}. Ensure connections are properly closed.`);
    }
  }

  /**
   * Check for cache-related leaks
   */
  private async checkCacheLeaks(result: LeakDetectionResult): Promise<void> {
    const cacheSize = this.estimateCacheSize();
    
    if (cacheSize > 50 * 1024 * 1024) { // 50MB
      result.leakTypes.push('excessive_cache_size');
      result.recommendations.push(`Large cache size: ${(cacheSize / 1024 / 1024).toFixed(2)}MB. Consider cache cleanup.`);
    }
  }

  /**
   * Check for component-specific leaks
   */
  private async checkComponentLeaks(result: LeakDetectionResult): Promise<void> {
    for (const [componentId, profile] of this.componentProfiles.entries()) {
      if (profile.leakRisk === 'high') {
        result.leakTypes.push('component_resource_leak');
        result.affectedComponents.push(componentId);
        result.recommendations.push(`Component ${componentId} has ${profile.resourceCount} resources. Check cleanup logic.`);
      }
    }
  }

  /**
   * Calculate overall severity
   */
  private calculateSeverity(result: LeakDetectionResult): 'low' | 'medium' | 'high' | 'critical' {
    const leakCount = result.leakTypes.length;
    const memoryInfo = memoryMonitorService.getMemoryInfo();
    
    if (!memoryInfo) return 'low';
    
    const memoryUsage = memoryInfo.usedJSHeapSize / memoryInfo.jsHeapSizeLimit;
    
    if (memoryUsage > 0.9 || leakCount >= 4) return 'critical';
    if (memoryUsage > 0.8 || leakCount >= 3) return 'high';
    if (memoryUsage > 0.6 || leakCount >= 2) return 'medium';
    return 'low';
  }

  /**
   * Perform automatic cleanup
   */
  private async performAutoCleanup(result: LeakDetectionResult): Promise<boolean> {
    try {
      console.warn('🧹 Performing automatic memory cleanup due to detected leaks');
      
      let cleanupPerformed = false;

      // Cleanup stale resources
      const staleCount = resourceManager.cleanupStale(30000); // 30 seconds
      if (staleCount > 0) {
        console.log(`🧹 Cleaned up ${staleCount} stale resources`);
        cleanupPerformed = true;
      }

      // Force garbage collection
      if (memoryMonitorService.forceGarbageCollection()) {
        cleanupPerformed = true;
      }

      // Clear browser caches
      await memoryMonitorService.clearCaches();
      cleanupPerformed = true;

      // Cleanup high-risk components
      for (const componentId of result.affectedComponents) {
        const cleanedResources = resourceManager.cleanupComponent(componentId);
        if (cleanedResources > 0) {
          console.log(`🧹 Cleaned up ${cleanedResources} resources for component ${componentId}`);
          cleanupPerformed = true;
        }
      }

      return cleanupPerformed;
    } catch (error) {
      console.error('Auto-cleanup failed:', error);
      return false;
    }
  }

  /**
   * Find detached DOM nodes (approximate)
   */
  private findDetachedNodes(): Element[] {
    const detached: Element[] = [];
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_ELEMENT,
      null
    );

    let node;
    while (node = walker.nextNode()) {
      const element = node as Element;
      // Check if element has React fiber properties but no parent
      if (element.hasAttribute('data-react-*') && !element.parentElement) {
        detached.push(element);
      }
    }

    return detached;
  }

  /**
   * Estimate event listener count
   */
  private estimateEventListenerCount(): number {
    // This is an approximation - actual count is not easily accessible
    const elements = document.querySelectorAll('*');
    let count = 0;
    
    elements.forEach(element => {
      // Check for common event attributes
      const eventAttrs = ['onclick', 'onchange', 'onsubmit', 'onload', 'onerror', 'onmousedown', 'onmouseup'];
      eventAttrs.forEach(attr => {
        if (element.hasAttribute(attr)) count++;
      });
      
      // Estimate based on element type
      const tagName = element.tagName.toLowerCase();
      if (['button', 'input', 'select', 'textarea', 'a'].includes(tagName)) {
        count += 2; // Assume average of 2 listeners per interactive element
      }
    });
    
    return count;
  }

  /**
   * Estimate cache size
   */
  private estimateCacheSize(): number {
    let totalSize = 0;
    
    // localStorage
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key) {
          const value = localStorage.getItem(key);
          totalSize += (key.length + (value?.length || 0)) * 2;
        }
      }
    } catch (error) {
      // Ignore
    }
    
    // sessionStorage
    try {
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          const value = sessionStorage.getItem(key);
          totalSize += (key.length + (value?.length || 0)) * 2;
        }
      }
    } catch (error) {
      // Ignore
    }
    
    return totalSize;
  }

  /**
   * Estimate component memory usage
   */
  private estimateComponentMemory(resourceCount: number): number {
    // Rough estimate: 1KB per resource
    return resourceCount * 1024;
  }

  /**
   * Assess leak risk for a component
   */
  private assessLeakRisk(resourceCount: number): 'low' | 'medium' | 'high' {
    if (resourceCount > 100) return 'high';
    if (resourceCount > 50) return 'medium';
    return 'low';
  }

  /**
   * Get leak detection report
   */
  getLeakReport() {
    return {
      isRunning: this.isRunning,
      componentProfiles: Array.from(this.componentProfiles.values()),
      recentLeaks: this.leakHistory.slice(-10),
      summary: {
        totalComponents: this.componentProfiles.size,
        highRiskComponents: Array.from(this.componentProfiles.values()).filter(p => p.leakRisk === 'high').length,
        recentLeakCount: this.leakHistory.filter(l => l.hasLeaks).length
      }
    };
  }

  /**
   * Force leak detection now
   */
  async forceDetection(): Promise<LeakDetectionResult> {
    return await this.performLeakDetection();
  }

  /**
   * Shutdown leak detector
   */
  shutdown(): void {
    this.stopDetection();
    this.componentProfiles.clear();
    this.leakHistory = [];
    console.log('🔍 Memory leak detector shutdown');
  }
}

// Create singleton instance
export const memoryLeakDetector = new MemoryLeakDetector();
export default memoryLeakDetector;