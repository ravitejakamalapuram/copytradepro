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
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">👤 Account Settings</h2>
              <p className="card-subtitle">Manage your account information and preferences</p>
            </div>
            <div className="card-body">
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <span className="text-4xl mb-4">🚧</span>
                <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                <p className="text-secondary">Account settings will be available in a future update.</p>
              </div>
            </div>
          </div>
        );
      
      case 'trading':
        return (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">📈 Trading Settings</h2>
              <p className="card-subtitle">Configure your trading preferences and risk management</p>
            </div>
            <div className="card-body">
              <div className="flex flex-col items-center justify-center p-8 text-center">
                <span className="text-4xl mb-4">🚧</span>
                <h3 className="text-lg font-semibold mb-2">Coming Soon</h3>
                <p className="text-secondary">Trading settings will be available in a future update.</p>
              </div>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="app">
      <Navigation />

      <main className="app-main">
        <div className="main-container">
          <div className="page-header">
            <h1 className="page-title">Settings</h1>
            <p className="page-subtitle">Manage your application preferences and configurations</p>
          </div>

          <div className="grid grid-cols-12 gap-6">
            <div className="col-span-3">
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">Categories</h3>
                </div>
                <div className="card-body p-0">
                  <nav className="nav-tabs flex-col">
                    <button
                      className={`nav-tab ${activeTab === 'notifications' ? 'active' : ''}`}
                      onClick={() => setActiveTab('notifications')}
                    >
                      <span className="nav-tab-icon">🔔</span>
                      <span>Notifications</span>
                      <span className="badge badge-info ml-auto">New</span>
                    </button>

                    <button
                      className={`nav-tab ${activeTab === 'account' ? 'active' : ''}`}
                      onClick={() => setActiveTab('account')}
                    >
                      <span className="nav-tab-icon">👤</span>
                      <span>Account</span>
                    </button>

                    <button
                      className={`nav-tab ${activeTab === 'trading' ? 'active' : ''}`}
                      onClick={() => setActiveTab('trading')}
                    >
                      <span className="nav-tab-icon">📈</span>
                      <span>Trading</span>
                    </button>
                  </nav>
                </div>
              </div>
            </div>

            <div className="col-span-9">
              {renderTabContent()}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Settings;
