import { useState, useCallback, useRef, useEffect } from 'react';

interface LoadingOptions {
  timeout?: number; // Timeout in milliseconds
  onTimeout?: () => void;
  onError?: (error: Error) => void;
  retryable?: boolean;
  maxRetries?: number;
}

interface LoadingState {
  isLoading: boolean;
  error: string | null;
  progress?: number;
  retryCount: number;
  timedOut: boolean;
}

export const useLoadingState = (initialState: Partial<LoadingState> = {}) => {
  const [state, setState] = useState<LoadingState>({
    isLoading: false,
    error: null,
    progress: undefined,
    retryCount: 0,
    timedOut: false,
    ...initialState,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Clear timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const startLoading = useCallback((options: LoadingOptions = {}) => {
    const { timeout = 30000, onTimeout } = options;

    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Create new abort controller for this operation
    abortControllerRef.current = new AbortController();

    setState(prev => ({
      ...prev,
      isLoading: true,
      error: null,
      progress: undefined,
      timedOut: false,
    }));

    // Set timeout
    if (timeout > 0) {
      timeoutRef.current = setTimeout(() => {
        setState(prev => ({
          ...prev,
          isLoading: false,
          timedOut: true,
          error: 'Operation timed out. Please try again.',
        }));

        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }

        if (onTimeout) {
          onTimeout();
        }
      }, timeout);
    }

    return abortControllerRef.current;
  }, []);

  const stopLoading = useCallback((error?: string | Error) => {
    // Clear timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    setState(prev => ({
      ...prev,
      isLoading: false,
      error: error ? (typeof error === 'string' ? error : error.message) : null,
      progress: undefined,
    }));
  }, []);

  const setProgress = useCallback((progress: number) => {
    setState(prev => ({
      ...prev,
      progress: Math.max(0, Math.min(100, progress)),
    }));
  }, []);

  const retry = useCallback(async (
    operation: (abortSignal?: AbortSignal) => Promise<any>,
    options: LoadingOptions = {}
  ) => {
    const { maxRetries = 3, onError } = options;

    if (state.retryCount >= maxRetries) {
      setState(prev => ({
        ...prev,
        error: `Maximum retry attempts (${maxRetries}) exceeded`,
      }));
      return;
    }

    try {
      setState(prev => ({
        ...prev,
        retryCount: prev.retryCount + 1,
        error: null,
      }));

      const abortController = startLoading(options);
      const result = await operation(abortController.signal);
      stopLoading();
      return result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Operation was aborted (likely due to timeout)
        return;
      }

      const errorMessage = error.message || 'An unexpected error occurred';
      stopLoading(errorMessage);

      if (onError) {
        onError(error);
      }

      throw error;
    }
  }, [state.retryCount, startLoading, stopLoading]);

  const reset = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    setState({
      isLoading: false,
      error: null,
      progress: undefined,
      retryCount: 0,
      timedOut: false,
    });
  }, []);

  // Wrapper for async operations with automatic loading state management
  const withLoading = useCallback(async <T>(
    operation: (abortSignal?: AbortSignal) => Promise<T>,
    options: LoadingOptions = {}
  ): Promise<T | undefined> => {
    try {
      const abortController = startLoading(options);
      const result = await operation(abortController.signal);
      stopLoading();
      return result;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        // Operation was aborted (likely due to timeout)
        return undefined;
      }

      const errorMessage = error.message || 'An unexpected error occurred';
      stopLoading(errorMessage);

      if (options.onError) {
        options.onError(error);
      }

      throw error;
    }
  }, [startLoading, stopLoading]);

  return {
    // State
    ...state,
    
    // Actions
    startLoading,
    stopLoading,
    setProgress,
    retry,
    reset,
    withLoading,
    
    // Utilities
    canRetry: state.retryCount < 3 && !state.isLoading,
    hasError: !!state.error,
    hasTimedOut: state.timedOut,
    
    // Abort controller for manual cancellation
    abort: () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    },
  };
};

export default useLoadingState;