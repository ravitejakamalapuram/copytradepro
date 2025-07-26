import React, { useState, useEffect } from 'react';
import { useResourceCleanup } from '../hooks/useResourceCleanup';
import { Button, Flex, Stack } from './ui';

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'warning' | 'info';
  timestamp: Date;
  autoClose?: boolean;
  duration?: number;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  }>;
}

interface NotificationDisplayProps {
  className?: string;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  maxNotifications?: number;
}

const NotificationDisplay: React.FC<NotificationDisplayProps> = ({
  position = 'top-right',
  maxNotifications = 5
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const { registerTimeout, registerEventListener } = useResourceCleanup('NotificationDisplay');

  useEffect(() => {
    // Listen for service worker messages (notification clicks)
    const handleMessage = (event: Event) => {
      const messageEvent = event as MessageEvent;
      if (messageEvent.data?.type === 'NOTIFICATION_CLICK') {
        console.log('Notification clicked:', messageEvent.data);
        // Handle notification click navigation
        if (messageEvent.data.url && messageEvent.data.url !== window.location.pathname) {
          window.location.href = messageEvent.data.url;
        }
      }
    };

    if (navigator.serviceWorker) {
      navigator.serviceWorker.addEventListener('message', handleMessage);
      registerEventListener(navigator.serviceWorker, 'message', handleMessage);
    }

    return () => {
      if (navigator.serviceWorker) {
        navigator.serviceWorker.removeEventListener('message', handleMessage);
      }
    };
  }, [registerEventListener]);

  const addNotification = (notification: Omit<NotificationItem, 'id' | 'timestamp'>) => {
    const newNotification: NotificationItem = {
      ...notification,
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      autoClose: notification.autoClose !== false,
      duration: notification.duration || 5000
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev];
      return updated.slice(0, maxNotifications);
    });

    // Auto-close notification if enabled
    if (newNotification.autoClose) {
      const timeout = setTimeout(() => {
        removeNotification(newNotification.id);
      }, newNotification.duration);
      
      // Register timeout for cleanup
      registerTimeout(timeout);
    }
  };

  const removeNotification = (id: string) => {
    setNotifications(prev => prev.filter(notification => notification.id !== id));
  };

  const clearAllNotifications = () => {
    setNotifications([]);
  };

  const getNotificationIcon = (type: NotificationItem['type']) => {
    switch (type) {
      case 'success':
        return '✅';
      case 'error':
        return '❌';
      case 'warning':
        return '⚠️';
      case 'info':
      default:
        return 'ℹ️';
    }
  };



  // Expose addNotification function globally for use by other components
  useEffect(() => {
    (window as unknown as { addNotification?: typeof addNotification }).addNotification = addNotification;
    return () => {
      delete (window as unknown as { addNotification?: typeof addNotification }).addNotification;
    };
  }, []);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <>
      <style>
        {`
          @keyframes slideIn {
            from {
              transform: translateX(100%);
              opacity: 0;
            }
            to {
              transform: translateX(0);
              opacity: 1;
            }
          }
          
          @keyframes slideOut {
            from {
              transform: translateX(0);
              opacity: 1;
            }
            to {
              transform: translateX(100%);
              opacity: 0;
            }
          }
        `}
      </style>
      
      <div className={`notification-display notification-${position}`}>
        {notifications.length > 1 && (
          <div style={{ marginBottom: '0.5rem', pointerEvents: 'auto' }}>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAllNotifications}
              style={{
                fontSize: '0.75rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                backdropFilter: 'blur(4px)'
              }}
            >
              Clear All ({notifications.length})
            </Button>
          </div>
        )}
        
        <Stack gap={1}>
          {notifications.map((notification) => (
            <div
              key={notification.id}
              className={`notification notification-${notification.type}`}
            >
              <Flex align="start" gap={3}>
                <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>
                  {getNotificationIcon(notification.type)}
                </span>
                
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: '600',
                    fontSize: '0.875rem',
                    marginBottom: '0.25rem',
                    color: '#1f2937'
                  }}>
                    {notification.title}
                  </div>
                  
                  <div style={{
                    fontSize: '0.8rem',
                    color: '#6b7280',
                    lineHeight: '1.4',
                    marginBottom: notification.actions ? '0.75rem' : 0
                  }}>
                    {notification.message}
                  </div>
                  
                  {notification.actions && notification.actions.length > 0 && (
                    <Flex gap={2} wrap>
                      {notification.actions.map((action, index) => (
                        <Button
                          key={index}
                          variant={action.variant || 'outline'}
                          size="sm"
                          onClick={action.action}
                          style={{ fontSize: '0.75rem' }}
                        >
                          {action.label}
                        </Button>
                      ))}
                    </Flex>
                  )}
                </div>
                
                <button
                  onClick={() => removeNotification(notification.id)}
                  className="notification-close"
                  title="Close notification"
                >
                  ×
                </button>
              </Flex>
              
              <div style={{
                fontSize: '0.7rem',
                color: '#9ca3af',
                marginTop: '0.5rem',
                textAlign: 'right'
              }}>
                <span className="notification-timestamp">
                  {notification.timestamp.toLocaleTimeString()}
                </span>
              </div>
            </div>
          ))}
        </Stack>
      </div>
    </>
  );
};

export default NotificationDisplay;
