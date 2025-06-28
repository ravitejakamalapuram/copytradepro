import React, { useState, useEffect } from 'react';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Flex,
  Stack,
  Grid,
  StatusBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell
} from './ui';
import { portfolioService, type PortfolioSummary } from '../services/portfolioService';

interface PortfolioDashboardProps {
  className?: string;
}

const PortfolioDashboard: React.FC<PortfolioDashboardProps> = ({ className = '' }) => {
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadPortfolioSummary();
  }, []);

  const loadPortfolioSummary = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await portfolioService.getSummary();
      setSummary(data);
    } catch (err: any) {
      console.error('Failed to load portfolio summary:', err);
      setError(err.message || 'Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      await loadPortfolioSummary();
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className={`portfolio-dashboard ${className}`}>
        <Card>
          <CardContent>
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
              <p>Loading portfolio data...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`portfolio-dashboard ${className}`}>
        <Card>
          <CardContent>
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <p style={{ color: '#ef4444', marginBottom: '1rem' }}>{error}</p>
              <Button variant="outline" onClick={loadPortfolioSummary}>
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className={`portfolio-dashboard ${className}`}>
        <Card>
          <CardContent>
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <p>No portfolio data available</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const { metrics, positions, tradingStats } = summary;

  return (
    <div className={`portfolio-dashboard ${className}`}>
      <Stack gap={6}>
        {/* Header */}
        <Flex justify="between" align="center">
          <div>
            <h1 style={{ fontSize: '1.875rem', fontWeight: '700', margin: 0 }}>
              Portfolio Dashboard
            </h1>
            <p style={{ color: '#64748b', margin: '0.5rem 0 0 0' }}>
              Track your trading performance and portfolio analytics
            </p>
          </div>
          <Button
            variant="outline"
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </Flex>

        {/* Key Metrics Cards */}
        <Grid cols={4} gap={4}>
          <Card>
            <CardContent>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  Portfolio Value
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                  {portfolioService.formatCurrency(metrics.currentValue)}
                </div>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: portfolioService.getPnLColor(metrics.totalPnL),
                  marginTop: '0.25rem'
                }}>
                  {portfolioService.formatPercentage(metrics.totalPnLPercentage)}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  Total P&L
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '700',
                  color: portfolioService.getPnLColor(metrics.totalPnL)
                }}>
                  {portfolioService.formatCurrency(metrics.totalPnL)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  All Time
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  Day P&L
                </div>
                <div style={{ 
                  fontSize: '1.5rem', 
                  fontWeight: '700',
                  color: portfolioService.getPnLColor(metrics.dayPnL)
                }}>
                  {portfolioService.formatCurrency(metrics.dayPnL)}
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  Today
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.875rem', color: '#64748b', marginBottom: '0.5rem' }}>
                  Success Rate
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '700' }}>
                  {metrics.successRate.toFixed(1)}%
                </div>
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                  {metrics.executedOrders}/{metrics.totalOrders} Orders
                </div>
              </div>
            </CardContent>
          </Card>
        </Grid>

        {/* Trading Statistics */}
        <Grid cols={2} gap={6}>
          <Card>
            <CardHeader title="Trading Performance" />
            <CardContent>
              <Stack gap={4}>
                <Flex justify="between" align="center">
                  <span style={{ color: '#64748b' }}>Win Rate</span>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: '600' }}>
                      {tradingStats.winRate.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                      {tradingStats.winningTrades}/{tradingStats.totalTrades} trades
                    </div>
                  </div>
                </Flex>

                <Flex justify="between" align="center">
                  <span style={{ color: '#64748b' }}>Profit Factor</span>
                  <div style={{ fontWeight: '600' }}>
                    {tradingStats.profitFactor.toFixed(2)}
                  </div>
                </Flex>

                <Flex justify="between" align="center">
                  <span style={{ color: '#64748b' }}>Average Win</span>
                  <div style={{ fontWeight: '600', color: '#10b981' }}>
                    {portfolioService.formatCurrency(tradingStats.averageWin)}
                  </div>
                </Flex>

                <Flex justify="between" align="center">
                  <span style={{ color: '#64748b' }}>Average Loss</span>
                  <div style={{ fontWeight: '600', color: '#ef4444' }}>
                    {portfolioService.formatCurrency(tradingStats.averageLoss)}
                  </div>
                </Flex>

                <Flex justify="between" align="center">
                  <span style={{ color: '#64748b' }}>Max Drawdown</span>
                  <div style={{ fontWeight: '600', color: '#ef4444' }}>
                    {tradingStats.maxDrawdown.toFixed(2)}%
                  </div>
                </Flex>

                <Flex justify="between" align="center">
                  <span style={{ color: '#64748b' }}>Sharpe Ratio</span>
                  <div style={{ fontWeight: '600' }}>
                    {tradingStats.sharpeRatio.toFixed(2)}
                  </div>
                </Flex>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Portfolio Overview" />
            <CardContent>
              <Stack gap={4}>
                <Flex justify="between" align="center">
                  <span style={{ color: '#64748b' }}>Active Positions</span>
                  <div style={{ fontWeight: '600' }}>
                    {metrics.activePositions}
                  </div>
                </Flex>

                <Flex justify="between" align="center">
                  <span style={{ color: '#64748b' }}>Total Invested</span>
                  <div style={{ fontWeight: '600' }}>
                    {portfolioService.formatCurrency(metrics.totalInvested)}
                  </div>
                </Flex>

                <Flex justify="between" align="center">
                  <span style={{ color: '#64748b' }}>Week P&L</span>
                  <div style={{ 
                    fontWeight: '600',
                    color: portfolioService.getPnLColor(metrics.weekPnL)
                  }}>
                    {portfolioService.formatCurrency(metrics.weekPnL)}
                  </div>
                </Flex>

                <Flex justify="between" align="center">
                  <span style={{ color: '#64748b' }}>Month P&L</span>
                  <div style={{ 
                    fontWeight: '600',
                    color: portfolioService.getPnLColor(metrics.monthPnL)
                  }}>
                    {portfolioService.formatCurrency(metrics.monthPnL)}
                  </div>
                </Flex>

                <Flex justify="between" align="center">
                  <span style={{ color: '#64748b' }}>Total Orders</span>
                  <div style={{ fontWeight: '600' }}>
                    {metrics.totalOrders}
                  </div>
                </Flex>

                <Flex justify="between" align="center">
                  <span style={{ color: '#64748b' }}>Executed Orders</span>
                  <div style={{ fontWeight: '600' }}>
                    {metrics.executedOrders}
                  </div>
                </Flex>
              </Stack>
            </CardContent>
          </Card>
        </Grid>

        {/* Top Positions */}
        {positions.length > 0 && (
          <Card>
            <CardHeader 
              title="Top Positions" 
              subtitle={`Showing ${positions.length} active positions`}
            />
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHeaderCell>Symbol</TableHeaderCell>
                    <TableHeaderCell>Quantity</TableHeaderCell>
                    <TableHeaderCell>Avg Price</TableHeaderCell>
                    <TableHeaderCell>Current Value</TableHeaderCell>
                    <TableHeaderCell>P&L</TableHeaderCell>
                    <TableHeaderCell>P&L %</TableHeaderCell>
                    <TableHeaderCell>Brokers</TableHeaderCell>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {positions.map((position, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <div style={{ fontWeight: '600' }}>{position.symbol}</div>
                      </TableCell>
                      <TableCell>{position.totalQuantity}</TableCell>
                      <TableCell>
                        {portfolioService.formatCurrency(position.averagePrice)}
                      </TableCell>
                      <TableCell>
                        {portfolioService.formatCurrency(position.currentValue)}
                      </TableCell>
                      <TableCell style={{ color: portfolioService.getPnLColor(position.pnl) }}>
                        {portfolioService.formatCurrency(position.pnl)}
                      </TableCell>
                      <TableCell style={{ color: portfolioService.getPnLColor(position.pnl) }}>
                        {portfolioService.formatPercentage(position.pnlPercentage)}
                      </TableCell>
                      <TableCell>
                        <Flex gap={1} wrap>
                          {position.brokerAccounts.map((broker, idx) => (
                            <StatusBadge key={idx} status="active">
                              {broker}
                            </StatusBadge>
                          ))}
                        </Flex>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </Stack>
    </div>
  );
};

export default PortfolioDashboard;
