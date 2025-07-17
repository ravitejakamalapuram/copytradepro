import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import { brokerService, type ShoonyaCredentials, type FyersCredentials } from '../services/brokerService';
import { accountService } from '../services/accountService';
import { useAccountStatusContext } from '../context/AccountStatusContext';
import AccountStatusIndicator from '../components/AccountStatusIndicator';
import { AuthenticationStep } from '@copytrade/shared-types';
import '../styles/app-theme.css';
import Button from '../components/ui/Button';

const ALL_BROKERS = [
  {
    id: 'shoonya',
    name: 'Shoonya',
    description: 'Reliable trading & investment platform by Finvasia',
    logo: '🏦',
    features: ['Zero brokerage on equity delivery', 'Advanced charting tools', 'API trading support']
  },
  {
    id: 'fyers',
    name: 'Fyers',
    description: 'Advanced trading platform with powerful APIs',
    logo: '🚀',
    features: ['Professional trading tools', 'Real-time market data', 'Advanced order types']
  },
];

interface FormData {
  brokerName: string;
  // Shoonya fields
  userId: string;
  password: string;
  totpKey: string;
  vendorCode: string;
  apiSecret: string;
  imei: string;
  // Fyers fields
  clientId: string;
  secretKey: string;
  redirectUri: string;
}

