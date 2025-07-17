/**
 * RESOURCE MANAGER
 * Centralized resource cleanup and memory management utility
 */

interface ResourceCleanup {
  id: string;
  cleanup: () => void;
  type: 'timeout' | 'interval' | 'listener' | 'subscription' | 'websocket' | 'observer' | 'cache' | 'other';
  created: Date;
  componentId?: string;
  metadata?: any;
}

class ResourceManager {
  private resources: Map<string, ResourceCleanup> = new Map();
  private componentResources: Map<string, Set<string>> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;
  private memoryCheckInterval: NodeJS.Timeout | null = null;
  private readonly CLEANUP_INTERVAL = 60000; // 1 minute
  private readonly MEMORY_CHECK_INTERVAL = 30000; // 30 seconds
  private readonly MAX_RESOURCES_WARNING = 1000;
  private readonly MAX_COMPONENT_RESOURCES_WARNING = 100;

  constructor() {
    this.startAutomaticCleanup();
    this.startMemoryMonitoring();
  }

  /**
   * Start automatic cleanup scheduling
   */
  private startAutomaticCleanup(): void {
    if (this.cleanupInterval) return;

    this.cleanupInterval = setInterval(() => {
      const staleCount = this.cleanupStale();
      if (staleCount > 0) {
        console.log(`🧹 Automatically cleaned up ${staleCount} stale resources`);
      }
    }, this.CLEANUP_INTERVAL);
  }

