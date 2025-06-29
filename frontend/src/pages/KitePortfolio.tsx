import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import KiteNavigation from '../components/KiteNavigation';
import { portfolioService } from '../services/portfolioService';
import '../styles/kite-theme.css';

interface PortfolioItem {
  symbol: string;
  qty: number;
  avgPrice: number;
  ltp: number;
  invested: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  dayChange: number;
  dayChangePercent: number;
  product: 'CNC' | 'MIS' | 'NRML';
  exchange: 'NSE' | 'BSE';
  type: 'holding' | 'position';
  lastTradeDate?: string;
  brokerAccounts?: string[];
}

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
type SortField = 'symbol' | 'pnl' | 'pnlPercent' | 'currentValue' | 'dayChange';
type SortOrder = 'asc' | 'desc';

const KitePortfolio: React.FC = () => {
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

      if (positionsResponse.positions) {
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
      }
    } catch (err: any) {
      console.error('Failed to fetch portfolio data:', err);
      setError(err.message || 'Failed to load portfolio data');
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

  const getItemIcon = (item: PortfolioItem) => {
    return item.type === 'holding' ? '📊' : '⚡';
  };

  const getItemTypeLabel = (item: PortfolioItem) => {
    return item.type === 'holding' ? 'Long Term' : 'Intraday';
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number, decimals: number = 2): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  const getPnLColor = (pnl: number): string => {
    if (pnl > 0) return 'var(--kite-profit)';
    if (pnl < 0) return 'var(--kite-loss)';
    return 'var(--kite-text-secondary)';
  };

  const filteredItems = getFilteredItems();

  if (loading) {
    return (
      <div className="kite-theme">
        <KiteNavigation />
        <div style={{ 
          padding: '2rem', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center',
          minHeight: '60vh'
        }}>
          <div style={{ 
            fontSize: '1.2rem', 
            color: 'var(--kite-text-secondary)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <div className="kite-spinner"></div>
            Loading portfolio...
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kite-theme">
        <KiteNavigation />
        <div style={{ padding: '2rem' }}>
          <div className="kite-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--kite-text-primary)' }}>
              Failed to Load Portfolio
            </div>
            <div style={{ color: 'var(--kite-text-secondary)', marginBottom: '2rem' }}>
              {error}
            </div>
            <button 
              className="kite-btn kite-btn-primary"
              onClick={fetchPortfolioData}
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kite-theme">
      <KiteNavigation />
      <div style={{ padding: '1.5rem', maxWidth: '1400px', margin: '0 auto' }}>
        {/* Header */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <h1 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '600', 
            color: 'var(--kite-text-primary)',
            margin: 0
          }}>
            Portfolio
          </h1>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className="kite-btn kite-btn-primary"
              onClick={() => navigate('/trade-setup')}
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            >
              + Buy/Sell
            </button>
            <button 
              className="kite-btn"
              onClick={fetchPortfolioData}
              style={{ fontSize: '0.875rem', padding: '0.5rem 1rem' }}
            >
              🔄 Refresh
            </button>
          </div>
        </div>

        {/* Portfolio Summary */}
        <div className="kite-card" style={{ marginBottom: '1.5rem' }}>
          <div className="kite-card-header">
            <h2 className="kite-card-title">Portfolio Summary</h2>
          </div>
          <div style={{ padding: '1.5rem' }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '1.5rem'
            }}>
              {/* Total Portfolio */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
                  Total Value
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--kite-text-primary)' }}>
                  {formatCurrency(portfolioSummary.totalValue)}
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: getPnLColor(portfolioSummary.totalPnL),
                  marginTop: '0.25rem'
                }}>
                  {portfolioSummary.totalPnL >= 0 ? '+' : ''}{formatCurrency(portfolioSummary.totalPnL)}
                  ({portfolioSummary.totalPnLPercent >= 0 ? '+' : ''}{formatNumber(portfolioSummary.totalPnLPercent)}%)
                </div>
              </div>

              {/* Holdings */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
                  📊 Holdings
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--kite-text-primary)' }}>
                  {formatCurrency(portfolioSummary.holdingsValue)}
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: getPnLColor(portfolioSummary.holdingsPnL),
                  marginTop: '0.25rem'
                }}>
                  {portfolioSummary.holdingsPnL >= 0 ? '+' : ''}{formatCurrency(portfolioSummary.holdingsPnL)}
                </div>
              </div>

              {/* Positions */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
                  ⚡ Positions
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--kite-text-primary)' }}>
                  {formatCurrency(portfolioSummary.positionsValue)}
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: getPnLColor(portfolioSummary.positionsPnL),
                  marginTop: '0.25rem'
                }}>
                  {portfolioSummary.positionsPnL >= 0 ? '+' : ''}{formatCurrency(portfolioSummary.positionsPnL)}
                </div>
              </div>

              {/* Day P&L */}
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
                  Today's P&L
                </div>
                <div style={{
                  fontSize: '1.25rem',
                  fontWeight: '600',
                  color: getPnLColor(portfolioSummary.dayPnL)
                }}>
                  {portfolioSummary.dayPnL >= 0 ? '+' : ''}{formatCurrency(portfolioSummary.dayPnL)}
                </div>
                <div style={{
                  fontSize: '0.875rem',
                  color: getPnLColor(portfolioSummary.dayPnL),
                  marginTop: '0.25rem'
                }}>
                  ({portfolioSummary.dayPnLPercent >= 0 ? '+' : ''}{formatNumber(portfolioSummary.dayPnLPercent)}%)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* View Mode Tabs */}
        <div className="kite-card" style={{ marginBottom: '1.5rem' }}>
          <div style={{
            display: 'flex',
            borderBottom: '1px solid var(--kite-border-secondary)',
            padding: '0 1.5rem'
          }}>
            {[
              { key: 'all', label: 'All', icon: '📋', count: portfolioItems.length },
              { key: 'holdings', label: 'Holdings', icon: '📊', count: portfolioItems.filter(i => i.type === 'holding').length },
              { key: 'positions', label: 'Positions', icon: '⚡', count: portfolioItems.filter(i => i.type === 'position').length }
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setViewMode(tab.key as ViewMode)}
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '1rem 1.5rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500',
                  color: viewMode === tab.key ? 'var(--kite-brand-primary)' : 'var(--kite-text-secondary)',
                  borderBottom: viewMode === tab.key ? '2px solid var(--kite-brand-primary)' : '2px solid transparent',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                <span>{tab.icon}</span>
                {tab.label}
                <span style={{
                  backgroundColor: viewMode === tab.key ? 'var(--kite-brand-primary)' : 'var(--kite-bg-neutral)',
                  color: viewMode === tab.key ? 'white' : 'var(--kite-text-secondary)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '600'
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Portfolio Items Table */}
        <div className="kite-card">
          <div className="kite-card-header">
            <h2 className="kite-card-title">
              {viewMode === 'all' ? 'All Items' :
               viewMode === 'holdings' ? 'Holdings' : 'Positions'}
              ({filteredItems.length})
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                Sort by:
              </span>
              <select
                value={sortField}
                onChange={(e) => setSortField(e.target.value as SortField)}
                style={{
                  padding: '0.25rem 0.5rem',
                  border: '1px solid var(--kite-border-secondary)',
                  borderRadius: 'var(--kite-radius-sm)',
                  backgroundColor: 'var(--kite-bg-secondary)',
                  color: 'var(--kite-text-primary)',
                  fontSize: '0.875rem'
                }}
              >
                <option value="currentValue">Value</option>
                <option value="pnl">P&L</option>
                <option value="pnlPercent">P&L %</option>
                <option value="symbol">Symbol</option>
                <option value="dayChange">Day Change</option>
              </select>
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                style={{
                  background: 'none',
                  border: '1px solid var(--kite-border-secondary)',
                  borderRadius: 'var(--kite-radius-sm)',
                  padding: '0.25rem 0.5rem',
                  cursor: 'pointer',
                  color: 'var(--kite-text-secondary)',
                  fontSize: '0.875rem'
                }}
              >
                {sortOrder === 'asc' ? '↑' : '↓'}
              </button>
            </div>
          </div>

          {filteredItems.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem' }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>
                {viewMode === 'holdings' ? '📊' : viewMode === 'positions' ? '⚡' : '📋'}
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--kite-text-primary)' }}>
                No {viewMode === 'all' ? 'items' : viewMode} found
              </div>
              <div style={{ color: 'var(--kite-text-secondary)', marginBottom: '2rem' }}>
                {viewMode === 'holdings'
                  ? 'You don\'t have any holdings yet. Start investing to see your long-term positions here.'
                  : viewMode === 'positions'
                  ? 'You don\'t have any active positions. Place some trades to see your intraday positions here.'
                  : 'Your portfolio is empty. Start trading to see your holdings and positions here.'
                }
              </div>
              <button
                className="kite-btn kite-btn-primary"
                onClick={() => navigate('/trade-setup')}
              >
                Start Trading
              </button>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table className="kite-table">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => handleSort('symbol')}>
                      Instrument {sortField === 'symbol' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th style={{ textAlign: 'right' }}>Qty</th>
                    <th style={{ textAlign: 'right' }}>Avg</th>
                    <th style={{ textAlign: 'right' }}>LTP</th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('currentValue')}>
                      Current Value {sortField === 'currentValue' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('pnl')}>
                      P&L {sortField === 'pnl' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => handleSort('dayChange')}>
                      Day Change {sortField === 'dayChange' && (sortOrder === 'asc' ? '↑' : '↓')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item, index) => (
                    <tr key={`${item.symbol}-${index}`}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.25rem' }}>{getItemIcon(item)}</span>
                          <div>
                            <div style={{ fontWeight: '500', color: 'var(--kite-text-primary)' }}>
                              {item.symbol}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)' }}>
                              {getItemTypeLabel(item)} • {item.exchange}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--kite-font-mono)' }}>
                        {formatNumber(item.qty, 0)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--kite-font-mono)' }}>
                        ₹{formatNumber(item.avgPrice)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--kite-font-mono)' }}>
                        ₹{formatNumber(item.ltp)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--kite-font-mono)', fontWeight: '500' }}>
                        {formatCurrency(item.currentValue)}
                      </td>
                      <td style={{
                        textAlign: 'right',
                        fontFamily: 'var(--kite-font-mono)',
                        fontWeight: '500',
                        color: getPnLColor(item.pnl)
                      }}>
                        {item.pnl >= 0 ? '+' : ''}{formatCurrency(item.pnl)}
                        <div style={{ fontSize: '0.75rem' }}>
                          ({item.pnlPercent >= 0 ? '+' : ''}{formatNumber(item.pnlPercent)}%)
                        </div>
                      </td>
                      <td style={{
                        textAlign: 'right',
                        fontFamily: 'var(--kite-font-mono)',
                        color: getPnLColor(item.dayChange)
                      }}>
                        {item.dayChange >= 0 ? '+' : ''}{formatCurrency(item.dayChange)}
                        <div style={{ fontSize: '0.75rem' }}>
                          ({item.dayChangePercent >= 0 ? '+' : ''}{formatNumber(item.dayChangePercent)}%)
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default KitePortfolio;
