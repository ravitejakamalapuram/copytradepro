import React, { useState, useEffect } from 'react';
import { useRealTimeOrders } from '../hooks/useRealTimeOrders';
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
  }>>([]);

  const [showDropdown, setShowDropdown] = useState(false);

  // Set up order update listeners
  useEffect(() => {
    onOrderStatusChange((update) => {
      console.log('Order status changed:', update);
      
      // Add to recent updates
      setRecentUpdates(prev => [
        {
          id: update.orderId,
          type: 'status',
          message: `${update.order.symbol} ${update.oldStatus} → ${update.newStatus}`,
          timestamp: new Date()
        },
        ...prev.slice(0, 9) // Keep last 10 updates
      ]);

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
    });
  }, [onOrderStatusChange, onOrderExecutionUpdate, onOrderUpdate]);

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
        return 'Real-time updates active';
      case 'connecting':
        return 'Connecting...';
      case 'disconnected':
        return 'Disconnected';
      case 'error':
        return 'Connection error';
      default:
        return 'Unknown status';
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

  return (
    <div className={`real-time-status ${className}`}>
      <div 
        className={`status-indicator status-indicator--${getStatusColor()}`}
        onClick={() => setShowDropdown(!showDropdown)}
        title={getStatusText()}
      >
        <span className="status-icon">{getStatusIcon()}</span>
        {connectionStatus === 'connecting' && (
          <div className="status-spinner"></div>
        )}
        <span className="status-text">{getStatusText()}</span>
        {showDetails && (
          <span className="status-details">
            {monitoringStatus && (
              <>
                • {monitoringStatus.activeOrders} orders
                • {monitoringStatus.activeBrokers} brokers
              </>
            )}
          </span>
        )}
        <span className="dropdown-arrow">▼</span>
      </div>

      {showDropdown && (
        <div className="status-dropdown">
          <div className="dropdown-header">
            <h4>Real-Time Status</h4>
            <button 
              className="close-button"
              onClick={() => setShowDropdown(false)}
            >
              ×
            </button>
          </div>

          <div className="status-section">
            <div className="status-row">
              <span className="label">Connection:</span>
              <span className={`value value--${getStatusColor()}`}>
                {getStatusIcon()} {getStatusText()}
              </span>
            </div>
            <div className="status-row">
              <span className="label">Last Update:</span>
              <span className="value">{formatLastUpdate()}</span>
            </div>
          </div>

          {monitoringStatus && (
            <div className="monitoring-section">
              <h5>Order Monitoring</h5>
              <div className="status-row">
                <span className="label">Active Orders:</span>
                <span className="value">{monitoringStatus.activeOrders}</span>
              </div>
              <div className="status-row">
                <span className="label">Active Brokers:</span>
                <span className="value">{monitoringStatus.activeBrokers}</span>
              </div>
              <div className="status-row">
                <span className="label">Polling:</span>
                <span className="value">
                  {monitoringStatus.isPolling ? '✅ Active' : '❌ Inactive'}
                </span>
              </div>
              <div className="status-row">
                <span className="label">Frequency:</span>
                <span className="value">{monitoringStatus.pollingFrequency / 1000}s</span>
              </div>
              {monitoringStatus.brokers.length > 0 && (
                <div className="status-row">
                  <span className="label">Brokers:</span>
                  <span className="value">{monitoringStatus.brokers.join(', ')}</span>
                </div>
              )}
            </div>
          )}

          {recentUpdates.length > 0 && (
            <div className="updates-section">
              <h5>Recent Updates</h5>
              <div className="updates-list">
                {recentUpdates.slice(0, 5).map((update, index) => (
                  <div key={`${update.id}-${index}`} className="update-item">
                    <div className="update-message">{update.message}</div>
                    <div className="update-time">
                      {update.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="dropdown-actions">
            <button 
              className={`action-button ${isConnected ? 'disconnect' : 'connect'}`}
              onClick={handleToggleConnection}
            >
              {isConnected ? 'Disconnect' : 'Connect'}
            </button>
            <button 
              className="action-button refresh"
              onClick={refreshMonitoringStatus}
              disabled={!isConnected}
            >
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeStatusIndicator;
