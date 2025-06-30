/**
 * REAL-TIME DATA HOOK
 * React hook for WebSocket-based live price streaming
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

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

export const useRealTimeData = () => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [livePrices, setLivePrices] = useState<Map<string, LivePrice>>(new Map());
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([]);
  const [marketStatus, setMarketStatus] = useState<MarketStatusUpdate | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  
  const subscribedSymbols = useRef<Set<string>>(new Set());
  const subscribedToIndices = useRef(false);

  // Initialize socket connection
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const newSocket = io('http://localhost:3001', {
      auth: {
        token
      },
      transports: ['websocket', 'polling']
    });

    newSocket.on('connect', () => {
      console.log('🔄 Real-time data connected');
      setConnected(true);
    });

    newSocket.on('disconnect', () => {
      console.log('🔄 Real-time data disconnected');
      setConnected(false);
    });

    newSocket.on('price_update', (priceData: LivePrice) => {
      setLivePrices(prev => {
        const updated = new Map(prev);
        const key = `${priceData.symbol}:${priceData.exchange}`;
        updated.set(key, priceData);
        return updated;
      });
      setLastUpdate(new Date());
    });

    newSocket.on('indices_update', (data: IndicesUpdate) => {
      setMarketIndices(data.indices);
      setLastUpdate(new Date(data.timestamp));
    });

    newSocket.on('market_status_update', (data: MarketStatusUpdate) => {
      setMarketStatus(data);
      setLastUpdate(new Date(data.timestamp));
    });

    newSocket.on('connect_error', (error) => {
      console.error('🚨 Real-time data connection error:', error);
    });

    setSocket(newSocket);

    return () => {
      newSocket.close();
    };
  }, []);

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
    lastUpdate,
    
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
    
    // Utils
    isSubscribed: (symbol: string, exchange: string = 'NSE') => 
      subscribedSymbols.current.has(`${symbol}:${exchange}`),
    subscribedCount: subscribedSymbols.current.size
  };
};

export default useRealTimeData;
