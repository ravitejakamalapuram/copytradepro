/**
 * Monitoring Dashboard
 * Production monitoring and system health dashboard
 */

import React, { useState, useEffect } from 'react';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorDisplay } from '../components/ErrorDisplay';
import './MonitoringDashboard.css';

interface SystemMetrics {
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

interface Alert {
  id: string;
  ruleId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
}

interface ErrorSummary {
  timestamp: string;
  errorType: string;
  count: number;
  lastOccurrence: string;
  severity: string;
  component: string;
}

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  metrics: SystemMetrics | null;
  activeAlerts: Alert[];
  summary: string;
}

interface DashboardData {
  systemHealth: HealthStatus;
  recentMetrics: SystemMetrics[];
  errorSummary: ErrorSummary[];
  brokerHealth: any;
  uptime: number;
}

interface SLAMetrics {
  uptime: number;
  availability: number;
  averageResponseTime: number;
  errorRate: number;
  successRate: number;
  timeWindow: number;
  timeWindowHours: number;
}

export const MonitoringDashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [slaMetrics, setSlaMetrics] = useState<SLAMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchDashboardData = async () => {
    try {
      const [dashboardResponse, slaResponse] = await Promise.all([
        fetch('/api/monitoring/dashboard', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }),
        fetch('/api/monitoring/sla?timeWindow=3600000', {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        })
      ]);

      if (!dashboardResponse.ok || !slaResponse.ok) {
        throw new Error('Failed to fetch monitoring data');
      }

      const dashboardResult = await dashboardResponse.json();
      const slaResult = await slaResponse.json();

      if (dashboardResult.success) {
        setDashboardData(dashboardResult.data);
      }

      if (slaResult.success) {
        setSlaMetrics(slaResult.data);
      }

      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch monitoring data');
    } finally {
      setLoading(false);
    }
  };

  const resolveAlert = async (alertId: string) => {
    try {
      const response = await fetch(`/api/monitoring/alerts/${alertId}/resolve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (response.ok) {
        // Refresh dashboard data
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Failed to resolve alert:', err);
    }
  };

  useEffect(() => {
    fetchDashboardData();

    if (autoRefresh) {
      const interval = setInterval(fetchDashboardData, 30000); // Refresh every 30 seconds
      setRefreshInterval(interval);
    }

    return () => {
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
    };
  }, [autoRefresh]);

  const formatBytes = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'healthy': return 'success';
      case 'degraded': return 'warning';
      case 'unhealthy': return 'error';
      default: return 'default';
    }
  };

  const getSeverityColor = (severity: string): string => {
    switch (severity) {
      case 'critical': return 'error';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'default';
    }
  };

  if (loading) {
    return (
      <div className="monitoring-dashboard">
        <div className="dashboard-header">
          <h1>System Monitoring</h1>
        </div>
        <div className="loading-container">
          <LoadingSpinner />
          <p>Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="monitoring-dashboard">
        <div className="dashboard-header">
          <h1>System Monitoring</h1>
        </div>
        <ErrorDisplay 
          message={error}
          onRetry={fetchDashboardData}
        />
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="monitoring-dashboard">
        <div className="dashboard-header">
          <h1>System Monitoring</h1>
        </div>
        <p>No monitoring data available</p>
      </div>
    );
  }

  const { systemHealth, recentMetrics, errorSummary, uptime } = dashboardData;
  const currentMetrics = systemHealth.metrics;

  return (
    <div className="monitoring-dashboard">
      <div className="dashboard-header">
        <h1>System Monitoring</h1>
        <div className="dashboard-controls">
          <Button
            variant={autoRefresh ? 'primary' : 'secondary'}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            {autoRefresh ? 'Auto Refresh: ON' : 'Auto Refresh: OFF'}
          </Button>
          <Button onClick={fetchDashboardData}>
            Refresh Now
          </Button>
        </div>
      </div>

      {/* System Health Overview */}
      <div className="dashboard-section">
        <h2>System Health</h2>
        <div className="health-overview">
          <Card className="health-status-card">
            <div className="health-status">
              <Badge variant={getStatusColor(systemHealth.status)}>
                {systemHealth.status.toUpperCase()}
              </Badge>
              <p>{systemHealth.summary}</p>
              <div className="uptime">
                <strong>Uptime:</strong> {formatUptime(uptime)}
              </div>
            </div>
          </Card>

          {slaMetrics && (
            <Card className="sla-metrics-card">
              <h3>SLA Metrics (Last Hour)</h3>
              <div className="sla-grid">
                <div className="sla-metric">
                  <span className="metric-label">Availability</span>
                  <span className="metric-value">{slaMetrics.availability.toFixed(2)}%</span>
                </div>
                <div className="sla-metric">
                  <span className="metric-label">Success Rate</span>
                  <span className="metric-value">{slaMetrics.successRate.toFixed(2)}%</span>
                </div>
                <div className="sla-metric">
                  <span className="metric-label">Avg Response</span>
                  <span className="metric-value">{slaMetrics.averageResponseTime.toFixed(0)}ms</span>
                </div>
                <div className="sla-metric">
                  <span className="metric-label">Error Rate</span>
                  <span className="metric-value">{slaMetrics.errorRate.toFixed(2)}%</span>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* Current System Metrics */}
      {currentMetrics && (
        <div className="dashboard-section">
          <h2>Current System Metrics</h2>
          <div className="metrics-grid">
            <Card className="metric-card">
              <h3>Memory Usage</h3>
              <div className="metric-value-large">
                {currentMetrics.memory.percentage.toFixed(1)}%
              </div>
              <div className="metric-details">
                <p>Used: {formatBytes(currentMetrics.memory.used)}</p>
                <p>Total: {formatBytes(currentMetrics.memory.total)}</p>
                <p>Heap: {formatBytes(currentMetrics.memory.heapUsed)} / {formatBytes(currentMetrics.memory.heapTotal)}</p>
              </div>
            </Card>

            <Card className="metric-card">
              <h3>Response Time</h3>
              <div className="metric-value-large">
                {currentMetrics.responseTime.average.toFixed(0)}ms
              </div>
              <div className="metric-details">
                <p>95th percentile: {currentMetrics.responseTime.p95.toFixed(0)}ms</p>
                <p>99th percentile: {currentMetrics.responseTime.p99.toFixed(0)}ms</p>
              </div>
            </Card>

            <Card className="metric-card">
              <h3>Error Rate</h3>
              <div className="metric-value-large">
                {currentMetrics.errorRate.toFixed(1)}%
              </div>
              <div className="metric-details">
                <p>Active Connections: {currentMetrics.activeConnections}</p>
              </div>
            </Card>

            <Card className="metric-card">
              <h3>CPU Load</h3>
              <div className="metric-value-large">
                {currentMetrics.cpu.loadAverage[0].toFixed(2)}
              </div>
              <div className="metric-details">
                <p>1min: {currentMetrics.cpu.loadAverage[0].toFixed(2)}</p>
                <p>5min: {currentMetrics.cpu.loadAverage[1].toFixed(2)}</p>
                <p>15min: {currentMetrics.cpu.loadAverage[2].toFixed(2)}</p>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Active Alerts */}
      {systemHealth.activeAlerts.length > 0 && (
        <div className="dashboard-section">
          <h2>Active Alerts ({systemHealth.activeAlerts.length})</h2>
          <div className="alerts-list">
            {systemHealth.activeAlerts.map((alert) => (
              <Card key={alert.id} className="alert-card">
                <div className="alert-header">
                  <Badge variant={getSeverityColor(alert.severity)}>
                    {alert.severity.toUpperCase()}
                  </Badge>
                  <span className="alert-timestamp">
                    {new Date(alert.timestamp).toLocaleString()}
                  </span>
                </div>
                <div className="alert-message">{alert.message}</div>
                <div className="alert-actions">
                  <Button
                    size="small"
                    onClick={() => resolveAlert(alert.id)}
                  >
                    Resolve
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Error Summary */}
      {errorSummary.length > 0 && (
        <div className="dashboard-section">
          <h2>Recent Errors</h2>
          <div className="errors-list">
            {errorSummary.slice(0, 10).map((error, index) => (
              <Card key={index} className="error-card">
                <div className="error-header">
                  <span className="error-type">{error.errorType}</span>
                  <Badge variant={getSeverityColor(error.severity)}>
                    {error.severity}
                  </Badge>
                </div>
                <div className="error-details">
                  <p><strong>Component:</strong> {error.component}</p>
                  <p><strong>Count:</strong> {error.count}</p>
                  <p><strong>Last Occurrence:</strong> {new Date(error.lastOccurrence).toLocaleString()}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* System Status Footer */}
      <div className="dashboard-footer">
        <p>Last updated: {new Date().toLocaleString()}</p>
        <p>Monitoring data refreshes every 30 seconds</p>
      </div>
    </div>
  );
};