/**
 * ANIMATED MARKET CARD COMPONENT
 * Enhanced market index cards with live animations
 */

import React, { useState, useEffect } from 'react';
import AnimatedPrice from './AnimatedPrice';
import './AnimatedPrice.css';

interface MarketIndex {
  name: string;
  value: number;
  change: number;
  changePercent: number;
  lastUpdated: string;
}

interface AnimatedMarketCardProps {
  index: MarketIndex;
  isUpdating?: boolean;
  className?: string;
}

const AnimatedMarketCard: React.FC<AnimatedMarketCardProps> = ({
  index,
  isUpdating = false,
  className = ''
}) => {
  const [previousValue, setPreviousValue] = useState(index.value);
  const [isFlashing, setIsFlashing] = useState(false);

  // Detect value changes and trigger flash effect
  useEffect(() => {
    if (index.value !== previousValue) {
      setIsFlashing(true);
      const timeout = setTimeout(() => setIsFlashing(false), 1000);
      setPreviousValue(index.value);
      return () => clearTimeout(timeout);
    }
  }, [index.value, previousValue]);

  // Determine trend direction
  const getTrendIcon = () => {
    if (index.changePercent > 0) {
      return (
        <svg className="w-4 h-4 trend-arrow trend-arrow--up" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M3.293 9.707a1 1 0 010-1.414l6-6a1 1 0 011.414 0l6 6a1 1 0 01-1.414 1.414L11 5.414V17a1 1 0 11-2 0V5.414L4.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
        </svg>
      );
    } else if (index.changePercent < 0) {
      return (
        <svg className="w-4 h-4 trend-arrow trend-arrow--down" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M16.707 10.293a1 1 0 010 1.414l-6 6a1 1 0 01-1.414 0l-6-6a1 1 0 111.414-1.414L9 14.586V3a1 1 0 012 0v11.586l4.293-4.293a1 1 0 011.414 0z" clipRule="evenodd" />
        </svg>
      );
    }
    return (
      <svg className="w-4 h-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
      </svg>
    );
  };

  // Get trend color class
  const getTrendClass = () => {
    if (index.changePercent > 0) return 'trend-indicator--up';
    if (index.changePercent < 0) return 'trend-indicator--down';
    return 'trend-indicator--neutral';
  };

  return (
    <div
      className={`market-index-card${isUpdating ? ' market-index-card--updating' : ''}${isFlashing ? ' animate-pulse' : ''} ${className}`}
    >
      {/* Header with name and trend icon */}
      <div className="market-index-card__header">
        <div className="market-index-card__name">{index.name}</div>
        <div className={`market-index-card__trend ${getTrendClass()}`}>{getTrendIcon()}</div>
      </div>
      {/* Main value with animation */}
      <div className="market-index-card__value">
        <AnimatedPrice
          value={index.value}
          size="lg"
          animate={true}
          className="market-index-card__value-text"
        />
      </div>
      {/* Change values with animations */}
      <div className="market-index-card__changes">
        <AnimatedPrice
          value={Math.abs(index.change)}
          change={index.change}
          showSign={true}
          size="sm"
          animate={true}
        />
        <AnimatedPrice
          value={Math.abs(index.changePercent)}
          changePercent={index.changePercent}
          showSign={true}
          size="sm"
          animate={true}
          currency=""
        />
      </div>
      {/* Progress bar for change percentage */}
      <div className="mt-3">
        <div className="w-full bg-gray-200 rounded-full h-1">
          <div
            className={`market-index-card__progress-bar ${index.changePercent >= 0 ? 'pnl-positive' : 'pnl-negative'}`}
            style={{
              ...({ ['--progress-width']: `${Math.min(Math.abs(index.changePercent) * 10, 100)}%` } as Record<string, string>),
            } as React.CSSProperties}
          />
        </div>
      </div>
      {/* Last updated indicator */}
      <div className="market-index-card__updated">
        <span>Updated</span>
        <span>{new Date(index.lastUpdated).toLocaleTimeString()}</span>
      </div>
      {/* Live update indicator */}
      {isUpdating && (
        <div className="market-index-card__live">
          <div className="market-index-card__live-dot" />
        </div>
      )}
    </div>
  );
};

export default AnimatedMarketCard;
