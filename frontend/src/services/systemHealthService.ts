/**
 * System Health Service
 * Service for fetching live system health and performance metrics
 */

import api from './api';

export interface SystemHealthMetric {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  value: string;
  description: string;
  trend?: 'up' | 'down' | 'stable';
  lastUpdated?: string;
}

export interface SystemHealthData {
  overall: 'healthy' | 'warning' | 'critical';
  metrics: SystemHealthMetric[];
  uptime: number;
  lastUpdated: string;
  alerts: SystemAlert[];
}

export interface SystemAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
}

export interface PerformanceMetrics {
  responseTime: {
    avg: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    totalRequests: number;
  };
  errorRate: {
    percentage: number;
    total: number;
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    percentage: number;
  };
}

export interface DatabaseHealth {
  status: 'connected' | 'disconnected' | 'degraded';
  responseTime: number;
  connections: {
    active: number;
    total: number;
  };
  operations: {
    reads: number;
    writes: number;
  };
}

export interface CacheStats {
  hitRate: number;
  size: number;
  evictions: number;
  operations: {
    gets: number;
    sets: number;
  };
}

class SystemHealthService {
  /**
   * Get overall system health status
   */
  async getSystemHealth(): Promise<{ success: boolean; data: SystemHealthData }> {
    try {
      const response = await api.get<{ success: boolean; data: any }>('/monitoring/health/detailed');
      
      if (response.data.success) {
        const healthData = response.data.data;
        
        // Transform backend data to frontend format
        const metrics: SystemHealthMetric[] = [
          {
            name: 'Database Connection',
            status: healthData.database?.status === 'connected' ? 'healthy' : 'critical',
            value: healthData.database?.status || 'Unknown',
            description: `Response time: ${healthData.database?.responseTime || 0}ms`,
            trend: 'stable'
          },
          {
            name: 'API Response Time',
            status: (healthData.performance?.responseTime?.avg || 0) < 100 ? 'healthy' : 
                   (healthData.performance?.responseTime?.avg || 0) < 500 ? 'warning' : 'critical',
            value: `${healthData.performance?.responseTime?.avg || 0}ms`,
            description: 'Average API response time',
            trend: 'stable'
          },
          {
            name: 'Memory Usage',
            status: (healthData.performance?.memory?.percentage || 0) < 70 ? 'healthy' : 
                   (healthData.performance?.memory?.percentage || 0) < 90 ? 'warning' : 'critical',
            value: `${Math.round(healthData.performance?.memory?.percentage || 0)}%`,
            description: `${Math.round((healthData.performance?.memory?.used || 0) / 1024 / 1024)}MB used`,
            trend: 'stable'
          },
          {
            name: 'Error Rate',
            status: (healthData.performance?.errorRate?.percentage || 0) < 1 ? 'healthy' : 
                   (healthData.performance?.errorRate?.percentage || 0) < 5 ? 'warning' : 'critical',
            value: `${healthData.performance?.errorRate?.percentage || 0}%`,
            description: 'Error rate over last hour',
            trend: 'stable'
          },
          {
            name: 'Active Connections',
            status: 'healthy',
            value: `${healthData.database?.connections?.active || 0}`,
            description: `${healthData.database?.connections?.total || 0} total connections`,
            trend: 'stable'
          },
          {
            name: 'Cache Hit Rate',
            status: (healthData.cache?.hitRate || 0) > 80 ? 'healthy' : 
                   (healthData.cache?.hitRate || 0) > 60 ? 'warning' : 'critical',
            value: `${Math.round(healthData.cache?.hitRate || 0)}%`,
            description: 'Cache performance indicator',
            trend: 'stable'
          }
        ];

        // Determine overall health
        const criticalCount = metrics.filter(m => m.status === 'critical').length;
        const warningCount = metrics.filter(m => m.status === 'warning').length;
        
        const overall = criticalCount > 0 ? 'critical' : 
                       warningCount > 0 ? 'warning' : 'healthy';

        return {
          success: true,
          data: {
            overall,
            metrics,
            uptime: healthData.uptime || 0,
            lastUpdated: new Date().toISOString(),
            alerts: healthData.alerts || []
          }
        };
      }
      
      throw new Error('Failed to get health data');
    } catch (error: any) {
      console.error('Failed to fetch system health:', error);
      
      // Return fallback data
      return {
        success: false,
        data: {
          overall: 'critical',
          metrics: [
            {
              name: 'System Status',
              status: 'critical',
              value: 'Unavailable',
              description: 'Unable to fetch system health data'
            }
          ],
          uptime: 0,
          lastUpdated: new Date().toISOString(),
          alerts: []
        }
      };
    }
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(): Promise<{ success: boolean; data: PerformanceMetrics }> {
    try {
      const response = await api.get<{ success: boolean; data: any }>('/monitoring/performance');
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      }
      
      throw new Error('Failed to get performance metrics');
    } catch (error: any) {
      console.error('Failed to fetch performance metrics:', error);
      return {
        success: false,
        data: {
          responseTime: { avg: 0, p95: 0, p99: 0 },
          throughput: { requestsPerSecond: 0, totalRequests: 0 },
          errorRate: { percentage: 0, total: 0 },
          memory: { used: 0, total: 0, percentage: 0 },
          cpu: { percentage: 0 }
        }
      };
    }
  }

