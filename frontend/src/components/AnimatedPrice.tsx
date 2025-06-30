/**
 * ANIMATED PRICE COMPONENT
 * Enhanced price display with live movement animations
 */

import React, { useState, useEffect, useRef } from 'react';
import './AnimatedPrice.css';

interface AnimatedPriceProps {
  value: number;
  change?: number;
  changePercent?: number;
  showSign?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  currency?: string;
  animate?: boolean;
  className?: string;
}

const AnimatedPrice: React.FC<AnimatedPriceProps> = ({
  value,
  change = 0,
  changePercent = 0,
  showSign = false,
  size = 'md',
  currency = '₹',
  animate = true,
  className = ''
}) => {
  const [previousValue, setPreviousValue] = useState(value);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'up' | 'down' | 'neutral'>('neutral');
  const animationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Detect price changes and trigger animations
  useEffect(() => {
    if (animate && value !== previousValue) {
      const newDirection = value > previousValue ? 'up' : value < previousValue ? 'down' : 'neutral';
      setDirection(newDirection);
      setIsAnimating(true);

      // Clear existing timeout
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }

      // Stop animation after duration
      animationTimeoutRef.current = setTimeout(() => {
        setIsAnimating(false);
        setDirection('neutral');
      }, 1500); // Animation duration

      setPreviousValue(value);
    }
  }, [value, previousValue, animate]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, []);

  // Determine color based on change
  const getColorClass = () => {
    if (showSign) {
      return change >= 0 ? 'text-green-600' : 'text-red-600';
    }
    return changePercent >= 0 ? 'text-green-600' : 'text-red-600';
  };

  // Size classes
  const sizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl font-bold'
  };

  // Animation classes
  const animationClasses = isAnimating ? [
    'animated-price',
    `animated-price--${direction}`,
    direction === 'up' ? 'animate-price-up' : direction === 'down' ? 'animate-price-down' : ''
  ].filter(Boolean).join(' ') : '';

  // Format the display value
  const formatValue = (val: number) => {
    if (val >= 10000000) return `${(val / 10000000).toFixed(2)}Cr`;
    if (val >= 100000) return `${(val / 100000).toFixed(2)}L`;
    if (val >= 1000) return `${(val / 1000).toFixed(2)}K`;
    return val.toFixed(2);
  };

  const displayValue = showSign && change !== undefined ? 
    `${change >= 0 ? '+' : ''}${formatValue(Math.abs(change))}` : 
    formatValue(value);

  return (
    <div className={`animated-price-container ${className}`}>
      <span 
        className={`
          ${sizeClasses[size]} 
          ${getColorClass()} 
          ${animationClasses}
          transition-all duration-300 ease-in-out
          font-medium
        `}
      >
        {currency && !showSign && currency}
        {displayValue}
        {showSign && changePercent !== undefined && (
          <span className="ml-1 text-xs">
            ({changePercent >= 0 ? '+' : ''}{changePercent.toFixed(2)}%)
          </span>
        )}
      </span>
      
      {/* Pulse effect for significant changes */}
      {isAnimating && Math.abs(changePercent) > 2 && (
        <div className={`
          absolute inset-0 rounded-full 
          ${direction === 'up' ? 'bg-green-400' : 'bg-red-400'}
          opacity-20 animate-ping
        `} />
      )}
    </div>
  );
};

export default AnimatedPrice;
