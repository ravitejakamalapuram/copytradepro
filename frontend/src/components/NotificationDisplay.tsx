import React, { useState, useEffect } from 'react';
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
  className = '',
  position = 'top-right',
  maxNotifications = 5
}) => {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  useEffect(() => {
    // Listen for service worker messages (notification clicks)
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'NOTIFICATION_CLICK') {
        console.log('Notification clicked:', event.data);
        // Handle notification click navigation
        if (event.data.url && event.data.url !== window.location.pathname) {
          window.location.href = event.data.url;
        }
      }
    };

    navigator.serviceWorker?.addEventListener('message', handleMessage);

    return () => {
      navigator.serviceWorker?.removeEventListener('message', handleMessage);
    };
  }, []);

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
      setTimeout(() => {
        removeNotification(newNotification.id);
      }, newNotification.duration);
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

  const getNotificationStyles = (type: NotificationItem['type']) => {
    const baseStyles = {
      padding: '1rem',
      borderRadius: '0.5rem',
      border: '1px solid',
      backgroundColor: '#ffffff',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
      marginBottom: '0.75rem',
      maxWidth: '400px',
      position: 'relative' as const,
      animation: 'slideIn 0.3s ease-out'
    };

    switch (type) {
      case 'success':
        return {
          ...baseStyles,
          borderColor: '#10b981',
          backgroundColor: '#f0fdf4'
        };
      case 'error':
        return {
          ...baseStyles,
          borderColor: '#ef4444',
          backgroundColor: '#fef2f2'
        };
      case 'warning':
        return {
          ...baseStyles,
          borderColor: '#f59e0b',
          backgroundColor: '#fffbeb'
        };
      case 'info':
      default:
        return {
          ...baseStyles,
          borderColor: '#3b82f6',
          backgroundColor: '#eff6ff'
        };
    }
  };

  const getPositionStyles = () => {
    const baseStyles = {
      position: 'fixed' as const,
      zIndex: 9999,
      pointerEvents: 'none' as const
    };

    switch (position) {
      case 'top-right':
        return { ...baseStyles, top: '1rem', right: '1rem' };
      case 'top-left':
        return { ...baseStyles, top: '1rem', left: '1rem' };
      case 'bottom-right':
        return { ...baseStyles, bottom: '1rem', right: '1rem' };
      case 'bottom-left':
        return { ...baseStyles, bottom: '1rem', left: '1rem' };
      default:
        return { ...baseStyles, top: '1rem', right: '1rem' };
    }
  };

  // Expose addNotification function globally for use by other components
  useEffect(() => {
    (window as any).addNotification = addNotification;
    return () => {
      delete (window as any).addNotification;
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
      
      <div className={`notification-display ${className}`} style={getPositionStyles()}>
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
              style={{
                ...getNotificationStyles(notification.type),
                pointerEvents: 'auto'
              }}
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
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '0.25rem',
                    color: '#9ca3af',
                    fontSize: '1rem',
                    lineHeight: 1,
                    flexShrink: 0
                  }}
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
                {notification.timestamp.toLocaleTimeString()}
              </div>
            </div>
          ))}
        </Stack>
      </div>
    </>
  );
};

export default NotificationDisplay;
