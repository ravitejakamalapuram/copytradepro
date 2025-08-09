import React, { useMemo } from 'react';
import Card, { CardHeader, CardContent } from '../ui/Card';
import { Stack, Grid, Flex } from '../ui/Layout';
import Button from '../ui/Button';
import type { ErrorAnalytics as ErrorAnalyticsType } from '../../types/errorTypes';
import './ErrorAnalytics.css';

export interface ErrorAnalyticsProps {
  analytics: ErrorAnalyticsType;
  timeRange: string;
  loading: boolean;
  onRefresh: () => void;
}

const ErrorAnalytics: React.FC<ErrorAnalyticsProps> = ({
  analytics,
  timeRange,
  loading,
  onRefresh
}) => {
  // Calculate insights and trends
  const insights = useMemo(() => {
    const totalErrors = analytics.totalErrors;
    const criticalRate = totalErrors > 0 ? (analytics.criticalErrors / totalErrors) * 100 : 0;
    const resolutionRate = totalErrors > 0 ? (analytics.resolvedErrors / totalErrors) * 100 : 0;
    
    // Find most problematic component
    const topComponent = Object.entries(analytics.errorsByComponent)
      .sort(([,a], [,b]) => b - a)[0];
    
    // Find most common error type
    const topErrorType = Object.entries(analytics.errorsByType)
      .sort(([,a], [,b]) => b - a)[0];
    
    // Calculate trend direction from hourly data
    const recentHours = analytics.errorTrends.hourly.slice(-6);
    const earlierHours = analytics.errorTrends.hourly.slice(-12, -6);
    const recentAvg = recentHours.reduce((a, b) => a + b, 0) / recentHours.length;
    const earlierAvg = earlierHours.reduce((a, b) => a + b, 0) / earlierHours.length;
    const trendDirection = recentAvg > earlierAvg ? 'increasing' : recentAvg < earlierAvg ? 'decreasing' : 'stable';
    
    return {
      criticalRate,
      resolutionRate,
      topComponent,
      topErrorType,
      trendDirection,
      recentAvg,
      earlierAvg
    };
  }, [analytics]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const formatPercentage = (num: number): string => {
    return `${num.toFixed(1)}%`;
  };

  const getTrendIcon = (direction: string): string => {
    switch (direction) {
      case 'increasing': return '📈';
      case 'decreasing': return '📉';
      default: return '➡️';
    }
  };

  const getTrendColor = (direction: string): string => {
    switch (direction) {
      case 'increasing': return 'var(--color-loss)';
      case 'decreasing': return 'var(--color-profit)';
      default: return 'var(--color-neutral)';
    }
  };

  const renderBarChart = (data: Record<string, number>, title: string, maxItems = 10) => {
    const sortedData = Object.entries(data)
      .sort(([,a], [,b]) => b - a)
      .slice(0, maxItems);
    
    const maxValue = Math.max(...sortedData.map(([,value]) => value));
    
    return (
      <div className="bar-chart">
        <h4 className="chart-title">{title}</h4>
        <div className="chart-bars">
          {sortedData.map(([key, value]) => (
            <div key={key} className="bar-item">
              <div className="bar-label">
                <span className="bar-name">{key}</span>
                <span className="bar-value">{formatNumber(value)}</span>
              </div>
              <div className="bar-container">
                <div 
                  className="bar-fill"
                  style={{ 
                    width: `${(value / maxValue) * 100}%`,
                    backgroundColor: 'var(--interactive-primary)'
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderTrendChart = (data: number[], title: string) => {
    const maxValue = Math.max(...data, 1);
    const minValue = Math.min(...data, 0);
    const range = maxValue - minValue || 1;
    
    return (
      <div className="trend-chart">
        <h4 className="chart-title">{title}</h4>
        <div className="trend-container">
          <svg className="trend-svg" viewBox="0 0 300 100">
            {/* Grid lines */}
            {[0, 25, 50, 75, 100].map(y => (
              <line
                key={y}
                x1="0"
                y1={y}
                x2="300"
                y2={y}
                stroke="var(--border-secondary)"
                strokeWidth="0.5"
              />
            ))}
            
            {/* Data line */}
            <polyline
              points={data.map((value, index) => {
                const x = (index / (data.length - 1)) * 300;
                const y = 100 - ((value - minValue) / range) * 100;
                return `${x},${y}`;
              }).join(' ')}
              fill="none"
              stroke="var(--interactive-primary)"
              strokeWidth="2"
            />
            
            {/* Data points */}
            {data.map((value, index) => {
              const x = (index / (data.length - 1)) * 300;
              const y = 100 - ((value - minValue) / range) * 100;
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="3"
                  fill="var(--interactive-primary)"
                />
              );
            })}
          </svg>
          <div className="trend-labels">
            <span className="trend-label-start">
              {data.length > 0 ? formatNumber(data[0]) : '0'}
            </span>
            <span className="trend-label-end">
              {data.length > 0 ? formatNumber(data[data.length - 1]) : '0'}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderPieChart = (data: Record<string, number>, title: string) => {
    const total = Object.values(data).reduce((sum, value) => sum + value, 0);
    if (total === 0) return null;
    
    const sortedData = Object.entries(data)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 6); // Show top 6 categories
    
    const colors = [
      'var(--color-loss)',
      'var(--color-neutral)',
      'var(--color-profit)',
      'var(--interactive-primary)',
      'var(--text-secondary)',
      'var(--border-primary)'
    ];
    
    let currentAngle = 0;
    
    return (
      <div className="pie-chart">
        <h4 className="chart-title">{title}</h4>
        <div className="pie-container">
          <svg className="pie-svg" viewBox="0 0 200 200">
            {sortedData.map(([key, value], index) => {
              const angle = (value / total) * 360;
              const startAngle = currentAngle;
              const endAngle = currentAngle + angle;
              
              const x1 = 100 + 80 * Math.cos((startAngle - 90) * Math.PI / 180);
              const y1 = 100 + 80 * Math.sin((startAngle - 90) * Math.PI / 180);
              const x2 = 100 + 80 * Math.cos((endAngle - 90) * Math.PI / 180);
              const y2 = 100 + 80 * Math.sin((endAngle - 90) * Math.PI / 180);
              
              const largeArcFlag = angle > 180 ? 1 : 0;
              
              const pathData = [
                `M 100 100`,
                `L ${x1} ${y1}`,
                `A 80 80 0 ${largeArcFlag} 1 ${x2} ${y2}`,
                'Z'
              ].join(' ');
              
              currentAngle += angle;
              
              return (
                <path
                  key={key}
                  d={pathData}
                  fill={colors[index % colors.length]}
                  stroke="var(--bg-primary)"
                  strokeWidth="2"
                />
              );
            })}
          </svg>
          
          <div className="pie-legend">
            {sortedData.map(([key, value], index) => (
              <div key={key} className="legend-item">
                <div 
                  className="legend-color"
                  style={{ backgroundColor: colors[index % colors.length] }}
                />
                <span className="legend-label">{key}</span>
                <span className="legend-value">
                  {formatNumber(value)} ({formatPercentage((value / total) * 100)})
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="error-analytics">
      <Stack gap={4}>
        {/* Analytics Header */}
        <Flex justify="between" align="center">
          <div>
            <h2 className="analytics-title">Error Analytics & Insights</h2>
            <p className="analytics-subtitle">
              Comprehensive analysis of error patterns and trends over the last {timeRange}
            </p>
          </div>
          <Button variant="outline" onClick={onRefresh} disabled={loading}>
            🔄 {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Flex>

        {/* Key Insights */}
        <Card>
          <CardHeader title="Key Insights" />
          <CardContent>
            <Grid cols={2} gap={4}>
              <div className="insight-card">
                <div className="insight-header">
                  <span className="insight-icon">🎯</span>
                  <h4>Error Trend</h4>
                </div>
                <div className="insight-content">
                  <div className="insight-value" style={{ color: getTrendColor(insights.trendDirection) }}>
                    {getTrendIcon(insights.trendDirection)} {insights.trendDirection.toUpperCase()}
                  </div>
                  <div className="insight-description">
                    Recent average: {formatNumber(insights.recentAvg)} errors/hour
                    {insights.trendDirection !== 'stable' && (
                      <span> vs {formatNumber(insights.earlierAvg)} previously</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="insight-card">
                <div className="insight-header">
                  <span className="insight-icon">⚠️</span>
                  <h4>Critical Error Rate</h4>
                </div>
                <div className="insight-content">
                  <div className="insight-value critical">
                    {formatPercentage(insights.criticalRate)}
                  </div>
                  <div className="insight-description">
                    {analytics.criticalErrors} critical errors out of {analytics.totalErrors} total
                  </div>
                </div>
              </div>

              <div className="insight-card">
                <div className="insight-header">
                  <span className="insight-icon">✅</span>
                  <h4>Resolution Rate</h4>
                </div>
                <div className="insight-content">
                  <div className="insight-value success">
                    {formatPercentage(insights.resolutionRate)}
                  </div>
                  <div className="insight-description">
                    {analytics.resolvedErrors} errors resolved, {analytics.unresolvedErrors} pending
                  </div>
                </div>
              </div>

              <div className="insight-card">
                <div className="insight-header">
                  <span className="insight-icon">🔧</span>
                  <h4>Top Problem Area</h4>
                </div>
                <div className="insight-content">
                  <div className="insight-value">
                    {insights.topComponent?.[0] || 'N/A'}
                  </div>
                  <div className="insight-description">
                    {insights.topComponent?.[1] ? formatNumber(insights.topComponent[1]) : '0'} errors
                    {insights.topErrorType && (
                      <span> • Most common: {insights.topErrorType[0]}</span>
                    )}
                  </div>
                </div>
              </div>
            </Grid>
          </CardContent>
        </Card>

        {/* Charts Grid */}
        <Grid cols={2} gap={4}>
          {/* Error Trends */}
          <Card>
            <CardHeader title="Error Trends" />
            <CardContent>
              <Stack gap={3}>
                {renderTrendChart(analytics.errorTrends.hourly, 'Hourly Errors (Last 24 Hours)')}
                {renderTrendChart(analytics.errorTrends.daily, 'Daily Errors (Last 30 Days)')}
              </Stack>
            </CardContent>
          </Card>

          {/* Distribution Charts */}
          <Card>
            <CardHeader title="Error Distribution" />
            <CardContent>
              <Stack gap={3}>
                {renderPieChart(analytics.errorsBySource, 'Errors by Source')}
                {renderPieChart(analytics.severityDistribution, 'Errors by Severity')}
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Detailed Breakdowns */}
        <Grid cols={2} gap={4}>
          <Card>
            <CardHeader title="Component Analysis" />
            <CardContent>
              {renderBarChart(analytics.errorsByComponent, 'Errors by Component', 8)}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Error Type Analysis" />
            <CardContent>
              {renderBarChart(analytics.errorsByType, 'Errors by Type', 8)}
            </CardContent>
          </Card>
        </Grid>

        {/* Additional Insights */}
        {(Object.keys(analytics.errorsByBroker).length > 0 || Object.keys(analytics.errorsByUser).length > 0) && (
          <Grid cols={2} gap={4}>
            {Object.keys(analytics.errorsByBroker).length > 0 && (
              <Card>
                <CardHeader title="Broker Analysis" />
                <CardContent>
                  {renderBarChart(analytics.errorsByBroker, 'Errors by Broker', 6)}
                </CardContent>
              </Card>
            )}

            {Object.keys(analytics.errorsByUser).length > 0 && (
              <Card>
                <CardHeader title="User Impact Analysis" />
                <CardContent>
                  {renderBarChart(analytics.errorsByUser, 'Top Affected Users', 6)}
                </CardContent>
              </Card>
            )}
          </Grid>
        )}

        {/* System Health Score */}
        <Card>
          <CardHeader title="System Health Overview" />
          <CardContent>
            <div className="health-overview">
              <div className="health-score">
                <div className="health-score-circle">
                  <svg viewBox="0 0 100 100" className="health-circle-svg">
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="var(--border-secondary)"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50"
                      cy="50"
                      r="45"
                      fill="none"
                      stroke="var(--color-profit)"
                      strokeWidth="8"
                      strokeDasharray={`${2 * Math.PI * 45}`}
                      strokeDashoffset={`${2 * Math.PI * 45 * (1 - (100 - insights.criticalRate) / 100)}`}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="health-score-text">
                    <div className="health-score-value">
                      {formatPercentage(100 - insights.criticalRate)}
                    </div>
                    <div className="health-score-label">Health Score</div>
                  </div>
                </div>
              </div>
              
              <div className="health-details">
                <h4>System Status</h4>
                <div className="health-metrics">
                  <div className="health-metric">
                    <span className="health-metric-label">Error Rate:</span>
                    <span className="health-metric-value">
                      {formatPercentage(insights.criticalRate)}
                    </span>
                  </div>
                  <div className="health-metric">
                    <span className="health-metric-label">Resolution Rate:</span>
                    <span className="health-metric-value success">
                      {formatPercentage(insights.resolutionRate)}
                    </span>
                  </div>
                  <div className="health-metric">
                    <span className="health-metric-label">Trend:</span>
                    <span 
                      className="health-metric-value"
                      style={{ color: getTrendColor(insights.trendDirection) }}
                    >
                      {getTrendIcon(insights.trendDirection)} {insights.trendDirection}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </Stack>
    </div>
  );
};

export default ErrorAnalytics;