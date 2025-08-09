import { authService } from './authService';
import type {
  ErrorLogEntry,
  ErrorSearchFilters,
  ErrorSearchResponse,
  ErrorAnalyticsResponse,
  TraceLifecycleResponse,
  ErrorPatternsResponse,
  ErrorInsightsResponse,
  ErrorResolveResponse,
  FrontendErrorEntry,
  SavedSearch,
  ErrorExportOptions
} from '../types/errorTypes';

class ErrorService {
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

  // Error Search and Retrieval
  async searchErrors(filters: ErrorSearchFilters): Promise<ErrorSearchResponse> {
    const queryParams = new URLSearchParams();
    
    if (filters.traceId) queryParams.append('traceId', filters.traceId);
    if (filters.level) filters.level.forEach(level => queryParams.append('level', level));
    if (filters.source) filters.source.forEach(source => queryParams.append('source', source));
    if (filters.component) filters.component.forEach(component => queryParams.append('component', component));
    if (filters.errorType) filters.errorType.forEach(type => queryParams.append('errorType', type));
    if (filters.userId) queryParams.append('userId', filters.userId);
    if (filters.brokerName) queryParams.append('brokerName', filters.brokerName);
    if (filters.resolved !== undefined) queryParams.append('resolved', filters.resolved.toString());
    if (filters.startDate) queryParams.append('startDate', filters.startDate.toISOString());
    if (filters.endDate) queryParams.append('endDate', filters.endDate.toISOString());
    if (filters.limit) queryParams.append('limit', filters.limit.toString());
    if (filters.offset) queryParams.append('offset', filters.offset.toString());

    return this.makeRequest(`/admin/errors/search?${queryParams.toString()}`);
  }

  async getErrorById(errorId: string): Promise<{ success: boolean; data: ErrorLogEntry }> {
    return this.makeRequest(`/admin/errors/${errorId}`);
  }

  async getRelatedErrors(traceId: string): Promise<{ success: boolean; data: ErrorLogEntry[] }> {
    return this.makeRequest(`/admin/errors/trace/${traceId}/related`);
  }

  // Error Analytics
  async getErrorAnalytics(timeWindow: number = 86400000): Promise<ErrorAnalyticsResponse> {
    return this.makeRequest(`/admin/errors/analytics?timeWindow=${timeWindow}`);
  }

  async getErrorPatterns(timeWindow: number = 86400000): Promise<ErrorPatternsResponse> {
    return this.makeRequest(`/admin/errors/patterns?timeWindow=${timeWindow}`);
  }

  async getErrorInsights(timeWindow: number = 86400000): Promise<ErrorInsightsResponse> {
    return this.makeRequest(`/admin/errors/insights?timeWindow=${timeWindow}`);
  }

  // Trace Lifecycle
  async getTraceLifecycle(traceId: string): Promise<TraceLifecycleResponse> {
    return this.makeRequest(`/admin/traces/${traceId}/lifecycle`);
  }

  async getTraceOperations(traceId: string): Promise<{
    success: boolean;
    data: Array<{
      operation: string;
      component: string;
      startTime: Date;
      endTime?: Date;
      status: 'SUCCESS' | 'ERROR' | 'PENDING';
      metadata?: unknown;
    }>;
  }> {
    return this.makeRequest(`/admin/traces/${traceId}/operations`);
  }

  // Error Resolution
  async resolveError(errorId: string, resolution: string): Promise<ErrorResolveResponse> {
    return this.makeRequest(`/admin/errors/${errorId}/resolve`, {
      method: 'PATCH',
      body: JSON.stringify({ resolution })
    });
  }

  async unresolveError(errorId: string): Promise<ErrorResolveResponse> {
    return this.makeRequest(`/admin/errors/${errorId}/unresolve`, {
      method: 'PATCH'
    });
  }

  async bulkResolveErrors(errorIds: string[], resolution: string): Promise<ErrorResolveResponse> {
    return this.makeRequest('/admin/errors/bulk-resolve', {
      method: 'PATCH',
      body: JSON.stringify({ errorIds, resolution })
    });
  }

  // Frontend Error Reporting
  async reportFrontendError(error: Omit<FrontendErrorEntry, 'id' | 'timestamp'>): Promise<{
    success: boolean;
    errorId: string;
  }> {
    return this.makeRequest('/errors/report', {
      method: 'POST',
      body: JSON.stringify({
        ...error,
        timestamp: new Date().toISOString()
      })
    });
  }

  // Saved Searches
  async getSavedSearches(): Promise<{ success: boolean; data: SavedSearch[] }> {
    return this.makeRequest('/admin/errors/saved-searches');
  }

  async createSavedSearch(search: Omit<SavedSearch, 'id' | 'createdAt' | 'updatedAt' | 'userId'>): Promise<{
    success: boolean;
    data: SavedSearch;
  }> {
    return this.makeRequest('/admin/errors/saved-searches', {
      method: 'POST',
      body: JSON.stringify(search)
    });
  }

  async updateSavedSearch(searchId: string, updates: Partial<SavedSearch>): Promise<{
    success: boolean;
    data: SavedSearch;
  }> {
    return this.makeRequest(`/admin/errors/saved-searches/${searchId}`, {
      method: 'PATCH',
      body: JSON.stringify(updates)
    });
  }

