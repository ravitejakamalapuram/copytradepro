import { useState, useEffect } from 'react';
import api from '../services/api';

export const useConnectionStatus = () => {
  const [isOnline, setIsOnline] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    const checkConnection = async () => {
      try {
        await api.get('/health', { timeout: 3000 });
        setIsOnline(true);
        setLastChecked(new Date());
      } catch (error) {
        console.warn('🔌 Server connection check failed');
        setIsOnline(false);
        setLastChecked(new Date());
      }
    };

    // Check immediately
    checkConnection();

    // Check every 10 seconds
    intervalId = setInterval(checkConnection, 10000);

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, []);

  return { isOnline, lastChecked };
};
