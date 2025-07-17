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
    if (account.isActive) {
      return {
        status: 'active',
        text: 'Active',
        color: '#22c55e', // green
        bgColor: '#dcfce7'
      };
    } else {
      return {
        status: 'inactive',
        text: 'Inactive',
        color: '#ef4444', // red
        bgColor: '#fee2e2'
      };
    }
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
      {!connected && (
        <span 
          className="connection-indicator-warning"
        >
          ⚠️
        </span>
      )}
    </span>
  );
};

export default AccountStatusIndicator;