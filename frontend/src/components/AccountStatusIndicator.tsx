import React, { useEffect } from 'react';
import { useAccountStatusContext } from '../context/AccountStatusContext';

interface AccountStatusIndicatorProps {
  accountId: string;
  showDetails?: boolean;
  className?: string;
}

const AccountStatusIndicator: React.FC<AccountStatusIndicatorProps> = ({
  accountId,
  showDetails = false,
  className = ''
}) => {
  const { 
    getAccount, 
    connected, 
    subscribeToAccountUpdates, 
    unsubscribeFromAccountUpdates,
    lastUpdate 
  } = useAccountStatusContext();

  const account = getAccount(accountId);

  // Subscribe to real-time updates for this account
  useEffect(() => {
    if (connected && accountId) {
      subscribeToAccountUpdates(accountId);
      
      return () => {
        unsubscribeFromAccountUpdates(accountId);
      };
    }
  }, [accountId, connected, subscribeToAccountUpdates, unsubscribeFromAccountUpdates]);

  if (!account) {
    return (
      <span className={`account-status-indicator account-status-unknown ${className}`}>
        <span className="status-dot"></span>
        {showDetails && <span className="status-text">Unknown</span>}
      </span>
    );
  }

  const getStatusInfo = () => {
    if (account.accountStatus === 'PROCEED_TO_OAUTH') {
      return { status: 'inactive', text: 'Auth Required', color: '#f59e0b', bgColor: '#fef3c7' };
    }
    if (account.isActive) {
      return { status: 'active', text: 'Active', color: '#22c55e', bgColor: '#dcfce7' };
    }
    return { status: 'inactive', text: 'Inactive', color: '#ef4444', bgColor: '#fee2e2' };
  };

  const statusInfo = getStatusInfo();

  return (
    <span 
      className={`account-status-indicator account-status-${statusInfo.status} ${className}`}
      title={`${account.brokerName} - ${statusInfo.text}${lastUpdate ? ` (Updated: ${lastUpdate.toLocaleTimeString()})` : ''}`}
    >
      <span 
        className={`status-dot status-dot--${statusInfo.status}`}
      ></span>
      {showDetails && (
        <span 
          className={`status-text status-text--${statusInfo.status}`}
        >
          {statusInfo.text}
        </span>
      )}
    </span>
  );
};

export default AccountStatusIndicator;