import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { Button, Flex } from '../components/ui';

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

  const navItems = [
    { path: '/account-setup', label: 'Account Setup', icon: '🔗' },
    { path: '/trade-setup', label: 'Trade Setup', icon: '📊' },
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

        {/* Navigation Links */}
        <div className="enterprise-nav-links">
          {navItems.map(item => (
            <button
              key={item.path}
              className={`enterprise-nav-link ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </div>

        {/* User Menu */}
        <Flex align="center" gap="4">
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
