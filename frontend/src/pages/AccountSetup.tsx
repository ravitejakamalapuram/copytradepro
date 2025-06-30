import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import { brokerService, type ShoonyaCredentials, type FyersCredentials } from '../services/brokerService';
import { accountService, type ConnectedAccount } from '../services/accountService';
import '../styles/app-theme.css';

const SUPPORTED_BROKERS = [
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
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedBroker, setSelectedBroker] = useState<string>('');
  const [checkingStatus, setCheckingStatus] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
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
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        setError(null);
        const connectedAccounts = await accountService.getConnectedAccounts();
        setAccounts(connectedAccounts);
      } catch (error: any) {
        console.error('Failed to fetch accounts:', error);
        setError('Failed to load connected accounts');
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
        alert('Broker connected successfully!');
        // Refresh accounts
        const connectedAccounts = await accountService.getConnectedAccounts();
        setAccounts(connectedAccounts);
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
      setCheckingStatus(prev => ({ ...prev, [accountId]: true }));
      await accountService.activateAccount(accountId);
      // Refresh accounts
      const connectedAccounts = await accountService.getConnectedAccounts();
      setAccounts(connectedAccounts);
    } catch (error: any) {
      console.error('Failed to activate account:', error);
      alert('Failed to activate account: ' + error.message);
    } finally {
      setCheckingStatus(prev => ({ ...prev, [accountId]: false }));
    }
  };

  const handleDeactivateAccount = async (accountId: string) => {
    try {
      setCheckingStatus(prev => ({ ...prev, [accountId]: true }));
      await accountService.deactivateAccount(accountId);
      // Refresh accounts
      const connectedAccounts = await accountService.getConnectedAccounts();
      setAccounts(connectedAccounts);
    } catch (error: any) {
      console.error('Failed to deactivate account:', error);
      alert('Failed to deactivate account: ' + error.message);
    } finally {
      setCheckingStatus(prev => ({ ...prev, [accountId]: false }));
    }
  };

  const handleRemoveAccount = async (accountId: string) => {
    if (!confirm('Are you sure you want to remove this account? This action cannot be undone.')) {
      return;
    }

    try {
      setCheckingStatus(prev => ({ ...prev, [accountId]: true }));
      await accountService.removeConnectedAccount(accountId);
      // Refresh accounts
      const connectedAccounts = await accountService.getConnectedAccounts();
      setAccounts(connectedAccounts);
    } catch (error: any) {
      console.error('Failed to remove account:', error);
      alert('Failed to remove account: ' + error.message);
    } finally {
      setCheckingStatus(prev => ({ ...prev, [accountId]: false }));
    }
  };

  const getStatusColor = (isActive: boolean): string => {
    return isActive ? 'var(--kite-profit)' : 'var(--kite-neutral)';
  };

  const getStatusText = (isActive: boolean): string => {
    return isActive ? 'Active' : 'Inactive';
  };

  if (loading) {
    return (
      <div className="kite-theme">
        <AppNavigation />
        <div className="kite-main">
          <div style={{ 
            display: 'flex', 
            justifyContent: 'center', 
            alignItems: 'center', 
            height: '50vh',
            flexDirection: 'column',
            gap: '1rem'
          }}>
            <div style={{ fontSize: '2rem' }}>🔗</div>
            <div style={{ color: 'var(--kite-text-secondary)' }}>Loading accounts...</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="kite-theme">
      <AppNavigation />
      
      <div className="kite-main">
        {/* Page Header */}
        <div className="kite-card">
          <div className="kite-card-header">
            <h1 className="kite-card-title">Broker Accounts</h1>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button 
                className="kite-btn"
                onClick={() => navigate('/trade-setup')}
              >
                📈 Start Trading
              </button>
              <button 
                className="kite-btn kite-btn-primary"
                onClick={() => setShowAddForm(true)}
              >
                + Add Broker
              </button>
            </div>
          </div>
        </div>

        {/* Connected Accounts */}
        {accounts.length > 0 && (
          <div className="kite-card">
            <div className="kite-card-header">
              <h2 className="kite-card-title">Connected Accounts ({accounts.length})</h2>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table className="kite-table">
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
                            {SUPPORTED_BROKERS.find(b => b.id === account.brokerName)?.logo || '🏦'}
                          </span>
                          <div>
                            <div style={{ fontWeight: '500', color: 'var(--kite-text-primary)' }}>
                              {account.brokerName.charAt(0).toUpperCase() + account.brokerName.slice(1)}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)' }}>
                              {SUPPORTED_BROKERS.find(b => b.id === account.brokerName)?.description}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td style={{ fontFamily: 'var(--kite-font-mono)', fontWeight: '500' }}>
                        {account.userId}
                      </td>
                      <td>
                        <span style={{
                          padding: '0.25rem 0.5rem',
                          borderRadius: 'var(--kite-radius-sm)',
                          fontSize: '0.75rem',
                          fontWeight: '500',
                          backgroundColor: account.isActive ? 'var(--kite-bg-success)' : 'var(--kite-bg-neutral)',
                          color: getStatusColor(account.isActive)
                        }}>
                          {getStatusText(account.isActive)}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                        {new Date(account.createdAt).toLocaleDateString('en-IN')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {account.isActive ? (
                            <button
                              className="kite-btn"
                              onClick={() => handleDeactivateAccount(account.id)}
                              disabled={checkingStatus[account.id]}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            >
                              {checkingStatus[account.id] ? 'Deactivating...' : 'Deactivate'}
                            </button>
                          ) : (
                            <button
                              className="kite-btn kite-btn-primary"
                              onClick={() => handleActivateAccount(account.id)}
                              disabled={checkingStatus[account.id]}
                              style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                            >
                              {checkingStatus[account.id] ? 'Activating...' : 'Activate'}
                            </button>
                          )}
                          <button
                            className="kite-btn kite-btn-danger"
                            onClick={() => handleRemoveAccount(account.id)}
                            disabled={checkingStatus[account.id]}
                            style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem' }}
                          >
                            Remove
                          </button>
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
          <div className="kite-card">
            <div className="kite-card-header">
              <h2 className="kite-card-title">
                {selectedBroker ? `Connect ${SUPPORTED_BROKERS.find(b => b.id === selectedBroker)?.name}` : 'Select Broker'}
              </h2>
              <button
                className="kite-btn"
                onClick={() => {
                  setShowAddForm(false);
                  setSelectedBroker('');
                  setError(null);
                }}
              >
                ✕ Cancel
              </button>
            </div>

            <div style={{ padding: '1.5rem' }}>
              {!selectedBroker ? (
                /* Broker Selection */
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '1rem' }}>
                  {SUPPORTED_BROKERS.map((broker) => (
                    <div
                      key={broker.id}
                      onClick={() => handleBrokerSelect(broker.id)}
                      style={{
                        padding: '1.5rem',
                        border: '2px solid var(--kite-border-secondary)',
                        borderRadius: 'var(--kite-radius-lg)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        backgroundColor: 'var(--kite-bg-secondary)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = 'var(--kite-brand-primary)';
                        e.currentTarget.style.backgroundColor = 'var(--kite-bg-tertiary)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = 'var(--kite-border-secondary)';
                        e.currentTarget.style.backgroundColor = 'var(--kite-bg-secondary)';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '2rem' }}>{broker.logo}</span>
                        <div>
                          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: 'var(--kite-text-primary)' }}>
                            {broker.name}
                          </h3>
                          <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                            {broker.description}
                          </p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        {broker.features.map((feature, index) => (
                          <div key={index} style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                            ✓ {feature}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* Broker Credentials Form */
                <div style={{ maxWidth: '500px', margin: '0 auto' }}>
                  {selectedBroker === 'shoonya' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          User ID *
                        </label>
                        <input
                          type="text"
                          placeholder="Enter your Shoonya User ID"
                          value={formData.userId}
                          onChange={(e) => handleInputChange('userId', e.target.value)}
                          className="kite-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Password *
                        </label>
                        <input
                          type="password"
                          placeholder="Enter your trading password"
                          value={formData.password}
                          onChange={(e) => handleInputChange('password', e.target.value)}
                          className="kite-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          TOTP Secret Key *
                        </label>
                        <input
                          type="text"
                          placeholder="Enter your TOTP secret key"
                          value={formData.totpKey}
                          onChange={(e) => handleInputChange('totpKey', e.target.value)}
                          className="kite-input"
                          style={{ fontSize: '1rem' }}
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginTop: '0.25rem' }}>
                          This is used for automatic OTP generation
                        </div>
                      </div>

                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Vendor Code *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., FN135006_U"
                          value={formData.vendorCode}
                          onChange={(e) => handleInputChange('vendorCode', e.target.value)}
                          className="kite-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          API Secret *
                        </label>
                        <input
                          type="password"
                          placeholder="Enter your API secret"
                          value={formData.apiSecret}
                          onChange={(e) => handleInputChange('apiSecret', e.target.value)}
                          className="kite-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          IMEI *
                        </label>
                        <input
                          type="text"
                          placeholder="e.g., abc1234"
                          value={formData.imei}
                          onChange={(e) => handleInputChange('imei', e.target.value)}
                          className="kite-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>
                    </div>
                  )}

                  {selectedBroker === 'fyers' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Client ID *
                        </label>
                        <input
                          type="text"
                          placeholder="Enter your Fyers Client ID"
                          value={formData.clientId}
                          onChange={(e) => handleInputChange('clientId', e.target.value)}
                          className="kite-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Secret Key *
                        </label>
                        <input
                          type="password"
                          placeholder="Enter your secret key"
                          value={formData.secretKey}
                          onChange={(e) => handleInputChange('secretKey', e.target.value)}
                          className="kite-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>

                      <div>
                        <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                          Redirect URI *
                        </label>
                        <input
                          type="url"
                          placeholder="https://your-app.com/callback"
                          value={formData.redirectUri}
                          onChange={(e) => handleInputChange('redirectUri', e.target.value)}
                          className="kite-input"
                          style={{ fontSize: '1rem' }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Error Display */}
                  {error && (
                    <div style={{
                      padding: '0.75rem',
                      backgroundColor: 'var(--kite-bg-danger)',
                      border: '1px solid var(--kite-loss)',
                      borderRadius: 'var(--kite-radius-md)',
                      color: 'var(--kite-loss)',
                      fontSize: '0.875rem',
                      marginTop: '1rem'
                    }}>
                      {error}
                    </div>
                  )}

                  {/* Submit Button */}
                  <button
                    className="kite-btn kite-btn-primary"
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
                    {submitting ? 'Connecting...' : `Connect ${SUPPORTED_BROKERS.find(b => b.id === selectedBroker)?.name}`}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Empty State */}
        {accounts.length === 0 && !showAddForm && (
          <div className="kite-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🔗</div>
            <div style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--kite-text-primary)' }}>
              No Broker Accounts Connected
            </div>
            <div style={{ color: 'var(--kite-text-secondary)', marginBottom: '2rem', maxWidth: '400px', margin: '0 auto 2rem' }}>
              Connect your broker account to start trading. We support multiple brokers with secure API integration.
            </div>
            <button
              className="kite-btn kite-btn-primary"
              onClick={() => setShowAddForm(true)}
              style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
            >
              Connect Your First Broker
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSetup;
