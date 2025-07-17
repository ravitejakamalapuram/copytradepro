import React from 'react';
import { StatusBadge as EnterpriseStatusBadge } from './ui/Badge';

interface StatusBadgeProps {
  status: string;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getStatusMapping = (status: string): 'active' | 'inactive' | 'pending' | 'executed' | 'rejected' | 'cancelled' | 'error' => {
    switch (status.toUpperCase()) {
      case 'EXECUTED':
      case 'COMPLETE':
      case 'FILLED':
        return 'executed';
      
      case 'REJECTED':
      case 'FAILED':
        return 'rejected';
      
      case 'PENDING':
      case 'PLACED':
      case 'OPEN':
        return 'pending';
      
      case 'CANCELLED':
      case 'CANCELED':
        return 'cancelled';
      
      case 'PARTIALLY_FILLED':
      case 'PARTIAL':
        return 'pending';
      
      case 'ACTIVE':
        return 'active';
      
      case 'INACTIVE':
        return 'inactive';
      
      case 'ERROR':
        return 'error';
      
      default:
        return 'inactive';
    }
  };

  const mappedStatus = getStatusMapping(status);

  return (
    <EnterpriseStatusBadge 
      status={mappedStatus} 
      className={className}
    >
      {status}
    </EnterpriseStatusBadge>
  );
};

export default StatusBadge;
