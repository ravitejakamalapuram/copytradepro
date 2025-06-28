import React, { useState, useEffect } from 'react';
import KiteNavigation from '../components/KiteNavigation';
import '../styles/kite-theme.css';

interface Holding {
  symbol: string;
  qty: number;
  avgCost: number;
  ltp: number;
  invested: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  dayChange: number;
  dayChangePercent: number;
}

const KiteHoldings: React.FC = () => {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [totalInvested, setTotalInvested] = useState(0);
  const [currentValue, setCurrentValue] = useState(0);
  const [totalPnL, setTotalPnL] = useState(0);
  const [dayPnL, setDayPnL] = useState(0);

  // Mock data similar to Kite interface
  useEffect(() => {
    const mockHoldings: Holding[] = [
      {
        symbol: 'ADANIENT',
        qty: 22,
        avgCost: 399.68,
        ltp: 444.00,
        invested: 8793.00,
        currentValue: 9768.00,
        pnl: 975.00,
        pnlPercent: 11.09,
        dayChange: -11.20,
        dayChangePercent: -2.46
      },
      {
        symbol: 'ANGELONE',
        qty: 3,
        avgCost: 2325.48,
        ltp: 2920.00,
        invested: 6976.45,
        currentValue: 8760.00,
        pnl: 1783.55,
        pnlPercent: 25.57,
        dayChange: -35.30,
        dayChangePercent: -1.19
      },
      {
        symbol: 'AONETOTAL',
        qty: 204,
        avgCost: 11.69,
        ltp: 11.91,
        invested: 2384.76,
        currentValue: 2429.64,
        pnl: 44.88,
        pnlPercent: 1.88,
        dayChange: 0.18,
        dayChangePercent: 1.54
      },
      {
        symbol: 'APLAPOLLO',
        qty: 5,
        avgCost: 1455.83,
        ltp: 1747.80,
        invested: 7279.15,
        currentValue: 8739.00,
        pnl: 1459.85,
        pnlPercent: 20.05,
        dayChange: -30.20,
        dayChangePercent: -1.67
      },
      {
        symbol: 'BEL',
        qty: 50,
        avgCost: 297.27,
        ltp: 414.95,
        invested: 14863.53,
        currentValue: 20747.50,
        pnl: 5883.97,
        pnlPercent: 39.59,
        dayChange: -39.85,
        dayChangePercent: -8.75
      },
      {
        symbol: 'BHEL',
        qty: 35,
        avgCost: 205.08,
        ltp: 253.45,
        invested: 7792.99,
        currentValue: 8870.75,
        pnl: 1077.76,
        pnlPercent: 13.83,
        dayChange: -28.40,
        dayChangePercent: -10.08
      }
    ];

    setHoldings(mockHoldings);

    // Calculate totals
    const invested = mockHoldings.reduce((sum, holding) => sum + holding.invested, 0);
    const current = mockHoldings.reduce((sum, holding) => sum + holding.currentValue, 0);
    const pnl = current - invested;
    const dayPnL = mockHoldings.reduce((sum, holding) => sum + (holding.dayChange * holding.qty), 0);

    setTotalInvested(invested);
    setCurrentValue(current);
    setTotalPnL(pnl);
    setDayPnL(dayPnL);
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const formatNumber = (num: number): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(num);
  };

  return (
    <div className="kite-theme">
      <KiteNavigation />
      
      <div className="kite-main">
        {/* Portfolio Summary */}
        <div className="kite-card">
          <div className="kite-card-header">
            <h2 className="kite-card-title">Holdings ({holdings.length})</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button className="kite-btn">
                📊 Analytics
              </button>
              <button className="kite-btn">
                📥 Download
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
              <div style={{ 
                fontSize: '0.75rem', 
                color: 'var(--kite-text-secondary)',
                marginBottom: '0.25rem'
              }}>
                Total Investment
              </div>
              <div style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600',
                fontFamily: 'var(--kite-font-mono)',
                color: 'var(--kite-text-primary)'
              }}>
                ₹{formatCurrency(totalInvested)}
              </div>
            </div>
            <div>
              <div style={{ 
                fontSize: '0.75rem', 
                color: 'var(--kite-text-secondary)',
                marginBottom: '0.25rem'
              }}>
                Current Value
              </div>
              <div style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600',
                fontFamily: 'var(--kite-font-mono)',
                color: 'var(--kite-text-primary)'
              }}>
                ₹{formatCurrency(currentValue)}
              </div>
            </div>
            <div>
              <div style={{ 
                fontSize: '0.75rem', 
                color: 'var(--kite-text-secondary)',
                marginBottom: '0.25rem'
              }}>
                Day's P&L
              </div>
              <div style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600',
                fontFamily: 'var(--kite-font-mono)',
                color: dayPnL >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
              }}>
                {dayPnL >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(dayPnL))}
              </div>
            </div>
            <div>
              <div style={{ 
                fontSize: '0.75rem', 
                color: 'var(--kite-text-secondary)',
                marginBottom: '0.25rem'
              }}>
                Total P&L
              </div>
              <div style={{ 
                fontSize: '1.25rem', 
                fontWeight: '600',
                fontFamily: 'var(--kite-font-mono)',
                color: totalPnL >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
              }}>
                {totalPnL >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(totalPnL))} ({((totalPnL / totalInvested) * 100).toFixed(2)}%)
              </div>
            </div>
          </div>

          {/* Holdings Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="kite-table">
              <thead>
                <tr>
                  <th>Instrument</th>
                  <th>Qty.</th>
                  <th>Avg. cost</th>
                  <th>LTP</th>
                  <th>Invested</th>
                  <th>Cur. val</th>
                  <th>P&L</th>
                  <th>Net chg.</th>
                  <th>Day chg.</th>
                </tr>
              </thead>
              <tbody>
                {holdings.map((holding, index) => (
                  <tr key={index}>
                    <td>
                      <div style={{ fontWeight: '500', color: 'var(--kite-text-primary)' }}>
                        {holding.symbol}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--kite-font-mono)' }}>
                      {holding.qty}
                    </td>
                    <td style={{ fontFamily: 'var(--kite-font-mono)' }}>
                      {formatNumber(holding.avgCost)}
                    </td>
                    <td style={{ fontFamily: 'var(--kite-font-mono)' }}>
                      {formatNumber(holding.ltp)}
                    </td>
                    <td style={{ fontFamily: 'var(--kite-font-mono)' }}>
                      {formatCurrency(holding.invested)}
                    </td>
                    <td style={{ fontFamily: 'var(--kite-font-mono)' }}>
                      {formatCurrency(holding.currentValue)}
                    </td>
                    <td style={{ 
                      fontFamily: 'var(--kite-font-mono)',
                      color: holding.pnl >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
                    }}>
                      {holding.pnl >= 0 ? '+' : ''}{formatCurrency(Math.abs(holding.pnl))}
                      <div style={{ fontSize: '0.75rem' }}>
                        {holding.pnlPercent >= 0 ? '+' : ''}{holding.pnlPercent.toFixed(2)}%
                      </div>
                    </td>
                    <td style={{ 
                      fontFamily: 'var(--kite-font-mono)',
                      color: holding.pnl >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
                    }}>
                      {holding.pnl >= 0 ? '+' : ''}{holding.pnlPercent.toFixed(2)}%
                    </td>
                    <td style={{ 
                      fontFamily: 'var(--kite-font-mono)',
                      color: holding.dayChange >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
                    }}>
                      {holding.dayChange >= 0 ? '+' : ''}{holding.dayChangePercent.toFixed(2)}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KiteHoldings;
