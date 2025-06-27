import React, { useState, useEffect } from 'react';
import { useRealTimeOrders } from '../hooks/useRealTimeOrders';
// Removed unused notificationService import
import { Button, StatusBadge, HStack } from './ui';
import './RealTimeStatusIndicator.css';

interface RealTimeStatusIndicatorProps {
  className?: string;
  onOrderUpdate?: (orderId: string, newStatus: string) => void;
}

const RealTimeStatusIndicator: React.FC<RealTimeStatusIndicatorProps> = ({
  className = '',
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

  // Removed unused recentUpdates state

  const [hasNewUpdates, setHasNewUpdates] = useState(false);
  // Removed unused pushNotificationsEnabled state
  // Removed unused notification permission state

  // Removed push notification initialization

  // Set up order update listeners
  useEffect(() => {
    onOrderStatusChange((update) => {
      console.log('Order status changed:', update);

      // Removed recent updates tracking

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

      // Removed recent updates tracking

      setHasNewUpdates(true);
      setTimeout(() => setHasNewUpdates(false), 3000);
    });
  }, [onOrderStatusChange, onOrderExecutionUpdate, onOrderUpdate]);

  // Removed unused getStatusEmoji function

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

  // Removed unused getStatusColor function

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
      case 'connected': return 'active';
      case 'connecting': return 'pending';
      case 'disconnected': return 'inactive';
      case 'error': return 'error';
      default: return 'inactive';
    }
  };

  return (
    <div className={`real-time-status-bar ${className}`}>
      <HStack gap={4} className="status-content">
        {/* Connection Status */}
        <div className="status-section">
          <StatusBadge
            status={getStatusVariant()}
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