  /**
   * Get database health
   */
  async getDatabaseHealth(): Promise<{ success: boolean; data: DatabaseHealth }> {
    try {
      const response = await api.get<{ success: boolean; data: any }>('/market-data/database/stats');
      
      if (response.data.success) {
        const dbData = response.data.data;
        
        return {
          success: true,
          data: {
            status: dbData.connected ? 'connected' : 'disconnected',
            responseTime: dbData.responseTime || 0,
            connections: {
              active: dbData.connections?.active || 0,
              total: dbData.connections?.total || 0
            },
            operations: {
              reads: dbData.operations?.reads || 0,
              writes: dbData.operations?.writes || 0
            }
          }
        };
      }
      
      throw new Error('Failed to get database health');
    } catch (error: any) {
      console.error('Failed to fetch database health:', error);
      return {
        success: false,
        data: {
          status: 'disconnected',
          responseTime: 0,
          connections: { active: 0, total: 0 },
          operations: { reads: 0, writes: 0 }
        }
      };
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{ success: boolean; data: CacheStats }> {
    try {
      const response = await api.get<{ success: boolean; data: any }>('/symbol-health/cache');
      
      if (response.data.success) {
        return {
          success: true,
          data: response.data.data
        };
      }
      
      throw new Error('Failed to get cache stats');
    } catch (error: any) {
      console.error('Failed to fetch cache stats:', error);
      return {
        success: false,
        data: {
          hitRate: 0,
          size: 0,
          evictions: 0,
          operations: { gets: 0, sets: 0 }
        }
      };
    }
  }

  /**
   * Clear system cache
   */
  async clearCache(type: 'all' | 'symbols' | 'search' = 'all'): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post<{ success: boolean; message: string }>('/symbol-health/cache/clear', { type });
      return response.data;
    } catch (error: any) {
      console.error('Failed to clear cache:', error);
      return {
        success: false,
        message: 'Failed to clear cache'
      };
    }
  }

  /**
   * Get startup status
   */
  async getStartupStatus(): Promise<{ success: boolean; data: any }> {
    try {
      const response = await api.get<{ success: boolean; data: any }>('/startup/status');
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch startup status:', error);
      return {
        success: false,
        data: null
      };
    }
  }

  /**
   * Get error logging health
   */
  async getErrorLoggingHealth(): Promise<{ success: boolean; data: any }> {
    try {
      const response = await api.get<{ success: boolean; data: any }>('/error-logging-health/status');
      return response.data;
    } catch (error: any) {
      console.error('Failed to fetch error logging health:', error);
      return {
        success: false,
        data: null
      };
    }
  }

  /**
   * Force restart symbol initialization
   */
  async restartSymbolInit(): Promise<{ success: boolean; message: string }> {
    try {
      const response = await api.post<{ success: boolean; message: string }>('/startup/force-restart-symbol-init');
      return response.data;
    } catch (error: any) {
      console.error('Failed to restart symbol init:', error);
      return {
        success: false,
        message: 'Failed to restart symbol initialization'
      };
    }
  }

  /**
   * Run system diagnostics
   */
  async runDiagnostics(): Promise<{ success: boolean; data: any }> {
    try {
      // Run multiple health checks in parallel
      const [health, performance, database, cache] = await Promise.all([
        this.getSystemHealth(),
        this.getPerformanceMetrics(),
        this.getDatabaseHealth(),
        this.getCacheStats()
      ]);

      return {
        success: true,
        data: {
          health: health.data,
          performance: performance.data,
          database: database.data,
          cache: cache.data,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error: any) {
      console.error('Failed to run diagnostics:', error);
      return {
        success: false,
        data: null
      };
    }
  }
}

export const systemHealthService = new SystemHealthService();
