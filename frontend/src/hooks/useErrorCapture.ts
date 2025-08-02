/**
 * React hook for error capture functionality
 * Provides easy access to error capture service for components
 * Implements Requirements: 1.2, 5.4
 */

import { useCallback } from 'react';
import { errorCaptureService } from '../services/errorCaptureService';

export interface UseErrorCaptureReturn {
  captureValidationError: (message: string, context?: {
    field?: string;
    value?: any;
    rule?: string;
    component?: string;
  }) => void;
  captureApiError: (error: any, context?: {
    method?: string;
    url?: string;
    requestId?: string;
    status?: number;
    duration?: number;
  }) => void;
  getQueueStatus: () => { queueSize: number; isOnline: boolean };
  clearQueue: () => void;
}

/**
 * Hook for capturing errors in React components
 */
export const useErrorCapture = (): UseErrorCaptureReturn => {
  const captureValidationError = useCallback((
    message: string,
    context?: {
      field?: string;
      value?: any;
      rule?: string;
      component?: string;
    }
  ) => {
    errorCaptureService.captureValidationError(message, context);
  }, []);

  const captureApiError = useCallback((
    error: any,
    context?: {
      method?: string;
      url?: string;
      requestId?: string;
      status?: number;
      duration?: number;
    }
  ) => {
    errorCaptureService.captureApiError(error, context);
  }, []);

  const getQueueStatus = useCallback(() => {
    return errorCaptureService.getQueueStatus();
  }, []);

  const clearQueue = useCallback(() => {
    errorCaptureService.clearQueue();
  }, []);

  return {
    captureValidationError,
    captureApiError,
    getQueueStatus,
    clearQueue
  };
};

export default useErrorCapture;