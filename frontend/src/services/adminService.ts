import { authService } from './authService';

export interface SystemMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  memory: {
    used: number;
    total: number;
    percentage: number;
    heapUsed: number;
    heapTotal: number;
  };
  uptime: number;
  activeConnections: number;
  errorRate: number;
  responseTime: {
    average: number;
    p95: number;
    p99: number;
  };
}

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'debug' | 'info' | 'warn' | 'error' | 'critical';
  message: string;
  context: {
    component?: string;
    userId?: string;
    operation?: string;
    requestId?: string;
    [key: string]: any;
  };
  data?: any;
  error?: any;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'USER' | 'ADMIN' | 'MODERATOR';
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING';
  lastLogin?: string;
  createdAt: string;
  totalTrades?: number;
  portfolioValue?: number;
}

export interface Alert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface BrokerStatus {
  name: string;
  status: 'CONNECTED' | 'DISCONNECTED' | 'ERROR';
  lastSync: string;
  totalAccounts: number;
  activeConnections: number;
}

class AdminService {
  private baseURL = `${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}`;

  private async makeRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = authService.getToken();
    
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // System Monitoring APIs
  async getSystemMetrics(): Promise<{ success: boolean; data: SystemMetrics[] }> {
    return this.makeRequest('/monitoring/metrics');
  }

  async getSystemHealth(): Promise<{
    success: boolean;
    data: {
      status: 'healthy' | 'degraded' | 'unhealthy';
      metrics: SystemMetrics | null;
      activeAlerts: Alert[];
      summary: string;
    };
  }> {
    return this.makeRequest('/monitoring/health/detailed');
  }

  async getDashboardData(): Promise<{
    success: boolean;
    data: {
      systemHealth: {
        status: 'healthy' | 'degraded' | 'unhealthy';
        metrics: SystemMetrics | null;
        activeAlerts: Alert[];
        summary: string;
      };
      recentMetrics: SystemMetrics[];
      errorSummary: Array<{
        timestamp: string;
        errorType: string;
        count: number;
        lastOccurrence: string;
        severity: string;
        component: string;
      }>;
      uptime: number;
    };
  }> {
    return this.makeRequest('/monitoring/dashboard');
  }

  async getSLAMetrics(timeWindow?: number): Promise<{
    success: boolean;
    data: {
      uptime: number;
      availability: number;
      averageResponseTime: number;
      errorRate: number;
      successRate: number;
      timeWindow: number;
      timeWindowHours: number;
    };
  }> {
    const params = timeWindow ? `?timeWindow=${timeWindow}` : '';
    return this.makeRequest(`/monitoring/sla${params}`);
  }

  async getErrorSummary(): Promise<{
    success: boolean;
    data: {
      errors: Array<{
        timestamp: string;
        errorType: string;
        count: number;
        lastOccurrence: string;
        severity: string;
        component: string;
      }>;
      activeAlerts: Alert[];
    };
  }> {
    return this.makeRequest('/monitoring/errors');
  }

  async resolveAlert(alertId: string): Promise<{ success: boolean; message: string }> {
    return this.makeRequest(`/monitoring/alerts/${alertId}/resolve`, {
      method: 'POST',
    });
  }

  // Logging APIs
  async getLogs(_level?: string, _limit?: number): Promise<{
    success: boolean;
    data: LogEntry[];
  }> {
    // The logs endpoint only accepts POST requests for sending logs
    // There's no GET endpoint to retrieve logs yet
    return { success: true, data: [] };
  }

  async getSystemLogs(_limit: number = 100): Promise<{
    success: boolean;
    data: LogEntry[];
  }> {
    try {
      // Get error summary which contains log-like data
      const response = await this.makeRequest('/monitoring/errors');
      if ((response as any).success && (response as any).data.errors) {
        // Transform error summary into log entries
        const logEntries: LogEntry[] = (response as any).data.errors.map((error: any) => ({
          id: `error_${error.timestamp}_${Math.random().toString(36).substr(2, 9)}`,
          timestamp: error.lastOccurrence,
          level: error.severity === 'critical' ? 'error' : 
                 error.severity === 'high' ? 'warn' : 'info',
          message: `${error.errorType} (${error.count} occurrences)`,
          context: {
            component: error.component,
            errorType: error.errorType,
            count: error.count
          }
        }));
        
        return { success: true, data: logEntries };
      }
      return { success: true, data: [] };
    } catch (error) {
      return { success: true, data: [] };
    }
  }

