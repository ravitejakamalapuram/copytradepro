import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useResourceCleanup } from '../hooks/useResourceCleanup';
import { portfolioService } from '../services/portfolioService';

import '../styles/app-theme.css';
import Button from './ui/Button';
import { UserDropdown } from './ui/UserDropdown';

interface PortfolioSummary {
  totalValue: number;
  totalPnL: number;
  dayPnL: number;
  totalPnLPercent: number;
  dayPnLPercent: number;
}

const AppNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Auth context available if needed
  const { registerInterval } = useResourceCleanup('AppNavigation');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    totalValue: 0,
    totalPnL: 0,
    dayPnL: 0,
    totalPnLPercent: 0,
    dayPnLPercent: 0
  });

  // Fetch portfolio data
  useEffect(() => {
    const fetchPortfolioData = async () => {
      try {
        const metrics = await portfolioService.getMetrics();
        setPortfolioSummary({
          totalValue: metrics.currentValue,
          totalPnL: metrics.totalPnL,
          dayPnL: metrics.dayPnL,
          totalPnLPercent: metrics.totalPnLPercentage,
          dayPnLPercent: metrics.dayPnL > 0 ? (metrics.dayPnL / metrics.currentValue) * 100 : 0
        });
      } catch (error) {
        console.error('Failed to fetch portfolio data:', error);
        // Keep default values on error
      }
    };

    // Initial fetch
    fetchPortfolioData();

    // Update every 30 seconds
    const interval = setInterval(() => {
      fetchPortfolioData();
    }, 30000);

    // Register interval for cleanup
    registerInterval(interval);

    return () => clearInterval(interval);
  }, [registerInterval]);



  // Check if user is admin (removed unused variable)

  const navItems = [
    // { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    // { path: '/portfolio', label: 'Portfolio', icon: '📈' },
    // { path: '/holdings', label: 'Holdings', icon: '📊' },
    { path: '/trade-setup', label: 'Trade', icon: '⚡' },
    { path: '/orders', label: 'Orders', icon: '📋' },
    // { path: '/positions', label: 'Positions', icon: '🎯' },
    { path: '/account-setup', label: 'Accounts', icon: '🔗' },
  ];

  // Use only regular nav items - admin items moved to user dropdown
  const allNavItems = navItems;

  // Static watchlist items for demo
  const watchlistItems = [
    { symbol: 'RELIANCE', ltp: 2485, change: 12.5, changePercent: 0.5 },
    { symbol: 'TCS', ltp: 3520, change: -25.0, changePercent: -0.7 },
    { symbol: 'INFY', ltp: 1650, change: 8.0, changePercent: 0.5 }
  ];

  return (
    <>
      {/* Top Navigation */}
      <nav className="app-nav">
        <div className="app-nav-content">
          {/* Logo */}
          <div className="app-logo">
            <span className="logo-icon">📈</span>
            <span>CopyTrade Pro</span>
          </div>

          {/* Main Navigation */}
          <div className="app-nav-links">
            {allNavItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                className={`app-nav-link ${location.pathname === item.path || location.pathname.startsWith(item.path) ? 'app-nav-link--active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </Button>
            ))}
          </div>

          {/* User Menu */}
          <div className="nav-user-menu">
            <UserDropdown />
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <div className={`app-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Watchlist Section */}
        <div className="app-sidebar-section">
          <div className="app-sidebar-title">Watchlist</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {watchlistItems.map((item, index) => (
              <div
                key={index}
                className="watchlist-item"
                onMouseEnter={(e) => {
                  e.currentTarget.classList.add('bg-hover');
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.classList.remove('bg-hover');
                }}
              >
                <div>
                  <div className="text-primary" style={{ fontSize: '0.75rem' }}>
                    {item.symbol}
                  </div>
                  <div className="text-primary" style={{ fontSize: '0.875rem' }}>
                    {item.ltp.toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className={item.change >= 0 ? 'pnl-positive' : 'pnl-negative'} style={{ fontSize: '0.75rem' }}>
                    {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}
                  </div>
                  <div className={item.changePercent >= 0 ? 'pnl-positive' : 'pnl-negative'} style={{ fontSize: '0.75rem' }}>
                    ({item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%)
                  </div>
                </div>
              </div>
            ))}
          </div>


        </div>

        {/* Portfolio Summary */}
        <div className="app-sidebar-section">
          <div className="app-sidebar-title">Portfolio</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div className="portfolio-summary-item">
              <span className="text-muted">Total Value</span>
              <span className="text-primary">
                ₹{(portfolioSummary?.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div className="portfolio-summary-item">
              <span className="text-muted">Day's P&L</span>
              <span className={`text-primary ${portfolioSummary?.dayPnL >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                {(portfolioSummary?.dayPnL || 0) >= 0 ? '+' : ''}₹{Math.abs(portfolioSummary?.dayPnL || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({(portfolioSummary?.dayPnLPercent || 0) >= 0 ? '+' : ''}{(portfolioSummary?.dayPnLPercent || 0).toFixed(2)}%)
              </span>
            </div>
            <div className="portfolio-summary-item">
              <span className="text-muted">Total P&L</span>
              <span className={`text-primary ${portfolioSummary?.totalPnL >= 0 ? 'pnl-positive' : 'pnl-negative'}`}>
                {(portfolioSummary?.totalPnL || 0) >= 0 ? '+' : ''}₹{Math.abs(portfolioSummary?.totalPnL || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({(portfolioSummary?.totalPnLPercent || 0) >= 0 ? '+' : ''}{(portfolioSummary?.totalPnLPercent || 0).toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="app-sidebar-section">
          <div className="app-sidebar-title">Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <Button
              className="btn btn-primary"
              onClick={() => navigate('/trade-setup')}
            >
              Place Order
            </Button>
            <Button
              className="btn"
              onClick={() => navigate('/advanced-orders')}
            >
              Advanced Orders
            </Button>
            <Button
              className="btn"
              onClick={() => navigate('/portfolio')}
            >
              View Analytics
            </Button>
            <Button
              className="btn"
              onClick={() => navigate('/alerts')}
            >
              🔔 Alerts
            </Button>
            <Button
              className="btn"
              onClick={() => navigate('/risk-management')}
            >
              ⚠️ Risk Management
            </Button>
            <Button
              className="btn"
              onClick={() => navigate('/copy-trading')}
            >
              📋 Copy Trading
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Sidebar Toggle */}
      <button
        style={{
          position: 'fixed',
          top: '70px',
          left: '1rem',
          zIndex: 101,
          display: 'none',
          padding: '0.5rem',
          backgroundColor: 'var(--bg-secondary)',
          border: '1px solid var(--border-primary)',
          borderRadius: 'var(--radius-md)',
          color: 'var(--text-primary)',
          cursor: 'pointer'
        }}
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className="mobile-sidebar-toggle"
      >
        ☰
      </button>

      <style>{`
        @media (max-width: 1024px) {
          .mobile-sidebar-toggle {
            display: block !important;
          }
        }
      `}</style>
    </>
  );
};

export default AppNavigation;
