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
    status?: string;
  }>>([]);

  const [showDropdown, setShowDropdown] = useState(false);
  const [hasNewUpdates, setHasNewUpdates] = useState(false);

  // Set up order update listeners
  useEffect(() => {
    onOrderStatusChange((update) => {
      console.log('Order status changed:', update);

      // Add to recent updates with better formatting
      const statusEmoji = getStatusEmoji(update.newStatus);
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

  return (
    <div className={`real-time-status ${className}`}>
      <div
        className={`status-indicator status-indicator--${getStatusColor()} ${hasNewUpdates ? 'has-updates' : ''}`}
        onClick={() => {
          setShowDropdown(!showDropdown);
          if (showDropdown) setHasNewUpdates(false);
        }}
        title={`${getStatusText()} - Click for details`}
      >
        <div className="status-main">
          <span className="status-icon">{getStatusIcon()}</span>
          {connectionStatus === 'connecting' && (
            <div className="status-spinner"></div>
          )}
          <span className="status-text">{getStatusText()}</span>
          {hasNewUpdates && (
            <span className="update-badge">!</span>
          )}
        </div>

        {showDetails && monitoringStatus && (
          <div className="status-details">
            <span className="detail-item">
              📊 {monitoringStatus.activeOrders} orders
            </span>
            <span className="detail-item">
              🔗 {monitoringStatus.activeBrokers} brokers
            </span>
          </div>
        )}

        <span className={`dropdown-arrow ${showDropdown ? 'open' : ''}`}>
          {showDropdown ? '▲' : '▼'}
        </span>
      </div>

      {showDropdown && (
        <div className="status-dropdown">
          <div className="dropdown-header">
            <div className="header-content">
              <h4>📡 Real-Time Order Status</h4>
              <div className="connection-badge">
                <span className={`connection-dot connection-dot--${getStatusColor()}`}></span>
                <span className="connection-text">{getStatusText()}</span>
              </div>
            </div>
            <button
              className="close-button"
              onClick={() => setShowDropdown(false)}
              title="Close"
            >
              ✕
            </button>
          </div>

          <div className="status-section">
            <div className="section-title">📊 Connection Status</div>
            <div className="status-grid">
              <div className="status-card">
                <div className="card-icon">{getStatusIcon()}</div>
                <div className="card-content">
                  <div className="card-label">Status</div>
                  <div className={`card-value card-value--${getStatusColor()}`}>
                    {getStatusText()}
                  </div>
                </div>
              </div>
              <div className="status-card">
                <div className="card-icon">🕒</div>
                <div className="card-content">
                  <div className="card-label">Last Update</div>
                  <div className="card-value">{formatLastUpdate()}</div>
                </div>
              </div>
            </div>
          </div>

          {monitoringStatus && (
            <div className="monitoring-section">
              <div className="section-title">🎯 Order Monitoring</div>
              <div className="monitoring-grid">
                <div className="monitoring-card">
                  <div className="metric-value">{monitoringStatus.activeOrders}</div>
                  <div className="metric-label">Active Orders</div>
                </div>
                <div className="monitoring-card">
                  <div className="metric-value">{monitoringStatus.activeBrokers}</div>
                  <div className="metric-label">Connected Brokers</div>
                </div>
                <div className="monitoring-card">
                  <div className="metric-value">
                    {monitoringStatus.isPolling ? '✅' : '❌'}
                  </div>
                  <div className="metric-label">
                    {monitoringStatus.isPolling ? 'Polling Active' : 'Polling Inactive'}
                  </div>
                </div>
                <div className="monitoring-card">
                  <div className="metric-value">{monitoringStatus.pollingFrequency / 1000}s</div>
                  <div className="metric-label">Update Frequency</div>
                </div>
              </div>
              {monitoringStatus.brokers.length > 0 && (
                <div className="brokers-list">
                  <div className="brokers-title">📈 Active Brokers:</div>
                  <div className="brokers-tags">
                    {monitoringStatus.brokers.map(broker => (
                      <span key={broker} className="broker-tag">
                        {broker.charAt(0).toUpperCase() + broker.slice(1)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {recentUpdates.length > 0 && (
            <div className="updates-section">
              <div className="section-title">
                📋 Recent Updates
                {hasNewUpdates && <span className="new-badge">NEW</span>}
              </div>
              <div className="updates-list">
                {recentUpdates.slice(0, 5).map((update, index) => (
                  <div key={`${update.id}-${index}`} className={`update-item update-item--${update.type}`}>
                    <div className="update-header">
                      <span className="update-icon">
                        {update.type === 'status' && update.status ? getStatusEmoji(update.status) : '📊'}
                      </span>
                      <span className="update-message">{update.message}</span>
                    </div>
                    <div className="update-time">
                      {update.timestamp.toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
              {recentUpdates.length === 0 && (
                <div className="no-updates">
                  <span className="no-updates-icon">📭</span>
                  <span className="no-updates-text">No recent updates</span>
                </div>
              )}
            </div>
          )}

          <div className="dropdown-actions">
            <button
              className={`action-button ${isConnected ? 'disconnect' : 'connect'}`}
              onClick={handleToggleConnection}
              title={isConnected ? 'Disconnect from real-time updates' : 'Connect to real-time updates'}
            >
              <span className="button-icon">{isConnected ? '🔌' : '🔗'}</span>
              {isConnected ? 'Disconnect' : 'Connect'}
            </button>
            <button
              className="action-button refresh"
              onClick={refreshMonitoringStatus}
              disabled={!isConnected}
              title="Refresh monitoring status"
            >
              <span className="button-icon">🔄</span>
              Refresh
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default RealTimeStatusIndicator;
