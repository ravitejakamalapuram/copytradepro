import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

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
  ];

  return (
    <header className="app-header">
      <div className="header-container">
        {/* Brand */}
        <div className="header-brand">
          <span style={{ fontSize: '1.5rem' }}>📈</span>
          CopyTrade Pro
        </div>

        {/* Navigation */}
        <nav className="header-nav">
          <div className="nav-tabs">
            {navItems.map(item => (
              <button
                key={item.path}
                className={`nav-tab ${location.pathname === item.path ? 'active' : ''}`}
                onClick={() => navigate(item.path)}
              >
                <span className="nav-tab-icon">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </nav>

        {/* User Menu */}
        <div className="header-user">
          <div className="flex flex-col items-end">
            <span className="text-sm font-medium text-primary">{user?.name}</span>
            <span className="text-xs text-secondary">{user?.email}</span>
          </div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleLogout}
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navigation;
