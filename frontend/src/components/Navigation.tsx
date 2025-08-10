import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Button from './ui/Button';
import { Flex } from '../components/ui';
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
    { path: '/market-overview', label: 'Market', icon: '📊' },
    { path: '/unified-trading', label: 'Unified Trading', icon: '🎯' },
    { path: '/trade-setup', label: 'Legacy Trading', icon: '⚡' },
    { path: '/advanced-orders', label: 'Orders', icon: '📋' },
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
          <span className="enterprise-logo-icon">📈</span>
          CopyTrade Pro
        </a>

        {/* Primary Navigation Links */}
        <div className="enterprise-nav-links">
          {primaryNavItems.map(item => (
            <Button
              key={item.path}
              variant="ghost"
              className={`enterprise-nav-link ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </Button>
          ))}
        </div>

        {/* Secondary Navigation & User Menu */}
        <Flex align="center" gap={3}>
          {/* Secondary Navigation */}
          <div className="enterprise-nav-secondary">
            {secondaryNavItems.map(item => (
              <Button
                key={item.path}
                variant="ghost"
                className={`enterprise-nav-link-secondary ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
                title={item.label}
              >
                <span>{item.icon}</span>
              </Button>
            ))}
          </div>

          <div className="nav-divider"></div>

          <NotificationIcon
            onClick={() => navigate('/settings')}
            showStatus={true}
          />

          <div className="user-info">
            <div className="user-name">{user?.name}</div>
            <div className="user-email">{user?.email}</div>
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
