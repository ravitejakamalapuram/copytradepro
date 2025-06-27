import React, { useState, useEffect } from 'react';
import { notificationService, type NotificationPreferences } from '../services/notificationService';
import {
  Card,
  CardHeader,
  CardContent,
  Button,
  Stack,
  Flex,
  Badge
} from './ui';
import './NotificationSettings.css';

interface NotificationSettingsProps {
  className?: string;
}

const NotificationSettings: React.FC<NotificationSettingsProps> = ({ className = '' }) => {
  const [preferences, setPreferences] = useState<NotificationPreferences | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [permission, setPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Initialize notification service
      const initialized = await notificationService.initialize();
      if (!initialized) {
        throw new Error('Failed to initialize push notifications');
      }

      // Check subscription status
      const subscribed = await notificationService.isSubscribed();
      setIsSubscribed(subscribed);

      // Get current permission
      setPermission(notificationService.getPermission());

      // Load preferences
      const prefs = await notificationService.getPreferences();
      if (prefs) {
        setPreferences(prefs);
      }
    } catch (error: any) {
      console.error('Failed to load notification settings:', error);
      setError(error.message || 'Failed to load notification settings');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubscribe = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const success = await notificationService.subscribe();
      if (success) {
        setIsSubscribed(true);
        setPermission(notificationService.getPermission());
        setSuccess('Successfully subscribed to push notifications!');
      } else {
        throw new Error('Failed to subscribe to push notifications');
      }
    } catch (error: any) {
      console.error('Failed to subscribe:', error);
      setError(error.message || 'Failed to subscribe to push notifications');
    } finally {
      setIsSaving(false);
    }
  };

  const handleUnsubscribe = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const success = await notificationService.unsubscribe();
      if (success) {
        setIsSubscribed(false);
        setSuccess('Successfully unsubscribed from push notifications');
      } else {
        throw new Error('Failed to unsubscribe from push notifications');
      }
    } catch (error: any) {
      console.error('Failed to unsubscribe:', error);
      setError(error.message || 'Failed to unsubscribe from push notifications');
    } finally {
      setIsSaving(false);
    }
  };

  const handlePreferenceChange = async (key: keyof NotificationPreferences, value: any) => {
    if (!preferences) return;

    try {
      setError(null);
      setSuccess(null);

      const updatedPreferences = { ...preferences, [key]: value };
      setPreferences(updatedPreferences);

      const success = await notificationService.updatePreferences({ [key]: value });
      if (!success) {
        throw new Error('Failed to update preferences');
      }
    } catch (error: any) {
      console.error('Failed to update preference:', error);
      setError(error.message || 'Failed to update preferences');
      // Revert the change
      loadSettings();
    }
  };

  const handleQuietHoursChange = async (field: 'enabled' | 'startTime' | 'endTime', value: any) => {
    if (!preferences) return;

    try {
      setError(null);
      setSuccess(null);

      const updatedQuietHours = { ...preferences.quietHours, [field]: value };
      const updatedPreferences = { ...preferences, quietHours: updatedQuietHours };
      setPreferences(updatedPreferences);

      const success = await notificationService.updatePreferences({ quietHours: updatedQuietHours });
      if (!success) {
        throw new Error('Failed to update quiet hours');
      }
    } catch (error: any) {
      console.error('Failed to update quiet hours:', error);
      setError(error.message || 'Failed to update quiet hours');
      // Revert the change
      loadSettings();
    }
  };

  const handleTestNotification = async () => {
    try {
      setIsSaving(true);
      setError(null);
      setSuccess(null);

      const success = await notificationService.sendTestNotification();
      if (success) {
        setSuccess('Test notification sent! Check your notifications.');
      } else {
        throw new Error('Failed to send test notification');
      }
    } catch (error: any) {
      console.error('Failed to send test notification:', error);
      setError(error.message || 'Failed to send test notification');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className={`notification-settings ${className}`}>
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <span>Loading notification settings...</span>
        </div>
      </div>
    );
  }

  if (!notificationService.isNotificationSupported()) {
    return (
      <div className={`notification-settings ${className}`}>
        <div className="error-container">
          <span className="error-icon">⚠️</span>
          <h3>Push Notifications Not Supported</h3>
          <p>Your browser doesn't support push notifications. Please use a modern browser like Chrome, Firefox, or Safari.</p>
        </div>
      </div>
    );
  }

  return (
    <Card className={className}>
      <CardHeader
        title="🔔 Notification Settings"
        subtitle="Manage your push notification preferences for real-time trade updates"
      />
      <CardContent>
        <Stack gap={6}>

          {error && (
            <div className="notification-alert error">
              <span className="alert-icon">❌</span>
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="notification-alert success">
              <span className="alert-icon">✅</span>
              <span>{success}</span>
            </div>
          )}

          {/* Push Notification Status */}
          <div className="notification-section">
            <h3 className="section-title">📱 Push Notifications</h3>
            <div className="push-notification-card">
              <Flex justify="between" align="center">
                <div className="status-info">
                  <Flex align="center" gap={3}>
                    <Badge
                      variant={isSubscribed ? 'success' : 'default'}
                      size="lg"
                    >
                      {isSubscribed ? 'Enabled' : 'Disabled'}
                    </Badge>
                    <div>
                      <p className="status-description">
                        {permission === 'granted'
                          ? 'You will receive push notifications for trade updates'
                          : permission === 'denied'
                          ? 'Push notifications are blocked. Please enable them in your browser settings.'
                          : 'Click subscribe to enable push notifications'
                        }
                      </p>
                    </div>
                  </Flex>
                </div>
                <div className="notification-actions">
                  {!isSubscribed ? (
                    <Button
                      variant="primary"
                      onClick={handleSubscribe}
                      disabled={isSaving || permission === 'denied'}
                      loading={isSaving}
                    >
                      Subscribe
                    </Button>
                  ) : (
                    <Flex gap={2}>
                      <Button
                        variant="outline"
                        onClick={handleTestNotification}
                        disabled={isSaving}
                        loading={isSaving}
                      >
                        Test Notification
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={handleUnsubscribe}
                        disabled={isSaving}
                        loading={isSaving}
                      >
                        Unsubscribe
                      </Button>
                    </Flex>
                  )}
                </div>
              </Flex>
            </div>
          </div>

      {/* Notification Preferences */}
      {preferences && isSubscribed && (
        <>
          <div className="settings-section">
            <h3>⚙️ Notification Types</h3>
            <div className="preference-grid">
              <div className="preference-item">
                <label>
                  <input
                    type="checkbox"
                    checked={preferences.orderStatusChanges}
                    onChange={(e) => handlePreferenceChange('orderStatusChanges', e.target.checked)}
                  />
                  <span className="preference-label">
                    <strong>Order Status Changes</strong>
                    <p>Get notified when your order status changes (placed, executed, rejected, etc.)</p>
                  </span>
                </label>
              </div>

              <div className="preference-item">
                <label>
                  <input
                    type="checkbox"
                    checked={preferences.orderExecutions}
                    onChange={(e) => handlePreferenceChange('orderExecutions', e.target.checked)}
                  />
                  <span className="preference-label">
                    <strong>Order Executions</strong>
                    <p>Get notified when your orders are successfully executed</p>
                  </span>
                </label>
              </div>

              <div className="preference-item">
                <label>
                  <input
                    type="checkbox"
                    checked={preferences.orderRejections}
                    onChange={(e) => handlePreferenceChange('orderRejections', e.target.checked)}
                  />
                  <span className="preference-label">
                    <strong>Order Rejections</strong>
                    <p>Get notified when your orders are rejected</p>
                  </span>
                </label>
              </div>

              <div className="preference-item">
                <label>
                  <input
                    type="checkbox"
                    checked={preferences.portfolioAlerts}
                    onChange={(e) => handlePreferenceChange('portfolioAlerts', e.target.checked)}
                  />
                  <span className="preference-label">
                    <strong>Portfolio Alerts</strong>
                    <p>Get notified about significant portfolio changes</p>
                  </span>
                </label>
              </div>

              <div className="preference-item">
                <label>
                  <input
                    type="checkbox"
                    checked={preferences.marketAlerts}
                    onChange={(e) => handlePreferenceChange('marketAlerts', e.target.checked)}
                  />
                  <span className="preference-label">
                    <strong>Market Alerts</strong>
                    <p>Get notified about important market movements</p>
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* Quiet Hours */}
          <div className="settings-section">
            <h3>🌙 Quiet Hours</h3>
            <div className="quiet-hours-container">
              <div className="quiet-hours-toggle">
                <label>
                  <input
                    type="checkbox"
                    checked={preferences.quietHours.enabled}
                    onChange={(e) => handleQuietHoursChange('enabled', e.target.checked)}
                  />
                  <span className="preference-label">
                    <strong>Enable Quiet Hours</strong>
                    <p>Disable notifications during specified hours</p>
                  </span>
                </label>
              </div>

              {preferences.quietHours.enabled && (
                <div className="quiet-hours-times">
                  <div className="time-input">
                    <label>Start Time:</label>
                    <input
                      type="time"
                      value={preferences.quietHours.startTime}
                      onChange={(e) => handleQuietHoursChange('startTime', e.target.value)}
                    />
                  </div>
                  <div className="time-input">
                    <label>End Time:</label>
                    <input
                      type="time"
                      value={preferences.quietHours.endTime}
                      onChange={(e) => handleQuietHoursChange('endTime', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
        </Stack>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
