import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import './Navigation.css';

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
    <nav className="navigation">
      <div className="nav-container">
        {/* Logo/Brand */}
        <div className="nav-brand">
          <h2>CopyTrade Pro</h2>
        </div>

        {/* Navigation Links */}
        <div className="nav-links">
          {navItems.map(item => (
            <button
              key={item.path}
              className={`nav-link ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </div>

        {/* User Menu */}
        <div className="nav-user">
          <div className="user-info">
            <span className="user-name">{user?.name}</span>
            <span className="user-email">{user?.email}</span>
          </div>
          <button className="logout-btn" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;
