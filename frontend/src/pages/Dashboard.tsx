import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import { portfolioService } from '../services/portfolioService';
import '../styles/app-theme.css';



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

const Dashboard: React.FC = () => {
  const navigate = useNavigate();

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
      <div className="app-theme app-layout">
        <AppNavigation />
        <div className="app-main">
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '50vh',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '24px' }}>📊</div>
            <div style={{ color: 'var(--text-secondary)' }}>Loading dashboard...</div>
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
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>⚠️</div>
            <div style={{ color: 'var(--color-loss)', marginBottom: '1rem' }}>{error}</div>
            <button
              className="btn btn-primary"
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
    <div className="app-theme app-layout">
      <AppNavigation />
      <div className="app-main">
        {/* Portfolio Overview */}
        <div className="trading-grid" style={{ marginBottom: 'var(--space-4)' }}>
          <div className="trading-card card--compact">
            <div className="trading-metric">
              <div className="trading-metric-label">Portfolio Value</div>
              <div className="trading-metric-value">₹{formatCurrency(portfolioSummary.totalValue)}</div>
              <div className={`trading-metric-change ${portfolioSummary.totalPnL >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                {portfolioSummary.totalPnL >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(portfolioSummary.totalPnL))} ({portfolioSummary.totalPnLPercent >= 0 ? '+' : ''}{portfolioSummary.totalPnLPercent.toFixed(2)}%)
              </div>
            </div>
          </div>

          <div className="trading-card card--compact">
            <div className="trading-metric">
              <div className="trading-metric-label">Day's P&L</div>
              <div className={`trading-metric-value ${portfolioSummary.dayPnL >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                {portfolioSummary.dayPnL >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(portfolioSummary.dayPnL))}
              </div>
              <div className={`trading-metric-change ${portfolioSummary.dayPnL >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                {portfolioSummary.dayPnLPercent >= 0 ? '+' : ''}{portfolioSummary.dayPnLPercent.toFixed(2)}%
              </div>
            </div>
          </div>

          <div className="trading-card card--compact">
            <div className="trading-metric">
              <div className="trading-metric-label">Total Invested</div>
              <div className="trading-metric-value">₹{formatCurrency(portfolioSummary.totalInvested)}</div>
              <div className="trading-metric-change text-secondary">
                Current: ₹{formatCurrency(portfolioSummary.totalValue)}
              </div>
            </div>
          </div>
        </div>



        {/* Today's Positions */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Recent Positions ({positions.length})</h2>
            <button
              className="btn"
              onClick={() => navigate('/positions')}
            >
              View All
            </button>
          </div>
          {positions.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-trading">
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
                        <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                          {position.symbol}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
                          {position.exchange}
                        </div>
                      </td>
                      <td style={{
                        fontFamily: 'var(--font-mono)',
                        color: position.qty > 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                        fontWeight: '500'
                      }}>
                        {position.qty > 0 ? '+' : ''}{position.qty}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {formatCurrency(position.avgPrice)}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>
                        {formatCurrency(position.ltp)}
                      </td>
                      <td style={{
                        fontFamily: 'var(--font-mono)',
                        color: position.pnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
                      }}>
                        {position.pnl >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(position.pnl))}
                        <div style={{ fontSize: '10px' }}>
                          {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                        </div>
                      </td>
                      <td style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
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
              color: 'var(--text-secondary)'
            }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>📊</div>
              <div style={{ fontSize: '14px', marginBottom: '6px' }}>No positions today</div>
              <div style={{ fontSize: '11px' }}>Start trading to see your positions here</div>
              <button
                className="btn btn-primary"
                style={{ marginTop: '1rem' }}
                onClick={() => navigate('/trade-setup')}
              >
                Place Order
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