  // User Management APIs - Not implemented in backend yet
  async getUsers(): Promise<{ success: boolean; data: User[] }> {
    // This endpoint doesn't exist yet - return empty array
    return { success: true, data: [] };
  }

  async getUserDetails(_userId: string): Promise<{ success: boolean; data: User & { 
    phone?: string;
    kycStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
    riskProfile: 'LOW' | 'MEDIUM' | 'HIGH';
    connectedBrokers: string[];
    totalPnL: number;
  } }> {
    // User management endpoints not implemented yet
    throw new Error('User management endpoints not implemented in backend');
  }

  async updateUserStatus(_userId: string, _status: 'ACTIVE' | 'SUSPENDED'): Promise<{ success: boolean; message: string }> {
    // User management endpoints not implemented yet
    throw new Error('User management endpoints not implemented in backend');
  }

  async updateUserRole(_userId: string, _role: 'USER' | 'ADMIN' | 'MODERATOR'): Promise<{ success: boolean; message: string }> {
    // User management endpoints not implemented yet
    throw new Error('User management endpoints not implemented in backend');
  }

  async deleteUser(_userId: string): Promise<{ success: boolean; message: string }> {
    // User management endpoints not implemented yet
    throw new Error('User management endpoints not implemented in backend');
  }

  async getUserActivity(_userId: string): Promise<{
    success: boolean;
    data: Array<{
      id: string;
      type: 'LOGIN' | 'TRADE' | 'DEPOSIT' | 'WITHDRAWAL' | 'SETTINGS_CHANGE';
      description: string;
      timestamp: string;
      ipAddress?: string;
      device?: string;
    }>;
  }> {
    // User management endpoints not implemented yet
    throw new Error('User management endpoints not implemented in backend');
  }

  // Broker Status APIs
  async getBrokerStatuses(): Promise<{ success: boolean; data: BrokerStatus[] }> {
    // Use existing broker health endpoint
    try {
      const response = await this.makeRequest('/broker/session-health');
      // Transform the response to match our interface
      const brokerData = (response as any).data || {};
      const statuses: BrokerStatus[] = Object.entries(brokerData).map(([name, data]: [string, unknown]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        status: data.connected ? 'CONNECTED' : 'DISCONNECTED',
        lastSync: data.lastSync || new Date().toISOString(),
        totalAccounts: data.totalAccounts || 0,
        activeConnections: data.activeConnections || 0
      }));

      return {
        success: true,
        data: statuses
      };
    } catch (error) {
      return { success: true, data: [] };
    }
  }

  // System Actions - Not implemented in backend yet
  async restartServices(): Promise<{ success: boolean; message: string }> {
    throw new Error('System admin endpoints not implemented in backend');
  }

  async createSystemBackup(): Promise<{ success: boolean; message: string }> {
    throw new Error('System admin endpoints not implemented in backend');
  }

  async generateSystemReport(): Promise<{ success: boolean; data: { reportUrl: string } }> {
    throw new Error('System admin endpoints not implemented in backend');
  }

  async clearSystemCache(): Promise<{ success: boolean; message: string }> {
    throw new Error('System admin endpoints not implemented in backend');
  }

  async getAdminActivity(_limit: number = 50): Promise<{
    success: boolean;
    data: Array<{
      id: string;
      timestamp: string;
      adminId: string;
      adminName: string;
      action: string;
      target: string;
      status: 'SUCCESS' | 'FAILED';
      details?: string;
    }>;
  }> {
    // Admin activity endpoints not implemented yet
    return { success: true, data: [] };
  }

  // Broker Management APIs - Not implemented in backend yet
  async reconnectBroker(_brokerName: string): Promise<{ success: boolean; message: string }> {
    throw new Error('Broker admin endpoints not implemented in backend');
  }

  async updateBrokerSettings(_brokerName: string, _settings: unknown): Promise<{ success: boolean; message: string }> {
    throw new Error('Broker admin endpoints not implemented in backend');
  }

  async getBrokerLogs(_brokerName: string, _limit: number = 50): Promise<{
    success: boolean;
    data: LogEntry[];
  }> {
    throw new Error('Broker admin endpoints not implemented in backend');
  }
}

export const adminService = new AdminService();