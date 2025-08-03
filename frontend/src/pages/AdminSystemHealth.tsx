import React, { useState, useEffect } from 'react';
import AppNavigation from '../components/AppNavigation';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Grid, Stack } from '../components/ui/Layout';
import '../styles/app-theme.css';

interface HealthMetric {
  name: string;
  status: 'healthy' | 'warning' | 'critical';
  value: string;
  description: string;
}

const AdminSystemHealth: React.FC = () => {
  const [healthMetrics, setHealthMetrics] = useState<HealthMetric[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const loadHealthMetrics = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setHealthMetrics([
        {
          name: 'Database Connection',
          status: 'healthy',
          value: 'Connected',
          description: 'MongoDB connection is stable'
        },
        {
          name: 'API Response Time',
          status: 'healthy',
          value: '45ms',
          description: 'Average response time is within normal range'
        },
        {
          name: 'Memory Usage',
          status: 'warning',
          value: '78%',
          description: 'Memory usage is elevated but stable'
        },
        {
          name: 'Error Rate',
          status: 'healthy',
          value: '2.3%',
          description: 'Error rate is within acceptable limits'
        },
        {
          name: 'Active Connections',
          status: 'healthy',
          value: '42',
          description: 'Number of active user connections'
        },
        {
          name: 'Queue Health',
          status: 'healthy',
          value: 'Normal',
          description: 'All processing queues are healthy'
        }
      ]);
      
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Failed to load health metrics:', error);
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

  const overallHealth = healthMetrics.some(m => m.status === 'critical') ? 'critical' :
                       healthMetrics.some(m => m.status === 'warning') ? 'warning' : 'healthy';

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
              fontSize: '1rem'
            }}>
              Monitor system performance and health metrics
            </p>
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
                {healthMetrics.map((metric, index) => (
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
                <Button variant="outline">
                  Clear Cache
                </Button>
                <Button variant="outline">
                  Restart Services
                </Button>
                <Button variant="outline">
                  Run Diagnostics
                </Button>
                <Button variant="outline">
                  Export Logs
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