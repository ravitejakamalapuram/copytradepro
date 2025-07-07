import React from 'react';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getStatusConfig = (status: string) => {
    switch (status.toUpperCase()) {
      case 'SUBMITTED':
        return {
          variant: 'badge-warning',
          icon: '📤',
          label: 'Submitted'
        };

      case 'PENDING':
      case 'OPEN':
        return {
          variant: 'badge-info',
          icon: '⏳',
          label: 'Pending'
        };

      case 'EXECUTED':
      case 'COMPLETE':
      case 'FILLED':
        return {
          variant: 'badge-success',
          icon: '✅',
          label: 'Executed'
        };

      case 'REJECTED':
        return {
          variant: 'badge-danger',
          icon: '❌',
          label: 'Rejected'
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

      case 'FAILED':
        return {
          variant: 'badge-danger',
          icon: '⚠️',
          label: 'Failed'
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
