import React, { useState, useEffect } from 'react';
import KiteNavigation from '../components/KiteNavigation';
import '../styles/kite-theme.css';

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

const KitePositions: React.FC = () => {
  const [positions, setPositions] = useState<Position[]>([]);
  const [totalPnL, setTotalPnL] = useState(0);
  const [totalInvested, setTotalInvested] = useState(0);

  useEffect(() => {
    // Mock positions data
    const mockPositions: Position[] = [
      {
        symbol: 'RELIANCE',
        qty: 10,
        avgPrice: 2847.65,
        ltp: 2860.00,
        pnl: 123.50,
        pnlPercent: 0.43,
        dayChange: 12.35,
        dayChangePercent: 0.43,
        product: 'CNC',
        exchange: 'NSE'
      },
      {
        symbol: 'TCS',
        qty: -5,
        avgPrice: 4156.30,
        ltp: 4140.00,
        pnl: 81.50,
        pnlPercent: 0.39,
        dayChange: -16.30,
        dayChangePercent: -0.39,
        product: 'MIS',
        exchange: 'NSE'
      },
      {
        symbol: 'INFY',
        qty: 15,
        avgPrice: 1789.25,
        ltp: 1795.00,
        pnl: 86.25,
        pnlPercent: 0.32,
        dayChange: 5.75,
        dayChangePercent: 0.32,
        product: 'CNC',
        exchange: 'NSE'
      },
      {
        symbol: 'HDFC',
        qty: -8,
        avgPrice: 1654.80,
        ltp: 1642.50,
        pnl: 98.40,
        pnlPercent: 0.74,
        dayChange: -12.30,
        dayChangePercent: -0.74,
        product: 'MIS',
        exchange: 'NSE'
      },
      {
        symbol: 'ICICIBANK',
        qty: 12,
        avgPrice: 1234.50,
        ltp: 1245.75,
        pnl: 135.00,
        pnlPercent: 0.91,
        dayChange: 11.25,
        dayChangePercent: 0.91,
        product: 'CNC',
        exchange: 'NSE'
      }
    ];

    setPositions(mockPositions);

    // Calculate totals
    const totalPnL = mockPositions.reduce((sum, pos) => sum + pos.pnl, 0);
    const totalInvested = mockPositions.reduce((sum, pos) => sum + (Math.abs(pos.qty) * pos.avgPrice), 0);
    
    setTotalPnL(totalPnL);
    setTotalInvested(totalInvested);
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

  return (
    <div className="kite-theme">
      <KiteNavigation />
      
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
                color: totalPnL >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
              }}>
                {totalPnL >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(totalPnL))}
              </div>
              <div style={{ 
                fontSize: '0.875rem', 
                color: totalPnL >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)',
                marginTop: '0.25rem'
              }}>
                {totalPnL >= 0 ? '+' : ''}{((totalPnL / totalInvested) * 100).toFixed(2)}%
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginBottom: '0.25rem' }}>
                Total Value
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: 'var(--kite-text-primary)' }}>
                ₹{formatCurrency(totalInvested + totalPnL)}
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

export default KitePositions;
