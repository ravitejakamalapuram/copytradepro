import React, { useState, useEffect } from 'react';
import Card, { CardHeader, CardContent } from '../ui/Card';
import { Stack, Grid, Flex } from '../ui/Layout';
import Button from '../ui/Button';
import { useToast } from '../Toast';
import ErrorList from './ErrorList';
import ErrorDetail from './ErrorDetail';
import ErrorAnalytics from './ErrorAnalytics';
import { errorService } from '../../services/errorService';
import type { ErrorLogEntry, ErrorAnalytics as ErrorAnalyticsType, ErrorSearchFilters } from '../../types/errorTypes';
import './ErrorDashboard.css';

export interface ErrorDashboardProps {
  timeRange?: 'hour' | 'day' | 'week' | 'month';
  filters?: {
    level?: string[];
    source?: string[];
    component?: string[];
    errorType?: string[];
  };
}

const ErrorDashboard: React.FC<ErrorDashboardProps> = ({
  timeRange = 'day',
  filters = {}
}) => {
  const { showToast } = useToast();
  
  // State management
  const [activeTab, setActiveTab] = useState<'overview' | 'errors' | 'analytics'>('overview');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  
  // Data state
  const [errorAnalytics, setErrorAnalytics] = useState<ErrorAnalyticsType | null>(null);
  const [recentErrors, setRecentErrors] = useState<ErrorLogEntry[]>([]);
  const [selectedError, setSelectedError] = useState<ErrorLogEntry | null>(null);
  const [totalErrors, setTotalErrors] = useState(0);
  
  // Filter state
  const [searchFilters, setSearchFilters] = useState<ErrorSearchFilters>({
    level: filters.level,
    source: filters.source,
    component: filters.component,
    errorType: filters.errorType,
    limit: 50,
    offset: 0
  });

  // Load dashboard data
  const loadDashboardData = async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true);
      setRefreshing(true);

      const timeWindowMs = getTimeWindowMs(timeRange);
      
      const [analyticsResponse, errorsResponse] = await Promise.all([
        errorService.getErrorAnalytics(timeWindowMs),
        errorService.searchErrors(searchFilters)
      ]);

      if (analyticsResponse.success) {
        setErrorAnalytics(analyticsResponse.data);
      }

      if (errorsResponse.success) {
        setRecentErrors(errorsResponse.data.errors);
        setTotalErrors(errorsResponse.data.total);
      }

      setLastRefresh(new Date());
    } catch (error) {
      console.error('Failed to load error dashboard data:', error);
      showToast({
        type: 'error',
        title: 'Failed to load error data',
        message: 'Please try refreshing the page'
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Auto-refresh effect
  useEffect(() => {
    loadDashboardData();

    const refreshInterval = setInterval(() => {
      if (autoRefresh) {
        loadDashboardData(false);
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [timeRange, searchFilters, autoRefresh]);

  // Helper functions
  const getTimeWindowMs = (range: string): number => {
    const windows = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000
    };
    return windows[range as keyof typeof windows] || windows.day;
  };

  const handleRefresh = async () => {
    await loadDashboardData();
    showToast({
      type: 'success',
      title: 'Data refreshed',
      message: 'Error dashboard data has been updated'
    });
  };

  const handleErrorSelect = (error: ErrorLogEntry) => {
    setSelectedError(error);
    setActiveTab('errors');
  };

  const handleFilterChange = (newFilters: Partial<ErrorSearchFilters>) => {
    setSearchFilters(prev => ({
      ...prev,
      ...newFilters,
      offset: 0 // Reset pagination
    }));
  };

  const getSeverityColor = (level: string): string => {
    const colors = {
      ERROR: 'var(--color-loss)',
      WARN: 'var(--color-neutral)',
      INFO: 'var(--color-profit)',
      DEBUG: 'var(--text-secondary)'
    };
    return colors[level as keyof typeof colors] || 'var(--text-primary)';
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <div className="error-dashboard">
      <Stack gap={6}>
        {/* Header */}
        <Flex justify="between" align="center">
          <div>
            <h1 className="error-dashboard__title">
              🚨 Error Management Dashboard
            </h1>
            <p className="error-dashboard__subtitle">
              Monitor and analyze system errors across all components
            </p>
            <div className="error-dashboard__status">
              Last updated: {lastRefresh.toLocaleTimeString()} •
              <span className={`status-indicator ${autoRefresh ? 'active' : 'inactive'}`}>
                {autoRefresh ? '🟢 Auto-refresh ON' : '🟡 Auto-refresh OFF'}
              </span>
            </div>
          </div>
          
          <Flex gap={2}>
            <Button
              variant="outline"
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={autoRefresh ? 'auto-refresh-active' : 'auto-refresh-inactive'}
            >
              {autoRefresh ? '⏸️ Pause' : '▶️ Resume'} Auto-refresh
            </Button>
            <Button
              variant="primary"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              🔄 {refreshing ? 'Refreshing...' : 'Refresh'}
            </Button>
          </Flex>
        </Flex>

        {/* Tab Navigation */}
        <div className="error-dashboard__tabs">
          {[
            { key: 'overview', label: 'Overview', icon: '📊' },
            { key: 'errors', label: 'Error Logs', icon: '📋' },
            { key: 'analytics', label: 'Analytics', icon: '📈' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Overview Tab */}
        {activeTab === 'overview' && (
          <Stack gap={4}>
            {/* Key Metrics */}
            <Grid cols={4} gap={4}>
              <Card className="metric-card">
                <CardContent className="metric-content">
                  <div className="metric-icon">🚨</div>
                  <div className="metric-value">
                    {formatNumber(errorAnalytics?.totalErrors || 0)}
                  </div>
                  <div className="metric-label">Total Errors</div>
                  <div className="metric-change">
                    Last {timeRange}
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-card">
                <CardContent className="metric-content">
                  <div className="metric-icon">💥</div>
                  <div className="metric-value critical">
                    {formatNumber(errorAnalytics?.criticalErrors || 0)}
                  </div>
                  <div className="metric-label">Critical Errors</div>
                  <div className="metric-change critical">
                    Requires attention
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-card">
                <CardContent className="metric-content">
                  <div className="metric-icon">✅</div>
                  <div className="metric-value success">
                    {formatNumber(errorAnalytics?.resolvedErrors || 0)}
                  </div>
                  <div className="metric-label">Resolved</div>
                  <div className="metric-change success">
                    {errorAnalytics?.totalErrors ? 
                      `${Math.round((errorAnalytics.resolvedErrors / errorAnalytics.totalErrors) * 100)}% resolved` : 
                      '0% resolved'
                    }
                  </div>
                </CardContent>
              </Card>

              <Card className="metric-card">
                <CardContent className="metric-content">
                  <div className="metric-icon">⏳</div>
                  <div className="metric-value warning">
                    {formatNumber(errorAnalytics?.unresolvedErrors || 0)}
                  </div>
                  <div className="metric-label">Unresolved</div>
                  <div className="metric-change warning">
                    Needs attention
                  </div>
                </CardContent>
              </Card>
            </Grid>

            {/* Error Distribution */}
            <Grid cols={2} gap={4}>
              <Card>
                <CardHeader title="Errors by Source" />
                <CardContent>
                  <div className="distribution-chart">
                    {errorAnalytics?.errorsBySource && Object.entries(errorAnalytics.errorsBySource).map(([source, count]) => (
                      <div key={source} className="distribution-item">
                        <div className="distribution-label">
                          <span className="source-badge" data-source={source.toLowerCase()}>
                            {source}
                          </span>
                          <span className="distribution-count">{count}</span>
                        </div>
                        <div className="distribution-bar">
                          <div 
                            className="distribution-fill"
                            style={{ 
                              width: `${(count / errorAnalytics.totalErrors) * 100}%`,
                              backgroundColor: getSeverityColor(source)
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader title="Top Error Components" />
                <CardContent>
                  <div className="top-components">
                    {errorAnalytics?.errorsByComponent && Object.entries(errorAnalytics.errorsByComponent)
                      .sort(([,a], [,b]) => b - a)
                      .slice(0, 5)
                      .map(([component, count]) => (
                        <div key={component} className="component-item">
                          <div className="component-info">
                            <span className="component-name">{component}</span>
                            <span className="component-count">{count} errors</span>
                          </div>
                          <div className="component-bar">
                            <div 
                              className="component-fill"
                              style={{ 
                                width: `${(count / errorAnalytics.totalErrors) * 100}%`
                              }}
                            />
                          </div>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            </Grid>

            {/* Recent Critical Errors */}
            <Card>
              <CardHeader 
                title="Recent Critical Errors" 
                action={
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => setActiveTab('errors')}
                  >
                    View All →
                  </Button>
                }
              />
              <CardContent>
                <div className="recent-errors">
                  {recentErrors
                    .filter(error => error.level === 'ERROR')
                    .slice(0, 5)
                    .map(error => (
                      <div 
                        key={error.id} 
                        className="recent-error-item"
                        onClick={() => handleErrorSelect(error)}
                      >
                        <div className="error-indicator critical" />
                        <div className="error-info">
                          <div className="error-message">{error.message}</div>
                          <div className="error-meta">
                            {error.component} • {new Date(error.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <div className="error-actions">
                          <Button variant="ghost" size="sm">
                            View Details →
                          </Button>
                        </div>
                      </div>
                    ))}
                  
                  {recentErrors.filter(error => error.level === 'ERROR').length === 0 && (
                    <div className="no-errors">
                      <div className="no-errors-icon">✅</div>
                      <div className="no-errors-text">No critical errors in the selected time range</div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Stack>
        )}

        {/* Error Logs Tab */}
        {activeTab === 'errors' && (
          <ErrorList
            errors={recentErrors}
            totalErrors={totalErrors}
            loading={loading}
            filters={searchFilters}
            selectedError={selectedError}
            onErrorSelect={handleErrorSelect}
            onFiltersChange={handleFilterChange}
            onRefresh={() => loadDashboardData()}
          />
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && errorAnalytics && (
          <ErrorAnalytics
            analytics={errorAnalytics}
            timeRange={timeRange}
            loading={loading}
            onRefresh={() => loadDashboardData()}
          />
        )}

        {/* Error Detail Modal */}
        {selectedError && (
          <ErrorDetail
            error={selectedError}
            onClose={() => setSelectedError(null)}
            onResolve={(errorId, resolution) => {
              // Handle error resolution
              console.log('Resolving error:', errorId, resolution);
              setSelectedError(null);
              loadDashboardData(false);
            }}
          />
        )}
      </Stack>
    </div>
  );
};

export default ErrorDashboard;