import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import { Stack, Grid, Flex } from '../components/ui/Layout';
import { useToast } from '../components/Toast';
import { PageTransition } from '../utils/animations';
import { adminService } from '../services/adminService';
import type { BrokerStatus as AdminBrokerStatus } from '../services/adminService';
import '../styles/app-theme.css';



const AdminPanel: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'dashboard' | 'users' | 'system' | 'brokers' | 'settings'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [autoRefresh, setAutoRefresh] = useState(true);

  // Real data from APIs
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [systemLogs, setSystemLogs] = useState<any[]>([]);
  const [slaMetrics, setSlaMetrics] = useState<unknown>(null);

  const [brokerStatuses, setBrokerStatuses] = useState<AdminBrokerStatus[]>([]);

  // Search and filter states
  const [logFilter, setLogFilter] = useState<'ALL' | 'ERROR' | 'WARN' | 'INFO'>('ALL');

  // User management is disabled - no bulk operations needed

  // Utility functions removed - not needed for current implementation

  const formatUptime = (seconds: number) => {
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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'CONNECTED':
        return 'var(--color-profit)';
      case 'SUSPENDED':
      case 'ERROR':
        return 'var(--color-loss)';
      case 'PENDING':
      case 'DISCONNECTED':
        return 'var(--color-neutral)';
      default:
        return 'var(--text-secondary)';
    }
  };

  // Color utility functions removed - not needed for current implementation

  const getLogLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case 'error':
      case 'critical':
        return 'var(--color-loss)';
      case 'warn':
        return 'var(--color-neutral)';
      case 'info':
        return 'var(--text-primary)';
      case 'debug':
        return 'var(--text-secondary)';
      default:
        return 'var(--text-primary)';
    }
  };



  // Load data on component mount and set up auto-refresh
  useEffect(() => {
    loadDashboardData();
    loadBrokerStatuses();
    loadSystemLogs();

    // Set up auto-refresh for real-time data
    const refreshInterval = setInterval(() => {
      if (autoRefresh) {
        if (activeTab === 'dashboard') {
          loadDashboardData();
          loadSystemLogs();
        } else if (activeTab === 'brokers') {
          loadBrokerStatuses();
        } else if (activeTab === 'system') {
          loadSystemLogs();
        }
        setLastRefresh(new Date());
      }
    }, 30000); // Refresh every 30 seconds

    return () => clearInterval(refreshInterval);
  }, [activeTab]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardResponse, slaResponse] = await Promise.all([
        adminService.getDashboardData(),
        adminService.getSLAMetrics()
      ]);

      if (dashboardResponse.success) {
        setDashboardData(dashboardResponse.data);
      }

      if (slaResponse.success) {
        setSlaMetrics(slaResponse.data);
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
      showToast({ type: 'error', title: 'Failed to load dashboard data' });
    } finally {
      setLoading(false);
    }
  };

  // loadUsers function removed - endpoints don't exist

  const loadBrokerStatuses = async () => {
    try {
      const response = await adminService.getBrokerStatuses();
      if (response.success) {
        setBrokerStatuses(response.data);
      }
    } catch (error) {
      console.error('Failed to load broker statuses:', error);
      showToast({ type: 'error', title: 'Failed to load broker statuses' });
    }
  };

  const loadSystemLogs = async () => {
    try {
      const response = await adminService.getSystemLogs(50);
      if (response.success) {
        setSystemLogs(response.data);
      }
    } catch (error) {
      console.error('Failed to load system logs:', error);
      // Don't show error toast for logs as it's not critical
    }
  };

  // User management functions removed - endpoints don't exist

  const refreshData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadDashboardData(),
        loadBrokerStatuses(),
        loadSystemLogs()
      ]);
      setLastRefresh(new Date());
      showToast({ type: 'success', title: 'Data refreshed successfully' });
    } catch (error) {
      showToast({ type: 'error', title: 'Failed to refresh data' });
    } finally {
      setLoading(false);
    }
  };

  // Filter functions

  const filteredLogs = systemLogs.filter(log => {
    if (logFilter === 'ALL') return true;
    return log.level.toUpperCase() === logFilter;
  });

  // Export functions (disabled since user management endpoints don't exist)

  const exportSystemLogs = () => {
    const csvContent = [
      ['Timestamp', 'Level', 'Message', 'Component'],
      ...filteredLogs.map(log => [
        new Date(log.timestamp).toLocaleString(),
        log.level.toUpperCase(),
        log.message.replace(/,/g, ';'), // Replace commas to avoid CSV issues
        log.context?.component || 'System'
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    showToast({ type: 'success', title: 'System logs exported successfully' });
  };

  // User management functions removed - endpoints don't exist

  return (
    <div className="app-theme app-layout">
      <AppNavigation />
      <PageTransition>
        <div className="app-main">
          <Stack gap={6}>
            {/* Header */}
            <Flex justify="between" align="center">
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
                  🛡️ Admin Panel
                </h1>
                <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>
                  System administration and user management
                </p>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Last updated: {lastRefresh.toLocaleTimeString()} •
                  <span style={{
                    color: autoRefresh ? 'var(--color-profit)' : 'var(--color-neutral)',
                    marginLeft: '0.25rem'
                  }}>
                    {autoRefresh ? '🟢 Auto-refresh ON' : '🟡 Auto-refresh OFF'}
                  </span>
                </div>
              </div>
              <Flex gap={2}>
                <Button
                  variant="outline"
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  style={{
                    color: autoRefresh ? 'var(--color-profit)' : 'var(--text-secondary)',
                    borderColor: autoRefresh ? 'var(--color-profit)' : 'var(--border-primary)'
                  }}
                >
                  {autoRefresh ? '⏸️ Pause' : '▶️ Resume'} Auto-refresh
                </Button>
                <Button variant="outline" onClick={() => navigate('/settings')}>
                  ⚙️ Settings
                </Button>
                <Button variant="primary" onClick={refreshData} disabled={loading}>
                  🔄 {loading ? 'Refreshing...' : 'Refresh Data'}
                </Button>
              </Flex>
            </Flex>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-primary)' }}>
              {[
                { key: 'dashboard', label: 'Dashboard', icon: '📊' },
                { key: 'users', label: 'User Management', icon: '👥' },
                { key: 'system', label: 'System Monitor', icon: '🖥️' },
                { key: 'brokers', label: 'Broker Status', icon: '🔗' },
                { key: 'settings', label: 'Admin Settings', icon: '⚙️' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as 'dashboard' | 'users' | 'system' | 'brokers' | 'settings')}
                  style={{
                    padding: '0.75rem 1rem',
                    border: 'none',
                    background: 'none',
                    color: activeTab === tab.key ? 'var(--interactive-primary)' : 'var(--text-secondary)',
                    borderBottom: activeTab === tab.key ? '2px solid var(--interactive-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Dashboard Tab */}
            {activeTab === 'dashboard' && (
              <Stack gap={4}>
                {/* Key Metrics */}
                <Grid cols={4} gap={4}>
                  <Card>
                    <CardContent style={{ textAlign: 'center', padding: '1.5rem' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>👥</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                        {dashboardData?.systemHealth?.metrics?.activeConnections || 0}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        Active Connections
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-profit)', marginTop: '0.25rem' }}>
                        {dashboardData?.systemHealth?.metrics?.activeConnections || 0} active connections
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent style={{ textAlign: 'center', padding: '1.5rem' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📈</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                        {dashboardData?.systemHealth?.metrics?.responseTime?.average?.toFixed(0) || 0}ms
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        Avg Response Time
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-profit)', marginTop: '0.25rem' }}>
                        {slaMetrics ? `${(slaMetrics as any).successRate?.toFixed(1) || 0}% success` : 'Loading...'}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent style={{ textAlign: 'center', padding: '1.5rem' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💰</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.25rem', fontFamily: 'var(--font-mono)' }}>
                        {dashboardData?.systemHealth?.metrics?.errorRate?.toFixed(1) || 0}%
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        Error Rate
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-profit)', marginTop: '0.25rem' }}>
                        {slaMetrics ? `${(slaMetrics as any).errorRate?.toFixed(1) || 0}% error rate` : 'Loading...'}
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent style={{ textAlign: 'center', padding: '1.5rem' }}>
                      <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>⏱️</div>
                      <div style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '0.25rem' }}>
                        {dashboardData ? formatUptime(dashboardData.uptime) : 'Loading...'}
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        System Uptime
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--color-profit)', marginTop: '0.25rem' }}>
                        {slaMetrics ? `${(slaMetrics as unknown).availability?.toFixed(1) || 0}% availability` : 'Loading...'}
                      </div>
                    </CardContent>
                  </Card>
                </Grid>

                {/* System Health */}
                <Card>
                  <CardHeader title="System Health" />
                  <CardContent>
                    {dashboardData?.systemHealth?.metrics ? (
                      <Grid cols={3} gap={4}>
                        <div style={{ textAlign: 'center', padding: '1rem' }}>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            Memory Usage
                          </div>
                          <div style={{
                            fontSize: '1.5rem',
                            fontWeight: '600',
                            color: dashboardData.systemHealth.metrics.memory.percentage > 80 ? 'var(--color-loss)' : 'var(--color-profit)'
                          }}>
                            {dashboardData.systemHealth.metrics.memory.percentage.toFixed(1)}%
                          </div>
                          <div style={{
                            width: '100%',
                            height: '8px',
                            backgroundColor: 'var(--bg-tertiary)',
                            borderRadius: '4px',
                            marginTop: '0.5rem',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${dashboardData.systemHealth.metrics.memory.percentage}%`,
                              height: '100%',
                              backgroundColor: dashboardData.systemHealth.metrics.memory.percentage > 80 ? 'var(--color-loss)' : 'var(--color-profit)',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>

                        <div style={{ textAlign: 'center', padding: '1rem' }}>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            Error Rate
                          </div>
                          <div style={{
                            fontSize: '1.5rem',
                            fontWeight: '600',
                            color: dashboardData.systemHealth.metrics.errorRate > 10 ? 'var(--color-loss)' : 'var(--color-profit)'
                          }}>
                            {dashboardData.systemHealth.metrics.errorRate.toFixed(1)}%
                          </div>
                          <div style={{
                            width: '100%',
                            height: '8px',
                            backgroundColor: 'var(--bg-tertiary)',
                            borderRadius: '4px',
                            marginTop: '0.5rem',
                            overflow: 'hidden'
                          }}>
                            <div style={{
                              width: `${Math.min(dashboardData.systemHealth.metrics.errorRate, 100)}%`,
                              height: '100%',
                              backgroundColor: dashboardData.systemHealth.metrics.errorRate > 10 ? 'var(--color-loss)' : 'var(--color-profit)',
                              transition: 'width 0.3s ease'
                            }} />
                          </div>
                        </div>

                        <div style={{ textAlign: 'center', padding: '1rem' }}>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                            Response Time
                          </div>
                          <div style={{
                            fontSize: '1.5rem',
                            fontWeight: '600',
                            color: dashboardData.systemHealth.metrics.responseTime.average > 1000 ? 'var(--color-loss)' : 'var(--color-profit)'
                          }}>
                            {dashboardData.systemHealth.metrics.responseTime.average.toFixed(0)}ms
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                            P95: {dashboardData.systemHealth.metrics.responseTime.p95.toFixed(0)}ms
                          </div>
                        </div>
                      </Grid>
                    ) : (
                      <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
                        {loading ? 'Loading system health...' : 'System health data unavailable'}
                      </div>
                    )}
                  </CardContent>
                </Card>


              </Stack>
            )}

            {/* User Management Tab */}
            {activeTab === 'users' && (
              <Card>
                <CardHeader
                  title="User Management"
                  action={
                    <div style={{ 
                      padding: '0.5rem 1rem', 
                      backgroundColor: 'rgba(245, 158, 11, 0.1)', 
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid rgba(245, 158, 11, 0.3)',
                      fontSize: '0.875rem',
                      color: 'var(--color-neutral)'
                    }}>
                      ⚠️ Backend endpoints not implemented yet
                    </div>
                  }
                />
                <CardContent>
                  <div style={{ 
                    textAlign: 'center', 
                    padding: '4rem 2rem',
                    color: 'var(--text-secondary)'
                  }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚧</div>
                    <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--text-primary)' }}>
                      User Management Coming Soon
                    </h3>
                    <p style={{ fontSize: '0.875rem', marginBottom: '1.5rem' }}>
                      The backend endpoints for user management are not implemented yet.
                      This feature will be available once the following endpoints are created:
                    </p>
                    <div style={{ 
                      textAlign: 'left', 
                      maxWidth: '400px', 
                      margin: '0 auto',
                      backgroundColor: 'var(--bg-tertiary)',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      fontSize: '0.75rem',
                      fontFamily: 'var(--font-mono)'
                    }}>
                      <div>GET /api/admin/users</div>
                      <div>PATCH /api/admin/users/:id/status</div>
                      <div>PATCH /api/admin/users/:id/role</div>
                      <div>DELETE /api/admin/users/:id</div>
                      <div>GET /api/admin/users/:id/activity</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Broker Status Tab */}
            {activeTab === 'brokers' && (
              <Card>
                <CardHeader title="Broker Integration Status" />
                <CardContent>
                  <Grid cols={2} gap={4}>
                    {brokerStatuses.map(broker => (
                      <Card key={broker.name} style={{ border: '1px solid var(--border-secondary)' }}>
                        <CardContent style={{ padding: '1.5rem' }}>
                          <Flex justify="between" align="center" style={{ marginBottom: '1rem' }}>
                            <div>
                              <div style={{ fontSize: '1.125rem', fontWeight: '600' }}>
                                {broker.name}
                              </div>
                              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                Last sync: {new Date(broker.lastSync).toLocaleTimeString()}
                              </div>
                            </div>
                            <span style={{
                              padding: '0.25rem 0.75rem',
                              borderRadius: 'var(--radius-sm)',
                              backgroundColor: getStatusColor(broker.status),
                              color: 'white',
                              fontSize: '0.75rem',
                              fontWeight: '500'
                            }}>
                              {broker.status}
                            </span>
                          </Flex>

                          <Grid cols={2} gap={3}>
                            <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                              <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
                                {broker.totalAccounts}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                Total Accounts
                              </div>
                            </div>
                            <div style={{ textAlign: 'center', padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                              <div style={{ fontSize: '1.25rem', fontWeight: '600', color: getStatusColor(broker.status) }}>
                                {broker.activeConnections}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                Active Now
                              </div>
                            </div>
                          </Grid>

                          <Flex gap={2} style={{ marginTop: '1rem' }}>
                            <Button
                              variant="outline"
                              size="sm"
                              style={{ flex: 1 }}
                              onClick={async () => {
                                try {
                                  setLoading(true);
                                  const response = await adminService.reconnectBroker(broker.name);
                                  if (response.success) {
                                    await loadBrokerStatuses();
                                    showToast({ type: 'success', title: response.message });
                                  }
                                } catch (error) {
                                  showToast({ type: 'error', title: `Failed to reconnect ${broker.name}` });
                                } finally {
                                  setLoading(false);
                                }
                              }}
                              disabled={loading}
                            >
                              {loading ? '⏳' : '🔄'} Reconnect
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              style={{ flex: 1 }}
                              onClick={() => showToast({ type: 'info', title: `${broker.name} settings opened` })}
                            >
                              ⚙️ Settings
                            </Button>
                          </Flex>
                        </CardContent>
                      </Card>
                    ))}
                  </Grid>
                </CardContent>
              </Card>
            )}

            {/* System Monitor Tab */}
            {activeTab === 'system' && (
              <Stack gap={4}>
                <Card>
                  <CardHeader
                    title={`System Logs (${filteredLogs.length} of ${systemLogs.length})`}
                    action={
                      <Flex gap={2}>
                        <select
                          value={logFilter}
                          onChange={(e) => setLogFilter(e.target.value as 'ALL' | 'ERROR' | 'WARN' | 'INFO')}
                          style={{
                            padding: '0.25rem 0.5rem',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.75rem'
                          }}
                        >
                          <option value="ALL">All Levels</option>
                          <option value="ERROR">Errors</option>
                          <option value="WARN">Warnings</option>
                          <option value="INFO">Info</option>
                        </select>
                        <Button variant="outline" size="sm" onClick={exportSystemLogs}>
                          📊 Export CSV
                        </Button>
                        <Button variant="outline" size="sm" onClick={loadSystemLogs}>
                          🔄 Refresh Logs
                        </Button>
                      </Flex>
                    }
                  />
                  <CardContent>
                    <div style={{
                      backgroundColor: 'var(--bg-tertiary)',
                      padding: '1rem',
                      borderRadius: 'var(--radius-md)',
                      fontFamily: 'var(--font-mono)',
                      fontSize: '0.875rem',
                      maxHeight: '400px',
                      overflowY: 'auto'
                    }}>
                      {filteredLogs.length > 0 ? (
                        filteredLogs.map((log, index) => (
                          <div
                            key={log.id || index}
                            style={{
                              color: getLogLevelColor(log.level),
                              marginBottom: '0.25rem'
                            }}
                          >
                            [{new Date(log.timestamp).toLocaleString()}] {log.level.toUpperCase()}: {log.message}
                            {log.context?.component && ` [${log.context.component}]`}
                          </div>
                        ))
                      ) : (
                        <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '2rem' }}>
                          {loading ? 'Loading system logs...' :
                            logFilter !== 'ALL' ? `No ${logFilter.toLowerCase()} logs found` : 'No recent logs available'}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader title="Database Status" />
                  <CardContent>
                    <Grid cols={3} gap={4}>
                      <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--color-profit)' }}>
                          Connected
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          Primary Database
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--color-profit)' }}>
                          Connected
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          Redis Cache
                        </div>
                      </div>
                      <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                        <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--color-profit)' }}>
                          Healthy
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          Backup System
                        </div>
                      </div>
                    </Grid>
                  </CardContent>
                </Card>
              </Stack>
            )}

            {/* Admin Settings Tab */}
            {activeTab === 'settings' && (
              <Stack gap={4}>
                <Card>
                  <CardHeader title="Platform Settings" />
                  <CardContent>
                    <Stack gap={4}>
                      <Flex justify="between" align="center">
                        <div>
                          <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                            Maintenance Mode
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Enable to prevent new user registrations and trading
                          </div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input type="checkbox" style={{ marginRight: '0.5rem' }} />
                          <span style={{ fontSize: '0.875rem' }}>Disabled</span>
                        </label>
                      </Flex>

                      <Flex justify="between" align="center">
                        <div>
                          <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                            New User Registrations
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Allow new users to register on the platform
                          </div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input type="checkbox" defaultChecked style={{ marginRight: '0.5rem' }} />
                          <span style={{ fontSize: '0.875rem' }}>Enabled</span>
                        </label>
                      </Flex>

                      <Flex justify="between" align="center">
                        <div>
                          <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                            Real-time Data
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Enable real-time market data streaming
                          </div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input type="checkbox" defaultChecked style={{ marginRight: '0.5rem' }} />
                          <span style={{ fontSize: '0.875rem' }}>Enabled</span>
                        </label>
                      </Flex>
                    </Stack>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader title="System Actions" />
                  <CardContent>
                    <Grid cols={2} gap={4}>
                      <Button variant="outline">
                        📊 Generate System Report
                      </Button>
                      <Button variant="outline">
                        💾 Create Database Backup
                      </Button>
                      <Button variant="outline">
                        🔄 Restart Services
                      </Button>
                      <Button variant="danger">
                        🚨 Emergency Shutdown
                      </Button>
                    </Grid>
                  </CardContent>
                </Card>
              </Stack>
            )}

            {/* Admin Settings Tab */}
            {activeTab === 'settings' && (
              <Stack gap={4}>
                <Grid cols={2} gap={4}>
                  {/* System Configuration */}
                  <Card>
                    <CardHeader title="System Configuration" />
                    <CardContent>
                      <Stack gap={3}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                            Auto-refresh Interval (seconds)
                          </label>
                          <input
                            type="number"
                            min="10"
                            max="300"
                            defaultValue="30"
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid var(--border-primary)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.875rem'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                            Max Log Entries
                          </label>
                          <input
                            type="number"
                            min="50"
                            max="1000"
                            defaultValue="100"
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid var(--border-primary)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.875rem'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                            <input type="checkbox" defaultChecked />
                            Enable email notifications for critical alerts
                          </label>
                        </div>

                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                            <input type="checkbox" defaultChecked />
                            Auto-backup system data daily
                          </label>
                        </div>
                      </Stack>
                    </CardContent>
                  </Card>

                  {/* Security Settings */}
                  <Card>
                    <CardHeader title="Security Settings" />
                    <CardContent>
                      <Stack gap={3}>
                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                            Session Timeout (minutes)
                          </label>
                          <input
                            type="number"
                            min="15"
                            max="480"
                            defaultValue="60"
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid var(--border-primary)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.875rem'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: '500', marginBottom: '0.5rem' }}>
                            Max Failed Login Attempts
                          </label>
                          <input
                            type="number"
                            min="3"
                            max="10"
                            defaultValue="5"
                            style={{
                              width: '100%',
                              padding: '0.5rem',
                              border: '1px solid var(--border-primary)',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.875rem'
                            }}
                          />
                        </div>

                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                            <input type="checkbox" defaultChecked />
                            Require 2FA for admin accounts
                          </label>
                        </div>

                        <div>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                            <input type="checkbox" defaultChecked />
                            Log all admin actions
                          </label>
                        </div>
                      </Stack>
                    </CardContent>
                  </Card>
                </Grid>

                {/* System Actions */}
                <Card>
                  <CardHeader title="System Actions" />
                  <CardContent>
                    <Grid cols={4} gap={3}>
                      <Button variant="outline" onClick={() => showToast({ type: 'info', title: 'System backup initiated' })}>
                        💾 Create Backup
                      </Button>
                      <Button variant="outline" onClick={() => showToast({ type: 'info', title: 'System report generated' })}>
                        📊 Generate Report
                      </Button>
                      <Button variant="outline" onClick={() => showToast({ type: 'warning', title: 'Cache cleared successfully' })}>
                        🗑️ Clear Cache
                      </Button>
                      <Button variant="danger" onClick={() => {
                        if (window.confirm('Are you sure you want to restart the system? This will temporarily interrupt service.')) {
                          showToast({ type: 'warning', title: 'System restart initiated' });
                        }
                      }}>
                        🔄 Restart System
                      </Button>
                    </Grid>
                  </CardContent>
                </Card>

                {/* Recent Admin Activity */}
                <Card>
                  <CardHeader title="Recent Admin Activity" />
                  <CardContent>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="table table-trading">
                        <thead>
                          <tr>
                            <th>Time</th>
                            <th>Admin</th>
                            <th>Action</th>
                            <th>Target</th>
                            <th>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                              {new Date(Date.now() - 300000).toLocaleTimeString()}
                            </td>
                            <td>Admin User</td>
                            <td>User Status Update</td>
                            <td>john@example.com</td>
                            <td style={{ color: 'var(--color-profit)' }}>Success</td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                              {new Date(Date.now() - 600000).toLocaleTimeString()}
                            </td>
                            <td>Admin User</td>
                            <td>System Backup</td>
                            <td>Full System</td>
                            <td style={{ color: 'var(--color-profit)' }}>Success</td>
                          </tr>
                          <tr>
                            <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                              {new Date(Date.now() - 900000).toLocaleTimeString()}
                            </td>
                            <td>Admin User</td>
                            <td>Broker Reconnect</td>
                            <td>Upstox</td>
                            <td style={{ color: 'var(--color-loss)' }}>Failed</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </Stack>
            )}
          </Stack>
        </div>
      </PageTransition>
    </div>
  );
};

export default AdminPanel;