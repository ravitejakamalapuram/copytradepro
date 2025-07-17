/**
 * MARKET DATA STATUS INDICATOR
 * Visual indicator for WebSocket connection status for market data
 */

import React from 'react';
import './AnimatedPrice.css';

interface MarketDataStatusIndicatorProps {
  connected: boolean;
  lastUpdate?: Date | null;
  subscribedCount?: number;
  className?: string;
}

const MarketDataStatusIndicator: React.FC<MarketDataStatusIndicatorProps> = ({
  connected,
  lastUpdate,
  subscribedCount = 0,
  className = ''
}) => {
  const getStatusText = () => {
    if (!connected) return 'Offline';
    if (subscribedCount > 0) return `Live (${subscribedCount})`;
    return 'Connected';
  };

  const getStatusColor = () => {
    if (!connected) return 'status-error';
    if (subscribedCount > 0) return 'status-success';
    return 'status-warning';
  };

  const getDotColor = () => {
    if (!connected) return 'dot-error';
    if (subscribedCount > 0) return 'dot-success';
    return 'dot-warning';
  };

  return (
    <div className={`connection-indicator ${connected ? 'connection-indicator--connected' : 'connection-indicator--disconnected'} ${className}`}>
      {/* Status dot with animation */}
      <div className={`connection-dot ${connected ? 'connection-dot--connected' : 'connection-dot--disconnected'} ${getDotColor()}`} />
      
      {/* Status text */}
      <span className={`font-medium ${getStatusColor()}`}>
        {getStatusText()}
      </span>

      {/* Data flow indicator */}
      {connected && subscribedCount > 0 && (
        <div className="flex items-center ml-2">
          <svg className="w-3 h-3 text-green-500 animate-pulse" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" />
          </svg>
        </div>
      )}

      {/* Last update time */}
      {lastUpdate && (
        <span className="text-xs text-gray-500 ml-2">
          {lastUpdate.toLocaleTimeString()}
        </span>
      )}
    </div>
  );
};

export default MarketDataStatusIndicator;
