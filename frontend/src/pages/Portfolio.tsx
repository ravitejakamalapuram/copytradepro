import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import PortfolioSummary from '../components/PortfolioSummary';
import TabbedNavigation from '../components/TabbedNavigation';
import PortfolioTable from '../components/PortfolioTable';
import SortControls from '../components/SortControls';
import { portfolioService } from '../services/portfolioService';
import type { PortfolioItem, SortField, SortOrder } from '../components/PortfolioTable';
import '../styles/app-theme.css';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import { Stack, Flex } from '../components/ui/Layout';

// PortfolioItem interface is now imported from PortfolioTable component

interface PortfolioSummary {
  totalValue: number;
  totalInvested: number;
  totalPnL: number;
  dayPnL: number;
  totalPnLPercent: number;
  dayPnLPercent: number;
  holdingsValue: number;
  positionsValue: number;
  holdingsPnL: number;
  positionsPnL: number;
}

type ViewMode = 'all' | 'holdings' | 'positions';
// SortField and SortOrder types are now imported from PortfolioTable component

const Portfolio: React.FC = () => {
  const navigate = useNavigate();
  const [portfolioItems, setPortfolioItems] = useState<PortfolioItem[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    totalValue: 0,
    totalInvested: 0,
    totalPnL: 0,
    dayPnL: 0,
    totalPnLPercent: 0,
    dayPnLPercent: 0,
    holdingsValue: 0,
    positionsValue: 0,
    holdingsPnL: 0,
    positionsPnL: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('all');
  const [sortField, setSortField] = useState<SortField>('currentValue');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');

  useEffect(() => {
    fetchPortfolioData();
  }, []);

  const fetchPortfolioData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch portfolio positions (this includes both holdings and positions)
      const positionsResponse = await portfolioService.getPositions();

      if (positionsResponse.positions && positionsResponse.positions.length > 0) {
        // Transform positions data to unified format
        const items: PortfolioItem[] = positionsResponse.positions.map(position => ({
          symbol: position.symbol,
          qty: position.totalQuantity,
          avgPrice: position.averagePrice,
          ltp: position.currentValue / position.totalQuantity, // Calculate LTP from current value
          invested: position.investedValue,
          currentValue: position.currentValue,
          pnl: position.pnl,
          pnlPercent: position.pnlPercentage,
          dayChange: position.pnl * 0.1, // Mock day change (10% of total P&L)
          dayChangePercent: position.pnlPercentage * 0.1,
          product: 'CNC' as const, // Default to CNC for holdings
          exchange: 'NSE' as const,
          type: 'holding' as const, // All positions from this API are holdings
          lastTradeDate: position.lastTradeDate,
          brokerAccounts: position.brokerAccounts
        }));

        setPortfolioItems(items);

        // Calculate summary
        const summary = calculateSummary(items);
        setPortfolioSummary(summary);
      } else {
        // No positions found - set empty state
        setPortfolioItems([]);
        setPortfolioSummary({
          totalValue: 0,
          totalInvested: 0,
          totalPnL: 0,
          dayPnL: 0,
          totalPnLPercent: 0,
          dayPnLPercent: 0,
          holdingsValue: 0,
          positionsValue: 0,
          holdingsPnL: 0,
          positionsPnL: 0
        });
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        console.error('Failed to fetch portfolio data:', err);
        setError(err.message || 'Failed to load portfolio data');
      } else {
        console.error('Failed to fetch portfolio data:', err);
        setError('Failed to load portfolio data');
      }

      // Set empty state on error
      setPortfolioItems([]);
      setPortfolioSummary({
        totalValue: 0,
        totalInvested: 0,
        totalPnL: 0,
        dayPnL: 0,
        totalPnLPercent: 0,
        dayPnLPercent: 0,
        holdingsValue: 0,
        positionsValue: 0,
        holdingsPnL: 0,
        positionsPnL: 0
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateSummary = (items: PortfolioItem[]): PortfolioSummary => {
    const holdings = items.filter(item => item.type === 'holding');
    const positions = items.filter(item => item.type === 'position');

    const totalValue = items.reduce((sum, item) => sum + item.currentValue, 0);
    const totalInvested = items.reduce((sum, item) => sum + item.invested, 0);
    const totalPnL = items.reduce((sum, item) => sum + item.pnl, 0);
    const dayPnL = items.reduce((sum, item) => sum + item.dayChange, 0);

    const holdingsValue = holdings.reduce((sum, item) => sum + item.currentValue, 0);
    const positionsValue = positions.reduce((sum, item) => sum + item.currentValue, 0);
    const holdingsPnL = holdings.reduce((sum, item) => sum + item.pnl, 0);
    const positionsPnL = positions.reduce((sum, item) => sum + item.pnl, 0);

    return {
      totalValue,
      totalInvested,
      totalPnL,
      dayPnL,
      totalPnLPercent: totalInvested > 0 ? (totalPnL / totalInvested) * 100 : 0,
      dayPnLPercent: totalValue > 0 ? (dayPnL / totalValue) * 100 : 0,
      holdingsValue,
      positionsValue,
      holdingsPnL,
      positionsPnL
    };
  };

  const getFilteredItems = (): PortfolioItem[] => {
    let filtered = portfolioItems;

    if (viewMode === 'holdings') {
      filtered = portfolioItems.filter(item => item.type === 'holding');
    } else if (viewMode === 'positions') {
      filtered = portfolioItems.filter(item => item.type === 'position');
    }

    // Sort items
    return filtered.sort((a, b) => {
      let aValue = a[sortField];
      let bValue = b[sortField];

      if (typeof aValue === 'string') {
        aValue = aValue.toLowerCase();
        bValue = (bValue as string).toLowerCase();
      }

      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Utility functions are now handled by the reusable components

  const filteredItems = getFilteredItems();

  if (loading) {
    return (
      <div className="app-theme app-layout">
        <AppNavigation />
        <div className="app-main" style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '60vh'
        }}>
          <div style={{ 
            fontSize: '1.2rem', 
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <div className="loading-spinner"></div>
            Loading portfolio...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-theme app-layout">
        <AppNavigation />
        <div className="app-main">
          <Card style={{ textAlign: 'center', padding: '3rem' }}>
            <CardContent>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--text-primary)' }}>
                Failed to Load Portfolio
              </div>
              <div style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                {error}
              </div>
              <Button 
                variant="primary"
                onClick={fetchPortfolioData}
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="app-theme app-layout">
      <AppNavigation />
      <div className="app-main">
        <Stack gap={6}>
          {/* Header */}
          <Flex justify="between" align="center">
            <h1 style={{
              fontSize: '16px',
              fontWeight: '600',
              color: 'var(--text-primary)',
              margin: 0
            }}>
              Portfolio
            </h1>
            <Flex gap={2}>
              <Button
                variant="primary"
                size="sm"
                onClick={() => navigate('/trade-setup')}
              >
                + Buy/Sell
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={fetchPortfolioData}
              >
                🔄 Refresh
              </Button>
            </Flex>
          </Flex>

        {/* Portfolio Summary */}
        <PortfolioSummary data={portfolioSummary} />

        {/* View Mode Tabs */}
        <TabbedNavigation
          tabs={[
            { key: 'all', label: 'All', icon: '📋', count: portfolioItems.length },
            { key: 'holdings', label: 'Holdings', icon: '📊', count: portfolioItems.filter(i => i.type === 'holding').length },
            { key: 'positions', label: 'Positions', icon: '⚡', count: portfolioItems.filter(i => i.type === 'position').length }
          ]}
          activeTab={viewMode}
          onTabChange={(tabKey) => setViewMode(tabKey as ViewMode)}
        />

          {/* Portfolio Items Table */}
          <Card>
            <CardHeader
              title={`${viewMode === 'all' ? 'All Items' :
                     viewMode === 'holdings' ? 'Holdings' : 'Positions'} (${filteredItems.length})`}
              action={
                <SortControls
                  sortOptions={[
                    { value: 'currentValue', label: 'Value' },
                    { value: 'pnl', label: 'P&L' },
                    { value: 'pnlPercent', label: 'P&L %' },
                    { value: 'symbol', label: 'Symbol' },
                    { value: 'dayChange', label: 'Day Change' }
                  ]}
                  selectedSort={sortField}
                  sortOrder={sortOrder}
                  onSortChange={(field) => setSortField(field as SortField)}
                  onOrderChange={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                />
              }
            />
            <CardContent>
              <PortfolioTable
                items={filteredItems}
                sortField={sortField}
                sortOrder={sortOrder}
                onSort={handleSort}
                emptyStateConfig={{
                  icon: viewMode === 'holdings' ? '📊' : viewMode === 'positions' ? '⚡' : '📋',
                  title: `No ${viewMode === 'all' ? 'items' : viewMode} found`,
                  description: viewMode === 'holdings'
                    ? 'You don\'t have any holdings yet. Start investing to see your long-term positions here.'
                    : viewMode === 'positions'
                    ? 'You don\'t have any active positions. Place some trades to see your intraday positions here.'
                    : 'Your portfolio is empty. Start trading to see your holdings and positions here.',
                  actionLabel: 'Start Trading',
                  onAction: () => navigate('/trade-setup')
                }}
              />
            </CardContent>
          </Card>
        </Stack>
      </div>
    </div>
  );
};

export default Portfolio;
