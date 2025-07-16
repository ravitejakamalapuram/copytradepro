/**
 * REAL-TIME DATA HOOK
 * React hook for WebSocket-based live price streaming
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { eventBusService } from '../services/eventBusService';
import { useResourceCleanup } from './useResourceCleanup';

interface LivePrice {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
  timestamp: Date;
  exchange: string;
}

interface MarketIndex {
  name: string;
  last: number;
  variation: number;
  percentChange: number;
  imgFileName: string;
}

interface IndicesUpdate {
  indices: MarketIndex[];
  timestamp: Date;
}

interface MarketStatusUpdate {
  status: string;
  isOpen: boolean;
  timestamp: Date;
}

interface ConnectionHealth {
  healthScore: number;
  lastActivity: Date | null;
  uptime: number;
  reconnectCount: number;
}

export const useRealTimeData = () => {
  const { registerTimeout, registerInterval, registerWebSocket, registerSubscription } = useResourceCleanup('useRealTimeData');
  
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectionHealth, setConnectionHealth] = useState<ConnectionHealth>({
    healthScore: 0,
    lastActivity: null,
    uptime: 0,
    reconnectCount: 0
  });
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map());
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([]);
  const [marketStatus, setMarketStatus] = useState<MarketStatusUpdate | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  
  const subscribedSymbols = useRef<Set<string>>(new Set());
  const subscribedToIndices = useRef(false);
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const healthCheckInterval = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000; // 1 second

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback((attempt: number): number => {
    return Math.min(baseReconnectDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
  }, []);

  // Handle reconnection with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('🚨 Max reconnection attempts reached');
      setLastError('Connection failed after maximum retry attempts');
      return;
    }

    const delay = getReconnectDelay(reconnectAttempts.current);
    console.log(`🔄 Scheduling reconnect attempt ${reconnectAttempts.current + 1} in ${delay}ms`);

    reconnectTimeout.current = setTimeout(() => {
      reconnectAttempts.current++;
      setConnectionHealth(prev => ({ ...prev, reconnectCount: reconnectAttempts.current }));
      initializeConnection();
    }, delay);
    
    // Register timeout for cleanup
    registerTimeout(reconnectTimeout.current);
  }, [registerTimeout]);

  // Initialize socket connection with enhanced error handling
  const initializeConnection = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLastError('No authentication token available');
      return;
    }

    setConnecting(true);
    setLastError(null);

    const socketUrl = '/';
    console.log('🔧 Initializing Socket.IO connection');

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      autoConnect: true
    });

    // Connection successful
    newSocket.on('connect', () => {
      console.log('🔄 Real-time data connected');
      setConnected(true);
      setConnecting(false);
      setLastError(null);
      reconnectAttempts.current = 0;
      
      // Clear any pending reconnect timeout
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }

      // Start health monitoring
      startHealthMonitoring(newSocket);

      // Resubscribe to previous subscriptions
      resubscribeToAll(newSocket);
    });

    // Connection lost
    newSocket.on('disconnect', (reason) => {
      console.log('🔄 Real-time data disconnected:', reason);
      setConnected(false);
      setConnecting(false);
      
      // Stop health monitoring
      stopHealthMonitoring();

      // Schedule reconnect for unexpected disconnections
      if (reason === 'io server disconnect') {
        setLastError('Server disconnected the connection');
      } else if (reason === 'transport close' || reason === 'transport error') {
        scheduleReconnect();
      }
    });

    // Handle data updates through event bus
    newSocket.on('price_update', (priceData: LivePrice) => {
      // Update local state
      setLivePrices(prev => {
        const updated = new Map(prev);
        const key = `${priceData.symbol}:${priceData.exchange}`;
        updated.set(key, priceData);
        return updated;
      });
      setLastUpdate(new Date());
      updateConnectionActivity();

      // Distribute through event bus
      eventBusService.emit('price_update', priceData);
    });

    // Handle price update errors
    newSocket.on('price_update_error', (errorData: { symbol: string; exchange: string; error: string; timestamp: Date }) => {
      console.warn('📡 Price update error:', errorData);
      
      // Distribute error through event bus
      eventBusService.emit('price_update_error', errorData);
    });

    newSocket.on('indices_update', (data: IndicesUpdate) => {
      // Update local state
      setMarketIndices(data.indices);
      setLastUpdate(new Date(data.timestamp));
      updateConnectionActivity();

      // Distribute through event bus
      eventBusService.emit('indices_update', data);
    });

    newSocket.on('market_status_update', (data: MarketStatusUpdate) => {
      // Update local state
      setMarketStatus(data);
      setLastUpdate(new Date(data.timestamp));
      updateConnectionActivity();

      // Distribute through event bus
      eventBusService.emit('market_status_update', data);
    });

    // Handle connection errors
    newSocket.on('connect_error', (error) => {
      console.error('🚨 Real-time data connection error:', error);
      setConnecting(false);
      setLastError(error.message || 'Connection error occurred');
      scheduleReconnect();
    });

    // Handle server-sent health responses
    newSocket.on('health_response', (data: { healthScore: number; lastActivity: string; uptime: number }) => {
      setConnectionHealth(prev => ({
        ...prev,
        healthScore: data.healthScore,
        uptime: data.uptime
      }));
    });

    // Handle connection errors from server
    newSocket.on('connection_error', (data: { message: string; canRetry: boolean }) => {
      console.warn('🚨 Server connection error:', data.message);
      setLastError(data.message);
      if (data.canRetry) {
        scheduleReconnect();
      }
    });

    setSocket(newSocket);
    
    // Register WebSocket for cleanup
    registerWebSocket(newSocket);
  }, [scheduleReconnect, registerWebSocket]);

  // Update connection activity
  const updateConnectionActivity = useCallback(() => {
    setConnectionHealth(prev => ({
      ...prev,
      lastActivity: new Date()
    }));
  }, []);

  // Start health monitoring
  const startHealthMonitoring = useCallback((socket: Socket) => {
    if (healthCheckInterval.current) {
      clearInterval(healthCheckInterval.current);
    }

    healthCheckInterval.current = setInterval(() => {
      if (socket.connected) {
        socket.emit('health_check');
        socket.emit('ping');
      }
    }, 30000); // Check every 30 seconds
    
    // Register interval for cleanup
    registerInterval(healthCheckInterval.current);
  }, [registerInterval]);

  // Stop health monitoring
  const stopHealthMonitoring = useCallback(() => {
    if (healthCheckInterval.current) {
      clearInterval(healthCheckInterval.current);
      healthCheckInterval.current = null;
    }
  }, []);

  // Resubscribe to all previous subscriptions after reconnect
  const resubscribeToAll = useCallback((socket: Socket) => {
    const userId = localStorage.getItem('userId') || 'anonymous';

    // Resubscribe to symbols
    subscribedSymbols.current.forEach(key => {
      const [symbol, exchange] = key.split(':');
      socket.emit('subscribe_symbol', { symbol, exchange, userId });
    });

    // Resubscribe to indices if previously subscribed
    if (subscribedToIndices.current) {
      socket.emit('subscribe_indices');
    }

    console.log(`🔄 Resubscribed to ${subscribedSymbols.current.size} symbols and indices: ${subscribedToIndices.current}`);
  }, []);

  // Initialize connection on mount
  useEffect(() => {
    initializeConnection();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      stopHealthMonitoring();
      if (socket) {
        socket.removeAllListeners();
        socket.close();
      }
    };
  }, [initializeConnection, stopHealthMonitoring]);

  // Subscribe to symbol price updates
  const subscribeToSymbol = useCallback((symbol: string, exchange: string = 'NSE') => {
    if (!socket || !connected) return;

    const key = `${symbol}:${exchange}`;
    if (subscribedSymbols.current.has(key)) return;

    const userId = localStorage.getItem('userId') || 'anonymous';
    
    socket.emit('subscribe_symbol', {
      symbol,
      exchange,
      userId
    });

    subscribedSymbols.current.add(key);
    console.log(`📈 Subscribed to ${symbol} on ${exchange}`);
  }, [socket, connected]);

  // Unsubscribe from symbol price updates
  const unsubscribeFromSymbol = useCallback((symbol: string, exchange: string = 'NSE') => {
    if (!socket) return;

    const key = `${symbol}:${exchange}`;
    if (!subscribedSymbols.current.has(key)) return;

    socket.emit('unsubscribe_symbol', {
      symbol,
      exchange
    });

    subscribedSymbols.current.delete(key);
    
    // Remove from live prices
    setLivePrices(prev => {
      const updated = new Map(prev);
      updated.delete(key);
      return updated;
    });

    console.log(`📉 Unsubscribed from ${symbol} on ${exchange}`);
  }, [socket]);

  // Subscribe to market indices updates
  const subscribeToIndices = useCallback(() => {
    if (!socket || !connected || subscribedToIndices.current) return;

    socket.emit('subscribe_indices');
    subscribedToIndices.current = true;
    console.log('📊 Subscribed to market indices');
  }, [socket, connected]);

  // Unsubscribe from market indices updates
  const unsubscribeFromIndices = useCallback(() => {
    if (!socket || !subscribedToIndices.current) return;

    socket.emit('unsubscribe_indices');
    subscribedToIndices.current = false;
    setMarketIndices([]);
    console.log('📊 Unsubscribed from market indices');
  }, [socket]);

  // Get live price for a symbol
  const getLivePrice = useCallback((symbol: string, exchange: string = 'NSE'): LivePrice | null => {
    const key = `${symbol}:${exchange}`;
    return livePrices.get(key) || null;
  }, [livePrices]);

  // Subscribe to multiple symbols at once
  const subscribeToSymbols = useCallback((symbols: Array<{ symbol: string; exchange?: string }>) => {
    symbols.forEach(({ symbol, exchange = 'NSE' }) => {
      subscribeToSymbol(symbol, exchange);
    });
  }, [subscribeToSymbol]);

  // Unsubscribe from multiple symbols at once
  const unsubscribeFromSymbols = useCallback((symbols: Array<{ symbol: string; exchange?: string }>) => {
    symbols.forEach(({ symbol, exchange = 'NSE' }) => {
      unsubscribeFromSymbol(symbol, exchange);
    });
  }, [unsubscribeFromSymbol]);

  // Clear all subscriptions
  const clearAllSubscriptions = useCallback(() => {
    subscribedSymbols.current.forEach(key => {
      const [symbol, exchange] = key.split(':');
      unsubscribeFromSymbol(symbol, exchange);
    });
    
    if (subscribedToIndices.current) {
      unsubscribeFromIndices();
    }
  }, [unsubscribeFromSymbol, unsubscribeFromIndices]);

  return {
    // Connection status
    connected,
    connecting,
    lastUpdate,
    lastError,
    connectionHealth,
    
    // Data
    livePrices: Array.from(livePrices.values()),
    marketIndices,
    marketStatus,
    
    // Methods
    subscribeToSymbol,
    unsubscribeFromSymbol,
    subscribeToSymbols,
    unsubscribeFromSymbols,
    subscribeToIndices,
    unsubscribeFromIndices,
    getLivePrice,
    clearAllSubscriptions,
    
    // Connection management
    reconnect: initializeConnection,
    
    // Utils
    isSubscribed: (symbol: string, exchange: string = 'NSE') => 
      subscribedSymbols.current.has(`${symbol}:${exchange}`),
    subscribedCount: subscribedSymbols.current.size,
    canReconnect: reconnectAttempts.current < maxReconnectAttempts
  };
};

export default useRealTimeData;
