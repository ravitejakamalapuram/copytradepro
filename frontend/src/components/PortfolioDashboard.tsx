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
    } catch (err: unknown) {
      console.error('Failed to load portfolio summary:', err);
      let message = 'Failed to load portfolio data';
      function isErrorWithMessage(e: unknown): e is { message: string } {
        return typeof e === 'object' && e !== null && 'message' in e && typeof (e as { message: unknown }).message === 'string';
      }
      if (isErrorWithMessage(err)) {
        message = err.message;
      }
      setError(message);
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
            <div className="dashboard-center dashboard-loading">
              <div className="loading-spinner"></div>
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
            <div className="dashboard-center dashboard-error">
              <p className="dashboard-error-message">{error}</p>
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
            <div className="dashboard-center dashboard-empty">
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
            <h1 className="dashboard-title">Portfolio Dashboard</h1>
            <p className="dashboard-subtitle">Track your trading performance and portfolio analytics</p>
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
              <div className="dashboard-metric">
                <div className="dashboard-metric-label">Portfolio Value</div>
                <div className="dashboard-metric-value">{portfolioService.formatCurrency(metrics.currentValue)}</div>
                <div className={
                  metrics.totalPnL > 0 ? 'dashboard-metric-change dashboard-metric-positive' : metrics.totalPnL < 0 ? 'dashboard-metric-change dashboard-metric-negative' : 'dashboard-metric-change dashboard-metric-neutral'
                }>
                  {portfolioService.formatPercentage(metrics.totalPnLPercentage)}
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="dashboard-metric">
                <div className="dashboard-metric-label">Total P&L</div>
                <div className={
                  metrics.totalPnL > 0 ? 'dashboard-metric-value dashboard-metric-positive' : metrics.totalPnL < 0 ? 'dashboard-metric-value dashboard-metric-negative' : 'dashboard-metric-value dashboard-metric-neutral'
                }>
                  {portfolioService.formatCurrency(metrics.totalPnL)}
                </div>
                <div className="dashboard-metric-change dashboard-metric-neutral">All Time</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="dashboard-metric">
                <div className="dashboard-metric-label">Day P&L</div>
                <div className={
                  metrics.dayPnL > 0 ? 'dashboard-metric-value dashboard-metric-positive' : metrics.dayPnL < 0 ? 'dashboard-metric-value dashboard-metric-negative' : 'dashboard-metric-value dashboard-metric-neutral'
                }>
                  {portfolioService.formatCurrency(metrics.dayPnL)}
                </div>
                <div className="dashboard-metric-change dashboard-metric-neutral">Today</div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent>
              <div className="dashboard-metric">
                <div className="dashboard-metric-label">Success Rate</div>
                <div className="dashboard-metric-value">{metrics.successRate.toFixed(1)}%</div>
                <div className="dashboard-metric-change dashboard-metric-neutral">{metrics.executedOrders}/{metrics.totalOrders} Orders</div>
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
                  <span className="dashboard-metric-label">Win Rate</span>
                  <div className="dashboard-metric-right">
                    <div className="dashboard-metric-value">{tradingStats.winRate.toFixed(1)}%</div>
                    <div className="dashboard-metric-change dashboard-metric-neutral">
                      {tradingStats.winningTrades}/{tradingStats.totalTrades} trades
                    </div>
                  </div>
                </Flex>
                <Flex justify="between" align="center">
                  <span className="dashboard-metric-label">Profit Factor</span>
                  <div className="dashboard-metric-value">{tradingStats.profitFactor.toFixed(2)}</div>
                </Flex>
                <Flex justify="between" align="center">
                  <span className="dashboard-metric-label">Average Win</span>
                  <div className="dashboard-metric-value dashboard-metric-positive">{portfolioService.formatCurrency(tradingStats.averageWin)}</div>
                </Flex>
                <Flex justify="between" align="center">
                  <span className="dashboard-metric-label">Average Loss</span>
                  <div className="dashboard-metric-value dashboard-metric-negative">{portfolioService.formatCurrency(tradingStats.averageLoss)}</div>
                </Flex>
                <Flex justify="between" align="center">
                  <span className="dashboard-metric-label">Max Drawdown</span>
                  <div className="dashboard-metric-value dashboard-metric-negative">{tradingStats.maxDrawdown.toFixed(2)}%</div>
                </Flex>
                <Flex justify="between" align="center">
                  <span className="dashboard-metric-label">Sharpe Ratio</span>
                  <div className="dashboard-metric-value">{tradingStats.sharpeRatio.toFixed(2)}</div>
                </Flex>
              </Stack>
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Portfolio Overview" />
            <CardContent>
              <Stack gap={4}>
                <Flex justify="between" align="center">
                  <span className="dashboard-metric-label">Active Positions</span>
                  <div className="dashboard-metric-value">{metrics.activePositions}</div>
                </Flex>

                <Flex justify="between" align="center">
                  <span className="dashboard-metric-label">Total Invested</span>
                  <div className="dashboard-metric-value">{portfolioService.formatCurrency(metrics.totalInvested)}</div>
                </Flex>

                <Flex justify="between" align="center">
                  <span className="dashboard-metric-label">Week P&L</span>
                  <div className={
                    metrics.weekPnL > 0 ? 'dashboard-metric-value dashboard-metric-positive' : metrics.weekPnL < 0 ? 'dashboard-metric-value dashboard-metric-negative' : 'dashboard-metric-value dashboard-metric-neutral'
                  }>{portfolioService.formatCurrency(metrics.weekPnL)}</div>
                </Flex>

                <Flex justify="between" align="center">
                  <span className="dashboard-metric-label">Month P&L</span>
                  <div className={
                    metrics.monthPnL > 0 ? 'dashboard-metric-value dashboard-metric-positive' : metrics.monthPnL < 0 ? 'dashboard-metric-value dashboard-metric-negative' : 'dashboard-metric-value dashboard-metric-neutral'
                  }>{portfolioService.formatCurrency(metrics.monthPnL)}</div>
                </Flex>

                <Flex justify="between" align="center">
                  <span className="dashboard-metric-label">Total Orders</span>
                  <div className="dashboard-metric-value">{metrics.totalOrders}</div>
                </Flex>

                <Flex justify="between" align="center">
                  <span className="dashboard-metric-label">Executed Orders</span>
                  <div className="dashboard-metric-value">{metrics.executedOrders}</div>
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
                        <div className="dashboard-metric-symbol">{position.symbol}</div>
                      </TableCell>
                      <TableCell>{position.totalQuantity}</TableCell>
                      <TableCell>{portfolioService.formatCurrency(position.averagePrice)}</TableCell>
                      <TableCell>{portfolioService.formatCurrency(position.currentValue)}</TableCell>
                      <TableCell className={
                        position.pnl > 0 ? 'dashboard-metric-positive' : position.pnl < 0 ? 'dashboard-metric-negative' : 'dashboard-metric-neutral'
                      }>
                        {portfolioService.formatCurrency(position.pnl)}
                      </TableCell>
                      <TableCell className={
                        position.pnl > 0 ? 'dashboard-metric-positive' : position.pnl < 0 ? 'dashboard-metric-negative' : 'dashboard-metric-neutral'
                      }>
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
