import React, { useState, useEffect } from 'react';
import AppNavigation from '../components/AppNavigation';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Grid, Stack } from '../components/ui/Layout';
import { useToast } from '../components/Toast';
import { systemHealthService, type SystemHealthData } from '../services/systemHealthService';
import '../styles/app-theme.css';

const AdminSystemHealth: React.FC = () => {
  const { showToast } = useToast();
  const [healthData, setHealthData] = useState<SystemHealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const loadHealthMetrics = async () => {
    setLoading(true);
    try {
      const response = await systemHealthService.getSystemHealth();

      if (response.success) {
        setHealthData(response.data);
        setLastUpdated(new Date());
        showToast({
          type: 'success',
          title: 'Health metrics updated',
          message: 'System health data refreshed successfully'
        });
      } else {
        showToast({
          type: 'error',
          title: 'Failed to load health metrics',
          message: 'Unable to fetch system health data'
        });
      }
    } catch (error) {
      console.error('Failed to load health metrics:', error);
      showToast({
        type: 'error',
        title: 'Error loading health metrics',
        message: 'An error occurred while fetching system health data'
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHealthMetrics();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadHealthMetrics, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy':
        return 'var(--color-profit)';
      case 'warning':
        return 'var(--color-neutral)';
      case 'critical':
        return 'var(--color-loss)';
      default:
        return 'var(--text-secondary)';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy':
        return '✅';
      case 'warning':
        return '⚠️';
      case 'critical':
        return '❌';
      default:
        return '❓';
    }
  };

  const refreshMetrics = async () => {
    await loadHealthMetrics();
  };

  const runDiagnostics = async () => {
    setActionLoading('diagnostics');
    try {
      const response = await systemHealthService.runDiagnostics();

      if (response.success) {
        showToast({
          type: 'success',
          title: 'Diagnostics completed',
          message: 'System diagnostics completed successfully'
        });
        await loadHealthMetrics(); // Refresh data after diagnostics
      } else {
        showToast({
          type: 'error',
          title: 'Diagnostics failed',
          message: 'Unable to complete system diagnostics'
        });
      }
    } catch (error) {
      console.error('Failed to run diagnostics:', error);
      showToast({
        type: 'error',
        title: 'Error running diagnostics',
        message: 'An error occurred while running system diagnostics'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const clearCache = async () => {
    setActionLoading('cache');
    try {
      const response = await systemHealthService.clearCache('all');

      if (response.success) {
        showToast({
          type: 'success',
          title: 'Cache cleared',
          message: response.message || 'System cache cleared successfully'
        });
        await loadHealthMetrics(); // Refresh data after cache clear
      } else {
        showToast({
          type: 'error',
          title: 'Failed to clear cache',
          message: response.message || 'Unable to clear system cache'
        });
      }
    } catch (error) {
      console.error('Failed to clear cache:', error);
      showToast({
        type: 'error',
        title: 'Error clearing cache',
        message: 'An error occurred while clearing cache'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const restartSymbolInit = async () => {
    setActionLoading('restart');
    try {
      const response = await systemHealthService.restartSymbolInit();

      if (response.success) {
        showToast({
          type: 'success',
          title: 'Symbol initialization restarted',
          message: response.message || 'Symbol initialization restarted successfully'
        });
        await loadHealthMetrics(); // Refresh data after restart
      } else {
        showToast({
          type: 'error',
          title: 'Failed to restart symbol initialization',
          message: response.message || 'Unable to restart symbol initialization'
        });
      }
    } catch (error) {
      console.error('Failed to restart symbol init:', error);
      showToast({
        type: 'error',
        title: 'Error restarting symbol initialization',
        message: 'An error occurred while restarting symbol initialization'
      });
    } finally {
      setActionLoading(null);
    }
  };

  const overallHealth = healthData?.overall || 'critical';

  return (
    <div className="app-theme app-layout">
      <AppNavigation />

      <div className="app-main">
        <div style={{ 
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <div>
            <h1 style={{ 
              fontSize: '2rem',
              fontWeight: '600',
              color: 'var(--text-primary)',
              marginBottom: '0.5rem'
            }}>
              System Health
            </h1>
            <p style={{
              color: 'var(--text-secondary)',
              fontSize: '1rem',
              marginBottom: '0.5rem'
            }}>
              Monitor system performance and health metrics
            </p>
            {healthData && (
              <div style={{
                display: 'flex',
                gap: '1rem',
                fontSize: '0.875rem',
                color: 'var(--text-muted)'
              }}>
                <span>
                  Uptime: {Math.floor((healthData.uptime || 0) / 3600)}h {Math.floor(((healthData.uptime || 0) % 3600) / 60)}m
                </span>
                <span>•</span>
                <span>
                  Last updated: {lastUpdated.toLocaleTimeString()}
                </span>
              </div>
            )}
          </div>
          
          <Button 
            onClick={loadHealthMetrics}
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>

        <Stack gap={6}>
          {/* Active Alerts */}
          {healthData?.alerts && healthData.alerts.length > 0 && (
            <Card>
              <CardHeader>
                <h2 style={{
                  fontSize: '1.25rem',
                  fontWeight: '500',
                  color: 'var(--color-loss)',
                  margin: 0
                }}>
                  ⚠️ Active Alerts ({healthData.alerts.length})
                </h2>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {healthData.alerts.slice(0, 5).map((alert, index) => (
                    <div
                      key={alert.id || index}
                      style={{
                        padding: '0.75rem',
                        borderRadius: '6px',
                        backgroundColor: alert.severity === 'critical' ? 'rgba(239, 68, 68, 0.1)' :
                                       alert.severity === 'high' ? 'rgba(245, 101, 101, 0.1)' :
                                       alert.severity === 'medium' ? 'rgba(251, 191, 36, 0.1)' :
                                       'rgba(156, 163, 175, 0.1)',
                        border: `1px solid ${alert.severity === 'critical' ? 'rgba(239, 68, 68, 0.3)' :
                                            alert.severity === 'high' ? 'rgba(245, 101, 101, 0.3)' :
                                            alert.severity === 'medium' ? 'rgba(251, 191, 36, 0.3)' :
                                            'rgba(156, 163, 175, 0.3)'}`
                      }}
                    >
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        gap: '0.5rem'
                      }}>
                        <div style={{ flex: 1 }}>
                          <div style={{
                            fontSize: '0.875rem',
                            fontWeight: '500',
                            color: 'var(--text-primary)',
                            marginBottom: '0.25rem'
                          }}>
                            {alert.message}
                          </div>
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-muted)'
                          }}>
                            {new Date(alert.timestamp).toLocaleString()}
                          </div>
                        </div>
                        <span style={{
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          color: alert.severity === 'critical' ? 'var(--color-loss)' :
                                 alert.severity === 'high' ? 'var(--color-loss)' :
                                 alert.severity === 'medium' ? 'var(--color-neutral)' :
                                 'var(--text-secondary)',
                          textTransform: 'uppercase'
                        }}>
                          {alert.severity}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Overall Health Status */}
          <Card>
            <CardContent>
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '1rem',
                padding: '2rem'
              }}>
                <div style={{ fontSize: '3rem' }}>
                  {getStatusIcon(overallHealth)}
                </div>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ 
                    fontSize: '1.5rem',
                    fontWeight: '600',
                    color: getStatusColor(overallHealth),
                    marginBottom: '0.5rem'
                  }}>
                    System {overallHealth.charAt(0).toUpperCase() + overallHealth.slice(1)}
                  </div>
                  <div style={{ 
                    color: 'var(--text-secondary)',
                    fontSize: '0.875rem'
                  }}>
                    Last updated: {lastUpdated.toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Health Metrics Grid */}
          <div>
            <h2 style={{ 
              fontSize: '1.25rem',
              fontWeight: '500',
              color: 'var(--text-primary)',
              marginBottom: '1rem'
            }}>
              Health Metrics
            </h2>
            
            {loading ? (
              <div style={{ 
                display: 'flex', 
                justifyContent: 'center', 
                alignItems: 'center', 
                height: '200px',
                color: 'var(--text-secondary)'
              }}>
                Loading health metrics...
              </div>
            ) : (
              <Grid cols={2} gap={4}>
                {(healthData?.metrics || []).map((metric, index) => (
                  <Card key={index}>
                    <CardContent>
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '1rem'
                      }}>
                        <div style={{ fontSize: '1.5rem' }}>
                          {getStatusIcon(metric.status)}
                        </div>
                        <div style={{ flex: 1 }}>
                          <div style={{ 
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '0.5rem'
                          }}>
                            <h3 style={{ 
                              fontSize: '1rem',
                              fontWeight: '500',
                              color: 'var(--text-primary)',
                              margin: 0
                            }}>
                              {metric.name}
                            </h3>
                            <div style={{ 
                              fontSize: '1.25rem',
                              fontWeight: '600',
                              color: getStatusColor(metric.status)
                            }}>
                              {metric.value}
                            </div>
                          </div>
                          <p style={{ 
                            fontSize: '0.875rem',
                            color: 'var(--text-secondary)',
                            margin: 0
                          }}>
                            {metric.description}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </Grid>
            )}
          </div>

          {/* System Actions */}
          <Card>
            <CardHeader>
              <h2 style={{ 
                fontSize: '1.25rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                margin: 0
              }}>
                System Actions
              </h2>
            </CardHeader>
            <CardContent>
              <div style={{
                display: 'flex',
                gap: '1rem',
                flexWrap: 'wrap'
              }}>
                <Button
                  variant="outline"
                  onClick={clearCache}
                  disabled={actionLoading === 'cache'}
                >
                  {actionLoading === 'cache' ? 'Clearing...' : 'Clear Cache'}
                </Button>
                <Button
                  variant="outline"
                  onClick={restartSymbolInit}
                  disabled={actionLoading === 'restart'}
                >
                  {actionLoading === 'restart' ? 'Restarting...' : 'Restart Symbol Init'}
                </Button>
                <Button
                  variant="outline"
                  onClick={runDiagnostics}
                  disabled={actionLoading === 'diagnostics'}
                >
                  {actionLoading === 'diagnostics' ? 'Running...' : 'Run Diagnostics'}
                </Button>
                <Button
                  variant="outline"
                  onClick={refreshMetrics}
                  disabled={loading}
                >
                  {loading ? 'Refreshing...' : 'Refresh Metrics'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </Stack>
      </div>
    </div>
  );
};

export default AdminSystemHealth;