  async deleteSavedSearch(searchId: string): Promise<{ success: boolean }> {
    return this.makeRequest(`/admin/errors/saved-searches/${searchId}`, {
      method: 'DELETE'
    });
  }

  // Error Export
  async exportErrors(options: ErrorExportOptions): Promise<Blob> {
    const queryParams = new URLSearchParams();
    
    // Add filter parameters
    if (options.filters.traceId) queryParams.append('traceId', options.filters.traceId);
    if (options.filters.level) options.filters.level.forEach(level => queryParams.append('level', level));
    if (options.filters.source) options.filters.source.forEach(source => queryParams.append('source', source));
    if (options.filters.component) options.filters.component.forEach(component => queryParams.append('component', component));
    if (options.filters.errorType) options.filters.errorType.forEach(type => queryParams.append('errorType', type));
    if (options.filters.userId) queryParams.append('userId', options.filters.userId);
    if (options.filters.brokerName) queryParams.append('brokerName', options.filters.brokerName);
    if (options.filters.resolved !== undefined) queryParams.append('resolved', options.filters.resolved.toString());
    if (options.filters.startDate) queryParams.append('startDate', options.filters.startDate.toISOString());
    if (options.filters.endDate) queryParams.append('endDate', options.filters.endDate.toISOString());
    
    // Add export options
    queryParams.append('format', options.format);
    queryParams.append('includeStackTrace', options.includeStackTrace.toString());
    queryParams.append('includeContext', options.includeContext.toString());
    queryParams.append('includeMetadata', options.includeMetadata.toString());

    const token = authService.getToken();
    const response = await fetch(`${this.baseURL}/admin/errors/export?${queryParams.toString()}`, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`Export failed: ${response.statusText}`);
    }

    return response.blob();
  }

  // Error Statistics
  async getErrorStats(timeRange: 'hour' | 'day' | 'week' | 'month' = 'day'): Promise<{
    success: boolean;
    data: {
      totalErrors: number;
      criticalErrors: number;
      resolvedErrors: number;
      errorRate: number;
      topComponents: Array<{ component: string; count: number }>;
      recentTrend: 'increasing' | 'decreasing' | 'stable';
    };
  }> {
    return this.makeRequest(`/admin/errors/stats?timeRange=${timeRange}`);
  }

  // Real-time Error Monitoring
  async getRealtimeErrors(limit: number = 10): Promise<{
    success: boolean;
    data: ErrorLogEntry[];
  }> {
    return this.makeRequest(`/admin/errors/realtime?limit=${limit}`);
  }

  // Error Aggregation
  async getErrorAggregation(
    groupBy: 'component' | 'errorType' | 'source' | 'broker' | 'user',
    timeWindow: number = 86400000
  ): Promise<{
    success: boolean;
    data: Record<string, number>;
  }> {
    return this.makeRequest(`/admin/errors/aggregation?groupBy=${groupBy}&timeWindow=${timeWindow}`);
  }

  // Error Trends
  async getErrorTrends(
    period: 'hourly' | 'daily' | 'weekly',
    duration: number = 24
  ): Promise<{
    success: boolean;
    data: Array<{ timestamp: Date; count: number }>;
  }> {
    return this.makeRequest(`/admin/errors/trends?period=${period}&duration=${duration}`);
  }

  // Component Health
  async getComponentHealth(): Promise<{
    success: boolean;
    data: Array<{
      component: string;
      errorCount: number;
      errorRate: number;
      lastError?: Date;
      healthScore: number;
      status: 'healthy' | 'warning' | 'critical';
    }>;
  }> {
    return this.makeRequest('/admin/errors/component-health');
  }

  // Error Correlation
  async getErrorCorrelation(errorId: string): Promise<{
    success: boolean;
    data: {
      relatedErrors: ErrorLogEntry[];
      commonPatterns: string[];
      suggestedActions: string[];
    };
  }> {
    return this.makeRequest(`/admin/errors/${errorId}/correlation`);
  }

  // Utility Methods
  generateTraceId(): string {
    return `trace_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  formatErrorForDisplay(error: ErrorLogEntry): {
    title: string;
    subtitle: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    timestamp: string;
  } {
    const severity = error.level === 'ERROR' ? 'critical' : 
                    error.level === 'WARN' ? 'medium' : 'low';
    
    return {
      title: error.message,
      subtitle: `${error.component} • ${error.operation}`,
      severity,
      timestamp: new Date(error.timestamp).toLocaleString()
    };
  }

  getErrorSeverityColor(level: string): string {
    const colors = {
      ERROR: '#ef4444',
      WARN: '#f59e0b',
      INFO: '#10b981',
      DEBUG: '#6b7280'
    };
    return colors[level as keyof typeof colors] || '#6b7280';
  }

  isErrorCritical(error: ErrorLogEntry): boolean {
    return error.level === 'ERROR' || 
           error.errorType.includes('CRITICAL') ||
           error.context.statusCode === 500 ||
           error.component.includes('TRADING') ||
           error.component.includes('BROKER');
  }

  shouldRetryError(error: ErrorLogEntry): boolean {
    const retryableTypes = [
      'NETWORK_ERROR',
      'TIMEOUT_ERROR',
      'RATE_LIMIT_ERROR',
      'TEMPORARY_ERROR'
    ];
    
    return retryableTypes.some(type => error.errorType.includes(type)) &&
           (error.context.retryCount || 0) < 3;
  }
}

export const errorService = new ErrorService();