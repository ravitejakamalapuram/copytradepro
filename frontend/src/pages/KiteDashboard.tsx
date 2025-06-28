import React, { useState, useEffect } from 'react';
import KiteNavigation from '../components/KiteNavigation';
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
}

const KiteDashboard: React.FC = () => {
  const [marketData, setMarketData] = useState<MarketData[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [portfolioValue, setPortfolioValue] = useState(548025);
  const [dayPnL, setDayPnL] = useState(2064);
  const [totalPnL, setTotalPnL] = useState(48025);

  useEffect(() => {
    // Mock market data
    const mockMarketData: MarketData[] = [
      { symbol: 'NIFTY 50', ltp: 25637.80, change: -1.26, changePercent: -0.05 },
      { symbol: 'SENSEX', ltp: 84058.90, change: 181.87, changePercent: 0.22 },
      { symbol: 'BANKNIFTY', ltp: 54234.15, change: 234.50, changePercent: 0.43 },
      { symbol: 'FINNIFTY', ltp: 23456.80, change: -123.45, changePercent: -0.52 }
    ];

    // Mock positions
    const mockPositions: Position[] = [
      { symbol: 'RELIANCE', qty: 10, avgPrice: 2847.65, ltp: 2860.00, pnl: 123.50, pnlPercent: 0.43 },
      { symbol: 'TCS', qty: 5, avgPrice: 4156.30, ltp: 4140.00, pnl: -81.50, pnlPercent: -0.39 },
      { symbol: 'INFY', qty: 15, avgPrice: 1789.25, ltp: 1795.00, pnl: 86.25, pnlPercent: 0.32 }
    ];

    setMarketData(mockMarketData);
    setPositions(mockPositions);
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

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
              ₹{formatCurrency(portfolioValue)}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--kite-profit)', marginTop: '0.25rem' }}>
              +₹{formatCurrency(totalPnL)} (+{((totalPnL / (portfolioValue - totalPnL)) * 100).toFixed(2)}%)
            </div>
          </div>

          <div className="kite-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
              Day's P&L
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: dayPnL >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)' }}>
              {dayPnL >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(dayPnL))}
            </div>
            <div style={{ fontSize: '0.875rem', color: dayPnL >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)', marginTop: '0.25rem' }}>
              {dayPnL >= 0 ? '+' : ''}{((dayPnL / portfolioValue) * 100).toFixed(2)}%
            </div>
          </div>

          <div className="kite-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
              Available Margin
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: 'var(--kite-text-primary)' }}>
              ₹{formatCurrency(125000)}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)', marginTop: '0.25rem' }}>
              Used: ₹{formatCurrency(75000)}
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
            <h2 className="kite-card-title">Today's Positions</h2>
            <button className="kite-btn">View All</button>
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
                    <th>Chg.</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position, index) => (
                    <tr key={index}>
                      <td>
                        <div style={{ fontWeight: '500', color: 'var(--kite-text-primary)' }}>
                          {position.symbol}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--kite-font-mono)' }}>
                        {position.qty}
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
                      </td>
                      <td style={{ 
                        fontFamily: 'var(--kite-font-mono)',
                        color: position.pnlPercent >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
                      }}>
                        {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
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
            <button className="kite-btn kite-btn-primary" style={{ padding: '1rem', justifyContent: 'center' }}>
              📈 Place Order
            </button>
            <button className="kite-btn" style={{ padding: '1rem', justifyContent: 'center' }}>
              📊 View Holdings
            </button>
            <button className="kite-btn" style={{ padding: '1rem', justifyContent: 'center' }}>
              🎯 Positions
            </button>
            <button className="kite-btn" style={{ padding: '1rem', justifyContent: 'center' }}>
              💰 Add Funds
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KiteDashboard;
