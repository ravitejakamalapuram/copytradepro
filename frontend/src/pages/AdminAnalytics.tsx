import React, { useState, useEffect } from 'react';
import AppNavigation from '../components/AppNavigation';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import { Grid, Stack } from '../components/ui/Layout';
import '../styles/app-theme.css';

interface AnalyticsData {
  userGrowth: { period: string; users: number }[];
  orderVolume: { period: string; orders: number }[];
  errorTrends: { period: string; errors: number }[];
  topErrors: { error: string; count: number }[];
}

const AdminAnalytics: React.FC = () => {
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const loadAnalytics = async () => {
    setLoading(true);
    try {
      // TODO: Replace with actual API calls
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setAnalyticsData({
        userGrowth: [
          { period: 'Week 1', users: 120 },
          { period: 'Week 2', users: 135 },
          { period: 'Week 3', users: 142 },
          { period: 'Week 4', users: 156 }
        ],
        orderVolume: [
          { period: 'Week 1', orders: 280 },
          { period: 'Week 2', orders: 320 },
          { period: 'Week 3', orders: 295 },
          { period: 'Week 4', orders: 352 }
        ],
        errorTrends: [
          { period: 'Week 1', errors: 45 },
          { period: 'Week 2', errors: 38 },
          { period: 'Week 3', errors: 52 },
          { period: 'Week 4', errors: 29 }
        ],
        topErrors: [
          { error: 'Network timeout', count: 23 },
          { error: 'Authentication failed', count: 18 },
          { error: 'Database connection', count: 12 },
          { error: 'Invalid order data', count: 8 },
          { error: 'Rate limit exceeded', count: 6 }
        ]
      });
    } catch (error) {
      console.error('Failed to load analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAnalytics();
  }, [timeRange]);

  const timeRangeOptions = [
    { value: '7d', label: 'Last 7 days' },
    { value: '30d', label: 'Last 30 days' },
    { value: '90d', label: 'Last 90 days' }
  ];

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
              Analytics Dashboard
            </h1>
            <p style={{ 
              color: 'var(--text-secondary)',
              fontSize: '1rem'
            }}>
              System analytics and performance insights
            </p>
          </div>
          
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            {timeRangeOptions.map((option) => (
              <Button
                key={option.value}
                variant={timeRange === option.value ? 'primary' : 'outline'}
                onClick={() => setTimeRange(option.value as '7d' | '30d' | '90d')}
                size="sm"
              >
                {option.label}
              </Button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '400px',
            color: 'var(--text-secondary)'
          }}>
            Loading analytics data...
          </div>
        ) : analyticsData ? (
          <Stack gap={6}>
            {/* Key Metrics */}
            <div>
              <h2 style={{ 
                fontSize: '1.25rem',
                fontWeight: '500',
                color: 'var(--text-primary)',
                marginBottom: '1rem'
              }}>
                Key Metrics
              </h2>
              
              <Grid cols={3} gap={4}>
                <Card>
                  <CardContent>
                    <div style={{ textAlign: 'center' }}>
                      <div style={{ 
                        fontSize: '2rem',
                        fontWeight: '600',
                        color: 'var(--color-profit)',
                        marginBottom: '0.5rem'
                      }}>
                        {analyticsData.userGrowth[analyticsData.userGrowth.length - 1]?.users || 0}
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>Total Users</div>
                      <div style={{ 
                        fontSize: '0.875rem',
                        color: 'var(--color-profit)',
                        marginTop: '0.25rem'
                      }}>
                        +{analyticsData.userGrowth[analyticsData.userGrowth.length - 1]?.users - analyticsData.userGrowth[0]?.users || 0} this period
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
                        {analyticsData.orderVolume.reduce((sum, item) => sum + item.orders, 0)}
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>Total Orders</div>
                      <div style={{ 
                        fontSize: '0.875rem',
                        color: 'var(--text-tertiary)',
                        marginTop: '0.25rem'
                      }}>
                        {timeRange} period
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
                        color: 'var(--color-loss)',
                        marginBottom: '0.5rem'
                      }}>
                        {analyticsData.errorTrends.reduce((sum, item) => sum + item.errors, 0)}
                      </div>
                      <div style={{ color: 'var(--text-secondary)' }}>Total Errors</div>
                      <div style={{ 
                        fontSize: '0.875rem',
                        color: 'var(--text-tertiary)',
                        marginTop: '0.25rem'
                      }}>
                        {timeRange} period
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Grid>
            </div>

            {/* Charts Section */}
            <Grid cols={2} gap={6}>
              {/* User Growth */}
              <Card>
                <CardHeader>
                  <h3 style={{ 
                    fontSize: '1.125rem',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    margin: 0
                  }}>
                    User Growth
                  </h3>
                </CardHeader>
                <CardContent>
                  <div style={{ height: '200px', display: 'flex', alignItems: 'end', gap: '1rem', padding: '1rem 0' }}>
                    {analyticsData.userGrowth.map((item, index) => (
                      <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div
                          style={{
                            width: '100%',
                            height: `${(item.users / Math.max(...analyticsData.userGrowth.map(d => d.users))) * 150}px`,
                            backgroundColor: 'var(--color-profit)',
                            borderRadius: '4px 4px 0 0',
                            marginBottom: '0.5rem'
                          }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                          {item.period}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                          {item.users}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Order Volume */}
              <Card>
                <CardHeader>
                  <h3 style={{ 
                    fontSize: '1.125rem',
                    fontWeight: '500',
                    color: 'var(--text-primary)',
                    margin: 0
                  }}>
                    Order Volume
                  </h3>
                </CardHeader>
                <CardContent>
                  <div style={{ height: '200px', display: 'flex', alignItems: 'end', gap: '1rem', padding: '1rem 0' }}>
                    {analyticsData.orderVolume.map((item, index) => (
                      <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <div
                          style={{
                            width: '100%',
                            height: `${(item.orders / Math.max(...analyticsData.orderVolume.map(d => d.orders))) * 150}px`,
                            backgroundColor: 'var(--color-accent)',
                            borderRadius: '4px 4px 0 0',
                            marginBottom: '0.5rem'
                          }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                          {item.period}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', fontWeight: '500' }}>
                          {item.orders}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </Grid>

            {/* Top Errors */}
            <Card>
              <CardHeader>
                <h3 style={{ 
                  fontSize: '1.125rem',
                  fontWeight: '500',
                  color: 'var(--text-primary)',
                  margin: 0
                }}>
                  Top Errors ({timeRange})
                </h3>
              </CardHeader>
              <CardContent>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  {analyticsData.topErrors.map((error, index) => (
                    <div key={index} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      padding: '0.75rem',
                      backgroundColor: 'var(--color-bg-elevated)',
                      borderRadius: '0.5rem'
                    }}>
                      <div style={{ 
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.75rem'
                      }}>
                        <div style={{ 
                          width: '1.5rem',
                          height: '1.5rem',
                          backgroundColor: 'var(--color-loss)',
                          borderRadius: '50%',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.75rem',
                          color: 'white',
                          fontWeight: '600'
                        }}>
                          {index + 1}
                        </div>
                        <span style={{ color: 'var(--text-primary)' }}>{error.error}</span>
                      </div>
                      <div style={{ 
                        fontSize: '1rem',
                        fontWeight: '600',
                        color: 'var(--color-loss)'
                      }}>
                        {error.count}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </Stack>
        ) : (
          <div style={{ 
            textAlign: 'center',
            color: 'var(--text-secondary)',
            padding: '4rem'
          }}>
            Failed to load analytics data
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminAnalytics;