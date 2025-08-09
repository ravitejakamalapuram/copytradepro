import React from 'react';

/**
 * Wrap React.lazy with a simple retry on transient network failures (e.g., Vite HMR hiccups)
 * - retries: number of additional attempts
 * - delay: ms between attempts
 */
export function lazyWithRetry<T extends React.ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 1,
  delay = 500
): React.LazyExoticComponent<T> {
  const attempt = (remaining: number): Promise<{ default: T }> => {
    return factory().catch((err: unknown) => {
      const message = String(err || '');
      const isTransient = message.includes('Failed to fetch dynamically imported module') ||
                          message.includes('Importing a module script failed');

      if (!isTransient || remaining <= 0) {
        throw err;
      }

      return new Promise((resolve, reject) => {
        setTimeout(() => {
          attempt(remaining - 1).then(resolve).catch(reject);
        }, delay);
      });
    });
  };

  return React.lazy(() => attempt(retries));
}