const AccountSetup: React.FC = () => {
  const navigate = useNavigate();
  const {
    accounts,
    activateAccount,
    deactivateAccount,
    removeAccount,
    refreshAccounts,
    isOperationInProgress
  } = useAccountStatusContext();
  
  const [availableBrokers, setAvailableBrokers] = useState<string[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [oauthInProgress, setOauthInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<FormData>({
    brokerName: '',
    userId: '',
    password: '',
    totpKey: '',
    vendorCode: '',
    apiSecret: '',
    imei: '',
    clientId: '',
    secretKey: '',
    redirectUri: '',
  });

  useEffect(() => {
    const fetchAvailableBrokers = async () => {
      try {
        setLoading(true);
        setError(null);

        const brokers = await accountService.getAvailableBrokers();
        setAvailableBrokers(brokers);

        console.log('📋 Available brokers:', brokers);
        console.log('🔗 Connected accounts:', accounts.length);
      } catch (error: any) {
        console.error('Failed to fetch available brokers:', error);
        setError('Failed to load broker data');
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableBrokers();
  }, [accounts.length]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  // Handle OAuth flow - Debug Version to Find Root Cause
  const handleOAuthFlow = async (accountId: string, authUrl: string): Promise<void> => {
    setOauthInProgress(true);

    return new Promise((resolve, reject) => {
      console.log('🔄 Starting OAuth flow...');
      console.log('📍 Account ID:', accountId);
      console.log('🔗 Auth URL:', authUrl);

      // First, let's test if the URL is valid
      if (!authUrl || !authUrl.startsWith('http')) {
        console.error('❌ Invalid auth URL:', authUrl);
        setOauthInProgress(false);
        alert('Invalid authentication URL received. Please try again.');
        reject(new Error('Invalid auth URL'));
        return;
      }

      // Check if this is a Fyers API URL that might cause immediate redirect
      if (authUrl.includes('api.fyers.in/api/v2/generate-authcode')) {
        console.warn('⚠️ Detected Fyers API URL - this might redirect immediately');
        console.log('🔍 Full URL:', authUrl);

        // Test the URL first
        const testChoice = confirm(
          '⚠️ POTENTIAL ISSUE DETECTED\n\n' +
          'The auth URL is a Fyers API endpoint that might redirect immediately.\n' +
          'This could cause the popup to close automatically.\n\n' +
          'Click OK to test opening this URL\n' +
          'Click Cancel to abort and check configuration'
        );

        if (!testChoice) {
          setOauthInProgress(false);
          reject(new Error('User chose to abort due to URL concerns'));
          return;
        }
      }

      // Show debug info to user
      const proceed = confirm(
        '🔍 DEBUG MODE - Fyers OAuth\n\n' +
        `Auth URL: ${authUrl.substring(0, 100)}...\n\n` +
        'This will open the Fyers authentication page.\n' +
        'Watch the browser console for debug information.\n\n' +
        'Click OK to proceed, Cancel to abort.'
      );

      if (!proceed) {
        console.log('🚫 User cancelled OAuth flow');
        setOauthInProgress(false);
        reject(new Error('OAuth cancelled by user'));
        return;
      }

      console.log('🚀 Opening authentication window...');

      // Try opening in new tab first (most reliable)
      const authWindow = window.open(authUrl, '_blank');

      console.log('🪟 Window opened:', !!authWindow);
      console.log('🪟 Window closed immediately?', authWindow?.closed);

      if (!authWindow) {
        console.error('❌ Failed to open window - popup blocked');
        setOauthInProgress(false);
        alert('Popup blocked! Please allow popups for this site and try again.');
        reject(new Error('Popup blocked'));
        return;
      }

      // Check if window closes immediately
      setTimeout(() => {
        console.log('🕐 After 1 second - Window closed?', authWindow.closed);
        if (authWindow.closed) {
          console.error('❌ Window closed automatically after 1 second!');
          setOauthInProgress(false);
          alert('Authentication window closed automatically. This might be due to:\n1. Popup blocker\n2. Invalid URL\n3. Browser security policy\n\nPlease check browser console for details.');
          reject(new Error('Window closed automatically'));
          return;
        }
      }, 1000);

      // Check again after 3 seconds
      setTimeout(() => {
        console.log('🕐 After 3 seconds - Window closed?', authWindow.closed);
        if (authWindow.closed) {
          console.error('❌ Window closed automatically after 3 seconds!');
          setOauthInProgress(false);
          alert('Authentication window closed automatically after 3 seconds.');
          reject(new Error('Window closed automatically'));
          return;
        }

        // If window is still open, ask for auth code
        const authCode = prompt(
          '🔐 Fyers OAuth - Enter Authorization Code\n\n' +
          'The authentication window should be open.\n' +
          'Complete the authentication and copy the authorization code.\n\n' +
          'Authorization Code:'
        );

        if (authCode && authCode.trim()) {
          console.log('✅ Auth code entered:', authCode.trim());

          // Try to close the window
          try {
            if (!authWindow.closed) {
              authWindow.close();
            }
          } catch (e) {
            console.log('ℹ️ Could not close auth window (expected for cross-origin)');
          }

          // Complete OAuth authentication
          completeOAuthAuth(accountId, authCode.trim())
            .then(() => {
              setOauthInProgress(false);
              resolve();
            })
            .catch((err) => {
              console.error('❌ OAuth completion failed:', err);
              setOauthInProgress(false);
              reject(err);
            });
        } else {
          console.log('🚫 No auth code provided');
          setOauthInProgress(false);
          reject(new Error('No authorization code provided'));
        }
      }, 5000); // Wait 5 seconds before prompting
    });
  };

  // Complete OAuth authentication with auth code
  const completeOAuthAuth = async (accountId: string, authCode: string): Promise<void> => {
    try {
      console.log('🔄 Completing OAuth authentication...');

      // Call the new OAuth completion endpoint
      const response = await fetch('/api/broker/oauth/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          accountId,
          authCode
        })
      });

      const result = await response.json();

      if (result.success) {
        console.log('✅ OAuth completed successfully');
        alert('Account activated successfully!');

        // Refresh accounts using context
        await refreshAccounts();
      } else {
        console.error('❌ OAuth completion failed:', result.message);
        alert(`OAuth completion failed: ${result.message || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('🚨 OAuth completion error:', error);
      alert(`OAuth completion failed: ${error.message || 'Network error'}`);
    }
  };

  const handleBrokerSelect = (brokerId: string) => {
    setSelectedBroker(brokerId);
    setFormData(prev => ({ ...prev, brokerName: brokerId }));
    setShowAddForm(true);
  };

  const handleSubmit = async () => {
    if (!formData.brokerName) {
      setError('Please select a broker');
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      let result;
      if (formData.brokerName === 'shoonya') {
        const credentials: ShoonyaCredentials = {
          userId: formData.userId,
          password: formData.password,
          totpKey: formData.totpKey,
          vendorCode: formData.vendorCode,
          apiSecret: formData.apiSecret,
          imei: formData.imei,
        };
        result = await brokerService.connectBroker('shoonya', credentials);
      } else if (formData.brokerName === 'fyers') {
        const credentials: FyersCredentials = {
          clientId: formData.clientId,
          secretKey: formData.secretKey,
          redirectUri: formData.redirectUri,
        };
        result = await brokerService.connectBroker('fyers', credentials);
      } else {
        throw new Error('Unsupported broker');
      }

      if (result.success) {
        // Check if OAuth authentication is required
        if (result.data?.requiresAuthCode && result.data?.authUrl && result.data?.accountId) {
          console.log('🔄 OAuth authentication required for new connection');
          console.log('📋 Account ID for OAuth:', result.data.accountId);

          // The account has been saved in inactive state, now complete OAuth
          try {
            await handleOAuthFlow(result.data.accountId, result.data.authUrl);

            // After successful OAuth, refresh accounts using context
            await refreshAccounts();

            // Reset form
            setShowAddForm(false);
            setSelectedBroker('');
            setFormData({
              brokerName: '',
              userId: '',
              password: '',
              totpKey: '',
              vendorCode: '',
              apiSecret: '',
              imei: '',
              clientId: '',
              secretKey: '',
              redirectUri: '',
            });
          } catch (oauthError: any) {
            console.error('❌ OAuth flow failed:', oauthError);
            setError(oauthError.message || 'OAuth authentication failed');
          }
        } else {
          // Direct connection successful (e.g., Shoonya)
          alert('Broker connected successfully!');
          // Refresh accounts using context
          await refreshAccounts();
          // Reset form
          setShowAddForm(false);
          setSelectedBroker('');
          setFormData({
            brokerName: '',
            userId: '',
            password: '',
            totpKey: '',
            vendorCode: '',
            apiSecret: '',
            imei: '',
            clientId: '',
            secretKey: '',
            redirectUri: '',
          });
        }
      } else {
        setError(result.message || 'Failed to connect broker');
      }
    } catch (error: any) {
      console.error('Connection failed:', error);
      setError(error.message || 'Failed to connect broker');
    } finally {
      setSubmitting(false);
    }
  };

  const handleActivateAccount = async (accountId: string) => {
    try {
      const result = await activateAccount(accountId);

      if (result.success) {
        console.log('✅ Account activated successfully');
        alert('Account activated successfully!');
      } else {
        // Handle OAuth flow
        if (result.authStep === AuthenticationStep.OAUTH_REQUIRED && result.authUrl) {
          console.log('🔄 OAuth authentication required');
          await handleOAuthFlow(accountId, result.authUrl);
        } else {
          console.error('❌ Account activation failed:', result.message);
          alert(`Failed to activate account: ${result.message || 'Unknown error'}`);
        }
      }
    } catch (error: any) {
      console.error('Failed to activate account:', error);
      alert('Failed to activate account: ' + error.message);
    }
  };

  const handleDeactivateAccount = async (accountId: string) => {
    try {
      const success = await deactivateAccount(accountId);
      if (success) {
        alert('Account deactivated successfully!');
      } else {
        alert('Failed to deactivate account');
      }
    } catch (error: any) {
      console.error('Failed to deactivate account:', error);
      alert('Failed to deactivate account: ' + error.message);
    }
  };

  const handleRemoveAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to remove this account? This action cannot be undone.')) {
      return;
    }

    try {
      const success = await removeAccount(accountId);
      if (success) {
        alert('Account removed successfully!');
      } else {
        alert('Failed to remove account');
      }
    } catch (error: any) {
      console.error('Failed to remove account:', error);
      alert('Failed to remove account: ' + error.message);
    }
  };



  if (loading) {
    return (
      <div className="app-theme app-layout">
        <AppNavigation />
        <div className="app-main">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '50vh',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '2rem' }}>🔗</div>
            <div style={{ color: 'var(--text-secondary)' }}>Loading accounts...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-theme app-layout">
      <AppNavigation />
      
      <div className="app-main">
        {/* Page Header */}
        <div className="card">
          <div className="card-header">
            <h1 className="card-title">Broker Accounts</h1>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Button 
                variant="primary"
                onClick={() => navigate('/trade-setup')}
              >
                📈 Start Trading
              </Button>
              <Button 
                variant="primary"
                onClick={() => setShowAddForm(true)}
              >
                + Add Broker
              </Button>
            </div>
          </div>
        </div>

        {/* Connected Accounts */}
        {accounts.length > 0 && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Connected Accounts ({accounts.length})</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="table table-trading">
                <thead>
                  <tr>
                    <th>Broker</th>
                    <th>User ID</th>
                    <th>Status</th>
                    <th>Connected</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '1.25rem' }}>
                            {ALL_BROKERS.find(b => b.id === account.brokerName)?.logo || '🏦'}
                          </span>
                          <div>
                            <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                              {account.brokerName.charAt(0).toUpperCase() + account.brokerName.slice(1)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                              {ALL_BROKERS.find(b => b.id === account.brokerName)?.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                          {account.userId}
                        </div>
                        {account.userName && (
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            marginTop: '0.125rem'
                          }}>
                            {account.userName}
                          </div>
                        )}
                      </td>
                      <td>
                        {(() => {
                          const isBrokerAvailable = availableBrokers.includes(account.brokerName);
                          const isAccountActive = account.isActive;

                          let status, bgColor, textColor;

                          if (!isBrokerAvailable) {
                            status = 'BROKER INACTIVE';
                            bgColor = 'var(--bg-loss-light)';
                            textColor = 'var(--color-loss)';
                          } else if (isAccountActive) {
                            status = 'ACTIVE';
                            bgColor = 'var(--bg-profit-light)';
                            textColor = 'var(--color-profit)';
                          } else {
                            status = 'INACTIVE';
                            bgColor = 'var(--bg-tertiary)';
                            textColor = 'var(--text-secondary)';
                          }

                          return (
                            <span style={{
                              padding: '0.25rem 0.5rem',
                              borderRadius: 'var(--radius-sm)',
                              fontSize: '0.75rem',
                              fontWeight: '500',
                              backgroundColor: bgColor,
                              color: textColor
                            }}>
                              {status}
                            </span>
                          );
                        })()}
                      </td>
                      <td style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                        {new Date(account.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <AccountStatusIndicator accountId={account.id} showDetails={false} />
                          {account.isActive ? (
                            <Button
                              variant="outline"
                              onClick={() => handleDeactivateAccount(account.id)}
                              disabled={isOperationInProgress(account.id)}
                            >
                              {isOperationInProgress(account.id) ? 'Deactivating...' : 'Deactivate'}
                            </Button>
                          ) : (
                            <Button
                              variant="primary"
                              onClick={() => handleActivateAccount(account.id)}
                              disabled={isOperationInProgress(account.id) || oauthInProgress}
                            >
                              {oauthInProgress ? 'OAuth in Progress...' :
                               isOperationInProgress(account.id) ? 'Activating...' : 'Activate'}
                            </Button>
                          )}
                          <Button
                            variant="danger"
                            onClick={() => handleRemoveAccount(account.id)}
                            disabled={isOperationInProgress(account.id)}
                          >
                            Remove
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Broker Form */}
        {showAddForm && (
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">
                {selectedBroker ? `Connect ${ALL_BROKERS.find(b => b.id === selectedBroker)?.name}` : 'Select Broker'}
              </h2>
              <Button
                variant="outline"
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedBroker('');
                  setError(null);
                }}
              >
                ✕ Cancel
              </Button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {!selectedBroker ? (
                /* Broker Selection */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                  {ALL_BROKERS.map((broker) => {
                    const isAvailable = availableBrokers.includes(broker.id);
                    return (
                    <div
                      key={broker.id}
                      onClick={() => isAvailable ? handleBrokerSelect(broker.id) : null}
                      style={{
                        padding: '1.5rem',
                        border: `2px solid ${isAvailable ? 'var(--border-secondary)' : 'var(--border-tertiary)'}`,
                        borderRadius: 'var(--radius-lg)',
                        cursor: isAvailable ? 'pointer' : 'not-allowed',
                        transition: 'all 0.2s ease',
                        backgroundColor: isAvailable ? 'var(--bg-secondary)' : 'var(--bg-tertiary)',
                        opacity: isAvailable ? 1 : 0.6,
                        position: 'relative'
                      }}
                      onMouseEnter={(e) => {
                        if (isAvailable) {
                          e.currentTarget.style.borderColor = 'var(--interactive-primary)';
                          e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (isAvailable) {
                          e.currentTarget.style.borderColor = 'var(--border-secondary)';
                          e.currentTarget.style.backgroundColor = 'var(--bg-secondary)';
                        }
                      }}
                    >
                      {/* Status indicator for unavailable brokers */}
                      {!isAvailable && (
                        <div style={{
                          position: 'absolute',
                          top: '0.75rem',
                          right: '0.75rem',
                          backgroundColor: 'var(--color-loss)',
                          color: 'white',
                          padding: '0.25rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: '600'
                        }}>
                          INACTIVE
                        </div>
                      )}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '2rem' }}>{broker.logo}</span>
                        <div>
                          <h3 style={{
                            margin: 0,
                            fontSize: '1.25rem',
                            fontWeight: '600',
                            color: isAvailable ? 'var(--text-primary)' : 'var(--text-tertiary)'
                          }}>
                            {broker.name}
                            {isAvailable && (
                              <span style={{
                                marginLeft: '0.5rem',
                                fontSize: '0.75rem',
                                color: 'var(--color-profit)',
                                fontWeight: '500'
                              }}>
                                ● AVAILABLE
                              </span>
                            )}
                          </h3>
                          <p style={{
                            margin: 0,
                            fontSize: '0.875rem',
                            color: isAvailable ? 'var(--text-secondary)' : 'var(--text-tertiary)'
                          }}>
                            {isAvailable ? broker.description : 'Broker not initialized on server'}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {broker.features.map((feature, index) => (
                          <div key={index} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            ✓ {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                    );
                  })}
                </div>
              ) : (
                /* Broker Credentials Form */
                <div style={{ maxWidth: '500px', margin: '0 auto' }}>
                  {selectedBroker === 'shoonya' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          User ID *
                        </label>
                        <input
                          type="text"
                          placeholder="Enter your Shoonya User ID"
                          value={formData.userId}
                          onChange={(e) => handleInputChange('userId', e.target.value)}
                          className="form-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Password *
                        </label>
                        <input
                          type="password"
                          placeholder="Enter your trading password"
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          className="form-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          TOTP Secret Key *
                        </label>
                        <input
                          type="text"
                          placeholder="Enter your TOTP secret key"
                          value={formData.totpKey}
                          onChange={(e) => handleInputChange('totpKey', e.target.value)}
                          className="form-input"
                          style={{ fontSize: '1rem' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          This is used for automatic OTP generation
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Vendor Code *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., FN135006_U"
                          value={formData.vendorCode}
                          onChange={(e) => handleInputChange('vendorCode', e.target.value)}
                          className="form-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          API Secret *
                        </label>
                        <input
                          type="password"
                          placeholder="Enter your API secret"
                          value={formData.apiSecret}
                          onChange={(e) => handleInputChange('apiSecret', e.target.value)}
                          className="form-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          IMEI *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., abc1234"
                          value={formData.imei}
                          onChange={(e) => handleInputChange('imei', e.target.value)}
                          className="form-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>
                    </div>
                  )}

                  {selectedBroker === 'fyers' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Client ID *
                        </label>
                        <input
                          type="text"
                          placeholder="Enter your Fyers Client ID"
                          value={formData.clientId}
                          onChange={(e) => handleInputChange('clientId', e.target.value)}
                          className="form-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Secret Key *
                        </label>
                        <input
                          type="password"
                          placeholder="Enter your secret key"
                          value={formData.secretKey}
                          onChange={(e) => handleInputChange('secretKey', e.target.value)}
                          className="form-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Redirect URI *
                        </label>
                        <input
                          type="url"
                          placeholder="https://your-app.com/callback"
                          value={formData.redirectUri}
                          onChange={(e) => handleInputChange('redirectUri', e.target.value)}
                          className="form-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* OAuth Progress Display */}
                  {oauthInProgress && (
                    <div style={{
                      padding: '1rem',
                      backgroundColor: 'var(--bg-profit-light)',
                      border: '2px solid var(--color-profit)',
                      borderRadius: 'var(--radius-lg)',
                      color: 'var(--color-profit)',
                      fontSize: '0.875rem',
                      marginTop: '1rem',
                      textAlign: 'center'
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                        <div className="loading-spinner" style={{ width: '20px', height: '20px' }}></div>
                        <strong>🔐 OAuth Authentication in Progress</strong>
                      </div>
                      <div style={{ fontSize: '0.8rem', lineHeight: '1.4' }}>
                        Complete the authentication in the opened window/tab.<br/>
                        You will be prompted to enter the authorization code shortly.
                      </div>
                    </div>
                  )}

                  {/* Error Display */}
                  {error && (
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--bg-loss-light)',
                      border: '1px solid var(--color-loss)',
                      borderRadius: 'var(--radius-md)',
                      color: 'var(--color-loss)',
                      fontSize: '0.875rem',
                      marginTop: '1rem'
                    }}>
                      {error}
                    </div>
                  )}

                  {/* Submit Button */}
                  <Button
                    variant="primary"
                    onClick={handleSubmit}
                    disabled={submitting}
                    style={{
                      width: '100%',
                      justifyContent: 'center',
                      fontSize: '1rem',
                      padding: '0.75rem',
                      marginTop: '2rem'
                    }}
                  >
                    {submitting ? 'Connecting...' : `Connect ${ALL_BROKERS.find(b => b.id === selectedBroker)?.name}`}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {accounts.length === 0 && !showAddForm && (
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔗</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--text-primary)' }}>
              No Broker Accounts Connected
            </div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
              Connect your broker account to start trading. We support multiple brokers with secure API integration.
            </div>
            <Button
              variant="primary"
              onClick={() => setShowAddForm(true)}
              style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
            >
              Connect Your First Broker
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSetup;
