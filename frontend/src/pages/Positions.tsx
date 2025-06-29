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
  dayChange: number;
  dayChangePercent: number;
  product: 'MIS' | 'CNC' | 'NRML';
  exchange: 'NSE' | 'BSE';
}

interface PositionsSummary {
  totalValue: number;
  totalInvested: number;
  totalPnL: number;
  dayPnL: number;
  totalPnLPercent: number;
  dayPnLPercent: number;
}

const Positions: React.FC = () => {
  const navigate = useNavigate();
  const [positions, setPositions] = useState<Position[]>([]);
  const [positionsSummary, setPositionsSummary] = useState<PositionsSummary>({
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
    const fetchPositionsData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch portfolio summary
        const summaryResponse = await portfolioService.getSummary();
        setPositionsSummary({
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
        const positionsData = positionsResponse.positions.map((position: any) => ({
          symbol: position.symbol,
          qty: position.totalQuantity,
          avgPrice: position.averagePrice,
          ltp: position.currentValue / position.totalQuantity, // Calculate LTP
          pnl: position.pnl,
          pnlPercent: position.pnlPercentage,
          dayChange: 0, // Not available in current API
          dayChangePercent: 0, // Not available in current API
          product: 'CNC' as const, // Default product
          exchange: 'NSE' as const // Default exchange
        }));
        setPositions(positionsData);

      } catch (error: any) {
        console.error('Failed to fetch positions data:', error);
        setError('Failed to load positions data');
      } finally {
        setLoading(false);
      }
    };

    fetchPositionsData();
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getProductColor = (product: string): string => {
    switch (product) {
      case 'MIS': return 'var(--kite-neutral)';
      case 'CNC': return 'var(--kite-profit)';
      case 'NRML': return 'var(--kite-brand-primary)';
      default: return 'var(--kite-text-secondary)';
    }
  };

  if (loading) {
    return (
      <div className="kite-theme">
        <AppNavigation />
        <div className="kite-main">
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '50vh',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '2rem' }}>🎯</div>
            <div style={{ color: 'var(--kite-text-secondary)' }}>Loading positions...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kite-theme">
        <AppNavigation />
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
      <AppNavigation />
      
      <div className="kite-main">
        {/* Positions Summary */}
        <div className="kite-card">
          <div className="kite-card-header">
            <h2 className="kite-card-title">Positions ({positions.length})</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button className="kite-btn kite-btn-primary">
                + New Position
              </button>
              <button className="kite-btn">
                📊 Analytics
              </button>
              <button className="kite-btn">
                📥 Export
              </button>
            </div>
          </div>

          {/* Summary Stats */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: 'var(--kite-bg-tertiary)',
            borderRadius: 'var(--kite-radius-lg)'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginBottom: '0.25rem' }}>
                Total P&L
              </div>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                fontFamily: 'var(--kite-font-mono)',
                color: positionsSummary.totalPnL >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
              }}>
                {positionsSummary.totalPnL >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(positionsSummary.totalPnL))}
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: positionsSummary.totalPnL >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)',
                marginTop: '0.25rem'
              }}>
                {positionsSummary.totalPnLPercent >= 0 ? '+' : ''}{positionsSummary.totalPnLPercent.toFixed(2)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginBottom: '0.25rem' }}>
                Total Value
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: 'var(--kite-text-primary)' }}>
                ₹{formatCurrency(positionsSummary.totalValue)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginBottom: '0.25rem' }}>
                Long Positions
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--kite-profit)' }}>
                {positions.filter(p => p.qty > 0).length}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginBottom: '0.25rem' }}>
                Short Positions
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--kite-loss)' }}>
                {positions.filter(p => p.qty < 0).length}
              </div>
            </div>
          </div>

          {/* Positions Table */}
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
                    <th>Chg.</th>
                    <th>Product</th>
                    <th>Actions</th>
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
                      <td style={{ 
                        fontFamily: 'var(--kite-font-mono)',
                        color: position.dayChange >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
                      }}>
                        {position.dayChange >= 0 ? '+' : ''}{position.dayChangePercent.toFixed(2)}%
                      </td>
                      <td>
                        <span style={{ 
                          color: getProductColor(position.product),
                          fontWeight: '500',
                          fontSize: '0.875rem'
                        }}>
                          {position.product}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button 
                            className="kite-btn kite-btn-success"
                            style={{ 
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem'
                            }}
                          >
                            {position.qty > 0 ? 'Sell' : 'Buy'}
                          </button>
                          <button 
                            className="kite-btn"
                            style={{ 
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem'
                            }}
                          >
                            Exit
                          </button>
                        </div>
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
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
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

        {/* Risk Management */}
        <div className="kite-card">
          <div className="kite-card-header">
            <h2 className="kite-card-title">Risk Management</h2>
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{ 
              padding: '1rem',
              backgroundColor: 'var(--kite-bg-tertiary)',
              borderRadius: 'var(--kite-radius-md)',
              border: '1px solid var(--kite-border-secondary)'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
                Available Margin
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: 'var(--kite-text-primary)' }}>
                ₹{formatCurrency(125000)}
              </div>
            </div>
            <div style={{ 
              padding: '1rem',
              backgroundColor: 'var(--kite-bg-tertiary)',
              borderRadius: 'var(--kite-radius-md)',
              border: '1px solid var(--kite-border-secondary)'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
                Used Margin
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: 'var(--kite-neutral)' }}>
                ₹{formatCurrency(75000)}
              </div>
            </div>
            <div style={{ 
              padding: '1rem',
              backgroundColor: 'var(--kite-bg-tertiary)',
              borderRadius: 'var(--kite-radius-md)',
              border: '1px solid var(--kite-border-secondary)'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
                Margin Utilization
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: 'var(--kite-neutral)' }}>
                37.5%
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Positions;
