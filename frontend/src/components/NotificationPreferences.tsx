import React, { useState, useEffect } from 'react';
import { notificationService, NotificationPreferences } from '../services/notificationService';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Flex,
  Stack,
  Input,
  StatusBadge
} from './ui';

interface NotificationPreferencesProps {
  className?: string;
}

const NotificationPreferencesComponent: React.FC<NotificationPreferencesProps> = ({ className = '' }) => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingNotification, setTestingNotification] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState({
    isSupported: false,
    permission: 'default' as NotificationPermission,
    isSubscribed: false
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    loadPreferences();
    updateSubscriptionStatus();
  }, []);

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const prefs = await notificationService.getPreferences();
      if (prefs) {
        setPreferences(prefs);
      }
    } catch (error) {
      console.error('Failed to load notification preferences:', error);
      setErrors({ general: 'Failed to load notification preferences' });
    } finally {
      setLoading(false);
    }
  };

  const updateSubscriptionStatus = async () => {
    const status = notificationService.getSubscriptionStatus();
    const isSubscribed = await notificationService.isSubscribed();
    setSubscriptionStatus({
      ...status,
      isSubscribed
    });
  };

  const handleToggleChange = (field: keyof NotificationPreferences, value: boolean) => {
    if (!preferences) return;

    setPreferences({
      ...preferences,
      [field]: value
    });
  };

  const handleQuietHoursChange = (field: 'enabled' | 'startTime' | 'endTime', value: boolean | string) => {
    if (!preferences) return;

    setPreferences({
      ...preferences,
      quietHours: {
        ...preferences.quietHours,
        [field]: value
      }
    });
  };

  const handleSavePreferences = async () => {
    if (!preferences) return;

    try {
      setSaving(true);
      setErrors({});
      setSuccessMessage('');

      const success = await notificationService.updatePreferences(preferences);
      
      if (success) {
        setSuccessMessage('Notification preferences saved successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrors({ general: 'Failed to save notification preferences' });
      }
    } catch (error) {
      console.error('Failed to save preferences:', error);
      setErrors({ general: 'Failed to save notification preferences' });
    } finally {
      setSaving(false);
    }
  };

  const handleSubscribeToPush = async () => {
    try {
      setErrors({});
      
      // Initialize notification service if not already done
      const initialized = await notificationService.initialize();
      if (!initialized) {
        setErrors({ push: 'Failed to initialize push notifications' });
        return;
      }

      // Subscribe to push notifications
      const success = await notificationService.subscribe();
      if (success) {
        setSuccessMessage('Successfully subscribed to push notifications!');
        await updateSubscriptionStatus();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrors({ push: 'Failed to subscribe to push notifications' });
      }
    } catch (error) {
      console.error('Failed to subscribe to push notifications:', error);
      setErrors({ push: 'Failed to subscribe to push notifications' });
    }
  };

  const handleUnsubscribeFromPush = async () => {
    try {
      setErrors({});
      
      const success = await notificationService.unsubscribe();
      if (success) {
        setSuccessMessage('Successfully unsubscribed from push notifications!');
        await updateSubscriptionStatus();
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrors({ push: 'Failed to unsubscribe from push notifications' });
      }
    } catch (error) {
      console.error('Failed to unsubscribe from push notifications:', error);
      setErrors({ push: 'Failed to unsubscribe from push notifications' });
    }
  };

  const handleSendTestNotification = async () => {
    try {
      setTestingNotification(true);
      setErrors({});
      
      const success = await notificationService.sendTestNotification();
      if (success) {
        setSuccessMessage('Test notification sent! Check your notifications.');
        setTimeout(() => setSuccessMessage(''), 3000);
      } else {
        setErrors({ test: 'Failed to send test notification' });
      }
    } catch (error) {
      console.error('Failed to send test notification:', error);
      setErrors({ test: 'Failed to send test notification' });
    } finally {
      setTestingNotification(false);
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader title="Notification Preferences" />
        <CardContent>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div className="loading-spinner"></div>
            <p>Loading notification preferences...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!preferences) {
    return (
      <Card className={className}>
        <CardHeader title="Notification Preferences" />
        <CardContent>
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <p>Failed to load notification preferences.</p>
            <Button variant="outline" onClick={loadPreferences}>
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader 
        title="Notification Preferences" 
        subtitle="Configure how you want to receive notifications"
      />
      <CardContent>
        <Stack gap={6}>
          {/* Success Message */}
          {successMessage && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#dcfce7',
              border: '1px solid #bbf7d0',
              borderRadius: '0.5rem',
              color: '#166534',
              fontSize: '0.875rem'
            }}>
              {successMessage}
            </div>
          )}

          {/* Error Messages */}
          {Object.keys(errors).length > 0 && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              borderRadius: '0.5rem',
              color: '#dc2626',
              fontSize: '0.875rem'
            }}>
              {Object.values(errors).map((error, index) => (
                <div key={index}>{error}</div>
              ))}
            </div>
          )}

          {/* Push Notifications Section */}
          <div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: '600' }}>
              Push Notifications
            </h3>
            
            <Stack gap={4}>
              <Flex justify="between" align="center">
                <div>
                  <div style={{ fontWeight: '500' }}>Browser Support</div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    {subscriptionStatus.isSupported ? 'Supported' : 'Not supported in this browser'}
                  </div>
                </div>
                <StatusBadge 
                  status={subscriptionStatus.isSupported ? 'active' : 'inactive'} 
                />
              </Flex>

              <Flex justify="between" align="center">
                <div>
                  <div style={{ fontWeight: '500' }}>Permission Status</div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    {subscriptionStatus.permission}
                  </div>
                </div>
                <StatusBadge 
                  status={subscriptionStatus.permission === 'granted' ? 'active' : 
                          subscriptionStatus.permission === 'denied' ? 'inactive' : 'pending'} 
                />
              </Flex>

              <Flex justify="between" align="center">
                <div>
                  <div style={{ fontWeight: '500' }}>Subscription Status</div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    {subscriptionStatus.isSubscribed ? 'Subscribed' : 'Not subscribed'}
                  </div>
                </div>
                <Flex gap={2}>
                  <StatusBadge 
                    status={subscriptionStatus.isSubscribed ? 'active' : 'inactive'} 
                  />
                  {subscriptionStatus.isSupported && (
                    subscriptionStatus.isSubscribed ? (
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={handleUnsubscribeFromPush}
                      >
                        Unsubscribe
                      </Button>
                    ) : (
                      <Button 
                        variant="primary" 
                        size="sm"
                        onClick={handleSubscribeToPush}
                        disabled={subscriptionStatus.permission === 'denied'}
                      >
                        Subscribe
                      </Button>
                    )
                  )}
                </Flex>
              </Flex>

              {subscriptionStatus.isSubscribed && (
                <Flex justify="between" align="center">
                  <div>
                    <div style={{ fontWeight: '500' }}>Test Notifications</div>
                    <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                      Send a test notification to verify everything is working
                    </div>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleSendTestNotification}
                    disabled={testingNotification}
                  >
                    {testingNotification ? 'Sending...' : 'Send Test'}
                  </Button>
                </Flex>
              )}
            </Stack>
          </div>

          {/* Notification Types Section */}
          <div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: '600' }}>
              Notification Types
            </h3>

            <Stack gap={3}>
              <Flex justify="between" align="center">
                <div>
                  <div style={{ fontWeight: '500' }}>Order Status Changes</div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Get notified when order status changes (placed, executed, cancelled)
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences.orderStatusChanges}
                    onChange={(e) => handleToggleChange('orderStatusChanges', e.target.checked)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Enable</span>
                </label>
              </Flex>

              <Flex justify="between" align="center">
                <div>
                  <div style={{ fontWeight: '500' }}>Order Executions</div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Get notified when orders are successfully executed
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences.orderExecutions}
                    onChange={(e) => handleToggleChange('orderExecutions', e.target.checked)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Enable</span>
                </label>
              </Flex>

              <Flex justify="between" align="center">
                <div>
                  <div style={{ fontWeight: '500' }}>Order Rejections</div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Get notified when orders are rejected or failed
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences.orderRejections}
                    onChange={(e) => handleToggleChange('orderRejections', e.target.checked)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Enable</span>
                </label>
              </Flex>

              <Flex justify="between" align="center">
                <div>
                  <div style={{ fontWeight: '500' }}>Portfolio Alerts</div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Get notified about portfolio performance and changes
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences.portfolioAlerts}
                    onChange={(e) => handleToggleChange('portfolioAlerts', e.target.checked)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Enable</span>
                </label>
              </Flex>

              <Flex justify="between" align="center">
                <div>
                  <div style={{ fontWeight: '500' }}>Market Alerts</div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Get notified about market movements and news
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences.marketAlerts}
                    onChange={(e) => handleToggleChange('marketAlerts', e.target.checked)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Enable</span>
                </label>
              </Flex>
            </Stack>
          </div>

          {/* Quiet Hours Section */}
          <div>
            <h3 style={{ marginBottom: '1rem', fontSize: '1.125rem', fontWeight: '600' }}>
              Quiet Hours
            </h3>

            <Stack gap={3}>
              <Flex justify="between" align="center">
                <div>
                  <div style={{ fontWeight: '500' }}>Enable Quiet Hours</div>
                  <div style={{ fontSize: '0.875rem', color: '#64748b' }}>
                    Disable notifications during specified hours
                  </div>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={preferences.quietHours.enabled}
                    onChange={(e) => handleQuietHoursChange('enabled', e.target.checked)}
                    style={{ marginRight: '0.5rem' }}
                  />
                  <span style={{ fontSize: '0.875rem' }}>Enable</span>
                </label>
              </Flex>

              {preferences.quietHours.enabled && (
                <>
                  <Flex gap={4} align="center">
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Start Time
                      </label>
                      <Input
                        type="time"
                        value={preferences.quietHours.startTime}
                        onChange={(e) => handleQuietHoursChange('startTime', e.target.value)}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        End Time
                      </label>
                      <Input
                        type="time"
                        value={preferences.quietHours.endTime}
                        onChange={(e) => handleQuietHoursChange('endTime', e.target.value)}
                      />
                    </div>
                  </Flex>
                </>
              )}
            </Stack>
          </div>

          {/* Save Button */}
          <Flex justify="end">
            <Button
              variant="primary"
              onClick={handleSavePreferences}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </Button>
          </Flex>
        </Stack>
      </CardContent>
    </Card>
  );
};

export default NotificationPreferencesComponent;
