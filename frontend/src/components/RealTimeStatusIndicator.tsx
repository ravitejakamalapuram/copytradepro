import React, { useState, useEffect } from 'react';
import { useRealTimeOrders } from '../hooks/useRealTimeOrders';
import { notificationService } from '../services/notificationService';
import { Button, StatusBadge, HStack } from './ui';
import './RealTimeStatusIndicator.css';

interface RealTimeStatusIndicatorProps {
  className?: string;
  showDetails?: boolean;
  onOrderUpdate?: (orderId: string, newStatus: string) => void;
}

const RealTimeStatusIndicator: React.FC<RealTimeStatusIndicatorProps> = ({
  className = '',
  showDetails = false,
  onOrderUpdate
}) => {
  const {
    isConnected,
    connectionStatus,
    monitoringStatus,
    lastUpdate,
    connect,
    disconnect,
    onOrderStatusChange,
    onOrderExecutionUpdate,
    refreshMonitoringStatus
  } = useRealTimeOrders();

  const [recentUpdates, setRecentUpdates] = useState<Array<{
    id: string;
    type: 'status' | 'execution';
    message: string;
    timestamp: Date;
    status?: string;
  }>>([]);

  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  const [pushNotificationsEnabled, setPushNotificationsEnabled] = useState(false);
  const [, setNotificationPermission] = useState<NotificationPermission>('default');

  // Initialize push notifications
  useEffect(() => {
    const initializePushNotifications = async () => {
      try {
        if (notificationService.isNotificationSupported()) {
          await notificationService.initialize();
          const isSubscribed = await notificationService.isSubscribed();
          setPushNotificationsEnabled(isSubscribed);
          setNotificationPermission(notificationService.getPermission());
        }
      } catch (error) {
        console.error('Failed to initialize push notifications:', error);
      }
    };

    initializePushNotifications();
  }, []);

  // Set up order update listeners
  useEffect(() => {
    onOrderStatusChange((update) => {
      console.log('Order status changed:', update);

      // Add to recent updates with better formatting
      setRecentUpdates(prev => [
        {
          id: update.orderId,
          type: 'status',
          message: `${update.order.symbol} order ${update.oldStatus.toLowerCase()} → ${update.newStatus.toLowerCase()}`,
          timestamp: new Date(),
          status: update.newStatus
        },
        ...prev.slice(0, 9) // Keep last 10 updates
      ]);

      // Show notification badge
      setHasNewUpdates(true);
      setTimeout(() => setHasNewUpdates(false), 3000);

      // Notify parent component
      if (onOrderUpdate) {
        onOrderUpdate(update.orderId, update.newStatus);
      }
    });

    onOrderExecutionUpdate((update) => {
      console.log('Order execution updated:', update);

      setRecentUpdates(prev => [
        {
          id: update.orderId,
          type: 'execution',
          message: `${update.order.symbol} partially filled: ${update.executionData.executed_quantity || 0} shares`,
          timestamp: new Date()
        },
        ...prev.slice(0, 9)
      ]);

      setHasNewUpdates(true);
      setTimeout(() => setHasNewUpdates(false), 3000);
    });
  }, [onOrderStatusChange, onOrderExecutionUpdate, onOrderUpdate]);

  const getStatusEmoji = (status: string) => {
    switch (status.toUpperCase()) {
      case 'EXECUTED':
      case 'FILLED':
        return '✅';
      case 'REJECTED':
      case 'CANCELLED':
        return '❌';
      case 'PLACED':
      case 'PENDING':
        return '⏳';
      case 'PARTIAL':
      case 'PARTIALLY_FILLED':
        return '🔄';
      default:
        return '📋';
    }
  };

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return '🟢';
      case 'connecting':
        return '🟡';
      case 'disconnected':
        return '🔴';
      case 'error':
        return '❌';
      default:
        return '⚪';
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Live Updates';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Offline';
      case 'error':
        return 'Error';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'success';
      case 'connecting':
        return 'warning';
      case 'disconnected':
      case 'error':
        return 'error';
      default:
        return 'neutral';
    }
  };

  const formatLastUpdate = () => {
    if (!lastUpdate) return 'Never';
    
    const now = new Date();
    const diff = now.getTime() - lastUpdate.getTime();
    
    if (diff < 60000) { // Less than 1 minute
      return 'Just now';
    } else if (diff < 3600000) { // Less than 1 hour
      return `${Math.floor(diff / 60000)}m ago`;
    } else {
      return lastUpdate.toLocaleTimeString();
    }
  };

  const handleToggleConnection = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  const getStatusVariant = () => {
    switch (connectionStatus) {
      case 'connected': return 'success';
      case 'connecting': return 'warning';
      case 'disconnected': return 'error';
      case 'error': return 'error';
      default: return 'default';
    }
  };

  return (
    <div className={`real-time-status-bar ${className}`}>
      <HStack gap={4} className="status-content">
        {/* Connection Status */}
        <div className="status-section">
          <StatusBadge
            variant={getStatusVariant()}
            size="base"
          >
            <span className="status-icon">{getStatusIcon()}</span>
            {connectionStatus === 'connecting' && (
              <div className="status-spinner"></div>
            )}
            <span className="status-text">{getStatusText()}</span>
            {hasNewUpdates && (
              <span className="update-badge">!</span>
            )}
          </StatusBadge>
        </div>

        {/* Monitoring Stats */}
        {monitoringStatus && isConnected && (
          <div className="monitoring-stats">
            <HStack gap={3}>
              <div className="stat-item">
                <span className="stat-icon">📊</span>
                <span className="stat-value">{monitoringStatus.activeOrders}</span>
                <span className="stat-label">Orders</span>
              </div>
              <div className="stat-item">
                <span className="stat-icon">🔗</span>
                <span className="stat-value">{monitoringStatus.activeBrokers}</span>
                <span className="stat-label">Brokers</span>
              </div>
            </HStack>
          </div>
        )}

        {/* Last Update */}
        {lastUpdate && (
          <div className="last-update">
            <span className="update-icon">🕒</span>
            <span className="update-text">{formatLastUpdate()}</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="status-actions">
          <HStack gap={2}>
            <Button
              variant={isConnected ? 'danger' : 'primary'}
              size="sm"
              onClick={handleToggleConnection}
              loading={connectionStatus === 'connecting'}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </Button>

            {isConnected && (
              <Button
                variant="secondary"
                size="sm"
                onClick={refreshMonitoringStatus}
                title="Refresh monitoring status"
              >
                🔄
              </Button>
            )}
          </HStack>
        </div>
      </HStack>
    </div>
  );
};

export default RealTimeStatusIndicator;
