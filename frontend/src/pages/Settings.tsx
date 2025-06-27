import React, { useState } from 'react';
import Navigation from '../components/Navigation';
import NotificationSettings from '../components/NotificationSettings';
import {
  Container,
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  Grid,

  Badge
} from '../components/ui';
import './Settings.css';

const Settings: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'notifications' | 'account' | 'trading'>('notifications');

  const renderTabContent = () => {
    switch (activeTab) {
      case 'notifications':
        return <NotificationSettings />;
      
      case 'account':
        return (
          <Card>
            <CardHeader
              title="👤 Account Settings"
              subtitle="Manage your account information and preferences"
            />
            <CardContent>
              <div className="settings-coming-soon">
                <span className="coming-soon-icon">🚧</span>
                <h3>Coming Soon</h3>
                <p>Account settings will be available in a future update.</p>
              </div>
            </CardContent>
          </Card>
        );
      
      case 'trading':
        return (
          <Card>
            <CardHeader
              title="📈 Trading Settings"
              subtitle="Configure your trading preferences and risk management"
            />
            <CardContent>
              <div className="settings-coming-soon">
                <span className="coming-soon-icon">🚧</span>
                <h3>Coming Soon</h3>
                <p>Trading settings will be available in a future update.</p>
              </div>
            </CardContent>
          </Card>
        );
      
      default:
        return null;
    }
  };

  return (
    <>
      <Navigation />
      <Container>
        <PageHeader
          title="Settings"
          subtitle="Manage your application preferences and configurations"
        />

        <Grid cols={12} gap={6}>
          <div className="settings-sidebar">
            <Card>
              <CardHeader title="Categories" />
              <CardContent className="settings-nav">
                <nav className="settings-nav-list">
                  <button
                    className={`settings-nav-item ${activeTab === 'notifications' ? 'active' : ''}`}
                    onClick={() => setActiveTab('notifications')}
                  >
                    <span className="nav-icon">🔔</span>
                    <span className="nav-label">Notifications</span>
                    <Badge variant="info" size="sm">New</Badge>
                  </button>

                  <button
                    className={`settings-nav-item ${activeTab === 'account' ? 'active' : ''}`}
                    onClick={() => setActiveTab('account')}
                  >
                    <span className="nav-icon">👤</span>
                    <span className="nav-label">Account</span>
                  </button>

                  <button
                    className={`settings-nav-item ${activeTab === 'trading' ? 'active' : ''}`}
                    onClick={() => setActiveTab('trading')}
                  >
                    <span className="nav-icon">📈</span>
                    <span className="nav-label">Trading</span>
                  </button>
                </nav>
              </CardContent>
            </Card>
          </div>

          <div className="settings-content">
            {renderTabContent()}
          </div>
        </Grid>
      </Container>
    </>
  );
};

export default Settings;
