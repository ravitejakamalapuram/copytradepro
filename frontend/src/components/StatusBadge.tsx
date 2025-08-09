import React from 'react';
import { StatusBadge as EnterpriseStatusBadge } from './ui/Badge';
import { ORDER_STATUS, ACCOUNT_STATUS } from '@copytrade/shared-types';

type StatusInput = string | keyof typeof ORDER_STATUS | keyof typeof ACCOUNT_STATUS;

interface StatusBadgeProps {
  status: StatusInput;
  className?: string;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className = '' }) => {
  const getStatusMapping = (status: StatusInput): 'active' | 'inactive' | 'pending' | 'executed' | 'rejected' | 'cancelled' | 'error' => {
    const s = String(status).toUpperCase();
    switch (s) {
      case ORDER_STATUS.EXECUTED:
      case 'COMPLETE':
      case 'FILLED':
        return 'executed';

      case ORDER_STATUS.REJECTED:
      case ORDER_STATUS.FAILED:
        return 'rejected';

      case ORDER_STATUS.PENDING:
      case ORDER_STATUS.PLACED:
      case 'OPEN':
      case ORDER_STATUS.PARTIALLY_FILLED:
      case 'PARTIAL':
        return 'pending';

      case ORDER_STATUS.CANCELLED:
      case 'CANCELED':
        return 'cancelled';

      case ACCOUNT_STATUS.ACTIVE:
        return 'active';

      case ACCOUNT_STATUS.INACTIVE:
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
