import React from 'react';
import PriceDisplay from './PriceDisplay';

interface StatsCardProps {
  title: string;
  value: number | string;
  icon?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  currency?: string;
  precision?: number;
  className?: string;
  loading?: boolean;
}

const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon,
  trend,
  currency,
  precision = 2,
  className = '',
  loading = false
}) => {
  if (loading) {
    return (
      <div className={`card ${className}`}>
        <div className="card-body">
          <div className="flex items-center justify-between mb-2">
            <div className="bg-neutral-200 animate-pulse rounded h-4 w-24"></div>
            {icon && <div className="bg-neutral-200 animate-pulse rounded h-6 w-6"></div>}
          </div>
          <div className="bg-neutral-200 animate-pulse rounded h-8 w-32 mb-2"></div>
          {trend && <div className="bg-neutral-200 animate-pulse rounded h-4 w-16"></div>}
        </div>
      </div>
    );
  }

  return (
    <div className={`card ${className}`}>
      <div className="card-body">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-medium text-secondary">{title}</h3>
          {icon && <span className="text-xl">{icon}</span>}
        </div>
        
        <div className="mb-2">
          {typeof value === 'number' && currency ? (
            <PriceDisplay 
              value={value} 
              currency={currency}
              precision={precision}
              size="lg"
              className="font-bold"
            />
          ) : (
            <span className="text-2xl font-bold text-primary font-mono">
              {value}
            </span>
          )}
        </div>

        {trend && (
          <div className="flex items-center gap-1">
            <span className={`text-sm font-medium ${
              trend.isPositive ? 'text-success' : 'text-danger'
            }`}>
              {trend.isPositive ? '↗' : '↘'} {Math.abs(trend.value).toFixed(2)}%
            </span>
            <span className="text-xs text-tertiary">vs last period</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
