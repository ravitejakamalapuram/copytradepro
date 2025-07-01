import { useCallback } from 'react';
import { useNotifications } from './useNotifications';
import type { NotificationItem } from '../components/NotificationDisplay';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
  title?: string;
  message: string;
  type?: ToastType;
  duration?: number;
  autoClose?: boolean;
  actions?: Array<{
    label: string;
    action: () => void;
    variant?: 'primary' | 'secondary' | 'outline';
  }>;
}

export interface UseToastReturn {
  // Toast methods
  toast: (options: ToastOptions) => void;
  success: (message: string, title?: string, options?: Partial<ToastOptions>) => void;
  error: (message: string, title?: string, options?: Partial<ToastOptions>) => void;
  warning: (message: string, title?: string, options?: Partial<ToastOptions>) => void;
  info: (message: string, title?: string, options?: Partial<ToastOptions>) => void;
  
  // Validation specific toasts
  validationError: (message: string, options?: Partial<ToastOptions>) => void;
  formSuccess: (message: string, options?: Partial<ToastOptions>) => void;
  
  // Order specific toasts
  orderSuccess: (message: string, orderCount?: number, options?: Partial<ToastOptions>) => void;
  orderError: (message: string, options?: Partial<ToastOptions>) => void;
  orderPartialSuccess: (successCount: number, totalCount: number, options?: Partial<ToastOptions>) => void;
}

const defaultDurations = {
  success: 4000,
  error: 6000,
  warning: 5000,
  info: 4000
};

const getToastIcon = (type: ToastType): string => {
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

// Removed unused getToastColors function

export const useToast = (): UseToastReturn => {
  const { showNotification } = useNotifications();

  const toast = useCallback((options: ToastOptions) => {
    const {
      title,
      message,
      type = 'info',
      duration = defaultDurations[type],
      autoClose = true,
      actions
    } = options;

    const notification: Omit<NotificationItem, 'id' | 'timestamp'> = {
      title: title || getDefaultTitle(type),
      message,
      type,
      duration,
      autoClose,
      actions,
      icon: getToastIcon(type)
    };

    showNotification(notification);
  }, [showNotification]);

  const success = useCallback((message: string, title?: string, options?: Partial<ToastOptions>) => {
    toast({
      message,
      title: title || 'Success',
      type: 'success',
      ...options
    });
  }, [toast]);

  const error = useCallback((message: string, title?: string, options?: Partial<ToastOptions>) => {
    toast({
      message,
      title: title || 'Error',
      type: 'error',
      ...options
    });
  }, [toast]);

  const warning = useCallback((message: string, title?: string, options?: Partial<ToastOptions>) => {
    toast({
      message,
      title: title || 'Warning',
      type: 'warning',
      ...options
    });
  }, [toast]);

  const info = useCallback((message: string, title?: string, options?: Partial<ToastOptions>) => {
    toast({
      message,
      title: title || 'Information',
      type: 'info',
      ...options
    });
  }, [toast]);

  // Validation specific toasts
  const validationError = useCallback((message: string, options?: Partial<ToastOptions>) => {
    error(message, 'Validation Error', {
      duration: 5000,
      ...options
    });
  }, [error]);

  const formSuccess = useCallback((message: string, options?: Partial<ToastOptions>) => {
    success(message, 'Form Submitted', {
      duration: 3000,
      ...options
    });
  }, [success]);

  // Order specific toasts
  const orderSuccess = useCallback((message: string, orderCount?: number, options?: Partial<ToastOptions>) => {
    const title = orderCount && orderCount > 1 
      ? `${orderCount} Orders Placed Successfully`
      : 'Order Placed Successfully';
    
    success(message, title, {
      duration: 4000,
      actions: [
        {
          label: 'View Orders',
          action: () => {
            window.location.href = '/orders';
          },
          variant: 'outline'
        }
      ],
      ...options
    });
  }, [success]);

  const orderError = useCallback((message: string, options?: Partial<ToastOptions>) => {
    error(message, 'Order Failed', {
      duration: 6000,
      actions: [
        {
          label: 'Try Again',
          action: () => {
            // This will be handled by the calling component
            console.log('Retry order placement');
          },
          variant: 'outline'
        }
      ],
      ...options
    });
  }, [error]);

  const orderPartialSuccess = useCallback((successCount: number, totalCount: number, options?: Partial<ToastOptions>) => {
    const message = `${successCount} out of ${totalCount} orders were placed successfully. Some orders failed.`;
    
    warning(message, 'Partial Success', {
      duration: 7000,
      actions: [
        {
          label: 'View Orders',
          action: () => {
            window.location.href = '/orders';
          },
          variant: 'outline'
        },
        {
          label: 'Retry Failed',
          action: () => {
            console.log('Retry failed orders');
          },
          variant: 'primary'
        }
      ],
      ...options
    });
  }, [warning]);

  return {
    toast,
    success,
    error,
    warning,
    info,
    validationError,
    formSuccess,
    orderSuccess,
    orderError,
    orderPartialSuccess
  };
};

const getDefaultTitle = (type: ToastType): string => {
  switch (type) {
    case 'success':
      return 'Success';
    case 'error':
      return 'Error';
    case 'warning':
      return 'Warning';
    case 'info':
    default:
      return 'Information';
  }
};

export default useToast;
