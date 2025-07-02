import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import { brokerService, type PlaceOrderRequest } from '../services/brokerService';
import { accountService, type ConnectedAccount } from '../services/accountService';
// import { fundsService } from '../services/fundsService';
import { marketDataService } from '../services/marketDataService';
import { Checkbox } from '../components/ui/Checkbox';
import { useToast } from '../hooks/useToast';

interface OrderForm {
  symbol: string;
  exchange: 'NSE' | 'BSE';
  action: 'BUY' | 'SELL';
  quantity: string;
  price: string;
  orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  product: 'CNC' | 'MIS' | 'NRML';
  validity: 'DAY' | 'IOC';
  triggerPrice: string;
  selectedAccounts: string[];
}

interface MarginInfo {
  required: number;
  available: number;
  shortfall: number;
}

const TradeSetup: React.FC = () => {
  const navigate = useNavigate();
  const { error: showError, success: showSuccess, warning: showWarning } = useToast();
  
  // State management
  const [loading, setLoading] = useState(true);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [orderForm, setOrderForm] = useState<OrderForm>({
    symbol: '',
    exchange: 'NSE',
    action: 'BUY',
    quantity: '',
    price: '',
    orderType: 'LIMIT',
    product: 'CNC',
    validity: 'DAY',
    triggerPrice: '',
    selectedAccounts: []
  });
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [marginInfo] = useState<MarginInfo>({
    required: 0,
    available: 0,
    shortfall: 0
  });
  
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  // const [showValidationModal, setShowValidationModal] = useState(false);

  // Load connected accounts
  useEffect(() => {
    const loadAccounts = async () => {
      try {
        setLoading(true);
        const accounts = await accountService.getConnectedAccounts();
        setConnectedAccounts(accounts);
        
        // Auto-select all active accounts
        const activeAccountIds = accounts
          .filter(account => account.isActive)
          .map(account => account.id);
        setOrderForm(prev => ({ ...prev, selectedAccounts: activeAccountIds }));
      } catch (error) {
        console.error('Failed to load accounts:', error);
        showError('Failed to load broker accounts');
      } finally {
        setLoading(false);
      }
    };

    loadAccounts();
  }, [showError]);

  // Symbol search functionality
  const handleSymbolSearch = async (query: string) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }

    try {
      const results = await marketDataService.searchSymbols(query);
      setSearchResults(results.slice(0, 10));
      setShowSearchResults(true);
    } catch (error) {
      console.error('Symbol search failed:', error);
      setSearchResults([]);
    }
  };

  const handleSymbolSelect = (result: any) => {
    setOrderForm(prev => ({ ...prev, symbol: result.symbol }));
    setSearchQuery(result.symbol);
    setShowSearchResults(false);
    
    // TODO: Get current price for the symbol when API is available
  };

  // Validation
  const validateForm = () => {
    const errors: Record<string, string> = {};
    
    if (!orderForm.symbol) errors.symbol = 'Symbol is required';
    if (!orderForm.quantity || parseInt(orderForm.quantity) <= 0) errors.quantity = 'Valid quantity is required';
    if (orderForm.orderType !== 'MARKET' && (!orderForm.price || parseFloat(orderForm.price) <= 0)) {
      errors.price = 'Valid price is required for limit orders';
    }
    if ((orderForm.orderType === 'SL-LIMIT' || orderForm.orderType === 'SL-MARKET') && 
        (!orderForm.triggerPrice || parseFloat(orderForm.triggerPrice) <= 0)) {
      errors.triggerPrice = 'Valid trigger price is required for stop loss orders';
    }
    if (orderForm.selectedAccounts.length === 0) {
      errors.selectedAccounts = 'At least one trading account must be selected';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Account selection
  const handleAccountSelection = (accountId: string, checked: boolean) => {
    setOrderForm(prev => ({
      ...prev,
      selectedAccounts: checked 
        ? [...prev.selectedAccounts, accountId]
        : prev.selectedAccounts.filter(id => id !== accountId)
    }));
  };

  const handleSelectAllAccounts = () => {
    const allAccountIds = connectedAccounts.map(account => account.id);
    const allSelected = allAccountIds.every(id => orderForm.selectedAccounts.includes(id));
    
    setOrderForm(prev => ({
      ...prev,
      selectedAccounts: allSelected ? [] : allAccountIds
    }));
  };

  // Order placement
  const handlePlaceOrder = async () => {
    if (!validateForm()) {
      showError('Please fix the validation errors');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const orderRequests: PlaceOrderRequest[] = orderForm.selectedAccounts.map(accountId => {
        const account = connectedAccounts.find(acc => acc.id === accountId);
        return {
          accountId,
          brokerName: account?.brokerName || 'SHOONYA',
          symbol: orderForm.symbol,
          exchange: orderForm.exchange,
          action: orderForm.action,
          quantity: parseInt(orderForm.quantity),
          price: orderForm.orderType === 'MARKET' ? 0 : parseFloat(orderForm.price),
          orderType: orderForm.orderType,
          product: orderForm.product,
          validity: orderForm.validity,
          triggerPrice: (orderForm.orderType === 'SL-LIMIT' || orderForm.orderType === 'SL-MARKET')
            ? parseFloat(orderForm.triggerPrice) : undefined
        };
      });

      const results = await Promise.allSettled(
        orderRequests.map(request => brokerService.placeOrder(request))
      );

      const successful = results.filter(result => result.status === 'fulfilled').length;
      const failed = results.length - successful;

      if (successful > 0) {
        if (failed > 0) {
          showWarning(`Order placed successfully on ${successful} account${successful > 1 ? 's' : ''}, failed on ${failed}`);
        } else {
          showSuccess(`Order placed successfully on ${successful} account${successful > 1 ? 's' : ''}`);
        }
        
        // Reset form on success
        setOrderForm(prev => ({
          ...prev,
          symbol: '',
          quantity: '',
          price: '',
          triggerPrice: ''
        }));
        setSearchQuery('');
      } else {
        showError('Failed to place order on all accounts');
      }
    } catch (error) {
      console.error('Order placement failed:', error);
      setError(error instanceof Error ? error.message : 'Failed to place order');
      showError('Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  // Utility functions
  const getFieldClassName = (fieldName: string) => {
    return validationErrors[fieldName] ? 'field-error' : '';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  // Loading state
  if (loading) {
    return (
      <div className="trading-theme">
        <AppNavigation />
        <div className="trade-setup-page">
          <div className="trade-setup-page__content">
            <div className="loading-container">
              <div className="loading-icon">📈</div>
              <div className="loading-text">Loading trading setup...</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No accounts state
  if (connectedAccounts.length === 0) {
    return (
      <div className="trading-theme">
        <AppNavigation />
        <div className="trade-setup-page">
          <div className="trade-setup-page__content">
            <div className="empty-state">
              <div className="empty-state__icon">🔗</div>
              <h2 className="empty-state__title">No Active Broker Accounts</h2>
              <p className="empty-state__subtitle">Connect and activate a broker account to start trading</p>
              <button 
                className="btn btn--primary"
                onClick={() => navigate('/account-setup')}
              >
                Connect Broker Account
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main render
  return (
    <div className="trading-theme">
      <AppNavigation />

      <div className="trade-setup-page">
        <div className="trade-setup-page__header">
          <h1 className="header-title">Place Order</h1>
          <p className="header-subtitle">Execute trades across multiple broker accounts</p>
          <div className="header-actions">
            <button
              className="btn btn--outline"
              onClick={() => navigate('/orders')}
            >
              📋 View Orders
            </button>
            <button
              className="btn btn--outline"
              onClick={() => navigate('/portfolio')}
            >
              📊 Positions
            </button>
            <button
              className="btn btn--error"
              onClick={() => {
                console.log('Test validation button clicked');
                validateForm();
              }}
            >
              🧪 Test Validation
            </button>
          </div>
        </div>

        <div className="trade-setup-page__content">
          <div className="trade-setup-page__main">
            <div className="order-form-grid">
              {/* Main Order Form */}
              <div className="order-form-section">
                <div className="card">
                  <div className="card__header">
                    <h2 className="card__title">Order Details</h2>
                    <div className="action-buttons">
                      <button
                        className={`btn ${orderForm.action === 'BUY' ? 'btn--success' : 'btn--outline'}`}
                        onClick={() => setOrderForm(prev => ({ ...prev, action: 'BUY' }))}
                      >
                        BUY
                      </button>
                      <button
                        className={`btn ${orderForm.action === 'SELL' ? 'btn--error' : 'btn--outline'}`}
                        onClick={() => setOrderForm(prev => ({ ...prev, action: 'SELL' }))}
                      >
                        SELL
                      </button>
                    </div>
                  </div>

                  <div className="card__content">
                    {/* Symbol Search */}
                    <div className="form-group">
                      <label className="form-label">Symbol *</label>
                      <div className="symbol-search">
                        <input
                          type="text"
                          className={`form-input ${getFieldClassName('symbol')}`}
                          placeholder="Search stocks (e.g., RELIANCE, TCS)"
                          value={searchQuery}
                          onChange={(e) => handleSymbolSearch(e.target.value)}
                          onFocus={() => searchResults.length > 0 && setShowSearchResults(true)}
                        />
                        {showSearchResults && searchResults.length > 0 && (
                          <div className="search-dropdown">
                            {searchResults.map((result, index) => (
                              <div
                                key={index}
                                className="search-result"
                                onClick={() => handleSymbolSelect(result)}
                              >
                                <div className="search-result__symbol">{result.symbol}</div>
                                <div className="search-result__name">{result.name}</div>
                                <div className="search-result__exchange">{result.exchange}</div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      {validationErrors.symbol && (
                        <div className="form-error">{validationErrors.symbol}</div>
                      )}
                    </div>

                    {/* Quantity and Price */}
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Quantity *</label>
                        <input
                          type="number"
                          className={`form-input ${getFieldClassName('quantity')}`}
                          placeholder="0"
                          value={orderForm.quantity}
                          onChange={(e) => setOrderForm(prev => ({ ...prev, quantity: e.target.value }))}
                        />
                        {validationErrors.quantity && (
                          <div className="form-error">{validationErrors.quantity}</div>
                        )}
                      </div>

                      <div className="form-group">
                        <label className="form-label">
                          Price {orderForm.orderType === 'MARKET' ? '(Market)' : '*'}
                        </label>
                        <input
                          type="number"
                          step="0.05"
                          className={`form-input ${getFieldClassName('price')}`}
                          placeholder="0.00"
                          value={orderForm.price}
                          onChange={(e) => setOrderForm(prev => ({ ...prev, price: e.target.value }))}
                          disabled={orderForm.orderType === 'MARKET'}
                        />
                        {validationErrors.price && (
                          <div className="form-error">{validationErrors.price}</div>
                        )}
                      </div>
                    </div>

                    {/* Order Type and Product */}
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">Order Type</label>
                        <select
                          className="form-select"
                          value={orderForm.orderType}
                          onChange={(e) => {
                            const newOrderType = e.target.value as any;
                            setOrderForm(prev => ({
                              ...prev,
                              orderType: newOrderType,
                              price: newOrderType === 'MARKET' ? '' : prev.price
                            }));
                          }}
                        >
                          <option value="MARKET">Market</option>
                          <option value="LIMIT">Limit</option>
                          <option value="SL-LIMIT">Stop Loss Limit</option>
                          <option value="SL-MARKET">Stop Loss Market</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="form-label">Product</label>
                        <select
                          className="form-select"
                          value={orderForm.product}
                          onChange={(e) => setOrderForm(prev => ({ ...prev, product: e.target.value as any }))}
                        >
                          <option value="CNC">CNC (Delivery)</option>
                          <option value="MIS">MIS (Intraday)</option>
                          <option value="NRML">NRML (Normal)</option>
                        </select>
                      </div>
                    </div>

                    {/* Trigger Price for Stop Loss Orders */}
                    {(orderForm.orderType === 'SL-LIMIT' || orderForm.orderType === 'SL-MARKET') && (
                      <div className="form-group">
                        <label className="form-label">Trigger Price *</label>
                        <input
                          type="number"
                          step="0.05"
                          className={`form-input ${getFieldClassName('triggerPrice')}`}
                          placeholder="0.00"
                          value={orderForm.triggerPrice}
                          onChange={(e) => setOrderForm(prev => ({ ...prev, triggerPrice: e.target.value }))}
                        />
                        {validationErrors.triggerPrice && (
                          <div className="form-error">{validationErrors.triggerPrice}</div>
                        )}
                      </div>
                    )}

                    {/* Broker Account Selection */}
                    <div className="form-group">
                      <div className="account-selection-header">
                        <label className="form-label">
                          Select Trading Accounts ({orderForm.selectedAccounts.length} selected)
                        </label>
                        {connectedAccounts.length > 1 && (
                          <button
                            type="button"
                            className="btn btn--link btn--small"
                            onClick={handleSelectAllAccounts}
                          >
                            {orderForm.selectedAccounts.length === connectedAccounts.length ? 'Deselect All' : 'Select All'}
                          </button>
                        )}
                      </div>

                      <div className={`account-selection ${getFieldClassName('selectedAccounts')}`}>
                        {connectedAccounts.length === 0 ? (
                          <div className="empty-accounts">
                            No active accounts found. Please activate at least one broker account.
                          </div>
                        ) : (
                          connectedAccounts.map(account => (
                            <div key={account.id} className="account-item">
                              <div className="account-checkbox">
                                <Checkbox
                                  checked={orderForm.selectedAccounts.includes(account.id)}
                                  onChange={(checked) => handleAccountSelection(account.id, checked)}
                                />
                              </div>
                              <div className="account-details">
                                <div className="account-header">
                                  <span className="account-broker">{account.brokerName.toUpperCase()}</span>
                                  <span className={`account-status ${account.isActive ? 'active' : 'inactive'}`}>
                                    {account.isActive ? 'ACTIVE' : 'INACTIVE'}
                                  </span>
                                </div>
                                <div className="account-info">
                                  <span className="account-id">Account: {account.userId}</span>
                                  <span className="account-user">{account.userName} • {account.email}</span>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                      {validationErrors.selectedAccounts && (
                        <div className="form-error">{validationErrors.selectedAccounts}</div>
                      )}
                    </div>

                    {/* Error Display */}
                    {error && (
                      <div className="error-message">
                        {error}
                      </div>
                    )}

                    {/* Place Order Button */}
                    <button
                      className="btn btn--primary btn--full-width btn--large"
                      onClick={handlePlaceOrder}
                      disabled={submitting || !orderForm.symbol || !orderForm.quantity || orderForm.selectedAccounts.length === 0}
                    >
                      {submitting
                        ? `Placing Orders on ${orderForm.selectedAccounts.length} Account${orderForm.selectedAccounts.length > 1 ? 's' : ''}...`
                        : `${orderForm.action} ${orderForm.symbol || 'Stock'} on ${orderForm.selectedAccounts.length} Account${orderForm.selectedAccounts.length > 1 ? 's' : ''}`
                      }
                    </button>
                  </div>
                </div>
              </div>

              {/* Order Summary & Margin Info Sidebar */}
              <div className="order-summary-section">
                {/* Order Summary */}
                <div className="card">
                  <div className="card__header">
                    <h3 className="card__title">Order Summary</h3>
                  </div>
                  <div className="card__content">
                    {orderForm.symbol ? (
                      <div className="summary-details">
                        <div className="summary-row">
                          <span className="summary-label">Symbol:</span>
                          <span className="summary-value">{orderForm.symbol}</span>
                        </div>
                        <div className="summary-row">
                          <span className="summary-label">Exchange:</span>
                          <span className={`summary-value exchange-badge ${orderForm.exchange.toLowerCase()}`}>
                            {orderForm.exchange}
                          </span>
                        </div>
                        <div className="summary-row">
                          <span className="summary-label">Action:</span>
                          <span className={`summary-value action-badge ${orderForm.action.toLowerCase()}`}>
                            {orderForm.action}
                          </span>
                        </div>
                        <div className="summary-row">
                          <span className="summary-label">Quantity:</span>
                          <span className="summary-value">{orderForm.quantity || '0'}</span>
                        </div>
                        <div className="summary-row">
                          <span className="summary-label">Price:</span>
                          <span className="summary-value">
                            {orderForm.orderType === 'MARKET' ? 'Market' : `₹${orderForm.price || '0.00'}`}
                          </span>
                        </div>
                        {(orderForm.orderType === 'SL-LIMIT' || orderForm.orderType === 'SL-MARKET') && (
                          <div className="summary-row">
                            <span className="summary-label">Trigger Price:</span>
                            <span className="summary-value">₹{orderForm.triggerPrice || '0.00'}</span>
                          </div>
                        )}
                        <div className="summary-row">
                          <span className="summary-label">Type:</span>
                          <span className="summary-value">{orderForm.orderType}</span>
                        </div>
                        <div className="summary-row">
                          <span className="summary-label">Product:</span>
                          <span className="summary-value">{orderForm.product}</span>
                        </div>
                        {orderForm.quantity && orderForm.price && (
                          <>
                            <div className="summary-divider"></div>
                            <div className="summary-row summary-total">
                              <span className="summary-label">Total Value:</span>
                              <span className="summary-value">
                                ₹{formatCurrency(parseInt(orderForm.quantity || '0') * parseFloat(orderForm.price || '0'))}
                              </span>
                            </div>
                          </>
                        )}
                      </div>
                    ) : (
                      <div className="empty-summary">
                        <div className="empty-summary__icon">📋</div>
                        <div className="empty-summary__text">Enter order details to see summary</div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Margin Information */}
                <div className="card">
                  <div className="card__header">
                    <h3 className="card__title">Margin Info</h3>
                  </div>
                  <div className="card__content">
                    <div className="margin-details">
                      <div className="margin-row">
                        <span className="margin-label">Required:</span>
                        <span className="margin-value">₹{formatCurrency(marginInfo.required)}</span>
                      </div>
                      <div className="margin-row">
                        <span className="margin-label">Available:</span>
                        <span className="margin-value">₹{formatCurrency(marginInfo.available)}</span>
                      </div>
                      {marginInfo.shortfall > 0 && (
                        <>
                          <div className="margin-row margin-shortfall">
                            <span className="margin-label">Shortfall:</span>
                            <span className="margin-value">₹{formatCurrency(marginInfo.shortfall)}</span>
                          </div>
                          <button
                            className="btn btn--primary btn--full-width btn--small"
                            onClick={() => navigate('/funds')}
                          >
                            Add Funds
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradeSetup;
