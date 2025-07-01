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
      id: Date.now().toString() + Math.random().toString(36).substring(2, 11),
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
      padding: '1rem 1.25rem',
      borderRadius: '0.75rem',
      border: '1px solid',
      backgroundColor: '#ffffff',
      boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1), 0 4px 10px rgba(0, 0, 0, 0.05)',
      marginBottom: '0.75rem',
      maxWidth: '420px',
      minWidth: '320px',
      position: 'relative' as const,
      animation: 'slideIn 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
      backdropFilter: 'blur(8px)',
      borderLeft: '4px solid'
    };

    switch (type) {
      case 'success':
        return {
          ...baseStyles,
          borderColor: '#e5e7eb',
          borderLeftColor: '#22c55e',
          backgroundColor: '#f8fffe',
          background: 'linear-gradient(135deg, #f0fdf4 0%, #f8fffe 100%)'
        };
      case 'error':
        return {
          ...baseStyles,
          borderColor: '#e5e7eb',
          borderLeftColor: '#ef4444',
          backgroundColor: '#fffefe',
          background: 'linear-gradient(135deg, #fef2f2 0%, #fffefe 100%)'
        };
      case 'warning':
        return {
          ...baseStyles,
          borderColor: '#e5e7eb',
          borderLeftColor: '#f59e0b',
          backgroundColor: '#fffffe',
          background: 'linear-gradient(135deg, #fffbeb 0%, #fffffe 100%)'
        };
      case 'info':
      default:
        return {
          ...baseStyles,
          borderColor: '#e5e7eb',
          borderLeftColor: '#3b82f6',
          backgroundColor: '#fefffe',
          background: 'linear-gradient(135deg, #eff6ff 0%, #fefffe 100%)'
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
              transform: translateX(100%) scale(0.95);
              opacity: 0;
            }
            to {
              transform: translateX(0) scale(1);
              opacity: 1;
            }
          }

          @keyframes slideOut {
            from {
              transform: translateX(0) scale(1);
              opacity: 1;
            }
            to {
              transform: translateX(100%) scale(0.95);
              opacity: 0;
            }
          }

          .notification-item:hover {
            transform: translateY(-2px);
            box-shadow: 0 15px 35px rgba(0, 0, 0, 0.15), 0 6px 15px rgba(0, 0, 0, 0.08) !important;
            transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
          }

          .notification-close-btn {
            transition: all 0.2s ease;
            border-radius: 50%;
            width: 24px;
            height: 24px;
            display: flex;
            align-items: center;
            justify-content: center;
            background: rgba(0, 0, 0, 0.05);
          }

          .notification-close-btn:hover {
            background: rgba(0, 0, 0, 0.1);
            transform: scale(1.1);
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
              className="notification-item"
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
                  className="notification-close-btn"
                  style={{
                    border: 'none',
                    cursor: 'pointer',
                    color: '#6b7280',
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
