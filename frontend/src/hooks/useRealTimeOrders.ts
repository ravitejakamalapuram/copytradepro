import { useState, useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from './useAuth';

interface OrderStatusUpdate {
  orderId: string;
  oldStatus: string;
  newStatus: string;
  order: {
    id: string;
    symbol: string;
    action: string;
    quantity: number;
    price: number;
    status: string;
    broker_name: string;
    executed_at?: string;
  };
  timestamp: string;
}

interface OrderExecutionUpdate {
  orderId: string;
  executionData: {
    executed_quantity?: number;
    average_price?: number;
  };
  order: {
    id: string;
    symbol: string;
    executed_quantity?: number;
    average_price?: number;
  };
  timestamp: string;
}

interface SocketMessage {
  data?: any;
  message?: string;
  timestamp: string;
}

interface MonitoringStatus {
  isPolling: boolean;
  activeBrokers: number;
  activeOrders: number;
  pollingFrequency: number;
  brokers: string[];
}

interface UseRealTimeOrdersReturn {
  isConnected: boolean;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'error';
  monitoringStatus: MonitoringStatus | null;
  lastUpdate: Date | null;
  connect: () => void;
  disconnect: () => void;
  subscribeToOrders: () => void;
  unsubscribeFromOrders: () => void;
  onOrderStatusChange: (callback: (update: OrderStatusUpdate) => void) => void;
  onOrderExecutionUpdate: (callback: (update: OrderExecutionUpdate) => void) => void;
  refreshMonitoringStatus: () => void;
}

export const useRealTimeOrders = (): UseRealTimeOrdersReturn => {
  const { token, isAuthenticated } = useAuth();
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [monitoringStatus, setMonitoringStatus] = useState<MonitoringStatus | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const orderStatusCallbackRef = useRef<((update: OrderStatusUpdate) => void) | null>(null);
  const orderExecutionCallbackRef = useRef<((update: OrderExecutionUpdate) => void) | null>(null);

  const connect = useCallback(() => {
    if (socketRef.current?.connected) {
      console.log('Socket.IO already connected');
      return;
    }

    if (!token || !isAuthenticated) {
      console.error('No auth token available for Socket.IO connection');
      setConnectionStatus('error');
      return;
    }

    setConnectionStatus('connecting');

    try {
      // Create Socket.IO connection
      socketRef.current = io({
        auth: {
          token: token
        },
        autoConnect: false,
        reconnection: true,
        reconnectionAttempts: 5,
        reconnectionDelay: 3000,
        timeout: 10000
      });

      // Set up event listeners
      socketRef.current.on('connect', () => {
        console.log('Socket.IO connected');
        setIsConnected(true);
        setConnectionStatus('connected');

        // Auto-subscribe to orders and request monitoring status
        subscribeToOrders();
        refreshMonitoringStatus();
      });

      socketRef.current.on('disconnect', (reason) => {
        console.log('Socket.IO disconnected:', reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
      });

      socketRef.current.on('connect_error', (error) => {
        console.error('Socket.IO connection error:', error);
        setConnectionStatus('error');
      });

      // Set up order event listeners
      setupOrderEventListeners();

      // Connect
      socketRef.current.connect();

    } catch (error) {
      console.error('Error creating Socket.IO connection:', error);
      setConnectionStatus('error');
    }
  }, [token, isAuthenticated]);

  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const setupOrderEventListeners = useCallback(() => {
    if (!socketRef.current) return;

    // Listen for order status changes
    socketRef.current.on('order_status_changed', (data: OrderStatusUpdate) => {
      setLastUpdate(new Date());
      if (orderStatusCallbackRef.current) {
        orderStatusCallbackRef.current(data);
      }
    });

    // Listen for order execution updates
    socketRef.current.on('order_execution_updated', (data: OrderExecutionUpdate) => {
      setLastUpdate(new Date());
      if (orderExecutionCallbackRef.current) {
        orderExecutionCallbackRef.current(data);
      }
    });

    // Listen for monitoring status updates
    socketRef.current.on('monitoring_status', (data: SocketMessage) => {
      setLastUpdate(new Date());
      if (data.data) {
        setMonitoringStatus(data.data);
      }
    });

    // Listen for subscription confirmations
    socketRef.current.on('subscription_confirmed', (data: SocketMessage) => {
      console.log('Subscription confirmed:', data.message);
    });

    socketRef.current.on('subscription_cancelled', (data: SocketMessage) => {
      console.log('Subscription cancelled:', data.message);
    });
  }, []);

  const subscribeToOrders = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe_orders');
    }
  }, []);

  const unsubscribeFromOrders = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe_orders');
    }
  }, []);

  const refreshMonitoringStatus = useCallback(() => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('get_monitoring_status');
    }
  }, []);



  const onOrderStatusChange = useCallback((callback: (update: OrderStatusUpdate) => void) => {
    orderStatusCallbackRef.current = callback;
  }, []);

  const onOrderExecutionUpdate = useCallback((callback: (update: OrderExecutionUpdate) => void) => {
    orderExecutionCallbackRef.current = callback;
  }, []);

  // Auto-connect when authenticated
  useEffect(() => {
    if (isAuthenticated && token) {
      connect();
    } else {
      disconnect();
    }

    return () => {
      disconnect();
    };
  }, [isAuthenticated, token, connect, disconnect]);

  return {
    isConnected,
    connectionStatus,
    monitoringStatus,
    lastUpdate,
    connect,
    disconnect,
    subscribeToOrders,
    unsubscribeFromOrders,
    onOrderStatusChange,
    onOrderExecutionUpdate,
    refreshMonitoringStatus
  };
};
