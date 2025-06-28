import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../styles/kite-theme.css';

const KiteNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    { path: '/holdings', label: 'Holdings', icon: '📈' },
    { path: '/positions', label: 'Positions', icon: '🎯' },
    { path: '/orders', label: 'Orders', icon: '📋' },
    { path: '/funds', label: 'Funds', icon: '💰' },
  ];

  const watchlistItems = [
    { symbol: 'NIFTY 50', ltp: 25637.80, change: -1.26, changePercent: -0.05 },
    { symbol: 'SENSEX', ltp: 84058.90, change: 181.87, changePercent: 0.22 },
    { symbol: 'RELIANCE', ltp: 2847.65, change: 12.45, changePercent: 0.44 },
    { symbol: 'TCS', ltp: 4156.30, change: -23.70, changePercent: -0.57 },
    { symbol: 'INFY', ltp: 1789.25, change: 8.90, changePercent: 0.50 },
    { symbol: 'HDFC BANK', ltp: 1654.80, change: -5.20, changePercent: -0.31 },
  ];

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
                backgroundColor: 'var(--kite-profit)' 
              }}></div>
              Market Open
            </div>

            {/* User Info */}
            <div style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '0.75rem',
              padding: '0.5rem',
              borderRadius: 'var(--kite-radius-md)',
              backgroundColor: 'var(--kite-bg-tertiary)'
            }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ 
                  fontSize: '0.875rem', 
                  fontWeight: '500',
                  color: 'var(--kite-text-primary)' 
                }}>
                  {user?.name || 'User'}
                </div>
                <div style={{ 
                  fontSize: '0.75rem', 
                  color: 'var(--kite-text-secondary)' 
                }}>
                  ID: {user?.id || 'USER123'}
                </div>
              </div>
              <button
                className="kite-btn"
                onClick={handleLogout}
                style={{ 
                  padding: '0.25rem 0.5rem',
                  fontSize: '0.75rem'
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
                ₹5,48,025
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--kite-text-secondary)', fontSize: '0.75rem' }}>
                Day's P&L
              </span>
              <span style={{ 
                fontFamily: 'var(--kite-font-mono)',
                fontWeight: '500',
                color: 'var(--kite-profit)'
              }}>
                +₹2,064 (+0.38%)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--kite-text-secondary)', fontSize: '0.75rem' }}>
                Total P&L
              </span>
              <span style={{ 
                fontFamily: 'var(--kite-font-mono)',
                fontWeight: '500',
                color: 'var(--kite-profit)'
              }}>
                +₹48,025 (+9.61%)
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

      <style jsx>{`
        @media (max-width: 1024px) {
          .mobile-sidebar-toggle {
            display: block !important;
          }
        }
      `}</style>
    </div>
  );
};

export default KiteNavigation;
