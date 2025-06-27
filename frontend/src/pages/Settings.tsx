import React, { useState } from 'react';
import Navigation from '../components/Navigation';
import NotificationSettings from '../components/NotificationSettings';
import './Settings.css';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'notifications' | 'account' | 'trading'>('notifications');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'notifications':
        return <NotificationSettings />;
      
      case 'account':
        return (
          <div className="settings-content">
            <div className="settings-header">
              <h2>👤 Account Settings</h2>
              <p>Manage your account information and preferences.</p>
            </div>
            <div className="coming-soon">
              <span className="coming-soon-icon">🚧</span>
              <h3>Coming Soon</h3>
              <p>Account settings will be available in a future update.</p>
            </div>
          </div>
        );
      
      case 'trading':
        return (
          <div className="settings-content">
            <div className="settings-header">
              <h2>📈 Trading Settings</h2>
              <p>Configure your trading preferences and risk management.</p>
            </div>
            <div className="coming-soon">
              <span className="coming-soon-icon">🚧</span>
              <h3>Coming Soon</h3>
              <p>Trading settings will be available in a future update.</p>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="settings-page">
      <Navigation />
      
      <div className="settings-container">
        <div className="settings-sidebar">
          <h1>⚙️ Settings</h1>
          
          <nav className="settings-nav">
            <button
              className={`nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
              onClick={() => setActiveTab('notifications')}
            >
              <span className="nav-icon">🔔</span>
              <span className="nav-label">Notifications</span>
              <span className="nav-badge">New</span>
            </button>
            
            <button
              className={`nav-item ${activeTab === 'account' ? 'active' : ''}`}
              onClick={() => setActiveTab('account')}
            >
              <span className="nav-icon">👤</span>
              <span className="nav-label">Account</span>
            </button>
            
            <button
              className={`nav-item ${activeTab === 'trading' ? 'active' : ''}`}
              onClick={() => setActiveTab('trading')}
            >
              <span className="nav-icon">📈</span>
              <span className="nav-label">Trading</span>
            </button>
          </nav>
        </div>
        
        <div className="settings-main">
          {renderTabContent()}
        </div>
      </div>
    </div>
  );
};

export default Settings;
