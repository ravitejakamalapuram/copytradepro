import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getStatusConfig = (status: string) => {
    switch (status.toUpperCase()) {
      case 'EXECUTED':
      case 'COMPLETE':
      case 'FILLED':
        return {
          variant: 'badge-success',
          icon: '✅',
          label: 'Executed'
        };
      
      case 'REJECTED':
      case 'FAILED':
        return {
          variant: 'badge-danger',
          icon: '❌',
          label: 'Rejected'
        };
      
      case 'PENDING':
      case 'PLACED':
      case 'OPEN':
        return {
          variant: 'badge-warning',
          icon: '⏳',
          label: 'Pending'
        };
      
      case 'CANCELLED':
      case 'CANCELED':
        return {
          variant: 'badge-neutral',
          icon: '🚫',
          label: 'Cancelled'
        };
      
      case 'PARTIALLY_FILLED':
      case 'PARTIAL':
        return {
          variant: 'badge-info',
          icon: '🔄',
          label: 'Partial'
        };
      
      default:
        return {
          variant: 'badge-neutral',
          icon: '⚪',
          label: status
        };
    }
  };

  const config = getStatusConfig(status);

  return (
    <span className={`badge ${config.variant} ${className}`}>
      <span className="mr-1">{config.icon}</span>
      {config.label}
    </span>
  );
};

export default StatusBadge;
