import { useState, useEffect } from 'react';
import api from '../services/api';
import { useResourceCleanup } from './useResourceCleanup';

export const useConnectionStatus = () => {
  const { registerInterval } = useResourceCleanup('useConnectionStatus');
  const [isOnline, setIsOnline] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    const checkConnection = async () => {
      try {
        await api.get('/health', { timeout: 3000 });
        setIsOnline(true);
        setLastChecked(new Date());
      } catch {
        console.warn('🔌 Server connection check failed');
        setIsOnline(false);
        setLastChecked(new Date());
      }
    };

    // Check immediately
    checkConnection();

    // Check every 10 seconds
    const intervalId = setInterval(checkConnection, 10000);
    
    // Register interval for automatic cleanup
    registerInterval(intervalId);

    return () => {
      clearInterval(intervalId);
    };
  }, [registerInterval]);

  return { isOnline, lastChecked };
};
