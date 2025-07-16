/**
 * PERFORMANCE MONITOR HOOK
 * React hook for component-level performance monitoring
 */

import { useEffect, useRef, useCallback } from 'react';
import { performanceMonitorService } from '../services/performanceMonitorService';
import { useResourceCleanup } from './useResourceCleanup';

interface UsePerformanceMonitorOptions {
  componentName?: string;
  trackRenders?: boolean;
  trackUserInteractions?: boolean;
  renderThreshold?: number; // ms
}

export const usePerformanceMonitor = (options: UsePerformanceMonitorOptions = {}) => {
  const {
    componentName = 'UnknownComponent',
    trackRenders = true,
    trackUserInteractions = false,
    renderThreshold = 16 // 60fps
  } = options;

  const { registerSubscription } = useResourceCleanup(`usePerformanceMonitor-${componentName}`);
  const renderStartTime = useRef<number>(0);
  const renderCount = useRef<number>(0);
  const mountTime = useRef<number>(Date.now());

  // Start render timing
  const startRenderTiming = useCallback(() => {
    if (trackRenders) {
      renderStartTime.current = performance.now();
    }
  }, [trackRenders]);

  // End render timing
  const endRenderTiming = useCallback(() => {
    if (trackRenders && renderStartTime.current > 0) {
      const renderTime = performance.now() - renderStartTime.current;
      renderCount.current++;
      
      performanceMonitorService.recordRender(
        componentName,
        renderTime,
        renderCount.current,
        0 // props size - could be calculated if needed
      );

      // Warn about slow renders
      if (renderTime > renderThreshold) {
        console.warn(`🐌 Slow render detected in ${componentName}: ${renderTime.toFixed(2)}ms`);
      }

      renderStartTime.current = 0;
    }
  }, [trackRenders, componentName, renderThreshold]);

  // Record custom metric
  const recordMetric = useCallback((
    name: string,
    value: number,
    category: 'navigation' | 'api' | 'render' | 'memory' | 'user' | 'custom' = 'custom',
    tags?: Record<string, string>
  ) => {
    performanceMonitorService.recordMetric(
      `${componentName}_${name}`,
      value,
      category,
      { component: componentName, ...tags }
    );
  }, [componentName]);

  // Record user interaction
  const recordUserInteraction = useCallback((
    type: 'click' | 'scroll' | 'input' | 'navigation',
    target: string,
    duration?: number
  ) => {
    if (trackUserInteractions) {
      performanceMonitorService.recordUserInteraction(type, `${componentName}:${target}`, duration);
    }
  }, [trackUserInteractions, componentName]);

  // Time a function execution
  const timeFunction = useCallback(<T extends any[], R>(
    fn: (...args: T) => R,
    metricName: string
  ) => {
    return (...args: T): R => {
      const start = performance.now();
      const result = fn(...args);
      const duration = performance.now() - start;
      
      recordMetric(metricName, duration, 'custom');
      
      return result;
    };
  }, [recordMetric]);

  // Time an async function execution
  const timeAsyncFunction = useCallback(<T extends any[], R>(
    fn: (...args: T) => Promise<R>,
    metricName: string
  ) => {
    return async (...args: T): Promise<R> => {
      const start = performance.now();
      const result = await fn(...args);
      const duration = performance.now() - start;
      
      recordMetric(metricName, duration, 'custom');
      
      return result;
    };
  }, [recordMetric]);

  // Measure component lifecycle
  useEffect(() => {
    const componentLifetime = Date.now() - mountTime.current;
    recordMetric('mount_time', componentLifetime, 'render');

    return () => {
      const totalLifetime = Date.now() - mountTime.current;
      recordMetric('total_lifetime', totalLifetime, 'render');
      recordMetric('total_renders', renderCount.current, 'render');
    };
  }, [recordMetric]);

  // Track render performance
  useEffect(() => {
    startRenderTiming();
    
    // Use setTimeout to measure after render is complete
    const timeoutId = setTimeout(() => {
      endRenderTiming();
    }, 0);

    return () => {
      clearTimeout(timeoutId);
    };
  });

  // Setup user interaction tracking if enabled
  useEffect(() => {
    if (!trackUserInteractions) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(`[data-component="${componentName}"]`)) {
        const targetDesc = target.tagName + (target.id ? `#${target.id}` : '') + 
                         (target.className ? `.${target.className.split(' ')[0]}` : '');
        recordUserInteraction('click', targetDesc);
      }
    };

    const handleInput = (event: InputEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(`[data-component="${componentName}"]`)) {
        recordUserInteraction('input', target.tagName);
      }
    };

    document.addEventListener('click', handleClick, { passive: true });
    document.addEventListener('input', handleInput, { passive: true });

    // Register for cleanup
    registerSubscription(() => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('input', handleInput);
    });

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('input', handleInput);
    };
  }, [trackUserInteractions, componentName, recordUserInteraction, registerSubscription]);

  return {
    recordMetric,
    recordUserInteraction,
    timeFunction,
    timeAsyncFunction,
    startRenderTiming,
    endRenderTiming,
    componentName,
    renderCount: renderCount.current
  };
};

export default usePerformanceMonitor;