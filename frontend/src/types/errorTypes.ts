// Error Log Entry Interface
export interface ErrorLogEntry {
  id: string;
  traceId: string;
  timestamp: Date;
  level: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG';
  source: 'UI' | 'BE' | 'DB' | 'API';
  component: string;
  operation: string;
  message: string;
  errorType: string;
  stackTrace?: string;
  context: {
    requestId?: string;
    userId?: string;
    sessionId?: string;
    userAgent?: string;
    ipAddress?: string;
    brokerName?: string;
    accountId?: string;
    url?: string;
    method?: string;
    statusCode?: number;
    duration?: number;
    retryCount?: number;
  };
  metadata: {
    environment: string;
    version: string;
    nodeVersion: string;
    platform: string;
  };
  relatedErrors?: string[];
  resolved?: boolean;
  resolvedAt?: Date;
  resolvedBy?: string;
  resolution?: string;
}

// Error Analytics Interface
export interface ErrorAnalytics {
  totalErrors: number;
  errorsByType: Record<string, number>;
  errorsByComponent: Record<string, number>;
  errorsBySource: Record<string, number>;
  errorsByCategory: Record<string, number>;
  errorsByBroker: Record<string, number>;
  errorsByUser: Record<string, number>;
  severityDistribution: Record<string, number>;
  errorsByTimeRange: Array<{ timestamp: Date; count: number }>;
  topErrors: Array<{ message: string; count: number; lastOccurred: Date }>;
  errorTrends: {
    hourly: number[];
    daily: number[];
    weekly: number[];
  };
  criticalErrors: number;
  resolvedErrors: number;
  unresolvedErrors: number;
}

// Error Search Filters Interface
export interface ErrorSearchFilters {
  traceId?: string;
  level?: string[];
  source?: string[];
  component?: string[];
  errorType?: string[];
  userId?: string;
  brokerName?: string;
  resolved?: boolean;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

// Trace Lifecycle Interface
export interface TraceLifecycle {
  traceId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'SUCCESS' | 'ERROR' | 'PENDING';
  operations: Array<{
    operation: string;
    component: string;
    startTime: Date;
    endTime?: Date;
    status: 'SUCCESS' | 'ERROR' | 'PENDING';
    metadata?: any;
  }>;
  errorCount: number;
  warningCount: number;
}

// Error Patterns Interface
export interface ErrorPatterns {
  recurringErrors: Array<{
    pattern: string;
    count: number;
    firstSeen: Date;
    lastSeen: Date;
    affectedComponents: string[];
    suggestedFix: string;
  }>;
  errorSpikes: Array<{
    timestamp: Date;
    errorCount: number;
    primaryCause: string;
    affectedSystems: string[];
  }>;
  correlatedErrors: Array<{
    traceId: string;
    errorChain: Array<{
      component: string;
      operation: string;
      timestamp: Date;
      message: string;
    }>;
  }>;
}

// Error Insights Interface
export interface ErrorInsights {
  criticalIssues: Array<{
    title: string;
    description: string;
    impact: string;
    recommendedActions: string[];
    priority: 'low' | 'medium' | 'high' | 'critical';
  }>;
  performanceImpacts: Array<{
    component: string;
    avgErrorRate: number;
    impactOnUserExperience: string;
    optimizationSuggestions: string[];
  }>;
  systemHealthScore: {
    overall: number;
    breakdown: {
      trading: number;
      authentication: number;
      data: number;
      network: number;
      ui: number;
    };
  };
}

// API Response Interfaces
export interface ErrorSearchResponse {
  success: boolean;
  data: {
    errors: ErrorLogEntry[];
    total: number;
    hasMore: boolean;
  };
  message?: string;
}

export interface ErrorAnalyticsResponse {
  success: boolean;
  data: ErrorAnalytics;
  message?: string;
}

export interface TraceLifecycleResponse {
  success: boolean;
  data: TraceLifecycle;
  message?: string;
}

export interface ErrorPatternsResponse {
  success: boolean;
  data: ErrorPatterns;
  message?: string;
}

export interface ErrorInsightsResponse {
  success: boolean;
  data: ErrorInsights;
  message?: string;
}

export interface ErrorResolveResponse {
  success: boolean;
  message: string;
}

// Error Classification Types
export const ErrorCategory = {
  AUTHENTICATION: 'AUTHENTICATION',
  AUTHORIZATION: 'AUTHORIZATION',
  VALIDATION: 'VALIDATION',
  BROKER_API: 'BROKER_API',
  DATABASE: 'DATABASE',
  NETWORK: 'NETWORK',
  BUSINESS_LOGIC: 'BUSINESS_LOGIC',
  SYSTEM: 'SYSTEM',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE'
} as const;

export type ErrorCategory = typeof ErrorCategory[keyof typeof ErrorCategory];

export const ErrorSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
} as const;

export type ErrorSeverity = typeof ErrorSeverity[keyof typeof ErrorSeverity];

export interface ErrorClassification {
  category: ErrorCategory;
  severity: ErrorSeverity;
  isRetryable: boolean;
  requiresUserAction: boolean;
  affectsTrading: boolean;
}

// Frontend Error Capture Interface
export interface FrontendErrorEntry {
  id: string;
  traceId: string;
  timestamp: Date;
  source: 'UI';
  errorType: 'JAVASCRIPT' | 'REACT' | 'API' | 'NETWORK' | 'VALIDATION';
  message: string;
  stackTrace?: string;
  componentStack?: string;
  context: {
    url: string;
    userAgent: string;
    userId?: string;
    sessionId?: string;
    component?: string;
    props?: any;
    state?: any;
    userActions?: Array<{
      action: string;
      timestamp: Date;
      element?: string;
    }>;
  };
  browserInfo: {
    name: string;
    version: string;
    platform: string;
    language: string;
    cookieEnabled: boolean;
    onLine: boolean;
  };
}

// Error Dashboard Props
export interface ErrorDashboardFilters {
  level?: string[];
  source?: string[];
  component?: string[];
  errorType?: string[];
}

// Saved Search Interface
export interface SavedSearch {
  id: string;
  name: string;
  description?: string;
  filters: ErrorSearchFilters;
  createdAt: Date;
  updatedAt: Date;
  userId: string;
}

// Error Export Options
export interface ErrorExportOptions {
  format: 'json' | 'csv' | 'xlsx';
  filters: ErrorSearchFilters;
  includeStackTrace: boolean;
  includeContext: boolean;
  includeMetadata: boolean;
}