/**
 * COMPONENT LIFECYCLE HOOK
 * Enhanced component lifecycle management with automatic resource cleanup
 */

import { useEffect, useRef, useCallback } from 'react';
import { useResourceCleanup } from './useResourceCleanup';
import { memoryLeakDetector } from '../services/memoryLeakDetector';

interface LifecycleCallbacks {
  onMount?: () => void | (() => void);
  onUnmount?: () => void;
  onUpdate?: () => void;
  onError?: (error: Error) => void;
}

interface ComponentMetrics {
  mountTime: Date;
  updateCount: number;
  lastUpdate: Date;
  resourceCount: number;
}

export const useComponentLifecycle = (
  componentName: string,
  callbacks: LifecycleCallbacks = {}
) => {
  const { registerSubscription, componentId } = useResourceCleanup(componentName);
  const metricsRef = useRef<ComponentMetrics>({
    mountTime: new Date(),
    updateCount: 0,
    lastUpdate: new Date(),
    resourceCount: 0
  });
  const cleanupFunctionsRef = useRef<(() => void)[]>([]);
  const isUnmountedRef = useRef(false);

  // Register cleanup function
  const registerCleanup = useCallback((cleanupFn: () => void) => {
    if (isUnmountedRef.current) {
      console.warn(`Attempted to register cleanup after unmount for ${componentName}`);
      return;
    }
    
    cleanupFunctionsRef.current.push(cleanupFn);
    metricsRef.current.resourceCount++;
  }, [componentName]);

  // Safe state setter that checks if component is still mounted
  const safeSetState = useCallback(<T>(setter: (value: T) => void, value: T) => {
    if (!isUnmountedRef.current) {
      setter(value);
    } else {
      console.warn(`Attempted to set state after unmount for ${componentName}`);
    }
  }, [componentName]);

  // Safe async operation wrapper
  const safeAsync = useCallback(async <T>(
    asyncFn: () => Promise<T>,
    onSuccess?: (result: T) => void,
    onError?: (error: Error) => void
  ): Promise<T | null> => {
    try {
      const result = await asyncFn();
      
      if (!isUnmountedRef.current && onSuccess) {
        onSuccess(result);
      }
      
      return result;
    } catch (error) {
      if (!isUnmountedRef.current) {
        const err = error instanceof Error ? error : new Error(String(error));
        if (onError) {
          onError(err);
        } else if (callbacks.onError) {
          callbacks.onError(err);
        } else {
          console.error(`Async error in ${componentName}:`, err);
        }
      }
      return null;
    }
  }, [componentName, callbacks.onError]);

  // Component mount effect
  useEffect(() => {
    console.log(`🔄 Component mounted: ${componentName}`);
    
    let mountCleanup: (() => void) | undefined;
    
    try {
      if (callbacks.onMount) {
        const result = callbacks.onMount();
        if (typeof result === 'function') {
          mountCleanup = result;
        }
      }
    } catch (error) {
      console.error(`Mount error in ${componentName}:`, error);
      if (callbacks.onError) {
        callbacks.onError(error instanceof Error ? error : new Error(String(error)));
      }
    }

    // Cleanup function
    return () => {
      isUnmountedRef.current = true;
      
      console.log(`🔄 Component unmounting: ${componentName}`);
      
      try {
        // Run mount cleanup if provided
        if (mountCleanup) {
          mountCleanup();
        }
        
        // Run all registered cleanup functions
        cleanupFunctionsRef.current.forEach((cleanup, index) => {
          try {
            cleanup();
          } catch (error) {
            console.error(`Cleanup error ${index} in ${componentName}:`, error);
          }
        });
        
        // Run unmount callback
        if (callbacks.onUnmount) {
          callbacks.onUnmount();
        }
        
        console.log(`✅ Component unmounted: ${componentName} (cleaned ${cleanupFunctionsRef.current.length} resources)`);
      } catch (error) {
        console.error(`Unmount error in ${componentName}:`, error);
      }
    };
  }, [componentName, callbacks.onMount, callbacks.onUnmount, callbacks.onError]);

  // Update tracking effect
  useEffect(() => {
    metricsRef.current.updateCount++;
    metricsRef.current.lastUpdate = new Date();
    
    if (callbacks.onUpdate) {
      try {
        callbacks.onUpdate();
      } catch (error) {
        console.error(`Update error in ${componentName}:`, error);
        if (callbacks.onError) {
          callbacks.onError(error instanceof Error ? error : new Error(String(error)));
        }
      }
    }
  });

  // Memory leak detection for long-running components
  useEffect(() => {
    const checkInterval = setInterval(() => {
      const metrics = metricsRef.current;
      const componentAge = Date.now() - metrics.mountTime.getTime();
      
      // Check for potential memory leaks in long-running components
      if (componentAge > 300000 && metrics.resourceCount > 50) { // 5 minutes, 50+ resources
        console.warn(`🚨 Potential memory leak in ${componentName}:`, {
          age: `${Math.round(componentAge / 1000)}s`,
          resources: metrics.resourceCount,
          updates: metrics.updateCount
        });
        
        // Trigger leak detection
        memoryLeakDetector.forceDetection().then(result => {
          if (result.affectedComponents.includes(componentId)) {
            console.warn(`🚨 Component ${componentName} flagged for memory leaks`);
          }
        });
      }
    }, 60000); // Check every minute

    registerCleanup(() => clearInterval(checkInterval));
    
    return () => clearInterval(checkInterval);
  }, [componentName, componentId, registerCleanup]);

  // Get component metrics
  const getMetrics = useCallback(() => ({
    ...metricsRef.current,
    isUnmounted: isUnmountedRef.current,
    componentAge: Date.now() - metricsRef.current.mountTime.getTime()
  }), []);

  // Force cleanup (for debugging)
  const forceCleanup = useCallback(() => {
    cleanupFunctionsRef.current.forEach((cleanup, index) => {
      try {
        cleanup();
      } catch (error) {
        console.error(`Force cleanup error ${index} in ${componentName}:`, error);
      }
    });
    cleanupFunctionsRef.current = [];
    metricsRef.current.resourceCount = 0;
  }, [componentName]);

  return {
    registerCleanup,
    safeSetState,
    safeAsync,
    getMetrics,
    forceCleanup,
    isUnmounted: () => isUnmountedRef.current,
    componentId
  };
};

export default useComponentLifecycle;