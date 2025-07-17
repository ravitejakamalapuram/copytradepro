/**
 * EVENT BUS HOOK
 * React hook for subscribing to event bus events
 */

import { useEffect, useRef, useCallback } from 'react';
import { eventBusService } from '../services/eventBusService';

interface UseEventBusOptions {
  priority?: number;
  once?: boolean;
  immediate?: boolean;
}

/**
 * Hook to subscribe to event bus events
 */
export const useEventBus = <T = any>(
  eventType: string,
  callback: (data: T) => void,
  options: UseEventBusOptions = {}
) => {
  const callbackRef = useRef(callback);
  const listenerIdRef = useRef<string | null>(null);

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Subscribe to event
  useEffect(() => {
    const wrappedCallback = (data: T) => {
      callbackRef.current(data);
    };

    listenerIdRef.current = eventBusService.subscribe(
      eventType,
      wrappedCallback,
      {
        priority: options.priority,
        once: options.once
      }
    );

    return () => {
      if (listenerIdRef.current) {
        eventBusService.unsubscribe(eventType, listenerIdRef.current);
        listenerIdRef.current = null;
      }
    };
  }, [eventType, options.priority, options.once]);

  // Emit function for convenience
  const emit = useCallback((data: T) => {
    eventBusService.emit(eventType, data, { immediate: options.immediate });
  }, [eventType, options.immediate]);

  return {
    emit,
    isSubscribed: listenerIdRef.current !== null
  };
};

/**
 * Hook to subscribe to multiple event types
 */
export const useEventBusMultiple = <T = any>(
  eventTypes: string[],
  callback: (eventType: string, data: T) => void,
  options: UseEventBusOptions = {}
) => {
  const callbackRef = useRef(callback);
  const listenerIdsRef = useRef<Map<string, string>>(new Map());

  // Update callback ref when callback changes
  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  // Subscribe to all event types
  useEffect(() => {
    const newListenerIds = new Map<string, string>();

    eventTypes.forEach(eventType => {
      const wrappedCallback = (data: T) => {
        callbackRef.current(eventType, data);
      };

      const listenerId = eventBusService.subscribe(
        eventType,
        wrappedCallback,
        {
          priority: options.priority,
          once: options.once
        }
      );

      newListenerIds.set(eventType, listenerId);
    });

    listenerIdsRef.current = newListenerIds;

    return () => {
      newListenerIds.forEach((listenerId, eventType) => {
        eventBusService.unsubscribe(eventType, listenerId);
      });
      listenerIdsRef.current.clear();
    };
  }, [eventTypes, options.priority, options.once]);

  // Emit function for convenience
  const emit = useCallback((eventType: string, data: T) => {
    if (eventTypes.includes(eventType)) {
      eventBusService.emit(eventType, data, { immediate: options.immediate });
    }
  }, [eventTypes, options.immediate]);

  return {
    emit,
    subscribedEventTypes: Array.from(listenerIdsRef.current.keys())
  };
};

/**
 * Hook for price updates specifically
 */
export const usePriceUpdates = (
  callback: (priceData: {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    timestamp: Date;
    exchange: string;
  }) => void,
  options: UseEventBusOptions = {}
) => {
  return useEventBus('price_update', callback, options);
};

/**
 * Hook for account status updates specifically
 */
export const useAccountStatusUpdates = (
  callback: (update: {
    accountId: string;
    isActive: boolean;
    status: 'active' | 'inactive' | 'error' | 'expired';
    message?: string;
    timestamp: Date;
  }) => void,
  options: UseEventBusOptions = {}
) => {
  return useEventBus('account_status_update', callback, options);
};

/**
 * Hook for market indices updates specifically
 */
export const useMarketIndicesUpdates = (
  callback: (data: {
    indices: Array<{
      name: string;
      last: number;
      variation: number;
      percentChange: number;
      imgFileName: string;
    }>;
    timestamp: Date;
  }) => void,
  options: UseEventBusOptions = {}
) => {
  return useEventBus('indices_update', callback, options);
};

/**
 * Hook for order updates specifically
 */
export const useOrderUpdates = (
  callback: (update: {
    orderId: string;
    status: string;
    accountId?: string;
    message?: string;
    timestamp: Date;
  }) => void,
  options: UseEventBusOptions = {}
) => {
  return useEventBus('order_update', callback, options);
};

/**
 * Hook for connection status updates
 */
export const useConnectionStatusUpdates = (
  callback: (status: {
    connected: boolean;
    service: string;
    message?: string;
    timestamp: Date;
  }) => void,
  options: UseEventBusOptions = {}
) => {
  return useEventBus('connection_status', callback, options);
};

export default useEventBus;