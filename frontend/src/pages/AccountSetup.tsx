import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import Navigation from '../components/Navigation';
import { brokerService } from '../services/brokerService';
import type { ShoonyaCredentials, FyersCredentials } from '../services/brokerService';
import { accountService } from '../services/accountService';
import type { ConnectedAccount } from '../services/accountService';
import {
  Container,
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  Button,
  Input,
  Select,
  StatusBadge,
  Flex,
  Stack
} from '../components/ui';
import './AccountSetup.css';

// Using ConnectedAccount from accountService

const SUPPORTED_BROKERS = [
  { id: 'shoonya', name: 'Shoonya', description: 'Reliable trading & investment platform by Finvasia' },
  { id: 'fyers', name: 'Fyers', description: 'Advanced trading platform with powerful APIs' },
];

const AccountSetup: React.FC = () => {
  const navigate = useNavigate();
  const { } = useAuth();
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [checkingStatus, setCheckingStatus] = useState<Record<string, boolean>>({});
  const [formData, setFormData] = useState({
    brokerName: '',
    // Shoonya fields
    userId: '',
    password: '',
    totpKey: '',  // Changed from twoFA to totpKey
    vendorCode: '',
    apiSecret: '',
    imei: '',
    // Fyers fields
    clientId: '',
    secretKey: '',
    redirectUri: '',
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
      if (!formData.totpKey.trim()) {
        newErrors.totpKey = 'TOTP Key is required';
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
          totpKey: formData.totpKey.trim(),
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
          totpKey: '',
          vendorCode: '',
          apiSecret: '',
          imei: '',
          clientId: '',
          secretKey: '',
          redirectUri: '',
        });
        setShowAddForm(false);
        setErrors({});
      } else {
        setErrors({ general: response.message || 'Failed to connect to broker' });
      }
    } catch (error: unknown) {
      console.error('🚨 Add account error:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to add account. Please try again.';
      setErrors({ general: errorMessage });
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
          totpKey: '',
          vendorCode: '',
          apiSecret: '',
          imei: '',
          clientId: '',
          secretKey: '',
          redirectUri: '',
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

  const handleToggleAccount = async (accountId: string) => {
    const account = accounts.find(acc => acc.id === accountId);
    if (!account) return;

    try {
      let success = false;

      if (account.isActive) {
        // Deactivate (logout)
        success = await accountService.deactivateAccount(accountId);
      } else {
        // Activate (re-authenticate)
        success = await accountService.activateAccount(accountId);
      }

      if (success) {
        // Update local state only if API call was successful
        setAccounts(prev =>
          prev.map(acc =>
            acc.id === accountId
              ? { ...acc, isActive: !acc.isActive }
              : acc
          )
        );
      } else {
        setErrors({
          general: `Failed to ${account.isActive ? 'deactivate' : 'activate'} account. Please try again.`
        });
      }
    } catch (error) {
      console.error('Error toggling account:', error);
      setErrors({
        general: `Network error while ${account.isActive ? 'deactivating' : 'activating'} account. Please try again.`
      });
    }
  };

  const handleCheckSessionStatus = async (accountId: string) => {
    setCheckingStatus(prev => ({ ...prev, [accountId]: true }));

    try {
      const result = await accountService.checkAccountSessionStatus(accountId);

      if (result.success && result.data) {
        // Update the account status based on real-time check
        setAccounts(prev =>
          prev.map(acc =>
            acc.id === accountId
              ? { ...acc, isActive: result.data!.isActive }
              : acc
          )
        );

        // Show status message
        const statusMessage = `Status: ${result.data.sessionInfo.status} - ${result.data.sessionInfo.message}`;
        setErrors({ general: statusMessage });

        // Clear message after 3 seconds
        setTimeout(() => setErrors({}), 3000);
      } else {
        setErrors({ general: result.message || 'Failed to check session status' });
      }
    } catch (error) {
      console.error('Error checking session status:', error);
      setErrors({ general: 'Network error while checking session status' });
    } finally {
      setCheckingStatus(prev => ({ ...prev, [accountId]: false }));
    }
  };

  return (
    <div className="enterprise-app">
      <Navigation />

      <main className="enterprise-main">
        <Container>
          <PageHeader
            title="Broker Account Setup"
            subtitle="Connect your broker accounts to start copy trading"
            actions={
              <Button
                variant="primary"
                onClick={() => setShowAddForm(true)}
                leftIcon="+"
              >
                Add Account
              </Button>
            }
          />

          {/* Account List */}
          <Card>
            <CardHeader
              title="Connected Accounts"
              subtitle={`${accounts.length} account${accounts.length !== 1 ? 's' : ''} connected`}
            />
            <CardContent>
              {accounts.length === 0 ? (
                <div className="empty-state">
                  <div className="empty-icon">🔗</div>
                  <h4>No accounts connected</h4>
                  <p>Add your first broker account to get started with copy trading</p>
                  <Button
                    variant="primary"
                    onClick={() => setShowAddForm(true)}
                    leftIcon="+"
                  >
                    Add Your First Account
                  </Button>
                </div>
              ) : (
                <Stack gap={4}>
                  {accounts.map(account => (
                    <Card key={account.id} variant="outlined" hoverable>
                      <CardContent>
                        <Flex justify="between" align="start">
                          <Stack gap={3}>
                            <Flex align="center" gap={3}>
                              <h4 style={{
                                margin: 0,
                                fontSize: '1.125rem',
                                fontWeight: '600',
                                color: '#0f172a'
                              }}>
                                {account.brokerName}
                              </h4>
                              <StatusBadge status={account.isActive ? 'active' : 'inactive'} />
                            </Flex>

                            <Stack gap={1}>
                              <div className="account-id">User ID: {account.userId}</div>
                              <div className="account-id">Account ID: {account.accountId}</div>
                              <div className="account-meta">User: {account.userName} ({account.email})</div>
                              <div className="account-meta">Exchanges: {account.exchanges?.join(', ') || 'N/A'}</div>
                              <div className="account-date">
                                Added: {new Date(account.createdAt).toLocaleDateString()}
                              </div>
                            </Stack>
                          </Stack>

                          <Flex gap={2}>
                            <Button
                              variant={account.isActive ? 'secondary' : 'primary'}
                              size="sm"
                              onClick={() => handleToggleAccount(account.id)}
                            >
                              {account.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleCheckSessionStatus(account.id)}
                              disabled={checkingStatus[account.id]}
                              loading={checkingStatus[account.id]}
                            >
                              Check Status
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              onClick={() => handleRemoveAccount(account.id)}
                            >
                              Remove
                            </Button>
                          </Flex>
                        </Flex>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              )}
            </CardContent>
          </Card>

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
                  <Select
                    label="Broker"
                    name="brokerName"
                    value={formData.brokerName}
                    onChange={handleInputChange}
                    state={errors.brokerName ? 'error' : 'default'}
                    error={errors.brokerName}
                    disabled={isSubmitting}
                    fullWidth
                    options={[
                      { value: '', label: 'Select a broker' },
                      ...SUPPORTED_BROKERS.map(broker => ({
                        value: broker.id,
                        label: `${broker.name} - ${broker.description}`
                      }))
                    ]}
                  />
                </div>

                {/* Conditional form fields based on selected broker */}
                {formData.brokerName === 'shoonya' && (
                  <>
                    <div className="form-group">
                      <Input
                        type="text"
                        label="User ID"
                        name="userId"
                        value={formData.userId}
                        onChange={handleInputChange}
                        state={errors.userId ? 'error' : 'default'}
                        error={errors.userId}
                        placeholder="Enter your Shoonya User ID"
                        disabled={isSubmitting}
                        fullWidth
                      />
                    </div>
                  </>
                )}

                {formData.brokerName === 'fyers' && (
                  <>
                    <div className="form-group">
                      <Input
                        type="text"
                        label="Client ID"
                        name="clientId"
                        value={formData.clientId}
                        onChange={handleInputChange}
                        state={errors.clientId ? 'error' : 'default'}
                        error={errors.clientId}
                        placeholder="Enter your Fyers Client ID"
                        disabled={isSubmitting}
                        fullWidth
                      />
                    </div>
                  </>
                )}

                {formData.brokerName === 'shoonya' && (
                  <>
                    <div className="form-group">
                      <Input
                        type="password"
                        label="Password"
                        name="password"
                        value={formData.password}
                        onChange={handleInputChange}
                        state={errors.password ? 'error' : 'default'}
                        error={errors.password}
                        placeholder="Enter your trading password"
                        disabled={isSubmitting}
                        fullWidth
                      />
                    </div>

                    <div className="form-group">
                      <Input
                        type="text"
                        label="TOTP Secret Key"
                        name="totpKey"
                        value={formData.totpKey}
                        onChange={handleInputChange}
                        state={errors.totpKey ? 'error' : 'default'}
                        error={errors.totpKey}
                        placeholder="Enter your TOTP secret key"
                        disabled={isSubmitting}
                        helperText="Enter your TOTP secret key. The system will automatically generate the current OTP."
                        fullWidth
                      />
                    </div>

                    <div className="form-group">
                      <Input
                        type="text"
                        label="Vendor Code"
                        name="vendorCode"
                        value={formData.vendorCode}
                        onChange={handleInputChange}
                        state={errors.vendorCode ? 'error' : 'default'}
                        error={errors.vendorCode}
                        placeholder="Enter vendor code provided by Shoonya"
                        disabled={isSubmitting}
                        fullWidth
                      />
                    </div>
                  </>
                )}

                {formData.brokerName === 'fyers' && (
                  <>
                    <div className="form-group">
                      <Input
                        type="password"
                        label="Secret Key"
                        name="secretKey"
                        value={formData.secretKey}
                        onChange={handleInputChange}
                        state={errors.secretKey ? 'error' : 'default'}
                        error={errors.secretKey}
                        placeholder="Enter your Fyers Secret Key"
                        disabled={isSubmitting}
                        fullWidth
                      />
                    </div>

                    <div className="form-group">
                      <Input
                        type="url"
                        label="Redirect URI"
                        name="redirectUri"
                        value={formData.redirectUri}
                        onChange={handleInputChange}
                        state={errors.redirectUri ? 'error' : 'default'}
                        error={errors.redirectUri}
                        placeholder="Enter your registered redirect URI"
                        disabled={isSubmitting}
                        fullWidth
                      />
                    </div>

                    <div className="form-group">
                      <Input
                        type="text"
                        label="TOTP Key (Optional)"
                        name="totpKey"
                        value={formData.totpKey}
                        onChange={handleInputChange}
                        state={errors.totpKey ? 'error' : 'default'}
                        error={errors.totpKey}
                        placeholder="Enter TOTP key for automated authentication"
                        disabled={isSubmitting}
                        fullWidth
                      />
                    </div>
                  </>
                )}

                {formData.brokerName === 'shoonya' && (
                  <>
                    <div className="form-group">
                      <Input
                        type="password"
                        label="API Secret"
                        name="apiSecret"
                        value={formData.apiSecret}
                        onChange={handleInputChange}
                        state={errors.apiSecret ? 'error' : 'default'}
                        error={errors.apiSecret}
                        placeholder="Enter your API secret"
                        disabled={isSubmitting}
                        fullWidth
                      />
                    </div>

                    <div className="form-group">
                      <Input
                        type="text"
                        label="IMEI"
                        name="imei"
                        value={formData.imei}
                        onChange={handleInputChange}
                        state={errors.imei ? 'error' : 'default'}
                        error={errors.imei}
                        placeholder="Enter device IMEI for identification"
                        disabled={isSubmitting}
                        fullWidth
                      />
                    </div>
                  </>
                )}

                <div className="modal-actions">
                  <Button
                    variant="secondary"
                    onClick={() => setShowAddForm(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting}
                    loading={isSubmitting}
                  >
                    {isSubmitting ? 'Adding...' : 'Add Account'}
                  </Button>
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
                  <Input
                    type="text"
                    label="Authorization Code"
                    value={fyersAuthCode}
                    onChange={(e) => setFyersAuthCode(e.target.value)}
                    state={errors.authCode ? 'error' : 'default'}
                    error={errors.authCode}
                    placeholder="Enter the authorization code from Fyers"
                    disabled={isSubmitting}
                    fullWidth
                  />
                </div>

                <div className="modal-actions">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setShowFyersAuthStep(false);
                      setFyersAuthUrl('');
                      setFyersAuthCode('');
                    }}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={isSubmitting || !fyersAuthCode.trim()}
                    loading={isSubmitting}
                  >
                    {isSubmitting ? 'Validating...' : 'Complete Authentication'}
                  </Button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Navigation Actions */}
        {accounts.length > 0 && (
          <div className="page-actions">
            <Button
              variant="primary"
              onClick={() => navigate('/trade-setup')}
            >
              Continue to Trade Setup
            </Button>
          </div>
        )}
        </Container>
      </main>
    </div>
  );
};

export default AccountSetup;
