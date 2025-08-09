/**
 * Error Notification Display Component
 * Displays user-friendly error notifications with actionable messages
 * Implements Requirements: 1.2, 1.3
 */

import React, { useEffect, useState } from 'react';
import { errorNotificationService, type ErrorNotification } from '../services/errorNotificationService';
import Button from './ui/Button';
import Card from './ui/Card';
import './ErrorNotificationDisplay.css';

interface ErrorNotificationDisplayProps {
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center';
  maxVisible?: number;
}

const ErrorNotificationDisplay: React.FC<ErrorNotificationDisplayProps> = ({
  position = 'top-right',
  maxVisible = 3
}) => {
  const [notifications, setNotifications] = useState<ErrorNotification[]>([]);

  useEffect(() => {
    const unsubscribe = errorNotificationService.subscribe(setNotifications);
    return unsubscribe;
  }, []);

  const visibleNotifications = notifications.slice(0, maxVisible);

  if (visibleNotifications.length === 0) {
    return null;
  }

  return (
    <div className={`error-notification-container error-notification-${position}`}>
      {visibleNotifications.map((notification) => (
        <ErrorNotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={() => errorNotificationService.dismissNotification(notification.id)}
        />
      ))}
      
      {notifications.length > maxVisible && (
        <div className="error-notification-overflow">
          <Card className="error-notification-overflow-card">
            <div className="error-notification-overflow-content">
              <span>+{notifications.length - maxVisible} more errors</span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => errorNotificationService.clearAll()}
              >
                Clear All
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
};

interface ErrorNotificationItemProps {
  notification: ErrorNotification;
  onDismiss: () => void;
}

const ErrorNotificationItem: React.FC<ErrorNotificationItemProps> = ({
  notification,
  onDismiss
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10);
    return () => clearTimeout(timer);
  }, []);

  const handleDismiss = () => {
    if (!notification.dismissible) return;
    
    setIsExiting(true);
    setTimeout(() => {
      onDismiss();
    }, 300); // Match CSS transition duration
  };

  const getNotificationIcon = () => {
    switch (notification.type) {
      case 'error':
        return (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="error-notification-icon error-icon"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        );
      
      case 'warning':
        return (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="error-notification-icon warning-icon"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
        );
      
      case 'info':
        return (
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="error-notification-icon info-icon"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="16" x2="12" y2="12" />
            <line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
        );
      
      default:
        return null;
    }
  };

  return (
    <div
      className={`
        error-notification-item
        error-notification-${notification.type}
        ${isVisible ? 'error-notification-visible' : ''}
        ${isExiting ? 'error-notification-exiting' : ''}
      `}
    >
      <Card className="error-notification-card">
        <div className="error-notification-content">
          <div className="error-notification-header">
            <div className="error-notification-icon-title">
              {getNotificationIcon()}
              <h4 className="error-notification-title">{notification.title}</h4>
            </div>
            
            {notification.dismissible && (
              <button
                className="error-notification-close"
                onClick={handleDismiss}
                aria-label="Dismiss notification"
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            )}
          </div>
          
          <p className="error-notification-message">{notification.message}</p>
          
          {notification.traceId && (
            <div className="error-notification-trace">
              <span className="error-notification-trace-label">Trace ID:</span>
              <code className="error-notification-trace-id">{notification.traceId}</code>
            </div>
          )}
          
          {notification.actions && notification.actions.length > 0 && (
            <div className="error-notification-actions">
              {notification.actions.map((action, index) => (
                <Button
                  key={index}
                  variant={action.primary ? 'primary' : 'outline'}
                  size="sm"
                  onClick={action.action}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default ErrorNotificationDisplay;