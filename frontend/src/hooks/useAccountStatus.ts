import { useState, useEffect, useCallback, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { accountService, type ConnectedAccount } from '../services/accountService';
import { eventBusService } from '../services/eventBusService';

interface AccountStatusUpdate {
  accountId: string;
  isActive: boolean;
  status: 'active' | 'inactive' | 'error' | 'expired';
  message?: string;
  timestamp: Date;
}

interface AccountConnectionEvent {
  accountId: string;
  brokerName: string;
  event: 'connected' | 'disconnected' | 'error' | 'token_refresh';
  message?: string;
  timestamp: Date;
}

export const useAccountStatus = () => {
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [lastError, setLastError] = useState<string | null>(null);
  
  // Track account operations in progress
  const [operationsInProgress, setOperationsInProgress] = useState<Record<string, boolean>>({});
  
  // Ref to track if we're currently fetching accounts to prevent race conditions
  const fetchingRef = useRef(false);
  
  // Connection management refs
  const reconnectAttempts = useRef(0);
  const reconnectTimeout = useRef<NodeJS.Timeout | null>(null);
  const maxReconnectAttempts = 5;
  const baseReconnectDelay = 1000;

  // Calculate exponential backoff delay
  const getReconnectDelay = useCallback((attempt: number): number => {
    return Math.min(baseReconnectDelay * Math.pow(2, attempt), 30000); // Max 30 seconds
  }, []);

  // Handle reconnection with exponential backoff
  const scheduleReconnect = useCallback(() => {
    if (reconnectAttempts.current >= maxReconnectAttempts) {
      console.error('🚨 Max reconnection attempts reached for account status');
      setLastError('Account status connection failed after maximum retry attempts');
      return;
    }

    const delay = getReconnectDelay(reconnectAttempts.current);
    console.log(`🔄 Scheduling account status reconnect attempt ${reconnectAttempts.current + 1} in ${delay}ms`);

    reconnectTimeout.current = setTimeout(() => {
      reconnectAttempts.current++;
      initializeConnection();
    }, delay);
  }, [getReconnectDelay]);

  // Update account status in local state
  const updateAccountStatus = useCallback((
    accountId: string, 
    isActive: boolean, 
    _status?: string, 
    message?: string
  ) => {
    setAccounts(prevAccounts => 
      prevAccounts.map(account => 
        account.id === accountId 
          ? { 
              ...account,
              isActive,
              // Preserve and display broker-provided status from backend if provided
              accountStatus: (_status?.toUpperCase?.() as any) || (isActive ? 'ACTIVE' as any : 'INACTIVE' as any),
              ...(message && { statusMessage: message })
            }
          : account
      )
    );
  }, []);

  // Handle connection events
  const handleConnectionEvent = useCallback((event: AccountConnectionEvent) => {
    const { accountId, event: eventType, message } = event;
    
    switch (eventType) {
      case 'connected':
        updateAccountStatus(accountId, true, 'ACTIVE', message);
        break;
      case 'disconnected':
        updateAccountStatus(accountId, false, 'INACTIVE', message);
        break;
      case 'error':
        updateAccountStatus(accountId, false, 'ERROR', message);
        break;
      case 'token_refresh':
        // Token refreshed successfully, ensure account is active
        updateAccountStatus(accountId, true, 'ACTIVE', message);
        break;
    }
  }, [updateAccountStatus]);

  // Initialize WebSocket connection with enhanced error handling
  const initializeConnection = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLastError('No authentication token available');
      return;
    }

    setConnecting(true);
    setLastError(null);

    const socketUrl = '/';
    console.log('🔧 Initializing account status WebSocket connection');

    const newSocket = io(socketUrl, {
      auth: { token },
      transports: ['websocket', 'polling'],
      timeout: 20000,
      forceNew: true,
      autoConnect: true
    });

    // Connection successful
    newSocket.on('connect', () => {
      console.log('🔄 Account status WebSocket connected');
      setConnected(true);
      setConnecting(false);
      setLastError(null);
      reconnectAttempts.current = 0;
      
      // Clear any pending reconnect timeout
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
    });

    // Connection lost
    newSocket.on('disconnect', (reason) => {
      console.log('🔄 Account status WebSocket disconnected:', reason);
      setConnected(false);
      setConnecting(false);

      // Schedule reconnect for unexpected disconnections
      if (reason === 'io server disconnect') {
        setLastError('Server disconnected the account status connection');
      } else if (reason === 'transport close' || reason === 'transport error') {
        scheduleReconnect();
      }
    });

    // Listen for account status updates
    newSocket.on('account_status_update', (update: AccountStatusUpdate) => {
      console.log('📡 Account status update received:', update);
      updateAccountStatus(update.accountId, update.isActive, update.status, update.message);
      setLastUpdate(new Date(update.timestamp));

      // Distribute through event bus
      eventBusService.emit('account_status_update', update);
    });

    // Listen for account connection events
    newSocket.on('account_connection_event', (event: AccountConnectionEvent) => {
      console.log('📡 Account connection event:', event);
      handleConnectionEvent(event);
      setLastUpdate(new Date(event.timestamp));

      // Distribute through event bus
      eventBusService.emit('account_connection_event', event);
    });

    // Handle connection errors
    newSocket.on('connect_error', (error) => {
      console.error('🚨 Account status WebSocket connection error:', error);
      setConnecting(false);
      setLastError(error.message || 'Account status connection error occurred');
      scheduleReconnect();
    });

    // Handle server-sent connection errors
    newSocket.on('connection_error', (data: { message: string; canRetry: boolean }) => {
      console.warn('🚨 Account status server connection error:', data.message);
      setLastError(data.message);
      if (data.canRetry) {
        scheduleReconnect();
      }
    });

    setSocket(newSocket);
  }, [scheduleReconnect, updateAccountStatus, handleConnectionEvent]);

  // Initialize connection on mount - DISABLED to prevent duplicate Socket.IO connections
  // The useRealTimeData hook handles all Socket.IO communication
  useEffect(() => {
    // Temporarily disabled to prevent connection loops
    // initializeConnection();

    return () => {
      // Cleanup on unmount
      if (reconnectTimeout.current) {
        clearTimeout(reconnectTimeout.current);
        reconnectTimeout.current = null;
      }
      if (socket) {
        socket.removeAllListeners();
        socket.close();
      }
    };
  }, [initializeConnection]);

  // Fetch accounts from API
  const fetchAccounts = useCallback(async (showLoading = true) => {
    if (fetchingRef.current) return; // Prevent concurrent fetches
    
    try {
      fetchingRef.current = true;
      if (showLoading) setLoading(true);
      setError(null);

      const connectedAccounts = await accountService.getConnectedAccounts();
      setAccounts(connectedAccounts);
      
      console.log('📋 Accounts fetched:', connectedAccounts.length);
    } catch (error: any) {
      console.error('Failed to fetch accounts:', error);
      setError('Failed to load account data');
    } finally {
      if (showLoading) setLoading(false);
      fetchingRef.current = false;
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  // Activate account
  const activateAccount = useCallback(async (accountId: string) => {
    try {
      setOperationsInProgress(prev => ({ ...prev, [accountId]: true }));

      const result = await accountService.activateAccount(accountId);

      if (result.success) {
        // Update local state immediately for better UX
        updateAccountStatus(accountId, true, 'ACTIVE', result.message);

        // Refresh accounts to get latest data
        await fetchAccounts(false);

        return result;
      } else {
        // Handle OAuth flow or other authentication steps
        return result;
      }
    } catch (error: any) {
      console.error('Failed to activate account:', error);
      throw error;
    } finally {
      setOperationsInProgress(prev => ({ ...prev, [accountId]: false }));
    }
  }, [updateAccountStatus, fetchAccounts]);

  // Deactivate account
  const deactivateAccount = useCallback(async (accountId: string) => {
    try {
      setOperationsInProgress(prev => ({ ...prev, [accountId]: true }));
      
      const success = await accountService.deactivateAccount(accountId);
      
      if (success) {
        // Update local state immediately
        updateAccountStatus(accountId, false, 'inactive', 'Account deactivated');
        
        // Refresh accounts to get latest data
        await fetchAccounts(false);
      }
      
      return success;
    } catch (error: any) {
      console.error('Failed to deactivate account:', error);
      throw error;
    } finally {
      setOperationsInProgress(prev => ({ ...prev, [accountId]: false }));
    }
  }, [updateAccountStatus, fetchAccounts]);

  // Remove account
  const removeAccount = useCallback(async (accountId: string) => {
    try {
      setOperationsInProgress(prev => ({ ...prev, [accountId]: true }));
      
      const success = await accountService.removeConnectedAccount(accountId);
      
      if (success) {
        // Remove from local state immediately
        setAccounts(prevAccounts => 
          prevAccounts.filter(account => account.id !== accountId)
        );
      }
      
      return success;
    } catch (error: any) {
      console.error('Failed to remove account:', error);
      throw error;
    } finally {
      setOperationsInProgress(prev => ({ ...prev, [accountId]: false }));
    }
  }, []);

  // Check account session status
  const checkAccountStatus = useCallback(async (accountId: string) => {
    try {
      setOperationsInProgress(prev => ({ ...prev, [accountId]: true }));
      
      const result = await accountService.checkAccountSessionStatus(accountId);
      
      if (result.success && result.data) {
        const { isActive, sessionInfo } = result.data;
        updateAccountStatus(accountId, isActive, sessionInfo.status, sessionInfo.message);
      }
      
      return result;
    } catch (error: any) {
      console.error('Failed to check account status:', error);
      throw error;
    } finally {
      setOperationsInProgress(prev => ({ ...prev, [accountId]: false }));
    }
  }, [updateAccountStatus]);

  // Refresh all accounts
  const refreshAccounts = useCallback(async () => {
    await fetchAccounts(true);
  }, [fetchAccounts]);

  // Subscribe to account updates via WebSocket
  const subscribeToAccountUpdates = useCallback((accountId: string) => {
    if (!socket || !connected) return;
    
    socket.emit('subscribe_account_status', { accountId });
    console.log(`📡 Subscribed to account status updates for ${accountId}`);
  }, [socket, connected]);

  // Unsubscribe from account updates
  const unsubscribeFromAccountUpdates = useCallback((accountId: string) => {
    if (!socket) return;
    
    socket.emit('unsubscribe_account_status', { accountId });
    console.log(`📡 Unsubscribed from account status updates for ${accountId}`);
  }, [socket]);

  // Get account by ID
  const getAccount = useCallback((accountId: string) => {
    return accounts.find(account => account.id === accountId) || null;
  }, [accounts]);

  // Get accounts by broker
  const getAccountsByBroker = useCallback((brokerName: string) => {
    return accounts.filter(account => account.brokerName === brokerName);
  }, [accounts]);

  // Get active accounts
  const getActiveAccounts = useCallback(() => {
    return accounts.filter(account => account.isActive);
  }, [accounts]);

  // Check if operation is in progress
  const isOperationInProgress = useCallback((accountId: string) => {
    return operationsInProgress[accountId] || false;
  }, [operationsInProgress]);

  return {
    // State
    accounts,
    loading,
    error,
    connected,
    connecting,
    lastUpdate,
    lastError,
    
    // Operations
    activateAccount,
    deactivateAccount,
    removeAccount,
    checkAccountStatus,
    refreshAccounts,
    
    // Connection management
    reconnect: initializeConnection,
    
    // WebSocket subscriptions
    subscribeToAccountUpdates,
    unsubscribeFromAccountUpdates,
    
    // Utilities
    getAccount,
    getAccountsByBroker,
    getActiveAccounts,
    isOperationInProgress,
    
    // Stats
    totalAccounts: accounts.length,
    activeAccounts: accounts.filter(a => a.isActive).length,
    inactiveAccounts: accounts.filter(a => !a.isActive).length,
    canReconnect: reconnectAttempts.current < maxReconnectAttempts
  };
};

export default useAccountStatus;