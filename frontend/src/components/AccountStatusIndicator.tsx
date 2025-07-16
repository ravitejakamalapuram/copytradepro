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
        className="status-dot"
        style={{
          backgroundColor: statusInfo.color,
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          display: 'inline-block',
          marginRight: showDetails ? '0.5rem' : '0'
        }}
      ></span>
      {showDetails && (
        <span 
          className="status-text"
          style={{
            fontSize: '0.75rem',
            fontWeight: '500',
            color: statusInfo.color,
            backgroundColor: statusInfo.bgColor,
            padding: '0.125rem 0.375rem',
            borderRadius: '0.25rem'
          }}
        >
          {statusInfo.text}
        </span>
      )}
      {!connected && (
        <span 
          className="connection-indicator"
          style={{
            marginLeft: '0.25rem',
            color: '#f59e0b',
            fontSize: '0.75rem'
          }}
          title="Real-time updates unavailable"
        >
          ⚠️
        </span>
      )}
    </span>
  );
};

export default AccountStatusIndicator;