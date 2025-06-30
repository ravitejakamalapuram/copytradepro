import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { marketDataService, type MarketIndex } from '../services/marketDataService';
import { portfolioService } from '../services/portfolioService';
import useRealTimeData from '../hooks/useRealTimeData';
import '../styles/app-theme.css';

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
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [marketIndices, setMarketIndices] = useState<MarketIndex[]>([]);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [portfolioSummary, setPortfolioSummary] = useState<PortfolioSummary>({
    totalValue: 0,
    totalPnL: 0,
    dayPnL: 0,
    totalPnLPercent: 0,
    dayPnLPercent: 0
  });

  // Real-time data hook for market status
  const { marketStatus } = useRealTimeData();

  // Fetch live market indices and portfolio data
  useEffect(() => {
    const fetchMarketData = async () => {
      try {
        const indices = await marketDataService.getMarketIndices();
        setMarketIndices(indices);
        setLastUpdated(new Date());
      } catch (error) {
        console.error('Failed to fetch market indices:', error);
      }
    };

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
    fetchMarketData();
    fetchPortfolioData();

    // Update every 30 seconds
    const interval = setInterval(() => {
      fetchMarketData();
      fetchPortfolioData();
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const navItems = [
    { path: '/dashboard', label: 'Dashboard', icon: '📊' },
    { path: '/portfolio', label: 'Portfolio', icon: '📈' },
    { path: '/holdings', label: 'Holdings', icon: '📊' },
    { path: '/orders', label: 'Orders', icon: '📋' },
    { path: '/positions', label: 'Positions', icon: '🎯' },
    { path: '/trade-setup', label: 'Trade', icon: '⚡' },
    { path: '/account-setup', label: 'Accounts', icon: '🔗' },
  ];

  // Use live market indices for watchlist
  const watchlistItems = marketIndices.map(index => ({
    symbol: index.name,
    ltp: index.value,
    change: index.change,
    changePercent: index.changePercent
  }));

  return (
    <div className="kite-theme">
      {/* Top Navigation */}
      <nav className="kite-nav">
        <div className="kite-nav-content">
          {/* Logo */}
          <div className="kite-logo">
            <span style={{ color: '#387ed1' }}>📈</span>
            <span>CopyTrade Pro</span>
          </div>

          {/* Main Navigation */}
          <div className="kite-nav-links">
            {navItems.map((item) => (
              <button
                key={item.path}
                className={`kite-nav-link ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span>{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>

          {/* User Menu */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            {/* Market Status */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              fontSize: '0.75rem',
              color: 'var(--kite-text-secondary)'
            }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: marketStatus?.isOpen ? 'var(--kite-profit)' : 'var(--kite-loss)'
              }}></div>
              {marketStatus?.status || 'Market Status Unknown'}
            </div>

            {/* User Info */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px',
              borderRadius: 'var(--kite-radius-md)',
              backgroundColor: 'var(--kite-bg-tertiary)'
            }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: '11px',
                  fontWeight: '500',
                  color: 'var(--kite-text-primary)',
                  lineHeight: '1.2'
                }}>
                  {user?.name || 'Kamalapuram'}
                </div>
                <div style={{
                  fontSize: '10px',
                  color: 'var(--kite-text-secondary)',
                  lineHeight: '1.2'
                }}>
                </div>
              </div>
              <button
                className="kite-btn"
                onClick={handleLogout}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  minHeight: 'auto'
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Sidebar */}
      <div className={`kite-sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Watchlist Section */}
        <div className="kite-sidebar-section">
          <div className="kite-sidebar-title">Watchlist</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {watchlistItems.map((item, index) => (
              <div
                key={index}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '0.5rem',
                  borderRadius: 'var(--kite-radius-sm)',
                  cursor: 'pointer',
                  transition: 'var(--kite-transition)',
                  fontSize: '0.875rem'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'var(--kite-bg-hover)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'transparent';
                }}
              >
                <div>
                  <div style={{ 
                    fontWeight: '500',
                    color: 'var(--kite-text-primary)',
                    fontSize: '0.75rem'
                  }}>
                    {item.symbol}
                  </div>
                  <div style={{ 
                    fontSize: '0.875rem',
                    fontFamily: 'var(--kite-font-mono)',
                    color: 'var(--kite-text-primary)'
                  }}>
                    {item.ltp.toFixed(2)}
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ 
                    fontSize: '0.75rem',
                    fontFamily: 'var(--kite-font-mono)',
                    color: item.change >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
                  }}>
                    {item.change >= 0 ? '+' : ''}{item.change.toFixed(2)}
                  </div>
                  <div style={{ 
                    fontSize: '0.75rem',
                    fontFamily: 'var(--kite-font-mono)',
                    color: item.changePercent >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
                  }}>
                    ({item.changePercent >= 0 ? '+' : ''}{item.changePercent.toFixed(2)}%)
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Live Data Indicator */}
          {lastUpdated && (
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--kite-text-secondary)',
              textAlign: 'center',
              marginTop: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.25rem'
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                backgroundColor: 'var(--kite-profit)',
                borderRadius: '50%',
                animation: 'pulse 2s infinite'
              }}></span>
              Live • {lastUpdated.toLocaleTimeString('en-IN', {
                hour: '2-digit',
                minute: '2-digit'
              })}
            </div>
          )}
        </div>

        {/* Portfolio Summary */}
        <div className="kite-sidebar-section">
          <div className="kite-sidebar-title">Portfolio</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--kite-text-secondary)', fontSize: '0.75rem' }}>
                Total Value
              </span>
              <span style={{
                fontFamily: 'var(--kite-font-mono)',
                fontWeight: '500',
                color: 'var(--kite-text-primary)'
              }}>
                ₹{(portfolioSummary?.totalValue || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--kite-text-secondary)', fontSize: '0.75rem' }}>
                Day's P&L
              </span>
              <span style={{
                fontFamily: 'var(--kite-font-mono)',
                fontWeight: '500',
                color: (portfolioSummary?.dayPnL || 0) >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
              }}>
                {(portfolioSummary?.dayPnL || 0) >= 0 ? '+' : ''}₹{Math.abs(portfolioSummary?.dayPnL || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({(portfolioSummary?.dayPnLPercent || 0) >= 0 ? '+' : ''}{(portfolioSummary?.dayPnLPercent || 0).toFixed(2)}%)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--kite-text-secondary)', fontSize: '0.75rem' }}>
                Total P&L
              </span>
              <span style={{
                fontFamily: 'var(--kite-font-mono)',
                fontWeight: '500',
                color: (portfolioSummary?.totalPnL || 0) >= 0 ? 'var(--kite-profit)' : 'var(--kite-loss)'
              }}>
                {(portfolioSummary?.totalPnL || 0) >= 0 ? '+' : ''}₹{Math.abs(portfolioSummary?.totalPnL || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })} ({(portfolioSummary?.totalPnLPercent || 0) >= 0 ? '+' : ''}{(portfolioSummary?.totalPnLPercent || 0).toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="kite-sidebar-section">
          <div className="kite-sidebar-title">Quick Actions</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <button 
              className="kite-btn kite-btn-primary"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => navigate('/trade-setup')}
            >
              Place Order
            </button>
            <button 
              className="kite-btn"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => navigate('/advanced-orders')}
            >
              Advanced Orders
            </button>
            <button 
              className="kite-btn"
              style={{ width: '100%', justifyContent: 'center' }}
              onClick={() => navigate('/portfolio')}
            >
              View Analytics
            </button>
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
          backgroundColor: 'var(--kite-bg-secondary)',
          border: '1px solid var(--kite-border-primary)',
          borderRadius: 'var(--kite-radius-md)',
          color: 'var(--kite-text-primary)',
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
    </div>
  );
};

export default AppNavigation;
