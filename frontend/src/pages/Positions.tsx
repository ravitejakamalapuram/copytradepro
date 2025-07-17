import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import { portfolioService } from '../services/portfolioService';
import '../styles/app-theme.css';
import Button from '../components/ui/Button'; // Added import for Button

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
      case 'MIS': return 'var(--color-neutral)';
      case 'CNC': return 'var(--color-profit)';
      case 'NRML': return 'var(--interactive-primary)';
      default: return 'var(--text-secondary)';
    }
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
            <div style={{ fontSize: '2rem' }}>🎯</div>
            <div style={{ color: 'var(--text-secondary)' }}>Loading positions...</div>
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
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
            <div style={{ color: 'var(--color-loss)', marginBottom: '1rem' }}>{error}</div>
            <Button
              variant="primary"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-theme app-layout">
      <AppNavigation />
      <div className="app-main">
        {/* Positions Summary */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Positions ({positions.length})</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Button variant="primary">
                + New Position
              </Button>
              <Button variant="secondary">
                📊 Analytics
              </Button>
              <Button variant="outline">
                📥 Export
              </Button>
            </div>
          </div>

          {/* Summary Stats */}
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1.5rem',
            marginBottom: '2rem',
            padding: '1rem',
            backgroundColor: 'var(--bg-tertiary)',
            borderRadius: 'var(--radius-lg)'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Total P&L
              </div>
              <div style={{
                fontSize: '1.25rem',
                fontWeight: '600',
                fontFamily: 'var(--font-mono)',
                color: positionsSummary.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
              }}>
                {positionsSummary.totalPnL >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(positionsSummary.totalPnL))}
              </div>
              <div style={{
                fontSize: '0.875rem',
                color: positionsSummary.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)',
                marginTop: '0.25rem'
              }}>
                {positionsSummary.totalPnLPercent >= 0 ? '+' : ''}{positionsSummary.totalPnLPercent.toFixed(2)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Total Value
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                ₹{formatCurrency(positionsSummary.totalValue)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Long Positions
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-profit)' }}>
                {positions.filter(p => p.qty > 0).length}
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                Short Positions
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', color: 'var(--color-loss)' }}>
                {positions.filter(p => p.qty < 0).length}
              </div>
            </div>
          </div>

          {/* Positions Table */}
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
                    <th>Chg.</th>
                    <th>Product</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position, index) => (
                    <tr key={index}>
                      <td>
                        <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                          {position.symbol}
                        </div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
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
                        <div style={{ fontSize: '0.75rem' }}>
                          {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                        </div>
                      </td>
                      <td style={{ 
                        fontFamily: 'var(--font-mono)',
                        color: position.dayChange >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
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
                          <Button 
                            variant="success"
                            size="sm"
                          >
                            {position.qty > 0 ? 'Sell' : 'Buy'}
                          </Button>
                          <Button 
                            variant="outline"
                            size="sm"
                          >
                            Exit
                          </Button>
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
              color: 'var(--text-secondary)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🎯</div>
              <div style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No positions today</div>
              <div style={{ fontSize: '0.875rem' }}>Start trading to see your positions here</div>
              <Button
                variant="primary"
                onClick={() => navigate('/trade-setup')}
              >
                Place Order
              </Button>
            </div>
          )}
        </div>

        {/* Risk Management */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Risk Management</h2>
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{ 
              padding: '1rem',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-secondary)'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Available Margin
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                ₹{formatCurrency(125000)}
              </div>
            </div>
            <div style={{ 
              padding: '1rem',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-secondary)'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Used Margin
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', fontFamily: 'var(--font-mono)', color: 'var(--color-neutral)' }}>
                ₹{formatCurrency(75000)}
              </div>
            </div>
            <div style={{ 
              padding: '1rem',
              backgroundColor: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-secondary)'
            }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                Margin Utilization
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', fontFamily: 'var(--font-mono)', color: 'var(--color-neutral)' }}>
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
