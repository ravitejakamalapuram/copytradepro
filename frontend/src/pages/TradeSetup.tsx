import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import { brokerService, type PlaceOrderRequest } from '../services/brokerService';
import { accountService, type ConnectedAccount } from '../services/accountService';
import { fundsService } from '../services/fundsService';
import { marketDataService } from '../services/marketDataService';
import { Checkbox } from '../components/ui/Checkbox';
import '../styles/app-theme.css';

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
  selectedAccounts: string[]; // Changed from single brokerAccount to array of selected account IDs
}

interface MarginInfo {
  required: number;
  available: number;
  shortfall: number;
}

const TradeSetup: React.FC = () => {
  const navigate = useNavigate();
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [orderForm, setOrderForm] = useState<OrderForm>({
    symbol: '',
    exchange: 'NSE',
    action: 'BUY',
    quantity: '',
    price: '',
    orderType: 'MARKET',
    product: 'CNC',
    validity: 'DAY',
    triggerPrice: '',
    selectedAccounts: [] // Initialize as empty array
  });
  const [marginInfo, setMarginInfo] = useState<MarginInfo>({
    required: 0,
    available: 0,
    shortfall: 0
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        setError(null);

        const accounts = await accountService.getConnectedAccounts();
        setConnectedAccounts(accounts);

        // Auto-select all active accounts by default
        if (accounts.length > 0) {
          setOrderForm(prev => ({
            ...prev,
            selectedAccounts: accounts.map(account => account.id)
          }));
        }

      } catch (error: any) {
        console.error('Failed to fetch accounts:', error);
        setError('Failed to load broker accounts');
      } finally {
        setLoading(false);
      }
    };

    fetchAccounts();
  }, []);

  // Calculate margin when form changes
  useEffect(() => {
    const calculateMargin = async () => {
      if (orderForm.symbol && orderForm.quantity && orderForm.price) {
        try {
          const margin = await fundsService.getMarginRequirement(
            orderForm.symbol,
            parseInt(orderForm.quantity),
            parseFloat(orderForm.price)
          );
          setMarginInfo(margin);
        } catch (error) {
          console.error('Failed to calculate margin:', error);
        }
      }
    };

    if (orderForm.orderType !== 'MARKET') {
      calculateMargin();
    }
  }, [orderForm.symbol, orderForm.quantity, orderForm.price, orderForm.orderType]);

  // Debounced symbol search
  const handleSymbolSearch = React.useCallback(
    React.useMemo(() => {
      let timeoutId: NodeJS.Timeout;
      return (searchTerm: string) => {
        clearTimeout(timeoutId);

        if (searchTerm.length < 2) {
          setSearchResults([]);
          setShowSearchResults(false);
          setSearchLoading(false);
          return;
        }

        setSearchLoading(true);
        timeoutId = setTimeout(async () => {
          try {
            console.log(`🔍 Frontend: Searching for "${searchTerm}" on ${orderForm.exchange}`);

            // Use NSE API search (broker-independent)
            const response = await marketDataService.searchSymbols(searchTerm, 8, orderForm.exchange);

            console.log(`📊 Frontend: Received response:`, response);

            // Handle the new response format
            const results = response.success ? response.data.results : [];

            // Transform results to match expected format (no prices for fast search)
            const transformedResults = results.map((result: any) => ({
              symbol: result.symbol,
              name: result.name,
              exchange: result.exchange,
              ltp: 0, // No price in search results for speed
              token: result.token || null
            }));

            console.log(`✅ Frontend: Transformed results:`, transformedResults);

            setSearchResults(transformedResults);
            setShowSearchResults(transformedResults.length > 0);

            if (transformedResults.length === 0) {
              console.log('❌ Frontend: No results found for:', searchTerm);
            }
          } catch (error: any) {
            console.error('❌ Frontend: Symbol search failed:', error);

            // Always show empty results on error
            setSearchResults([]);
            setShowSearchResults(false);
          } finally {
            setSearchLoading(false);
          }
        }, 300); // 300ms debounce
      };
    }, []),
    []
  );

  const handleSymbolSelect = (selectedSymbol: any) => {
    setOrderForm(prev => ({
      ...prev,
      symbol: selectedSymbol.symbol,
      exchange: selectedSymbol.exchange,
      // Don't set price from search results - user will enter manually or fetch separately
      price: prev.price // Keep existing price
    }));
    setShowSearchResults(false);
  };

  const handleAccountSelection = (accountId: string, checked: boolean) => {
    setOrderForm(prev => ({
      ...prev,
      selectedAccounts: checked
        ? [...prev.selectedAccounts, accountId]
        : prev.selectedAccounts.filter(id => id !== accountId)
    }));
  };

  const handleSelectAllAccounts = () => {
    const allSelected = orderForm.selectedAccounts.length === connectedAccounts.length;
    setOrderForm(prev => ({
      ...prev,
      selectedAccounts: allSelected ? [] : connectedAccounts.map(account => account.id)
    }));
  };

  const handlePlaceOrder = async () => {
    if (!orderForm.symbol || !orderForm.quantity || orderForm.selectedAccounts.length === 0) {
      setError('Please fill all required fields and select at least one account');
      return;
    }

    // Validate trigger price for Stop Loss orders
    if ((orderForm.orderType === 'SL-LIMIT' || orderForm.orderType === 'SL-MARKET') && !orderForm.triggerPrice) {
      setError('Trigger price is required for Stop Loss orders');
      return;
    }

    if (orderForm.orderType !== 'MARKET' && !orderForm.price) {
      setError('Price is required for limit orders');
      return;
    }

    if (marginInfo.shortfall > 0) {
      setError(`Insufficient margin. Shortfall: ₹${marginInfo.shortfall.toLocaleString()}`);
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      // Place orders across all selected accounts
      const orderPromises = orderForm.selectedAccounts.map(async (accountId) => {
        const account = connectedAccounts.find(acc => acc.id === accountId);
        if (!account) {
          throw new Error(`Account not found: ${accountId}`);
        }

        const orderRequest: PlaceOrderRequest = {
          brokerName: account.brokerName,
          accountId: accountId,
          symbol: orderForm.symbol,
          action: orderForm.action,
          quantity: parseInt(orderForm.quantity),
          price: orderForm.orderType === 'MARKET' ? undefined : parseFloat(orderForm.price),
          orderType: orderForm.orderType,
          exchange: orderForm.exchange,
          productType: orderForm.product,
          triggerPrice: (orderForm.orderType === 'SL-LIMIT' || orderForm.orderType === 'SL-MARKET')
            ? parseFloat(orderForm.triggerPrice)
            : undefined,
          remarks: `${orderForm.validity} order`
        };

        return brokerService.placeOrder(orderRequest);
      });

      const results = await Promise.allSettled(orderPromises);

      // Process results
      const successful = results.filter(result =>
        result.status === 'fulfilled' && result.value.success
      );
      const failed = results.filter(result =>
        result.status === 'rejected' ||
        (result.status === 'fulfilled' && !result.value.success)
      );

      if (successful.length > 0) {
        const successCount = successful.length;
        const totalCount = orderForm.selectedAccounts.length;

        if (failed.length === 0) {
          alert(`🎉 All orders placed successfully! (${successCount}/${totalCount} accounts)`);
        } else {
          alert(`⚠️ Partial success: ${successCount}/${totalCount} orders placed successfully`);
        }

        // Reset form
        setOrderForm(prev => ({
          ...prev,
          symbol: '',
          quantity: '',
          price: '',
          triggerPrice: ''
        }));

        // Navigate to orders page
        navigate('/orders');
      } else {
        setError(`Failed to place orders on all ${orderForm.selectedAccounts.length} accounts`);
      }

    } catch (error: any) {
      console.error('Order placement failed:', error);
      setError(error.message || 'Failed to place orders');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
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
            <div style={{ fontSize: '2rem' }}>📈</div>
            <div style={{ color: 'var(--kite-text-secondary)' }}>Loading trading setup...</div>
          </div>
        </div>
      </div>
    );
  }

  if (connectedAccounts.length === 0) {
    return (
      <div className="kite-theme">
        <AppNavigation />
        <div className="kite-main">
          <div className="kite-card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '500', marginBottom: '1rem' }}>
              No Active Broker Accounts
            </div>
            <div style={{ color: 'var(--kite-text-secondary)', marginBottom: '2rem' }}>
              Connect and activate a broker account to start trading
            </div>
            <button 
              className="kite-btn kite-btn-primary"
              onClick={() => navigate('/account-setup')}
            >
              Connect Broker Account
            </button>
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
            <h1 className="kite-card-title">Place Order</h1>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button 
                className="kite-btn"
                onClick={() => navigate('/orders')}
              >
                📋 View Orders
              </button>
              <button 
                className="kite-btn"
                onClick={() => navigate('/positions')}
              >
                🎯 Positions
              </button>
            </div>
          </div>
        </div>

        {/* Order Form */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          {/* Main Order Form */}
          <div className="kite-card">
            <div className="kite-card-header">
              <h2 className="kite-card-title">Order Details</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  className={`kite-btn ${orderForm.action === 'BUY' ? 'kite-btn-primary' : ''}`}
                  onClick={() => setOrderForm(prev => ({ ...prev, action: 'BUY' }))}
                  style={{
                    backgroundColor: orderForm.action === 'BUY' ? 'var(--kite-profit)' : undefined,
                    color: orderForm.action === 'BUY' ? 'white' : undefined
                  }}
                >
                  BUY
                </button>
                <button
                  className={`kite-btn ${orderForm.action === 'SELL' ? 'kite-btn-danger' : ''}`}
                  onClick={() => setOrderForm(prev => ({ ...prev, action: 'SELL' }))}
                  style={{
                    backgroundColor: orderForm.action === 'SELL' ? 'var(--kite-loss)' : undefined,
                    color: orderForm.action === 'SELL' ? 'white' : undefined
                  }}
                >
                  SELL
                </button>
              </div>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Symbol Search */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                  Symbol *
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    placeholder="Search stocks (e.g., RELIANCE, TCS)"
                    value={orderForm.symbol}
                    onChange={(e) => {
                      setOrderForm(prev => ({ ...prev, symbol: e.target.value }));
                      handleSymbolSearch(e.target.value);
                    }}
                    className="kite-input"
                    style={{ fontSize: '1rem', paddingRight: searchLoading ? '2.5rem' : '1rem' }}
                  />
                  {searchLoading && (
                    <div style={{
                      position: 'absolute',
                      right: '0.75rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      fontSize: '0.875rem'
                    }}>
                      ⏳
                    </div>
                  )}
                </div>

                {/* Search Results Dropdown */}
                {showSearchResults && searchResults.length > 0 && (
                  <div style={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    backgroundColor: 'var(--kite-bg-secondary)',
                    border: '1px solid var(--kite-border-primary)',
                    borderRadius: 'var(--kite-radius-md)',
                    zIndex: 1000,
                    maxHeight: '200px',
                    overflowY: 'auto'
                  }}>
                    {searchResults.map((result, index) => (
                      <div
                        key={index}
                        onClick={() => handleSymbolSelect(result)}
                        style={{
                          padding: '0.75rem',
                          cursor: 'pointer',
                          borderBottom: index < searchResults.length - 1 ? '1px solid var(--kite-border-secondary)' : 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--kite-bg-tertiary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ fontWeight: '500', color: 'var(--kite-text-primary)' }}>
                          {result.symbol}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                          {result.name}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quantity and Price */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                    Quantity *
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={orderForm.quantity}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, quantity: e.target.value }))}
                    className="kite-input"
                    style={{ fontSize: '1rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                    Price {orderForm.orderType === 'MARKET' ? '(Market)' : '*'}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    placeholder="0.00"
                    value={orderForm.price}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, price: e.target.value }))}
                    className="kite-input"
                    style={{ fontSize: '1rem' }}
                    disabled={orderForm.orderType === 'MARKET'}
                  />
                </div>
              </div>

              {/* Order Type and Product */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                    Order Type
                  </label>
                  <select
                    value={orderForm.orderType}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, orderType: e.target.value as any }))}
                    className="kite-input"
                    style={{ fontSize: '1rem' }}
                  >
                    <option value="MARKET">Market</option>
                    <option value="LIMIT">Limit</option>
                    <option value="SL-LIMIT">Stop Loss Limit</option>
                    <option value="SL-MARKET">Stop Loss Market</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                    Product
                  </label>
                  <select
                    value={orderForm.product}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, product: e.target.value as any }))}
                    className="kite-input"
                    style={{ fontSize: '1rem' }}
                  >
                    <option value="CNC">CNC (Delivery)</option>
                    <option value="MIS">MIS (Intraday)</option>
                    <option value="NRML">NRML (Normal)</option>
                  </select>
                </div>
              </div>

              {/* Trigger Price for Stop Loss Orders */}
              {(orderForm.orderType === 'SL-LIMIT' || orderForm.orderType === 'SL-MARKET') && (
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                    Trigger Price *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    placeholder="0.00"
                    value={orderForm.triggerPrice}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, triggerPrice: e.target.value }))}
                    className="kite-input"
                    style={{ fontSize: '1rem' }}
                  />
                </div>
              )}

              {/* Broker Account Selection */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)' }}>
                    Select Trading Accounts ({orderForm.selectedAccounts.length} selected)
                  </label>
                  {connectedAccounts.length > 1 && (
                    <button
                      type="button"
                      onClick={handleSelectAllAccounts}
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--kite-primary)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        textDecoration: 'underline'
                      }}
                    >
                      {orderForm.selectedAccounts.length === connectedAccounts.length ? 'Deselect All' : 'Select All'}
                    </button>
                  )}
                </div>
                <div style={{
                  border: '1px solid var(--kite-border)',
                  borderRadius: 'var(--kite-radius-md)',
                  padding: '1rem',
                  backgroundColor: 'var(--kite-bg-primary)',
                  maxHeight: '300px',
                  overflowY: 'auto',
                  boxShadow: 'inset 0 1px 3px rgba(0, 0, 0, 0.1)'
                }}>
                  {connectedAccounts.length === 0 ? (
                    <div style={{
                      color: 'var(--kite-text-secondary)',
                      fontSize: '0.875rem',
                      textAlign: 'center',
                      padding: '1rem'
                    }}>
                      No active accounts found. Please activate at least one broker account.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {connectedAccounts.map(account => (
                        <div
                          key={account.id}
                          style={{
                            padding: '0.75rem',
                            border: orderForm.selectedAccounts.includes(account.id)
                              ? '2px solid var(--kite-primary)'
                              : '1px solid var(--kite-border)',
                            borderRadius: 'var(--kite-radius-sm)',
                            backgroundColor: orderForm.selectedAccounts.includes(account.id)
                              ? 'var(--kite-bg-primary-light)'
                              : 'var(--kite-bg-primary)',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <Checkbox
                            checked={orderForm.selectedAccounts.includes(account.id)}
                            onChange={(checked) => handleAccountSelection(account.id, checked)}
                            label={
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginLeft: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                  <span style={{
                                    fontWeight: '600',
                                    fontSize: '0.875rem',
                                    color: 'var(--kite-text-primary)'
                                  }}>
                                    {account.brokerName.toUpperCase()}
                                  </span>
                                  <span style={{
                                    fontSize: '0.75rem',
                                    padding: '0.125rem 0.375rem',
                                    backgroundColor: account.isActive ? 'var(--kite-profit)' : 'var(--kite-text-secondary)',
                                    color: 'white',
                                    borderRadius: '0.25rem',
                                    fontWeight: '500'
                                  }}>
                                    {account.isActive ? 'ACTIVE' : 'INACTIVE'}
                                  </span>
                                </div>
                                <span style={{
                                  fontSize: '0.875rem',
                                  fontWeight: '500',
                                  color: 'var(--kite-text-primary)'
                                }}>
                                  Account: {account.userId}
                                </span>
                                <span style={{
                                  fontSize: '0.75rem',
                                  color: 'var(--kite-text-secondary)'
                                }}>
                                  {account.userName} • {account.email}
                                </span>
                              </div>
                            }
                            size="base"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {orderForm.selectedAccounts.length === 0 && (
                  <div style={{
                    fontSize: '0.75rem',
                    color: 'var(--kite-loss)',
                    marginTop: '0.25rem'
                  }}>
                    Please select at least one account to place orders
                  </div>
                )}
              </div>

              {/* Error Display */}
              {error && (
                <div style={{
                  padding: '0.75rem',
                  backgroundColor: 'var(--kite-bg-danger)',
                  border: '1px solid var(--kite-loss)',
                  borderRadius: 'var(--kite-radius-md)',
                  color: 'var(--kite-loss)',
                  fontSize: '0.875rem'
                }}>
                  {error}
                </div>
              )}

              {/* Place Order Button */}
              <button
                className="kite-btn kite-btn-primary"
                onClick={handlePlaceOrder}
                disabled={submitting || !orderForm.symbol || !orderForm.quantity || orderForm.selectedAccounts.length === 0}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  padding: '0.75rem'
                }}
              >
                {submitting
                  ? `Placing Orders on ${orderForm.selectedAccounts.length} Account${orderForm.selectedAccounts.length > 1 ? 's' : ''}...`
                  : `${orderForm.action} ${orderForm.symbol || 'Stock'} on ${orderForm.selectedAccounts.length} Account${orderForm.selectedAccounts.length > 1 ? 's' : ''}`
                }
              </button>
            </div>
          </div>

          {/* Order Summary & Margin Info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {/* Order Summary */}
            <div className="kite-card">
              <div className="kite-card-header">
                <h3 className="kite-card-title">Order Summary</h3>
              </div>
              <div style={{ padding: '1rem' }}>
                {orderForm.symbol ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--kite-text-secondary)' }}>Symbol:</span>
                      <span style={{ fontWeight: '500' }}>{orderForm.symbol}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--kite-text-secondary)' }}>Exchange:</span>
                      <span style={{
                        fontWeight: '500',
                        fontSize: '0.75rem',
                        padding: '0.125rem 0.5rem',
                        backgroundColor: orderForm.exchange === 'NSE' ? '#1f77b4' : '#ff7f0e',
                        color: 'white',
                        borderRadius: '0.25rem',
                        letterSpacing: '0.5px'
                      }}>
                        {orderForm.exchange}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--kite-text-secondary)' }}>Action:</span>
                      <span style={{
                        fontWeight: '500',
                        color: orderForm.action === 'BUY' ? 'var(--kite-profit)' : 'var(--kite-loss)'
                      }}>
                        {orderForm.action}
                      </span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--kite-text-secondary)' }}>Quantity:</span>
                      <span style={{ fontWeight: '500' }}>{orderForm.quantity || '0'}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--kite-text-secondary)' }}>Price:</span>
                      <span style={{ fontWeight: '500', fontFamily: 'var(--kite-font-mono)' }}>
                        {orderForm.orderType === 'MARKET' ? 'Market' : `₹${orderForm.price || '0.00'}`}
                      </span>
                    </div>
                    {(orderForm.orderType === 'SL-LIMIT' || orderForm.orderType === 'SL-MARKET') && (
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--kite-text-secondary)' }}>Trigger Price:</span>
                        <span style={{ fontWeight: '500', fontFamily: 'var(--kite-font-mono)' }}>
                          ₹{orderForm.triggerPrice || '0.00'}
                        </span>
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--kite-text-secondary)' }}>Type:</span>
                      <span style={{ fontWeight: '500' }}>{orderForm.orderType}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--kite-text-secondary)' }}>Product:</span>
                      <span style={{ fontWeight: '500' }}>{orderForm.product}</span>
                    </div>
                    {orderForm.quantity && orderForm.price && (
                      <>
                        <hr style={{ border: 'none', borderTop: '1px solid var(--kite-border-secondary)', margin: '0.5rem 0' }} />
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--kite-text-secondary)' }}>Total Value:</span>
                          <span style={{ fontWeight: '600', fontFamily: 'var(--kite-font-mono)' }}>
                            ₹{formatCurrency(parseInt(orderForm.quantity || '0') * parseFloat(orderForm.price || '0'))}
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: 'center', color: 'var(--kite-text-secondary)', padding: '2rem' }}>
                    <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                    <div>Enter order details to see summary</div>
                  </div>
                )}
              </div>
            </div>

            {/* Margin Information */}
            <div className="kite-card">
              <div className="kite-card-header">
                <h3 className="kite-card-title">Margin Info</h3>
              </div>
              <div style={{ padding: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--kite-text-secondary)' }}>Required:</span>
                    <span style={{ fontWeight: '500', fontFamily: 'var(--kite-font-mono)' }}>
                      ₹{formatCurrency(marginInfo.required)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--kite-text-secondary)' }}>Available:</span>
                    <span style={{ fontWeight: '500', fontFamily: 'var(--kite-font-mono)' }}>
                      ₹{formatCurrency(marginInfo.available)}
                    </span>
                  </div>
                  {marginInfo.shortfall > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--kite-loss)' }}>Shortfall:</span>
                      <span style={{ fontWeight: '500', fontFamily: 'var(--kite-font-mono)', color: 'var(--kite-loss)' }}>
                        ₹{formatCurrency(marginInfo.shortfall)}
                      </span>
                    </div>
                  )}

                  {marginInfo.shortfall > 0 && (
                    <button
                      className="kite-btn kite-btn-primary"
                      onClick={() => navigate('/funds')}
                      style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                    >
                      Add Funds
                    </button>
                  )}
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
