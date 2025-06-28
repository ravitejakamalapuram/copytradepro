import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button, Flex } from '../components/ui';
import NotificationIcon from './NotificationIcon';

const Navigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to logout?')) {
      await logout();
      navigate('/');
    }
  };

  const primaryNavItems = [
    { path: '/trade-setup', label: 'Trading', icon: '📊' },
    { path: '/advanced-orders', label: 'Orders', icon: '🎯' },
    { path: '/portfolio', label: 'Portfolio', icon: '📈' },
  ];

  const secondaryNavItems = [
    { path: '/account-setup', label: 'Accounts', icon: '🔗' },
    { path: '/settings', label: 'Settings', icon: '⚙️' },
    { path: '/demo', label: 'Components', icon: '🎨' },
  ];

  return (
    <nav className="enterprise-nav">
      <div className="enterprise-nav-content">
        {/* Brand */}
        <a href="/" className="enterprise-logo">
          <span style={{ fontSize: '1.5rem' }}>📈</span>
          CopyTrade Pro
        </a>

        {/* Primary Navigation Links */}
        <div className="enterprise-nav-links">
          {primaryNavItems.map(item => (
            <button
              key={item.path}
              className={`enterprise-nav-link ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                padding: '0.75rem 1rem',
                border: 'none',
                background: location.pathname === item.path ? '#3b82f6' : 'transparent',
                color: location.pathname === item.path ? 'white' : '#64748b',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: '500',
                transition: 'all 0.2s ease',
                textDecoration: 'none'
              }}
              onMouseEnter={(e) => {
                if (location.pathname !== item.path) {
                  e.currentTarget.style.backgroundColor = '#f1f5f9';
                  e.currentTarget.style.color = '#1e293b';
                }
              }}
              onMouseLeave={(e) => {
                if (location.pathname !== item.path) {
                  e.currentTarget.style.backgroundColor = 'transparent';
                  e.currentTarget.style.color = '#64748b';
                }
              }}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* Secondary Navigation & User Menu */}
        <Flex align="center" gap={3}>
          {/* Secondary Navigation */}
          <div className="enterprise-nav-secondary">
            {secondaryNavItems.map(item => (
              <button
                key={item.path}
                className={`enterprise-nav-link-secondary ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                title={item.label}
                style={{
                  padding: '0.5rem',
                  border: 'none',
                  background: 'transparent',
                  borderRadius: '0.375rem',
                  cursor: 'pointer',
                  fontSize: '1rem',
                  color: location.pathname === item.path ? '#3b82f6' : '#64748b',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (location.pathname !== item.path) {
                    e.currentTarget.style.color = '#1e293b';
                    e.currentTarget.style.backgroundColor = '#f1f5f9';
                  }
                }}
                onMouseLeave={(e) => {
                  if (location.pathname !== item.path) {
                    e.currentTarget.style.color = '#64748b';
                    e.currentTarget.style.backgroundColor = 'transparent';
                  }
                }}
              >
                <span>{item.icon}</span>
              </button>
            ))}
          </div>

          <div style={{
            width: '1px',
            height: '1.5rem',
            backgroundColor: '#e2e8f0',
            margin: '0 0.5rem'
          }}></div>

          <NotificationIcon
            onClick={() => navigate('/settings')}
            showStatus={true}
          />

          <div style={{ textAlign: 'right' }}>
            <div style={{
              fontWeight: '600',
              color: '#0f172a',
              fontSize: '0.875rem',
              lineHeight: '1.25'
            }}>
              {user?.name}
            </div>
            <div style={{
              fontSize: '0.75rem',
              color: '#64748b',
              lineHeight: '1.25'
            }}>
              {user?.email}
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleLogout}
          >
            Logout
          </Button>
        </Flex>
      </div>
    </nav>
  );
};

export default Navigation;
