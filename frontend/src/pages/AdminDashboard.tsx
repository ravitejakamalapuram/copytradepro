import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import Card, { CardContent } from '../components/ui/Card';
import { Grid, Stack } from '../components/ui/Layout';
import '../styles/app-theme.css';

interface SystemStats {
  totalUsers: number;
  activeUsers: number;
  totalOrders: number;
  errorRate: number;
  systemUptime: string;
  databaseStatus: string;
}

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState<SystemStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalOrders: 0,
    errorRate: 0,
    systemUptime: '0h 0m',
    databaseStatus: 'Unknown'
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading admin stats
    const loadStats = async () => {
      try {
        // TODO: Replace with actual API calls
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        setStats({
          totalUsers: 156,
          activeUsers: 42,
          totalOrders: 1247,
          errorRate: 2.3,
          systemUptime: '15d 8h 23m',
          databaseStatus: 'Healthy'
        });
      } catch (error) {
        console.error('Failed to load admin stats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadStats();
  }, []);

  const quickActions = [
    { 
      title: 'User Management', 
      description: 'Manage user accounts and permissions',
      icon: '👥',
      path: '/admin/users',
      color: 'var(--color-primary)'
    },
    { 
      title: 'Error Logs', 
      description: 'View and analyze system errors',
      icon: '🐛',
      path: '/admin/error-logs',
      color: 'var(--color-loss)'
    },
    { 
      title: 'System Health', 
      description: 'Monitor system performance',
      icon: '💚',
      path: '/admin/system-health',
      color: 'var(--color-profit)'
    },
    { 
      title: 'Analytics', 
      description: 'View system analytics and reports',
      icon: '📊',
      path: '/admin/analytics',
      color: 'var(--color-accent)'
    }
  ];

  return (
    <div className="app-theme app-layout">
      <AppNavigation />

      <div className="app-main">
        <div style={{ marginBottom: '2rem' }}>
          <h1 style={{ 
            fontSize: '2rem',
            fontWeight: '600',
            color: 'var(--text-primary)',
            marginBottom: '0.5rem'
          }}>
            Admin Dashboard
          </h1>
          <p style={{ 
            color: 'var(--text-secondary)',
            fontSize: '1rem'
          }}>
            System overview and administrative controls
          </p>
        </div>

        {loading ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '200px',
            color: 'var(--text-secondary)'
          }}>
            Loading admin dashboard...
          </div>
        ) : (
          <Stack gap={6}>
            {/* System Stats */}
            <div>
              <h2 style={{ 
                fontSize: '1.25rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '1rem'
              }}>
                System Overview
              </h2>
              
              <Grid cols={3} gap={4}>
                <Card>
                  <CardContent>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ 
                        fontSize: '2rem',
                        fontWeight: '600',
                        color: 'var(--color-primary)',
                        marginBottom: '0.5rem'
                      }}>
                        {stats.totalUsers}
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>Total Users</div>
                      <div style={{ 
                        fontSize: '0.875rem',
                        color: 'var(--color-profit)',
                        marginTop: '0.25rem'
                      }}>
                        {stats.activeUsers} active
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ 
                        fontSize: '2rem',
                        fontWeight: '600',
                        color: 'var(--color-accent)',
                        marginBottom: '0.5rem'
                      }}>
                        {stats.totalOrders}
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>Total Orders</div>
                      <div style={{ 
                        fontSize: '0.875rem',
                        color: 'var(--text-tertiary)',
                        marginTop: '0.25rem'
                      }}>
                        All time
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ 
                        fontSize: '2rem',
                        fontWeight: '600',
                        color: stats.errorRate > 5 ? 'var(--color-loss)' : 'var(--color-profit)',
                        marginBottom: '0.5rem'
                      }}>
                        {stats.errorRate}%
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>Error Rate</div>
                      <div style={{ 
                        fontSize: '0.875rem',
                        color: 'var(--text-tertiary)',
                        marginTop: '0.25rem'
                      }}>
                        Last 24h
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Grid>
            </div>

            {/* Quick Actions */}
            <div>
              <h2 style={{ 
                fontSize: '1.25rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '1rem'
              }}>
                Quick Actions
              </h2>
              
              <Grid cols={2} gap={4}>
                {quickActions.map((action, index) => (
                  <Card key={index} style={{ cursor: 'pointer' }} onClick={() => navigate(action.path)}>
                    <CardContent>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <div style={{ 
                          fontSize: '2rem',
                          width: '3rem',
                          height: '3rem',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          backgroundColor: 'var(--color-bg-elevated)',
                          borderRadius: '0.5rem'
                        }}>
                          {action.icon}
                        </div>
                        <div style={{ flex: 1 }}>
                          <h3 style={{ 
                            fontSize: '1rem',
                            fontWeight: '500',
                            color: 'var(--text-primary)',
                            marginBottom: '0.25rem'
                          }}>
                            {action.title}
                          </h3>
                          <p style={{ 
                            fontSize: '0.875rem',
                            color: 'var(--text-secondary)',
                            margin: 0
                          }}>
                            {action.description}
                          </p>
                        </div>
                        <div style={{ color: 'var(--text-tertiary)' }}>→</div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </Grid>
            </div>

            {/* System Status */}
            <div>
              <h2 style={{ 
                fontSize: '1.25rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '1rem'
              }}>
                System Status
              </h2>
              
              <Card>
                <CardContent>
                  <Grid cols={2} gap={4}>
                    <div>
                      <div style={{ 
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.5rem'
                      }}>
                        System Uptime
                      </div>
                      <div style={{ 
                        fontSize: '1.25rem',
                        fontWeight: '500',
                        color: 'var(--color-profit)'
                      }}>
                        {stats.systemUptime}
                      </div>
                    </div>
                    <div>
                      <div style={{ 
                        fontSize: '0.875rem',
                        color: 'var(--text-secondary)',
                        marginBottom: '0.5rem'
                      }}>
                        Database Status
                      </div>
                      <div style={{ 
                        fontSize: '1.25rem',
                        fontWeight: '500',
                        color: stats.databaseStatus === 'Healthy' ? 'var(--color-profit)' : 'var(--color-loss)'
                      }}>
                        {stats.databaseStatus}
                      </div>
                    </div>
                  </Grid>
                </CardContent>
              </Card>
            </div>
          </Stack>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard;