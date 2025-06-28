import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import KiteNavigation from '../components/KiteNavigation';
import { portfolioService } from '../services/portfolioService';
import '../styles/kite-theme.css';

interface MarketData {
  symbol: string;
  ltp: number;
  change: number;
  changePercent: number;
}

interface Position {
  symbol: string;
  qty: number;
  avgPrice: number;
  ltp: number;
  pnl: number;
  pnlPercent: number;
  product: string;
  exchange: string;
}

interface DashboardSummary {
  totalValue: number;
  totalInvested: number;
  totalPnL: number;
  dayPnL: number;
  totalPnLPercent: number;
  dayPnLPercent: number;
}

const KiteDashboard: React.FC = () => {
  const navigate = useNavigate();
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<DashboardSummary>({
    totalValue: 0,
    totalInvested: 0,
    totalPnL: 0,
    dayPnL: 0,
    totalPnLPercent: 0,
    dayPnLPercent: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch portfolio summary
        const summaryResponse = await portfolioService.getSummary();
        setPortfolioSummary({
          totalValue: summaryResponse.summary.portfolioValue,
          totalInvested: summaryResponse.metrics.totalInvested,
          totalPnL: summaryResponse.summary.totalPnL,
          dayPnL: summaryResponse.summary.dayPnL,
          totalPnLPercent: summaryResponse.metrics.totalPnLPercentage,
          dayPnLPercent: (summaryResponse.summary.dayPnL / summaryResponse.summary.portfolioValue) * 100
        });

        // Fetch positions
        const positionsResponse = await portfolioService.getPositions();
        // Convert PortfolioPosition to Position format
        const positionsData = positionsResponse.positions.slice(0, 5).map((position: any) => ({
          symbol: position.symbol,
          qty: position.totalQuantity,
          avgPrice: position.averagePrice,
          ltp: position.currentValue / position.totalQuantity, // Calculate LTP
          pnl: position.pnl,
          pnlPercent: position.pnlPercentage,
          product: 'CNC', // Default product type
          exchange: 'NSE' // Default exchange
        }));
        setPositions(positionsData);

        // Mock market data (since we don't have real market data API yet)
        const mockMarketData: MarketData[] = [
          { symbol: 'NIFTY 50', ltp: 25637.80, change: -1.26, changePercent: -0.05 },
          { symbol: 'SENSEX', ltp: 84058.90, change: 181.87, changePercent: 0.22 },
          { symbol: 'BANKNIFTY', ltp: 54234.15, change: 234.50, changePercent: 0.43 },
          { symbol: 'FINNIFTY', ltp: 23456.80, change: -123.45, changePercent: -0.52 }
        ];
        setMarketData(mockMarketData);

      } catch (error: any) {
        console.error('Failed to fetch dashboard data:', error);
        setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="kite-theme">
        <KiteNavigation />
        <div className="kite-main">
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '50vh',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '2rem' }}>📊</div>
            <div style={{ color: 'var(--kite-text-secondary)' }}>Loading dashboard...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kite-theme">
        <KiteNavigation />
        <div className="kite-main">
          <div className="kite-card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
            <div style={{ color: 'var(--kite-loss)', marginBottom: '1rem' }}>{error}</div>
            <button
              className="kite-btn kite-btn-primary"
              onClick={() => window.location.reload()}
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

      <div className="kite-main">
        {/* Portfolio Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="kite-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
              Portfolio Value
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: 'var(--kite-text-primary)' }}>
              ₹{formatCurrency(portfolioSummary.totalValue)}
            </div>
            <div style={{ fontSize: '0.875rem', color: portfolioSummary.totalPnL >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)', marginTop: '0.25rem' }}>
              {portfolioSummary.totalPnL >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(portfolioSummary.totalPnL))} ({portfolioSummary.totalPnLPercent >= 0 ? '+' : ''}{portfolioSummary.totalPnLPercent.toFixed(2)}%)
            </div>
          </div>

          <div className="kite-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
              Day's P&L
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: portfolioSummary.dayPnL >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)' }}>
              {portfolioSummary.dayPnL >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(portfolioSummary.dayPnL))}
            </div>
            <div style={{ fontSize: '0.875rem', color: portfolioSummary.dayPnL >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)', marginTop: '0.25rem' }}>
              {portfolioSummary.dayPnLPercent >= 0 ? '+' : ''}{portfolioSummary.dayPnLPercent.toFixed(2)}%
            </div>
          </div>

          <div className="kite-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
              Total Invested
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: 'var(--kite-text-primary)' }}>
              ₹{formatCurrency(portfolioSummary.totalInvested)}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)', marginTop: '0.25rem' }}>
              Current: ₹{formatCurrency(portfolioSummary.totalValue)}
            </div>
          </div>
        </div>

        {/* Market Overview */}
        <div className="kite-card">
          <div className="kite-card-header">
            <h2 className="kite-card-title">Market Overview</h2>
            <button className="kite-btn">View All</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            {marketData.map((item, index) => (
              <div key={index} style={{ 
                padding: '1rem',
                backgroundColor: 'var(--kite-bg-tertiary)',
                borderRadius: 'var(--kite-radius-md)',
                border: '1px solid var(--kite-border-secondary)'
              }}>
                <div style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem' }}>
                  {item.symbol}
                </div>
                <div style={{ fontSize: '1.25rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: 'var(--kite-text-primary)' }}>
                  {formatCurrency(item.ltp)}
                </div>
                <div style={{ 
                  fontSize: '0.875rem', 
                  fontFamily: 'var(--kite-font-mono)',
                  color: item.change >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)',
                  marginTop: '0.25rem'
                }}>
                  {item.change >= 0 ? '+' : ''}{formatCurrency(Math.abs(item.change))} ({item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%)
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Today's Positions */}
        <div className="kite-card">
          <div className="kite-card-header">
            <h2 className="kite-card-title">Recent Positions ({positions.length})</h2>
            <button
              className="kite-btn"
              onClick={() => navigate('/positions')}
            >
              View All
            </button>
          </div>
          {positions.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="kite-table">
                <thead>
                  <tr>
                    <th>Instrument</th>
                    <th>Qty.</th>
                    <th>Avg. Price</th>
                    <th>LTP</th>
                    <th>P&L</th>
                    <th>Product</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position, index) => (
                    <tr key={index}>
                      <td>
                        <div style={{ fontWeight: '500', color: 'var(--kite-text-primary)' }}>
                          {position.symbol}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)' }}>
                          {position.exchange}
                        </div>
                      </td>
                      <td style={{
                        fontFamily: 'var(--kite-font-mono)',
                        color: position.qty > 0 ? 'var(--kite-profit)' : 'var(--kite-loss)',
                        fontWeight: '500'
                      }}>
                        {position.qty > 0 ? '+' : ''}{position.qty}
                      </td>
                      <td style={{ fontFamily: 'var(--kite-font-mono)' }}>
                        {formatCurrency(position.avgPrice)}
                      </td>
                      <td style={{ fontFamily: 'var(--kite-font-mono)' }}>
                        {formatCurrency(position.ltp)}
                      </td>
                      <td style={{
                        fontFamily: 'var(--kite-font-mono)',
                        color: position.pnl >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
                      }}>
                        {position.pnl >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(position.pnl))}
                        <div style={{ fontSize: '0.75rem' }}>
                          {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                        </div>
                      </td>
                      <td style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                        {position.product}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{
              textAlign: 'center',
              padding: '3rem',
              color: 'var(--kite-text-secondary)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📊</div>
              <div style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No positions today</div>
              <div style={{ fontSize: '0.875rem' }}>Start trading to see your positions here</div>
              <button
                className="kite-btn kite-btn-primary"
                style={{ marginTop: '1rem' }}
                onClick={() => navigate('/trade-setup')}
              >
                Place Order
              </button>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="kite-card">
          <div className="kite-card-header">
            <h2 className="kite-card-title">Quick Actions</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <button
              className="kite-btn kite-btn-primary"
              style={{ padding: '1rem', justifyContent: 'center' }}
              onClick={() => navigate('/trade-setup')}
            >
              📈 Place Order
            </button>
            <button
              className="kite-btn"
              style={{ padding: '1rem', justifyContent: 'center' }}
              onClick={() => navigate('/holdings')}
            >
              📊 View Holdings
            </button>
            <button
              className="kite-btn"
              style={{ padding: '1rem', justifyContent: 'center' }}
              onClick={() => navigate('/positions')}
            >
              🎯 Positions
            </button>
            <button
              className="kite-btn"
              style={{ padding: '1rem', justifyContent: 'center' }}
              onClick={() => navigate('/funds')}
            >
              💰 Add Funds
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KiteDashboard;
