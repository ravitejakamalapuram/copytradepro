import React, { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import PortfolioDashboard from '../components/PortfolioDashboard';
import {
  Container,
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  Button,
  Flex,
  Stack,
  Grid,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  StatusBadge
} from '../components/ui';
import { portfolioService, type PortfolioAnalytics, type SymbolPerformance, type PerformanceData } from '../services/portfolioService';

const PortfolioAnalyticsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'analytics' | 'performance' | 'positions'>('dashboard');
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null);
  const [symbolPerformance, setSymbolPerformance] = useState<SymbolPerformance[]>([]);
  const [performanceData, setPerformanceData] = useState<PerformanceData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [performancePeriod, setPerformancePeriod] = useState('30');

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadAnalytics();
    } else if (activeTab === 'performance') {
      loadPerformanceData();
      loadSymbolPerformance();
    }
  }, [activeTab, performancePeriod]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await portfolioService.getAnalytics();
      setAnalytics(data);
    } catch (err: any) {
      console.error('Failed to load analytics:', err);
      setError(err.message || 'Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const loadPerformanceData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await portfolioService.getPerformanceData(parseInt(performancePeriod));
      setPerformanceData(data.performance);
    } catch (err: any) {
      console.error('Failed to load performance data:', err);
      setError(err.message || 'Failed to load performance data');
    } finally {
      setLoading(false);
    }
  };

  const loadSymbolPerformance = async () => {
    try {
      const data = await portfolioService.getSymbolPerformance();
      setSymbolPerformance(data.symbols);
    } catch (err: any) {
      console.error('Failed to load symbol performance:', err);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <PortfolioDashboard />;

      case 'analytics':
        if (loading) {
          return (
            <Card>
              <CardContent>
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
                  <p>Loading analytics...</p>
                </div>
              </CardContent>
            </Card>
          );
        }

        if (error) {
          return (
            <Card>
              <CardContent>
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>
                  <Button variant="outline" onClick={loadAnalytics}>
                    Retry
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        }

        if (!analytics) {
          return (
            <Card>
              <CardContent>
                <div style={{ textAlign: 'center', padding: '3rem' }}>
                  <p>No analytics data available</p>
                </div>
              </CardContent>
            </Card>
          );
        }

        return (
          <Stack gap={6}>
            {/* Risk Metrics */}
            <Card>
              <CardHeader title="Risk Analysis" />
              <CardContent>
                <Grid cols={3} gap={4}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                      Max Drawdown
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700', color: '#ef4444' }}>
                      {analytics.analytics.riskMetrics.maxDrawdown.toFixed(2)}%
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                      Sharpe Ratio
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                      {analytics.analytics.riskMetrics.sharpeRatio.toFixed(2)}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                      Volatility
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                      {analytics.analytics.riskMetrics.volatility.toFixed(2)}
                    </div>
                  </div>
                </Grid>
              </CardContent>
            </Card>

            {/* Diversification */}
            <Card>
              <CardHeader title="Portfolio Diversification" />
              <CardContent>
                <Grid cols={2} gap={4}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                      Total Symbols
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                      {analytics.analytics.diversification.totalSymbols}
                    </div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                      Concentration Risk
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                      {analytics.analytics.diversification.concentrationRisk.toFixed(1)}%
                    </div>
                  </div>
                </Grid>
              </CardContent>
            </Card>

            {/* Top Performers */}
            <Card>
              <CardHeader title="Top Performing Symbols" />
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHeaderCell>Symbol</TableHeaderCell>
                      <TableHeaderCell>Total Trades</TableHeaderCell>
                      <TableHeaderCell>Win Rate</TableHeaderCell>
                      <TableHeaderCell>Total P&L</TableHeaderCell>
                      <TableHeaderCell>Avg Return</TableHeaderCell>
                      <TableHeaderCell>Volume</TableHeaderCell>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.topPerformers.slice(0, 10).map((symbol, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div style={{ fontWeight: '600' }}>{symbol.symbol}</div>
                        </TableCell>
                        <TableCell>{symbol.totalTrades}</TableCell>
                        <TableCell>
                          <StatusBadge 
                            status={symbol.winRate >= 60 ? 'active' : symbol.winRate >= 40 ? 'pending' : 'inactive'}
                          >
                            {symbol.winRate.toFixed(1)}%
                          </StatusBadge>
                        </TableCell>
                        <TableCell style={{ color: portfolioService.getPnLColor(symbol.totalPnL) }}>
                          {portfolioService.formatCurrency(symbol.totalPnL)}
                        </TableCell>
                        <TableCell style={{ color: portfolioService.getPnLColor(symbol.averageReturn) }}>
                          {portfolioService.formatCurrency(symbol.averageReturn)}
                        </TableCell>
                        <TableCell>
                          {portfolioService.formatCurrency(symbol.volume)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </Stack>
        );

      case 'performance':
        return (
          <Stack gap={6}>
            {/* Performance Controls */}
            <Card>
              <CardHeader title="Performance Analysis" />
              <CardContent>
                <Flex justify="between" align="center">
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      Time Period
                    </label>
                    <Select
                      value={performancePeriod}
                      onChange={(e) => setPerformancePeriod(e.target.value)}
                      style={{ minWidth: '150px' }}
                    >
                      <option value="7">Last 7 days</option>
                      <option value="30">Last 30 days</option>
                      <option value="90">Last 90 days</option>
                      <option value="180">Last 6 months</option>
                      <option value="365">Last year</option>
                    </Select>
                  </div>
                  <Button variant="outline" onClick={loadPerformanceData} disabled={loading}>
                    {loading ? 'Loading...' : 'Refresh'}
                  </Button>
                </Flex>
              </CardContent>
            </Card>

            {/* Performance Chart Placeholder */}
            <Card>
              <CardHeader title="Portfolio Performance Chart" />
              <CardContent>
                <div style={{
                  height: '300px',
                  backgroundColor: '#f8fafc',
                  border: '2px dashed #cbd5e1',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexDirection: 'column',
                  gap: '1rem'
                }}>
                  <div style={{ fontSize: '1.125rem', fontWeight: '600', color: '#64748b' }}>
                    Performance Chart
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b', textAlign: 'center' }}>
                    Chart visualization will be implemented with a charting library
                    <br />
                    Showing {performanceData.length} data points for {performancePeriod} days
                  </div>
                  {performanceData.length > 0 && (
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      Latest P&L: {portfolioService.formatCurrency(performanceData[performanceData.length - 1]?.cumulativePnL || 0)}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Symbol Performance */}
            {symbolPerformance.length > 0 && (
              <Card>
                <CardHeader title="Symbol Performance" />
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHeaderCell>Symbol</TableHeaderCell>
                        <TableHeaderCell>Trades</TableHeaderCell>
                        <TableHeaderCell>Win Rate</TableHeaderCell>
                        <TableHeaderCell>Total P&L</TableHeaderCell>
                        <TableHeaderCell>Avg Return</TableHeaderCell>
                        <TableHeaderCell>Volume</TableHeaderCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {symbolPerformance.slice(0, 15).map((symbol, index) => (
                        <TableRow key={index}>
                          <TableCell>
                            <div style={{ fontWeight: '600' }}>{symbol.symbol}</div>
                          </TableCell>
                          <TableCell>{symbol.totalTrades}</TableCell>
                          <TableCell>
                            <StatusBadge 
                              status={symbol.winRate >= 60 ? 'active' : symbol.winRate >= 40 ? 'pending' : 'inactive'}
                            >
                              {symbol.winRate.toFixed(1)}%
                            </StatusBadge>
                          </TableCell>
                          <TableCell style={{ color: portfolioService.getPnLColor(symbol.totalPnL) }}>
                            {portfolioService.formatCurrency(symbol.totalPnL)}
                          </TableCell>
                          <TableCell style={{ color: portfolioService.getPnLColor(symbol.averageReturn) }}>
                            {portfolioService.formatCurrency(symbol.averageReturn)}
                          </TableCell>
                          <TableCell>
                            {portfolioService.formatCurrency(symbol.volume)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </Stack>
        );

      default:
        return <PortfolioDashboard />;
    }
  };

  return (
    <div className="enterprise-app">
      <Navigation />

      <main className="enterprise-main">
        <Container>
          <PageHeader
            title="Portfolio Analytics"
            subtitle="Comprehensive portfolio performance tracking and analysis"
          />

          {/* Tab Navigation */}
          <Card style={{ marginBottom: '2rem' }}>
            <CardContent>
              <Flex gap={1}>
                {[
                  { key: 'dashboard', label: 'Dashboard' },
                  { key: 'analytics', label: 'Analytics' },
                  { key: 'performance', label: 'Performance' },
                ].map((tab) => (
                  <Button
                    key={tab.key}
                    variant={activeTab === tab.key ? 'primary' : 'ghost'}
                    onClick={() => setActiveTab(tab.key as any)}
                  >
                    {tab.label}
                  </Button>
                ))}
              </Flex>
            </CardContent>
          </Card>

          {/* Tab Content */}
          {renderTabContent()}
        </Container>
      </main>
    </div>
  );
};

export default PortfolioAnalyticsPage;
