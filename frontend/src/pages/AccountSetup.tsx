import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Navigation from '../components/Navigation';
import { brokerService } from '../services/brokerService';
import type { ShoonyaCredentials, FyersCredentials } from '../services/brokerService';
import { accountService } from '../services/accountService';
import type { ConnectedAccount } from '../services/accountService';
import './AccountSetup.css';

// Using ConnectedAccount from accountService

const SUPPORTED_BROKERS = [
  { id: 'shoonya', name: 'Shoonya', description: 'Reliable trading & investment platform by Finvasia' },
  { id: 'fyers', name: 'Fyers', description: 'Advanced trading platform with powerful APIs' },
];

const AccountSetup: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formData, setFormData] = useState({
    brokerName: '',
    // Shoonya fields
    userId: '',
    password: '',
    twoFA: '',
    vendorCode: '',
    apiSecret: '',
    imei: '',
    // Fyers fields
    clientId: '',
    secretKey: '',
    redirectUri: '',
    totpKey: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [fyersAuthUrl, setFyersAuthUrl] = useState<string>('');
  const [fyersAuthCode, setFyersAuthCode] = useState<string>('');
  const [showFyersAuthStep, setShowFyersAuthStep] = useState(false);

  // Load connected accounts on component mount
  useEffect(() => {
    loadConnectedAccounts();
  }, []);

  const loadConnectedAccounts = async () => {
    try {
      const connectedAccounts = await accountService.getConnectedAccounts();
      setAccounts(connectedAccounts);
    } catch (error) {
      console.error('Failed to load connected accounts:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    // Clear error when user starts typing
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.brokerName) {
      newErrors.brokerName = 'Please select a broker';
    }

    if (formData.brokerName === 'shoonya') {
      if (!formData.userId.trim()) {
        newErrors.userId = 'User ID is required';
      }
      if (!formData.password.trim()) {
        newErrors.password = 'Password is required';
      }
      if (!formData.twoFA.trim()) {
        newErrors.twoFA = '2FA/OTP is required';
      }
      if (!formData.vendorCode.trim()) {
        newErrors.vendorCode = 'Vendor Code is required';
      }
      if (!formData.apiSecret.trim()) {
        newErrors.apiSecret = 'API Secret is required';
      }
      if (!formData.imei.trim()) {
        newErrors.imei = 'IMEI is required';
      }
    } else if (formData.brokerName === 'fyers') {
      if (!formData.clientId.trim()) {
        newErrors.clientId = 'Client ID is required';
      }
      if (!formData.secretKey.trim()) {
        newErrors.secretKey = 'Secret Key is required';
      }
      if (!formData.redirectUri.trim()) {
        newErrors.redirectUri = 'Redirect URI is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleAddAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      let credentials: ShoonyaCredentials | FyersCredentials;

      if (formData.brokerName === 'shoonya') {
        credentials = {
          userId: formData.userId.trim(),
          password: formData.password.trim(),
          twoFA: formData.twoFA.trim(),
          vendorCode: formData.vendorCode.trim(),
          apiSecret: formData.apiSecret.trim(),
          imei: formData.imei.trim(),
        } as ShoonyaCredentials;
      } else if (formData.brokerName === 'fyers') {
        credentials = {
          clientId: formData.clientId.trim(),
          secretKey: formData.secretKey.trim(),
          redirectUri: formData.redirectUri.trim(),
          totpKey: formData.totpKey?.trim() || undefined,
        } as FyersCredentials;
      } else {
        throw new Error('Unsupported broker');
      }

      const response = await brokerService.connectBroker(formData.brokerName, credentials);

      if (response.success && response.data) {
        // Handle Fyers two-step authentication
        if (formData.brokerName === 'fyers' && response.data.requiresAuthCode && response.data.authUrl) {
          setFyersAuthUrl(response.data.authUrl);
          setShowFyersAuthStep(true);
          setErrors({});
          return; // Don't close the form yet
        }

        // Handle successful connection (Shoonya or completed Fyers)
        const newAccount = accountService.createAccountFromBrokerResponse(
          formData.brokerName,
          response.data,
          credentials
        );

        // Save to backend and update local state
        const savedAccount = await accountService.saveConnectedAccount(newAccount);
        if (savedAccount) {
          setAccounts(prev => [...prev, savedAccount]);
        }
        setFormData({
          brokerName: '',
          userId: '',
          password: '',
          twoFA: '',
          vendorCode: '',
          apiSecret: '',
          imei: '',
          clientId: '',
          secretKey: '',
          redirectUri: '',
          totpKey: '',
        });
        setShowAddForm(false);
        setErrors({});
      } else {
        setErrors({ general: response.message || 'Failed to connect to broker' });
      }
    } catch (error: any) {
      console.error('🚨 Add account error:', error);
      setErrors({ general: error.message || 'Failed to add account. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFyersAuthCode = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fyersAuthCode.trim()) {
      setErrors({ authCode: 'Auth code is required' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      const credentials = {
        clientId: formData.clientId,
        secretKey: formData.secretKey,
        redirectUri: formData.redirectUri,
      } as FyersCredentials;

      const data = await brokerService.validateFyersAuthCode(fyersAuthCode, credentials);

      if (data.success && data.data) {
        const newAccount = accountService.createAccountFromBrokerResponse(
          'fyers',
          data.data,
          credentials
        );

        // Save to backend and update local state
        const savedAccount = await accountService.saveConnectedAccount(newAccount);
        if (savedAccount) {
          setAccounts(prev => [...prev, savedAccount]);
        }
        setFormData({
          brokerName: '',
          userId: '',
          password: '',
          twoFA: '',
          vendorCode: '',
          apiSecret: '',
          imei: '',
          clientId: '',
          secretKey: '',
          redirectUri: '',
          totpKey: '',
        });
        setShowAddForm(false);
        setShowFyersAuthStep(false);
        setFyersAuthUrl('');
        setFyersAuthCode('');
      } else {
        setErrors({ general: data.message || 'Failed to validate auth code' });
      }
    } catch (error) {
      console.error('Error validating Fyers auth code:', error);
      setErrors({ general: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveAccount = async (accountId: string) => {
    if (window.confirm('Are you sure you want to remove this account?')) {
      try {
        const success = await accountService.removeConnectedAccount(accountId);
        if (success) {
          setAccounts(prev => prev.filter(account => account.id !== accountId));
        } else {
          setErrors({ general: 'Failed to remove account. Please try again.' });
        }
      } catch (error) {
        console.error('Error removing account:', error);
        setErrors({ general: 'Network error. Please try again.' });
      }
    }
  };

  const handleToggleAccount = (accountId: string) => {
    setAccounts(prev =>
      prev.map(account =>
        account.id === accountId
          ? { ...account, isActive: !account.isActive }
          : account
      )
    );
  };

  return (
    <div className="page-container">
      <Navigation />
      
      <div className="container">
        <div className="page-header">
          <h1>Broker Account Setup</h1>
          <p>Connect your broker accounts to start copy trading</p>
        </div>

        {/* Account List */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Connected Accounts</h3>
            <button
              className="btn btn-primary"
              onClick={() => setShowAddForm(true)}
            >
              Add Account
            </button>
          </div>

          {accounts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🔗</div>
              <h4>No accounts connected</h4>
              <p>Add your first broker account to get started with copy trading</p>
              <button
                className="btn btn-primary"
                onClick={() => setShowAddForm(true)}
              >
                Add Your First Account
              </button>
            </div>
          ) : (
            <div className="accounts-list">
              {accounts.map(account => (
                <div key={account.id} className="account-item">
                  <div className="account-info">
                    <div className="account-header">
                      <h4>{account.brokerName}</h4>
                      <span className={`status-badge ${account.isActive ? 'active' : 'inactive'}`}>
                        {account.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <p className="account-id">User ID: {account.userId}</p>
                    <p className="account-id">Account ID: {account.accountId}</p>
                    <p className="account-meta">User: {account.userName} ({account.email})</p>
                    <p className="account-meta">Exchanges: {account.exchanges?.join(', ') || 'N/A'}</p>
                    <p className="account-date">
                      Added: {account.createdAt.toLocaleDateString()}
                    </p>
                  </div>
                  <div className="account-actions">
                    <button
                      className={`btn ${account.isActive ? 'btn-secondary' : 'btn-success'}`}
                      onClick={() => handleToggleAccount(account.id)}
                    >
                      {account.isActive ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      className="btn btn-error"
                      onClick={() => handleRemoveAccount(account.id)}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Add Account Form */}
        {showAddForm && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>Add Broker Account</h3>
                <button
                  className="modal-close"
                  onClick={() => setShowAddForm(false)}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleAddAccount} className="modal-body">
                {errors.general && (
                  <div className="form-error mb-3">{errors.general}</div>
                )}

                <div className="form-group">
                  <label htmlFor="brokerName" className="form-label">
                    Broker
                  </label>
                  <select
                    id="brokerName"
                    name="brokerName"
                    value={formData.brokerName}
                    onChange={handleInputChange}
                    className={`form-input ${errors.brokerName ? 'error' : ''}`}
                    disabled={isSubmitting}
                  >
                    <option value="">Select a broker</option>
                    {SUPPORTED_BROKERS.map(broker => (
                      <option key={broker.id} value={broker.id}>
                        {broker.name} - {broker.description}
                      </option>
                    ))}
                  </select>
                  {errors.brokerName && <div className="form-error">{errors.brokerName}</div>}
                </div>

                {/* Conditional form fields based on selected broker */}
                {formData.brokerName === 'shoonya' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="userId" className="form-label">
                        User ID
                      </label>
                      <input
                        type="text"
                        id="userId"
                        name="userId"
                        value={formData.userId}
                        onChange={handleInputChange}
                        className={`form-input ${errors.userId ? 'error' : ''}`}
                        placeholder="Enter your Shoonya User ID"
                        disabled={isSubmitting}
                      />
                      {errors.userId && <div className="form-error">{errors.userId}</div>}
                    </div>
                  </>
                )}

                {formData.brokerName === 'fyers' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="clientId" className="form-label">
                        Client ID
                      </label>
                      <input
                        type="text"
                        id="clientId"
                        name="clientId"
                        value={formData.clientId}
                        onChange={handleInputChange}
                        className={`form-input ${errors.clientId ? 'error' : ''}`}
                        placeholder="Enter your Fyers Client ID"
                        disabled={isSubmitting}
                      />
                      {errors.clientId && <div className="form-error">{errors.clientId}</div>}
                    </div>
                  </>
                )}

                {formData.brokerName === 'shoonya' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="password" className="form-label">
                        Password
                      </label>
                      <input
                        type="password"
                        id="password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        className={`form-input ${errors.password ? 'error' : ''}`}
                        placeholder="Enter your trading password"
                        disabled={isSubmitting}
                      />
                      {errors.password && <div className="form-error">{errors.password}</div>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="twoFA" className="form-label">
                        2FA/OTP
                      </label>
                      <input
                        type="text"
                        id="twoFA"
                        name="twoFA"
                        value={formData.twoFA}
                        onChange={handleInputChange}
                        className={`form-input ${errors.twoFA ? 'error' : ''}`}
                        placeholder="Enter OTP or TOTP"
                        disabled={isSubmitting}
                      />
                      {errors.twoFA && <div className="form-error">{errors.twoFA}</div>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="vendorCode" className="form-label">
                        Vendor Code
                      </label>
                      <input
                        type="text"
                        id="vendorCode"
                        name="vendorCode"
                        value={formData.vendorCode}
                        onChange={handleInputChange}
                        className={`form-input ${errors.vendorCode ? 'error' : ''}`}
                        placeholder="Enter vendor code provided by Shoonya"
                        disabled={isSubmitting}
                      />
                      {errors.vendorCode && <div className="form-error">{errors.vendorCode}</div>}
                    </div>
                  </>
                )}

                {formData.brokerName === 'fyers' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="secretKey" className="form-label">
                        Secret Key
                      </label>
                      <input
                        type="password"
                        id="secretKey"
                        name="secretKey"
                        value={formData.secretKey}
                        onChange={handleInputChange}
                        className={`form-input ${errors.secretKey ? 'error' : ''}`}
                        placeholder="Enter your Fyers Secret Key"
                        disabled={isSubmitting}
                      />
                      {errors.secretKey && <div className="form-error">{errors.secretKey}</div>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="redirectUri" className="form-label">
                        Redirect URI
                      </label>
                      <input
                        type="url"
                        id="redirectUri"
                        name="redirectUri"
                        value={formData.redirectUri}
                        onChange={handleInputChange}
                        className={`form-input ${errors.redirectUri ? 'error' : ''}`}
                        placeholder="Enter your registered redirect URI"
                        disabled={isSubmitting}
                      />
                      {errors.redirectUri && <div className="form-error">{errors.redirectUri}</div>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="totpKey" className="form-label">
                        TOTP Key (Optional)
                      </label>
                      <input
                        type="text"
                        id="totpKey"
                        name="totpKey"
                        value={formData.totpKey}
                        onChange={handleInputChange}
                        className={`form-input ${errors.totpKey ? 'error' : ''}`}
                        placeholder="Enter TOTP key for automated authentication"
                        disabled={isSubmitting}
                      />
                      {errors.totpKey && <div className="form-error">{errors.totpKey}</div>}
                    </div>
                  </>
                )}

                {formData.brokerName === 'shoonya' && (
                  <>
                    <div className="form-group">
                      <label htmlFor="apiSecret" className="form-label">
                        API Secret
                      </label>
                      <input
                        type="password"
                        id="apiSecret"
                        name="apiSecret"
                        value={formData.apiSecret}
                        onChange={handleInputChange}
                        className={`form-input ${errors.apiSecret ? 'error' : ''}`}
                        placeholder="Enter your API secret"
                        disabled={isSubmitting}
                      />
                      {errors.apiSecret && <div className="form-error">{errors.apiSecret}</div>}
                    </div>

                    <div className="form-group">
                      <label htmlFor="imei" className="form-label">
                        IMEI
                      </label>
                      <input
                        type="text"
                        id="imei"
                        name="imei"
                        value={formData.imei}
                        onChange={handleInputChange}
                        className={`form-input ${errors.imei ? 'error' : ''}`}
                        placeholder="Enter device IMEI for identification"
                        disabled={isSubmitting}
                      />
                      {errors.imei && <div className="form-error">{errors.imei}</div>}
                    </div>
                  </>
                )}

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowAddForm(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Adding...' : 'Add Account'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Fyers Auth Code Step */}
        {showFyersAuthStep && (
          <div className="modal-overlay">
            <div className="modal">
              <div className="modal-header">
                <h3>Complete Fyers Authentication</h3>
                <button
                  className="modal-close"
                  onClick={() => {
                    setShowFyersAuthStep(false);
                    setFyersAuthUrl('');
                    setFyersAuthCode('');
                  }}
                >
                  ×
                </button>
              </div>

              <form onSubmit={handleFyersAuthCode} className="modal-body">
                {errors.general && (
                  <div className="form-error mb-3">{errors.general}</div>
                )}

                <div className="auth-step-info">
                  <h4>Step 1: Visit Authorization URL</h4>
                  <p>Click the link below to authorize the application:</p>
                  <a
                    href={fyersAuthUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="auth-url-link"
                  >
                    Open Fyers Authorization Page
                  </a>
                </div>

                <div className="auth-step-info">
                  <h4>Step 2: Enter Authorization Code</h4>
                  <p>After authorizing, you'll receive an authorization code. Enter it below:</p>
                </div>

                <div className="form-group">
                  <label htmlFor="fyersAuthCode" className="form-label">
                    Authorization Code
                  </label>
                  <input
                    type="text"
                    id="fyersAuthCode"
                    value={fyersAuthCode}
                    onChange={(e) => setFyersAuthCode(e.target.value)}
                    className={`form-input ${errors.authCode ? 'error' : ''}`}
                    placeholder="Enter the authorization code from Fyers"
                    disabled={isSubmitting}
                  />
                  {errors.authCode && <div className="form-error">{errors.authCode}</div>}
                </div>

                <div className="modal-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => {
                      setShowFyersAuthStep(false);
                      setFyersAuthUrl('');
                      setFyersAuthCode('');
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={isSubmitting || !fyersAuthCode.trim()}
                  >
                    {isSubmitting ? 'Validating...' : 'Complete Authentication'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Navigation Actions */}
        {accounts.length > 0 && (
          <div className="page-actions">
            <button
              className="btn btn-primary"
              onClick={() => navigate('/trade-setup')}
            >
              Continue to Trade Setup
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AccountSetup;
