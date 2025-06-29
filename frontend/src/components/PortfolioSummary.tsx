import React from 'react';
import './PortfolioSummary.css';

interface PortfolioSummaryData {
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

interface PortfolioSummaryProps {
  data: PortfolioSummaryData;
}

const PortfolioSummary: React.FC<PortfolioSummaryProps> = ({ data }) => {
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

  return (
    <div className="portfolio-summary">
      <div className="portfolio-summary__header">
        <h2 className="portfolio-summary__title">Portfolio Summary</h2>
      </div>
      
      <div className="portfolio-summary__content">
        <div className="portfolio-summary__grid">
          {/* Total Portfolio */}
          <div className="portfolio-summary__item portfolio-summary__item--primary">
            <div className="portfolio-summary__label">Total Value</div>
            <div className="portfolio-summary__value portfolio-summary__value--large">
              {formatCurrency(data.totalValue)}
            </div>
            <div 
              className="portfolio-summary__change"
              style={{ color: getPnLColor(data.totalPnL) }}
            >
              {data.totalPnL >= 0 ? '+' : ''}{formatCurrency(data.totalPnL)} 
              ({data.totalPnLPercent >= 0 ? '+' : ''}{formatNumber(data.totalPnLPercent)}%)
            </div>
          </div>

          {/* Holdings */}
          <div className="portfolio-summary__item">
            <div className="portfolio-summary__label">
              <span className="portfolio-summary__icon">📊</span>
              Holdings
            </div>
            <div className="portfolio-summary__value">
              {formatCurrency(data.holdingsValue)}
            </div>
            <div 
              className="portfolio-summary__change"
              style={{ color: getPnLColor(data.holdingsPnL) }}
            >
              {data.holdingsPnL >= 0 ? '+' : ''}{formatCurrency(data.holdingsPnL)}
            </div>
          </div>

          {/* Positions */}
          <div className="portfolio-summary__item">
            <div className="portfolio-summary__label">
              <span className="portfolio-summary__icon">⚡</span>
              Positions
            </div>
            <div className="portfolio-summary__value">
              {formatCurrency(data.positionsValue)}
            </div>
            <div 
              className="portfolio-summary__change"
              style={{ color: getPnLColor(data.positionsPnL) }}
            >
              {data.positionsPnL >= 0 ? '+' : ''}{formatCurrency(data.positionsPnL)}
            </div>
          </div>

          {/* Day P&L */}
          <div className="portfolio-summary__item">
            <div className="portfolio-summary__label">Today's P&L</div>
            <div 
              className="portfolio-summary__value"
              style={{ color: getPnLColor(data.dayPnL) }}
            >
              {data.dayPnL >= 0 ? '+' : ''}{formatCurrency(data.dayPnL)}
            </div>
            <div 
              className="portfolio-summary__change"
              style={{ color: getPnLColor(data.dayPnL) }}
            >
              ({data.dayPnLPercent >= 0 ? '+' : ''}{formatNumber(data.dayPnLPercent)}%)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PortfolioSummary;
