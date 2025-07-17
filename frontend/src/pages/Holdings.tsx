import React, { useState, useEffect } from 'react';
import AppNavigation from '../components/AppNavigation';
import { portfolioService } from '../services/portfolioService';
import '../styles/app-theme.css';
import Button from '../components/ui/Button';

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
  exchange?: string;
  product?: string;
}

interface HoldingsSummary {
  totalValue: number;
  totalInvested: number;
  totalPnL: number;
  dayPnL: number;
  totalPnLPercent: number;
  dayPnLPercent: number;
}

const Holdings: React.FC = () => {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [portfolioSummary, setPortfolioSummary] = useState<HoldingsSummary>({
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
    const fetchHoldingsData = async () => {
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

        // Fetch positions (treating them as holdings for now)
        const positionsResponse = await portfolioService.getPositions();
        // Convert PortfolioPosition to holdings format
        const holdingsData = positionsResponse.positions.map((position: any) => ({
            symbol: position.symbol,
            qty: position.totalQuantity,
            avgCost: position.averagePrice,
            ltp: position.currentValue / position.totalQuantity, // Calculate LTP
            invested: position.investedValue,
            currentValue: position.currentValue,
            pnl: position.pnl,
            pnlPercent: position.pnlPercentage,
            dayChange: 0, // Not available in current API
            dayChangePercent: 0, // Not available in current API
            exchange: 'NSE', // Default exchange
            product: 'CNC' // Default product
          }));
          setHoldings(holdingsData);

      } catch (error: any) {
        console.error('Failed to fetch holdings data:', error);
        setError('Failed to load holdings data');
      } finally {
        setLoading(false);
      }
    };

    fetchHoldingsData();
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
            <div style={{ fontSize: '2rem' }}>📊</div>
            <div style={{ color: 'var(--kite-text-secondary)' }}>Loading holdings...</div>
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
    <div className="kite-theme">
      <AppNavigation />
      
      <div className="kite-main">
        {/* Portfolio Summary */}
        <div className="kite-card">
          <div className="kite-card-header">
            <h2 className="kite-card-title">Holdings ({holdings.length})</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Button variant="primary">
                📊 Analytics
              </Button>
              <Button variant="outline">
                📥 Download
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
                ₹{formatCurrency(portfolioSummary.totalInvested)}
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
                ₹{formatCurrency(portfolioSummary.totalValue)}
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
                color: portfolioSummary.dayPnL >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
              }}>
                {portfolioSummary.dayPnL >= 0 ? '+' : ''}{formatCurrency(Math.abs(portfolioSummary.dayPnL))}
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
                color: portfolioSummary.totalPnL >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
              }}>
                {portfolioSummary.totalPnL >= 0 ? '+' : ''}{formatCurrency(Math.abs(portfolioSummary.totalPnL))} ({portfolioSummary.totalPnLPercent.toFixed(2)}%)
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

export default Holdings;
