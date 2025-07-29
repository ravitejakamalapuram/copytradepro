import React, { useState } from 'react';
import AppNavigation from '../components/AppNavigation';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import { Stack, Grid, Flex } from '../components/ui/Layout';
import { useTheme, type Theme, type ColorScheme } from '../context/ThemeContext';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../components/Toast';
import { PageTransition } from '../utils/animations';
import '../styles/app-theme.css';

interface NotificationSettings {
  priceAlerts: boolean;
  portfolioAlerts: boolean;
  tradeExecutions: boolean;
  riskWarnings: boolean;
  emailNotifications: boolean;
  pushNotifications: boolean;
}

interface TradingSettings {
  defaultOrderType: 'MARKET' | 'LIMIT';
  defaultExchange: 'NSE' | 'BSE';
  defaultProduct: 'CNC' | 'MIS' | 'NRML';
  confirmBeforeOrder: boolean;
  autoRefreshInterval: number;
  maxPositionSize: number;
  riskPercentage: number;
}

const UserSettings: React.FC = () => {
  const { theme, colorScheme, setTheme, setColorScheme } = useTheme();
  const { user } = useAuth();
  const { showToast } = useToast();

  const [notificationSettings, setNotificationSettings] = useState<NotificationSettings>({
    priceAlerts: true,
    portfolioAlerts: true,
    tradeExecutions: true,
    riskWarnings: true,
    emailNotifications: false,
    pushNotifications: true
  });

  const [tradingSettings, setTradingSettings] = useState<TradingSettings>({
    defaultOrderType: 'LIMIT',
    defaultExchange: 'NSE',
    defaultProduct: 'CNC',
    confirmBeforeOrder: true,
    autoRefreshInterval: 5,
    maxPositionSize: 100000,
    riskPercentage: 2
  });

  const [activeTab, setActiveTab] = useState<'appearance' | 'notifications' | 'trading' | 'account'>('appearance');

  const themeOptions: { value: Theme; label: string; description: string }[] = [
    { value: 'light', label: 'Light', description: 'Clean and bright interface' },
    { value: 'dark', label: 'Dark', description: 'Easy on the eyes for long sessions' },
    { value: 'auto', label: 'Auto', description: 'Follows your system preference' }
  ];

  const colorSchemes: { value: ColorScheme; label: string; color: string }[] = [
    { value: 'blue', label: 'Blue', color: '#3b82f6' },
    { value: 'green', label: 'Green', color: '#10b981' },
    { value: 'purple', label: 'Purple', color: '#8b5cf6' },
    { value: 'orange', label: 'Orange', color: '#f59e0b' }
  ];

  const handleNotificationChange = (key: keyof NotificationSettings, value: boolean) => {
    setNotificationSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleTradingSettingChange = (key: keyof TradingSettings, value: any) => {
    setTradingSettings(prev => ({ ...prev, [key]: value }));
  };

  const saveSettings = () => {
    // Here you would save settings to backend
    showToast({ type: 'success', title: 'Settings saved successfully' });
  };

  const resetToDefaults = () => {
    setTheme('auto');
    setColorScheme('blue');
    setNotificationSettings({
      priceAlerts: true,
      portfolioAlerts: true,
      tradeExecutions: true,
      riskWarnings: true,
      emailNotifications: false,
      pushNotifications: true
    });
    setTradingSettings({
      defaultOrderType: 'LIMIT',
      defaultExchange: 'NSE',
      defaultProduct: 'CNC',
      confirmBeforeOrder: true,
      autoRefreshInterval: 5,
      maxPositionSize: 100000,
      riskPercentage: 2
    });
    showToast({ type: 'success', title: 'Settings reset to defaults' });
  };

  return (
    <div className="app-theme app-layout">
      <AppNavigation />
      <PageTransition>
        <div className="app-main">
          <Stack gap={6}>
            {/* Header */}
            <Flex justify="between" align="center">
              <div>
                <h1 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
                  Settings
                </h1>
                <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>
                  Customize your CopyTrade Pro experience
                </p>
              </div>
              <Flex gap={2}>
                <Button variant="outline" onClick={resetToDefaults}>
                  Reset to Defaults
                </Button>
                <Button variant="primary" onClick={saveSettings}>
                  Save Changes
                </Button>
              </Flex>
            </Flex>

            {/* Tab Navigation */}
            <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-primary)' }}>
              {[
                { key: 'appearance', label: 'Appearance', icon: '🎨' },
                { key: 'notifications', label: 'Notifications', icon: '🔔' },
                { key: 'trading', label: 'Trading', icon: '📈' },
                { key: 'account', label: 'Account', icon: '👤' }
              ].map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  style={{
                    padding: '0.75rem 1rem',
                    border: 'none',
                    background: 'none',
                    color: activeTab === tab.key ? 'var(--interactive-primary)' : 'var(--text-secondary)',
                    borderBottom: activeTab === tab.key ? '2px solid var(--interactive-primary)' : '2px solid transparent',
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem'
                  }}
                >
                  <span>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Appearance Settings */}
            {activeTab === 'appearance' && (
              <Stack gap={4}>
                <Card>
                  <CardHeader title="Theme Preference" />
                  <CardContent>
                    <Stack gap={4}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500' }}>
                          Choose your preferred theme
                        </label>
                        <Grid cols={3} gap={3}>
                          {themeOptions.map(option => (
                            <div
                              key={option.value}
                              onClick={() => setTheme(option.value)}
                              style={{
                                padding: '1rem',
                                border: theme === option.value ? '2px solid var(--interactive-primary)' : '1px solid var(--border-secondary)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                textAlign: 'center',
                                backgroundColor: theme === option.value ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>
                                {option.value === 'light' ? '☀️' : option.value === 'dark' ? '🌙' : '🌓'}
                              </div>
                              <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                                {option.label}
                              </div>
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                {option.description}
                              </div>
                            </div>
                          ))}
                        </Grid>
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '1rem', fontWeight: '500' }}>
                          Color Scheme
                        </label>
                        <Grid cols={4} gap={3}>
                          {colorSchemes.map(scheme => (
                            <div
                              key={scheme.value}
                              onClick={() => setColorScheme(scheme.value)}
                              style={{
                                padding: '1rem',
                                border: colorScheme === scheme.value ? '2px solid var(--interactive-primary)' : '1px solid var(--border-secondary)',
                                borderRadius: 'var(--radius-md)',
                                cursor: 'pointer',
                                textAlign: 'center',
                                backgroundColor: colorScheme === scheme.value ? 'rgba(59, 130, 246, 0.1)' : 'var(--bg-tertiary)',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              <div
                                style={{
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: scheme.color,
                                  margin: '0 auto 0.5rem',
                                  border: '2px solid var(--bg-primary)'
                                }}
                              />
                              <div style={{ fontWeight: '500', fontSize: '0.875rem' }}>
                                {scheme.label}
                              </div>
                            </div>
                          ))}
                        </Grid>
                      </div>
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            )}

            {/* Notification Settings */}
            {activeTab === 'notifications' && (
              <Stack gap={4}>
                <Card>
                  <CardHeader title="Alert Preferences" />
                  <CardContent>
                    <Stack gap={3}>
                      {Object.entries(notificationSettings).map(([key, value]) => (
                        <Flex key={key} justify="between" align="center">
                          <div>
                            <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                              {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                            </div>
                            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                              {key === 'priceAlerts' && 'Get notified when price targets are hit'}
                              {key === 'portfolioAlerts' && 'Alerts for portfolio performance changes'}
                              {key === 'tradeExecutions' && 'Notifications for completed trades'}
                              {key === 'riskWarnings' && 'Important risk management alerts'}
                              {key === 'emailNotifications' && 'Receive alerts via email'}
                              {key === 'pushNotifications' && 'Browser push notifications'}
                            </div>
                          </div>
                          <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                            <input
                              type="checkbox"
                              checked={value}
                              onChange={(e) => handleNotificationChange(key as keyof NotificationSettings, e.target.checked)}
                              style={{ marginRight: '0.5rem' }}
                            />
                            <span style={{ fontSize: '0.875rem' }}>
                              {value ? 'Enabled' : 'Disabled'}
                            </span>
                          </label>
                        </Flex>
                      ))}
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            )}

            {/* Trading Settings */}
            {activeTab === 'trading' && (
              <Stack gap={4}>
                <Card>
                  <CardHeader title="Default Trading Preferences" />
                  <CardContent>
                    <Grid cols={2} gap={4}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Default Order Type
                        </label>
                        <select
                          value={tradingSettings.defaultOrderType}
                          onChange={(e) => handleTradingSettingChange('defaultOrderType', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                          }}
                        >
                          <option value="MARKET">Market Order</option>
                          <option value="LIMIT">Limit Order</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Default Exchange
                        </label>
                        <select
                          value={tradingSettings.defaultExchange}
                          onChange={(e) => handleTradingSettingChange('defaultExchange', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                          }}
                        >
                          <option value="NSE">NSE</option>
                          <option value="BSE">BSE</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Default Product Type
                        </label>
                        <select
                          value={tradingSettings.defaultProduct}
                          onChange={(e) => handleTradingSettingChange('defaultProduct', e.target.value)}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                          }}
                        >
                          <option value="CNC">CNC (Delivery)</option>
                          <option value="MIS">MIS (Intraday)</option>
                          <option value="NRML">NRML (Normal)</option>
                        </select>
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Auto Refresh Interval (seconds)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="60"
                          value={tradingSettings.autoRefreshInterval}
                          onChange={(e) => handleTradingSettingChange('autoRefreshInterval', parseInt(e.target.value))}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                          }}
                        />
                      </div>
                    </Grid>

                    <Stack gap={3} style={{ marginTop: '1.5rem' }}>
                      <Flex justify="between" align="center">
                        <div>
                          <div style={{ fontWeight: '500', marginBottom: '0.25rem' }}>
                            Confirm Before Order
                          </div>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Show confirmation dialog before placing orders
                          </div>
                        </div>
                        <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                          <input
                            type="checkbox"
                            checked={tradingSettings.confirmBeforeOrder}
                            onChange={(e) => handleTradingSettingChange('confirmBeforeOrder', e.target.checked)}
                            style={{ marginRight: '0.5rem' }}
                          />
                          <span style={{ fontSize: '0.875rem' }}>
                            {tradingSettings.confirmBeforeOrder ? 'Enabled' : 'Disabled'}
                          </span>
                        </label>
                      </Flex>
                    </Stack>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader title="Risk Management" />
                  <CardContent>
                    <Grid cols={2} gap={4}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Max Position Size (₹)
                        </label>
                        <input
                          type="number"
                          min="1000"
                          step="1000"
                          value={tradingSettings.maxPositionSize}
                          onChange={(e) => handleTradingSettingChange('maxPositionSize', parseInt(e.target.value))}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Risk Per Trade (%)
                        </label>
                        <input
                          type="number"
                          min="0.1"
                          max="10"
                          step="0.1"
                          value={tradingSettings.riskPercentage}
                          onChange={(e) => handleTradingSettingChange('riskPercentage', parseFloat(e.target.value))}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                          }}
                        />
                      </div>
                    </Grid>
                  </CardContent>
                </Card>
              </Stack>
            )}

            {/* Account Settings */}
            {activeTab === 'account' && (
              <Stack gap={4}>
                <Card>
                  <CardHeader title="Profile Information" />
                  <CardContent>
                    <Grid cols={2} gap={4}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Name
                        </label>
                        <input
                          type="text"
                          value={user?.name || ''}
                          disabled
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--border-secondary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem',
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)'
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Email
                        </label>
                        <input
                          type="email"
                          value={user?.email || ''}
                          disabled
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--border-secondary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem',
                            backgroundColor: 'var(--bg-tertiary)',
                            color: 'var(--text-secondary)'
                          }}
                        />
                      </div>
                    </Grid>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader title="Security" />
                  <CardContent>
                    <Stack gap={3}>
                      <Button variant="outline" style={{ alignSelf: 'flex-start' }}>
                        Change Password
                      </Button>
                      <Button variant="outline" style={{ alignSelf: 'flex-start' }}>
                        Enable Two-Factor Authentication
                      </Button>
                      <Button variant="outline" style={{ alignSelf: 'flex-start' }}>
                        Download Account Data
                      </Button>
                    </Stack>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader title="Danger Zone" />
                  <CardContent>
                    <div style={{ 
                      padding: '1rem', 
                      border: '1px solid var(--color-loss)', 
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'rgba(239, 68, 68, 0.1)'
                    }}>
                      <div style={{ fontWeight: '500', marginBottom: '0.5rem', color: 'var(--color-loss)' }}>
                        Delete Account
                      </div>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
                        Permanently delete your account and all associated data. This action cannot be undone.
                      </div>
                      <Button variant="danger" size="sm">
                        Delete Account
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Stack>
            )}
          </Stack>
        </div>
      </PageTransition>
    </div>
  );
};

export default UserSettings;