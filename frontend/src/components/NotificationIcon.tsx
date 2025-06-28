import React, { useState } from 'react';
import { useNotifications } from '../hooks/useNotifications';
import { Button, StatusBadge } from './ui';

interface NotificationIconProps {
  className?: string;
  showStatus?: boolean;
  onClick?: () => void;
}

const NotificationIcon: React.FC<NotificationIconProps> = ({
  className = '',
  showStatus = true,
  onClick
}) => {
  const {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    isSubscribing,
    error,
    showNotification
  } = useNotifications();

  const [showTooltip, setShowTooltip] = useState(false);

  const getNotificationIcon = () => {
    if (!isSupported) {
      return '🔕'; // Not supported
    }
    
    if (permission === 'denied') {
      return '🔕'; // Blocked
    }
    
    if (isSubscribed) {
      return '🔔'; // Active
    }
    
    return '🔔'; // Available but not subscribed
  };

  const getStatusColor = () => {
    if (!isSupported || permission === 'denied') {
      return 'inactive';
    }
    
    if (isSubscribed) {
      return 'active';
    }
    
    return 'pending';
  };

  const getTooltipText = () => {
    if (!isSupported) {
      return 'Push notifications not supported in this browser';
    }
    
    if (permission === 'denied') {
      return 'Push notifications blocked. Enable in browser settings.';
    }
    
    if (isSubscribed) {
      return 'Push notifications enabled';
    }
    
    return 'Click to enable push notifications';
  };

  const handleClick = async () => {
    if (onClick) {
      onClick();
      return;
    }

    // Default behavior: try to subscribe if not already subscribed
    if (isSupported && !isSubscribed && permission !== 'denied') {
      try {
        const success = await subscribe();
        if (!success && error) {
          showNotification({
            title: 'Notification Error',
            message: error,
            type: 'error'
          });
        }
      } catch (err) {
        console.error('Failed to subscribe to notifications:', err);
      }
    } else if (permission === 'denied') {
      showNotification({
        title: 'Notifications Blocked',
        message: 'Please enable notifications in your browser settings to receive trade updates.',
        type: 'warning',
        autoClose: false,
        actions: [
          {
            label: 'Learn How',
            action: () => {
              // Open help documentation or settings guide
              window.open('https://support.google.com/chrome/answer/3220216', '_blank');
            },
            variant: 'outline'
          }
        ]
      });
    } else if (!isSupported) {
      showNotification({
        title: 'Notifications Not Supported',
        message: 'Your browser does not support push notifications. Please use a modern browser like Chrome, Firefox, or Safari.',
        type: 'warning'
      });
    }
  };

  return (
    <div 
      className={`notification-icon ${className}`}
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <Button
        variant="ghost"
        size="sm"
        onClick={handleClick}
        disabled={isSubscribing}
        style={{
          padding: '0.5rem',
          fontSize: '1.25rem',
          position: 'relative',
          opacity: isSubscribing ? 0.6 : 1
        }}
        title={getTooltipText()}
      >
        {getNotificationIcon()}
        
        {showStatus && (
          <div style={{
            position: 'absolute',
            top: '-2px',
            right: '-2px',
            transform: 'scale(0.7)'
          }}>
            <StatusBadge status={getStatusColor()} />
          </div>
        )}
        
        {isSubscribing && (
          <div style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '16px',
            height: '16px',
            border: '2px solid #3b82f6',
            borderTop: '2px solid transparent',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
        )}
      </Button>

      {/* Tooltip */}
      {showTooltip && (
        <div style={{
          position: 'absolute',
          bottom: '100%',
          left: '50%',
          transform: 'translateX(-50%)',
          marginBottom: '0.5rem',
          padding: '0.5rem 0.75rem',
          backgroundColor: '#1f2937',
          color: 'white',
          fontSize: '0.75rem',
          borderRadius: '0.375rem',
          whiteSpace: 'nowrap',
          zIndex: 1000,
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
          maxWidth: '200px',
          textAlign: 'center'
        }}>
          {getTooltipText()}
          
          {/* Tooltip arrow */}
          <div style={{
            position: 'absolute',
            top: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            width: 0,
            height: 0,
            borderLeft: '4px solid transparent',
            borderRight: '4px solid transparent',
            borderTop: '4px solid #1f2937'
          }} />
        </div>
      )}

      <style>
        {`
          @keyframes spin {
            0% { transform: translate(-50%, -50%) rotate(0deg); }
            100% { transform: translate(-50%, -50%) rotate(360deg); }
          }
        `}
      </style>
    </div>
  );
};

export default NotificationIcon;
