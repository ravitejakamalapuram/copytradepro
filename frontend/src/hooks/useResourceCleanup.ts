/**
 * RESOURCE CLEANUP HOOK
 * React hook for automatic resource cleanup on component unmount
 */

import { useEffect, useRef } from 'react';
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

  return {
    registerTimeout: (timeout: NodeJS.Timeout) => 
      resourceManager.registerTimeout(timeout, componentId),
    
    registerInterval: (interval: NodeJS.Timeout) => 
      resourceManager.registerInterval(interval, componentId),
    
    registerEventListener: (element: EventTarget, event: string, listener: EventListener) => 
      resourceManager.registerEventListener(element, event, listener, componentId),
    
    registerWebSocket: (socket: WebSocket | any) => 
      resourceManager.registerWebSocket(socket, componentId),
    
    registerSubscription: (unsubscribe: () => void) => 
      resourceManager.registerSubscription(unsubscribe, componentId),
    
    registerObserver: (observer: { disconnect: () => void }) => 
      resourceManager.registerObserver(observer, componentId),
    
    registerCache: (cacheKey: string, clearFunction: () => void) => 
      resourceManager.registerCache(cacheKey, clearFunction, componentId),
    
    registerDOMCleanup: (element: HTMLElement) => 
      resourceManager.registerDOMCleanup(element, componentId),
    
    register: (cleanup: () => void, type?: 'timeout' | 'interval' | 'listener' | 'subscription' | 'websocket' | 'observer' | 'cache' | 'other') => 
      resourceManager.register(`${componentId}_${Date.now()}`, cleanup, type, componentId),
    
    cleanup: (resourceId: string) => resourceManager.cleanup(resourceId),
    
    componentId
  };
};

export default useResourceCleanup;