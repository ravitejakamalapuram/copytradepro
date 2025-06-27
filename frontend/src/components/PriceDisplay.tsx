import React from 'react';

interface PriceDisplayProps {
  value: number | string;
  currency?: string;
  showSign?: boolean;
  precision?: number;
  className?: string;
  size?: 'sm' | 'base' | 'lg';
}

const PriceDisplay: React.FC<PriceDisplayProps> = ({
  value,
  currency = '₹',
  showSign = false,
  precision = 2,
  className = '',
  size = 'base'
}) => {
  const numericValue = typeof value === 'string' ? parseFloat(value) : value;
  
  if (isNaN(numericValue)) {
    return <span className={`font-mono ${className}`}>--</span>;
  }

  const isPositive = numericValue > 0;
  const isNegative = numericValue < 0;
  const isZero = numericValue === 0;

  const formatValue = (val: number) => {
    const formatted = Math.abs(val).toFixed(precision);
    return formatted.replace(/\.?0+$/, ''); // Remove trailing zeros
  };

  const getColorClass = () => {
    if (showSign) {
      if (isPositive) return 'text-success';
      if (isNegative) return 'text-danger';
    }
    return 'text-primary';
  };

  const getSizeClass = () => {
    switch (size) {
      case 'sm': return 'text-sm';
      case 'lg': return 'text-lg';
      default: return 'text-base';
    }
  };

  const getSign = () => {
    if (!showSign || isZero) return '';
    return isPositive ? '+' : '';
  };

  return (
    <span className={`font-mono font-medium ${getColorClass()} ${getSizeClass()} ${className}`}>
      {getSign()}{currency}{formatValue(numericValue)}
    </span>
  );
};

export default PriceDisplay;
