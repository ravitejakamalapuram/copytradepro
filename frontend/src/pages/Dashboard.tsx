import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import { portfolioService } from '../services/portfolioService';
// Styles now imported via main.scss



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
      <div className="trading-theme">
        <AppNavigation />
        <div className="dashboard-page">
          <div className="dashboard-page__container">
            <div className="dashboard-loading">
              <div className="dashboard-loading__spinner"></div>
              <div className="dashboard-loading__message">Loading dashboard...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="trading-theme">
        <AppNavigation />
        <div className="dashboard-page">
          <div className="dashboard-page__container">
            <div className="dashboard-empty">
              <div className="dashboard-empty__icon">⚠️</div>
              <h3 className="dashboard-empty__title">Error Loading Dashboard</h3>
              <p className="dashboard-empty__message">{error}</p>
              <button className="dashboard-empty__action" onClick={() => window.location.reload()}>
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="trading-theme">
      <AppNavigation />

      <div className="dashboard-page">
        <div className="dashboard-page__container">
          {/* Portfolio Overview */}
          <div className="portfolio-summary">
            <div className={`portfolio-summary__card ${portfolioSummary.totalPnL >= 0 ? 'portfolio-summary__card--positive' : 'portfolio-summary__card--negative'}`}>
              <div className="portfolio-summary__label">Portfolio Value</div>
              <div className="portfolio-summary__value portfolio-summary__value--neutral">
                ₹{formatCurrency(portfolioSummary.totalValue)}
              </div>
              <div className={`portfolio-summary__change ${portfolioSummary.totalPnL >= 0 ? 'portfolio-summary__change--positive' : 'portfolio-summary__change--negative'}`}>
                {portfolioSummary.totalPnL >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(portfolioSummary.totalPnL))} ({portfolioSummary.totalPnLPercent >= 0 ? '+' : ''}{portfolioSummary.totalPnLPercent.toFixed(2)}%)
              </div>
            </div>

            <div className={`portfolio-summary__card ${portfolioSummary.dayPnL >= 0 ? 'portfolio-summary__card--positive' : 'portfolio-summary__card--negative'}`}>
              <div className="portfolio-summary__label">Day's P&L</div>
              <div className={`portfolio-summary__value ${portfolioSummary.dayPnL >= 0 ? 'portfolio-summary__value--positive' : 'portfolio-summary__value--negative'}`}>
                {portfolioSummary.dayPnL >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(portfolioSummary.dayPnL))}
              </div>
              <div className={`portfolio-summary__change ${portfolioSummary.dayPnL >= 0 ? 'portfolio-summary__change--positive' : 'portfolio-summary__change--negative'}`}>
                {portfolioSummary.dayPnLPercent >= 0 ? '+' : ''}{portfolioSummary.dayPnLPercent.toFixed(2)}%
              </div>
            </div>

            <div className="portfolio-summary__card portfolio-summary__card--neutral">
              <div className="portfolio-summary__label">Total Invested</div>
              <div className="portfolio-summary__value portfolio-summary__value--neutral">
                ₹{formatCurrency(portfolioSummary.totalInvested)}
              </div>
              <div className="portfolio-summary__change">
                Current: ₹{formatCurrency(portfolioSummary.totalValue)}
              </div>
            </div>
          </div>



          {/* Today's Positions */}
          <div className="positions-section">
            <div className="positions-section__header">
              <h2 className="section-title">Recent Positions ({positions.length})</h2>
              <button
                className="view-all-btn"
                onClick={() => navigate('/positions')}
              >
                View All
              </button>
            </div>
            <div className="positions-section__content">
              {positions.length > 0 ? (
                <div className="positions-table-container">
                  <table className="positions-table">
                    <thead className="positions-table__header">
                      <tr>
                        <th>Instrument</th>
                        <th>Qty.</th>
                        <th>Avg. Price</th>
                        <th>LTP</th>
                        <th>P&L</th>
                    <th>Product</th>
                      </tr>
                    </thead>
                    <tbody className="positions-table__body">
                      {positions.map((position, index) => (
                        <tr key={index}>
                          <td>
                            <div className="position-symbol">
                              {position.symbol}
                              <div className="position-symbol__exchange">{position.exchange}</div>
                            </div>
                          </td>
                          <td className={`position-quantity ${position.qty > 0 ? 'position-quantity--positive' : 'position-quantity--negative'}`}>
                            {position.qty > 0 ? '+' : ''}{position.qty}
                          </td>
                          <td className="position-price">
                            {formatCurrency(position.avgPrice)}
                          </td>
                          <td className="position-price">
                            {formatCurrency(position.ltp)}
                          </td>
                          <td className={`position-pnl ${position.pnl >= 0 ? 'position-pnl--positive' : 'position-pnl--negative'}`}>
                            {position.pnl >= 0 ? '+' : ''}₹{formatCurrency(Math.abs(position.pnl))}
                            <div className="position-pnl__percent">
                              {position.pnlPercent >= 0 ? '+' : ''}{position.pnlPercent.toFixed(2)}%
                            </div>
                          </td>
                          <td className="position-product">
                            {position.product}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="dashboard-empty">
                  <div className="dashboard-empty__icon">📊</div>
                  <div className="dashboard-empty__title">No positions today</div>
                  <div className="dashboard-empty__message">Start trading to see your positions here</div>
                  <button
                    className="dashboard-empty__action"
                    onClick={() => navigate('/trade-setup')}
                  >
                    Place Order
                  </button>
                </div>
              )}
            </div>
          </div>


        </div>
      </div>
    </div>
  );
};

export default Dashboard;
