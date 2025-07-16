/**
 * RESOURCE CLEANUP HOOK
 * React hook for automatic resource cleanup on component unmount
 */

import { useEffect, useRef, useCallback, useMemo } from 'react';
import { resourceManager } from '../utils/resourceManager';

export const useResourceCleanup = (componentName?: string) => {
  const componentId = useRef(
    componentName || `component_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  ).current;

  useEffect(() => {
    return () => {
      const cleanedCount = resourceManager.cleanupComponent(componentId);
      if (cleanedCount > 0) {
        console.log(`🧹 Cleaned up ${cleanedCount} resources for component ${componentId}`);
      }
    };
  }, [componentId]);

  const registerTimeout = useCallback((timeout: NodeJS.Timeout) => 
    resourceManager.registerTimeout(timeout, componentId), [componentId]);
  
  const registerInterval = useCallback((interval: NodeJS.Timeout) => 
    resourceManager.registerInterval(interval, componentId), [componentId]);
  
  const registerEventListener = useCallback((element: EventTarget, event: string, listener: EventListener) => 
    resourceManager.registerEventListener(element, event, listener, componentId), [componentId]);
  
  const registerWebSocket = useCallback((socket: WebSocket | unknown) => 
    resourceManager.registerWebSocket(socket, componentId), [componentId]);
  
  const registerSubscription = useCallback((unsubscribe: () => void) => 
    resourceManager.registerSubscription(unsubscribe, componentId), [componentId]);
  
  const registerObserver = useCallback((observer: { disconnect: () => void }) => 
    resourceManager.registerObserver(observer, componentId), [componentId]);
  
  const registerCache = useCallback((cacheKey: string, clearFunction: () => void) => 
    resourceManager.registerCache(cacheKey, clearFunction, componentId), [componentId]);
  
  const registerDOMCleanup = useCallback((element: HTMLElement) => 
    resourceManager.registerDOMCleanup(element, componentId), [componentId]);
  
  const register = useCallback((cleanup: () => void, type?: 'timeout' | 'interval' | 'listener' | 'subscription' | 'websocket' | 'observer' | 'cache' | 'other') => 
    resourceManager.register(`${componentId}_${Date.now()}`, cleanup, type, componentId), [componentId]);
  
  const cleanup = useCallback((resourceId: string) => resourceManager.cleanup(resourceId), []);

  return useMemo(() => ({
    registerTimeout,
    registerInterval,
    registerEventListener,
    registerWebSocket,
    registerSubscription,
    registerObserver,
    registerCache,
    registerDOMCleanup,
    register,
    cleanup,
    componentId
  }), [
    registerTimeout,
    registerInterval,
    registerEventListener,
    registerWebSocket,
    registerSubscription,
    registerObserver,
    registerCache,
    registerDOMCleanup,
    register,
    cleanup,
    componentId
  ]);
};

export default useResourceCleanup;