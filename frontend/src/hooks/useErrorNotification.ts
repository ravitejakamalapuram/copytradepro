/**
 * React hook for error notification functionality
 * Provides easy access to error notification service for components
 * Implements Requirements: 1.2, 1.3
 */

import { useCallback } from 'react';
import { errorNotificationService, type ErrorNotification, type NotificationOptions } from '../services/errorNotificationService';
import type { FrontendErrorEntry } from '../services/errorCaptureService';

export interface UseErrorNotificationReturn {
  showErrorNotification: (errorEntry: FrontendErrorEntry, options?: NotificationOptions) => void;
  showNotification: (notification: Omit<ErrorNotification, 'id'>) => void;
  dismissNotification: (id: string) => void;
  clearAll: () => void;
}

/**
 * Hook for displaying error notifications in React components
 */
export const useErrorNotification = (): UseErrorNotificationReturn => {
  const showErrorNotification = useCallback((
    errorEntry: FrontendErrorEntry,
    options?: NotificationOptions
  ) => {
    errorNotificationService.showErrorNotification(errorEntry, options);
  }, []);

  const showNotification = useCallback((
    notification: Omit<ErrorNotification, 'id'>
  ) => {
    errorNotificationService.showNotification(notification);
  }, []);

  const dismissNotification = useCallback((id: string) => {
    errorNotificationService.dismissNotification(id);
  }, []);

  const clearAll = useCallback(() => {
    errorNotificationService.clearAll();
  }, []);

  return {
    showErrorNotification,
    showNotification,
    dismissNotification,
    clearAll
  };
};

export default useErrorNotification;