  /**
   * Start memory monitoring
   */
  private startMemoryMonitoring(): void {
    if (this.memoryCheckInterval) return;

    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, this.MEMORY_CHECK_INTERVAL);
  }

  /**
   * Check memory usage and warn about potential leaks
   */
  private checkMemoryUsage(): void {
    const totalResources = this.resources.size;
    
    if (totalResources > this.MAX_RESOURCES_WARNING) {
      console.warn(`🚨 High resource count detected: ${totalResources} resources registered. Potential memory leak!`);
    }

    // Check for components with too many resources
    for (const [componentId, resourceIds] of this.componentResources.entries()) {
      if (resourceIds.size > this.MAX_COMPONENT_RESOURCES_WARNING) {
        console.warn(`🚨 Component ${componentId} has ${resourceIds.size} resources. Potential memory leak!`);
      }
    }

    // Check browser memory if available
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      const usageRatio = memory.usedJSHeapSize / memory.jsHeapSizeLimit;
      
      if (usageRatio > 0.8) {
        console.warn(`🚨 High memory usage detected: ${(usageRatio * 100).toFixed(1)}%`);
        // Force cleanup of old resources
        const cleanedCount = this.cleanupStale(60000); // 1 minute
        if (cleanedCount > 0) {
          console.log(`🧹 Emergency cleanup: removed ${cleanedCount} resources`);
        }
      }
    }
  }

  /**
   * Register a resource for cleanup
   */
  register(
    resourceId: string,
    cleanup: () => void,
    type: ResourceCleanup['type'] = 'other',
    componentId?: string
  ): string {
    const resource: ResourceCleanup = {
      id: resourceId,
      cleanup,
      type,
      created: new Date(),
      componentId
    };

    this.resources.set(resourceId, resource);

    // Track component-specific resources
    if (componentId) {
      if (!this.componentResources.has(componentId)) {
        this.componentResources.set(componentId, new Set());
      }
      this.componentResources.get(componentId)!.add(resourceId);
    }

    return resourceId;
  }

  /**
   * Register a timeout for cleanup
   */
  registerTimeout(
    timeout: NodeJS.Timeout,
    componentId?: string
  ): string {
    const id = `timeout_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return this.register(
      id,
      () => clearTimeout(timeout),
      'timeout',
      componentId
    );
  }

  /**
   * Register an interval for cleanup
   */
  registerInterval(
    interval: NodeJS.Timeout,
    componentId?: string
  ): string {
    const id = `interval_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return this.register(
      id,
      () => clearInterval(interval),
      'interval',
      componentId
    );
  }

  /**
   * Register an event listener for cleanup
   */
  registerEventListener(
    element: EventTarget,
    event: string,
    listener: EventListener,
    componentId?: string
  ): string {
    const id = `listener_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return this.register(
      id,
      () => element.removeEventListener(event, listener),
      'listener',
      componentId
    );
  }

  /**
   * Register a WebSocket connection for cleanup
   */
  registerWebSocket(
    socket: WebSocket | any,
    componentId?: string
  ): string {
    const id = `websocket_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return this.register(
      id,
      () => {
        if (socket && typeof socket.close === 'function') {
          socket.close();
        } else if (socket && typeof socket.disconnect === 'function') {
          socket.disconnect();
        }
      },
      'websocket',
      componentId
    );
  }

  /**
   * Register a subscription for cleanup
   */
  registerSubscription(
    unsubscribe: () => void,
    componentId?: string
  ): string {
    const id = `subscription_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return this.register(id, unsubscribe, 'subscription', componentId);
  }

  /**
   * Register an observer (MutationObserver, IntersectionObserver, etc.) for cleanup
   */
  registerObserver(
    observer: { disconnect: () => void },
    componentId?: string
  ): string {
    const id = `observer_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return this.register(
      id,
      () => observer.disconnect(),
      'observer',
      componentId
    );
  }

  /**
   * Register cache cleanup
   */
  registerCache(
    cacheKey: string,
    clearFunction: () => void,
    componentId?: string
  ): string {
    const id = `cache_${cacheKey}_${Date.now()}`;
    return this.register(id, clearFunction, 'cache', componentId);
  }

  /**
   * Register DOM element cleanup
   */
  registerDOMCleanup(
    element: HTMLElement,
    componentId?: string
  ): string {
    const id = `dom_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    return this.register(
      id,
      () => {
        // Remove all event listeners by cloning the element
        if (element.parentNode) {
          const clone = element.cloneNode(true);
          element.parentNode.replaceChild(clone, element);
        }
      },
      'other',
      componentId
    );
  }

  /**
   * Cleanup a specific resource
   */
  cleanup(resourceId: string): boolean {
    const resource = this.resources.get(resourceId);
    if (!resource) return false;

    try {
      resource.cleanup();
      this.resources.delete(resourceId);
      
      // Remove from component tracking
      for (const [componentId, resourceIds] of this.componentResources.entries()) {
        if (resourceIds.has(resourceId)) {
          resourceIds.delete(resourceId);
          if (resourceIds.size === 0) {
            this.componentResources.delete(componentId);
          }
          break;
        }
      }
      
      return true;
    } catch (error) {
      console.error(`Failed to cleanup resource ${resourceId}:`, error);
      return false;
    }
  }

  /**
   * Cleanup all resources for a component
   */
  cleanupComponent(componentId: string): number {
    const resourceIds = this.componentResources.get(componentId);
    if (!resourceIds) return 0;

    let cleanedCount = 0;
    for (const resourceId of resourceIds) {
      if (this.cleanup(resourceId)) {
        cleanedCount++;
      }
    }

    this.componentResources.delete(componentId);
    return cleanedCount;
  }

  /**
   * Cleanup all resources
   */
  cleanupAll(): number {
    let cleanedCount = 0;
    
    for (const [resourceId] of this.resources) {
      if (this.cleanup(resourceId)) {
        cleanedCount++;
      }
    }

    this.resources.clear();
    this.componentResources.clear();
    
    return cleanedCount;
  }

  /**
   * Cleanup stale resources (older than specified age)
   */
  cleanupStale(maxAgeMs: number = 300000): number { // 5 minutes default
    const now = new Date();
    const staleResources: string[] = [];

    for (const [resourceId, resource] of this.resources) {
      const age = now.getTime() - resource.created.getTime();
      if (age > maxAgeMs) {
        staleResources.push(resourceId);
      }
    }

    let cleanedCount = 0;
    for (const resourceId of staleResources) {
      if (this.cleanup(resourceId)) {
        cleanedCount++;
      }
    }

    return cleanedCount;
  }

  /**
   * Get resource statistics
   */
  getStats() {
    const typeStats = new Map<string, number>();
    
    for (const resource of this.resources.values()) {
      const count = typeStats.get(resource.type) || 0;
      typeStats.set(resource.type, count + 1);
    }

    return {
      totalResources: this.resources.size,
      totalComponents: this.componentResources.size,
      resourcesByType: Object.fromEntries(typeStats),
      oldestResource: this.getOldestResource(),
      averageAge: this.getAverageResourceAge()
    };
  }

  /**
   * Get oldest resource age
   */
  private getOldestResource(): { id: string; age: number } | null {
    if (this.resources.size === 0) return null;

    const now = new Date();
    let oldest: { id: string; age: number } | null = null;

    for (const [id, resource] of this.resources) {
      const age = now.getTime() - resource.created.getTime();
      if (!oldest || age > oldest.age) {
        oldest = { id, age };
      }
    }

    return oldest;
  }

  /**
   * Get average resource age
   */
  private getAverageResourceAge(): number {
    if (this.resources.size === 0) return 0;

    const now = new Date();
    let totalAge = 0;

    for (const resource of this.resources.values()) {
      totalAge += now.getTime() - resource.created.getTime();
    }

    return totalAge / this.resources.size;
  }

  /**
   * Force garbage collection if available
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
    return false;
  }

  /**
   * Shutdown resource manager
   */
  shutdown(): void {
    // Stop automatic cleanup
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    // Stop memory monitoring
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = null;
    }

    // Cleanup all resources
    this.cleanupAll();
    
    console.log('🧹 Resource manager shutdown complete');
  }
}

// Create singleton instance
export const resourceManager = new ResourceManager();

export default resourceManager;