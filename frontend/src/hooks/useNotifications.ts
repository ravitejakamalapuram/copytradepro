import { useCallback, useEffect, useState } from 'react';
import { notificationService } from '../services/notificationService';
import type { NotificationItem } from '../components/NotificationDisplay';

export interface UseNotificationsReturn {
  // Subscription status
  isSupported: boolean;
  isSubscribed: boolean;
  permission: NotificationPermission;

  // Actions
  subscribe: () => Promise<boolean>;
  unsubscribe: () => Promise<boolean>;
  sendTestNotification: () => Promise<boolean>;
  refreshStatus: () => Promise<void>;

  // In-app notifications
  showNotification: (notification: Omit<NotificationItem, 'id' | 'timestamp'>) => void;

  // Loading states
  isLoading: boolean;
  isSubscribing: boolean;

  // Error handling
  error: string | null;
  clearError: () => void;
}

export const useNotifications = (): UseNotificationsReturn => {
  const [isSupported, setIsSupported] = useState(false);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize notification service and check status
  useEffect(() => {
    const initializeNotifications = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Check if notifications are supported
        const supported = notificationService.isNotificationSupported();
        setIsSupported(supported);

        if (supported) {
          // Initialize the service
          await notificationService.initialize();
          
          // Check current status
          const subscribed = await notificationService.isSubscribed();
          const currentPermission = notificationService.getPermission();
          
          setIsSubscribed(subscribed);
          setPermission(currentPermission);
        }
      } catch (err: any) {
        console.error('Failed to initialize notifications:', err);
        setError(err.message || 'Failed to initialize notifications');
      } finally {
        setIsLoading(false);
      }
    };

    initializeNotifications();
  }, []);

  // Show in-app notification
  const showNotification = useCallback((notification: Omit<NotificationItem, 'id' | 'timestamp'>) => {
    // Use the global addNotification function if available
    if ((window as any).addNotification) {
      (window as any).addNotification(notification);
    } else {
      console.warn('NotificationDisplay component not found. Make sure it is rendered in your app.');
      console.log('Notification:', notification);
    }
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async (): Promise<boolean> => {
    try {
      setIsSubscribing(true);
      setError(null);

      const success = await notificationService.subscribe();
      
      if (success) {
        setIsSubscribed(true);
        setPermission(notificationService.getPermission());
        
        // Show success notification
        showNotification({
          title: 'Notifications Enabled',
          message: 'You will now receive push notifications for trade updates.',
          type: 'success'
        });
        
        return true;
      } else {
        throw new Error('Failed to subscribe to notifications');
      }
    } catch (err: any) {
      console.error('Failed to subscribe:', err);
      setError(err.message || 'Failed to subscribe to notifications');
      return false;
    } finally {
      setIsSubscribing(false);
    }
  }, []);

  // Unsubscribe from push notifications
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      setIsSubscribing(true);
      setError(null);

      const success = await notificationService.unsubscribe();

      if (success) {
        setIsSubscribed(false);
        setPermission(notificationService.getPermission());

        // Show success notification
        showNotification({
          title: 'Notifications Disabled',
          message: 'You will no longer receive push notifications.',
          type: 'info'
        });

        return true;
      } else {
        throw new Error('Failed to unsubscribe from notifications');
      }
    } catch (err: any) {
      console.error('Failed to unsubscribe:', err);
      setError(err.message || 'Failed to unsubscribe from notifications');
      return false;
    } finally {
      setIsSubscribing(false);
    }
  }, [showNotification]);

  // Send test notification
  const sendTestNotification = useCallback(async (): Promise<boolean> => {
    try {
      setError(null);

      const success = await notificationService.sendTestNotification();
      
      if (success) {
        // Show in-app confirmation
        showNotification({
          title: 'Test Notification Sent',
          message: 'Check your browser notifications to see if it worked!',
          type: 'success'
        });
        
        return true;
      } else {
        throw new Error('Failed to send test notification');
      }
    } catch (err: any) {
      console.error('Failed to send test notification:', err);
      setError(err.message || 'Failed to send test notification');
      return false;
    }
  }, []);

  // Clear error
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Refresh subscription status
  const refreshStatus = useCallback(async () => {
    try {
      if (isSupported) {
        const subscribed = await notificationService.isSubscribed();
        const currentPermission = notificationService.getPermission();

        setIsSubscribed(subscribed);
        setPermission(currentPermission);
      }
    } catch (err: any) {
      console.error('Failed to refresh subscription status:', err);
    }
  }, [isSupported]);

  // Listen for order updates and show notifications
  useEffect(() => {
    const handleOrderUpdate = (event: CustomEvent) => {
      const { order, oldStatus, newStatus } = event.detail;
      
      // Show notification for order status changes
      if (oldStatus !== newStatus) {
        let notificationType: NotificationItem['type'] = 'info';
        let message = `Order ${order.symbol} status changed from ${oldStatus} to ${newStatus}`;
        
        if (newStatus === 'EXECUTED') {
          notificationType = 'success';
          message = `Order executed: ${order.action} ${order.quantity} ${order.symbol} at ₹${order.price}`;
        } else if (newStatus === 'REJECTED' || newStatus === 'FAILED') {
          notificationType = 'error';
          message = `Order ${newStatus.toLowerCase()}: ${order.symbol}`;
        } else if (newStatus === 'CANCELLED') {
          notificationType = 'warning';
          message = `Order cancelled: ${order.symbol}`;
        }
        
        showNotification({
          title: 'Order Update',
          message,
          type: notificationType,
          actions: [
            {
              label: 'View Details',
              action: () => {
                window.location.href = '/trade-setup';
              },
              variant: 'outline'
            }
          ]
        });
      }
    };

    // Listen for custom order update events
    window.addEventListener('orderUpdate', handleOrderUpdate as EventListener);
    
    return () => {
      window.removeEventListener('orderUpdate', handleOrderUpdate as EventListener);
    };
  }, [showNotification]);

  return {
    // Status
    isSupported,
    isSubscribed,
    permission,

    // Actions
    subscribe,
    unsubscribe,
    sendTestNotification,
    showNotification,
    refreshStatus,

    // Loading states
    isLoading,
    isSubscribing,

    // Error handling
    error,
    clearError
  };
};

export default useNotifications;
