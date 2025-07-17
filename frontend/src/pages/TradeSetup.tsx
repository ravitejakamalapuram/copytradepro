import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import OrderResultDisplay, { type OrderResultSummary } from '../components/OrderResultDisplay';
import { brokerService, type PlaceMultiAccountOrderRequest } from '../services/brokerService';
import { accountService, type ConnectedAccount } from '../services/accountService';
import { fundsService } from '../services/fundsService';
import { marketDataService } from '../services/marketDataService';
import { transformBrokerResponseToOrderResult } from '../utils/orderResultTransformer';
import { Checkbox } from '../components/ui/Checkbox';
import Button from '../components/ui/Button';
import '../styles/app-theme.css';

type OrderType = 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
type Product = 'CNC' | 'MIS' | 'NRML';
type SymbolSearchResult = { symbol: string; exchange: string };
type FailedOrderResult = { accountId: string };

interface OrderForm {
  symbol: string;
  exchange: 'NSE' | 'BSE';
  action: 'BUY' | 'SELL';
  quantity: string;
  price: string;
  orderType: OrderType;
  product: Product;
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
  const [orderResult, setOrderResult] = useState<OrderResultSummary | null>(null);
  const [showOrderResult, setShowOrderResult] = useState(false);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        setLoading(true);
        setError(null);

        const accounts = await accountService.getConnectedAccounts();
        console.log('🔍 DEBUG: Fetched accounts:', accounts);
        setConnectedAccounts(accounts);

        // Auto-select all active accounts by default
        if (accounts.length > 0) {
          setOrderForm(prev => ({
            ...prev,
            selectedAccounts: accounts.map(account => account.id)
          }));
        }

      } catch (error: unknown) {
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
        } catch (error: unknown) {
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
          } catch (error: unknown) {
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

  const handleSymbolSelect = (selectedSymbol: unknown) => {
    if (
      typeof selectedSymbol === 'object' &&
      selectedSymbol !== null &&
      'symbol' in selectedSymbol &&
      'exchange' in selectedSymbol &&
      typeof (selectedSymbol as { symbol: unknown }).symbol === 'string' &&
      ((selectedSymbol as { exchange: unknown }).exchange === 'NSE' || (selectedSymbol as { exchange: unknown }).exchange === 'BSE')
    ) {
      const { symbol, exchange } = selectedSymbol as SymbolSearchResult & { exchange: 'NSE' | 'BSE' };
      setOrderForm(prev => ({
        ...prev,
        symbol,
        exchange,
        price: prev.price
      }));
      setShowSearchResults(false);
    }
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

      // Use the new multi-account order placement service
      const orderRequest: PlaceMultiAccountOrderRequest = {
        selectedAccounts: orderForm.selectedAccounts,
        symbol: orderForm.symbol,
        action: orderForm.action,
        quantity: parseInt(orderForm.quantity),
        orderType: orderForm.orderType,
        price: orderForm.orderType === 'MARKET' ? undefined : parseFloat(orderForm.price),
        triggerPrice: (orderForm.orderType === 'SL-LIMIT' || orderForm.orderType === 'SL-MARKET')
          ? parseFloat(orderForm.triggerPrice)
          : undefined,
        exchange: orderForm.exchange,
        productType: orderForm.product,
        remarks: `${orderForm.validity} order placed via CopyTrade Pro`
      };

      const response = await brokerService.placeMultiAccountOrder(orderRequest);
      
      // Transform the response to OrderResultSummary format
      const orderResultSummary = transformBrokerResponseToOrderResult(response, {
        symbol: orderForm.symbol,
        action: orderForm.action,
        quantity: parseInt(orderForm.quantity),
        orderType: orderForm.orderType,
        price: orderForm.orderType === 'MARKET' ? undefined : parseFloat(orderForm.price),
        triggerPrice: (orderForm.orderType === 'SL-LIMIT' || orderForm.orderType === 'SL-MARKET')
          ? parseFloat(orderForm.triggerPrice)
          : undefined,
        exchange: orderForm.exchange,
        productType: orderForm.product
      });

      // Show the order result display
      setOrderResult(orderResultSummary);
      setShowOrderResult(true);

      // If all orders were successful, reset the form
      if (orderResultSummary.failedAccounts === 0) {
        setOrderForm(prev => ({
          ...prev,
          symbol: '',
          quantity: '',
          price: '',
          triggerPrice: ''
        }));
      }

    } catch (error: unknown) {
      console.error('Order placement failed:', error);
      setError((error as Error).message || 'Failed to place orders');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetryFailedOrders = async (failedResults: FailedOrderResult[]) => {
    const failedAccountIds = failedResults.map(result => result.accountId);
    
    // Update the form to only select failed accounts
    setOrderForm(prev => ({
      ...prev,
      selectedAccounts: failedAccountIds
    }));
    
    // Close the result display and let user modify if needed
    setShowOrderResult(false);
    setError('Ready to retry failed orders. You can modify the order details if needed, then click Place Order again.');
  };

  const handleCloseOrderResult = () => {
    setShowOrderResult(false);
    setOrderResult(null);
    
    // If there were successful orders, navigate to orders page
    if (orderResult && orderResult.successfulAccounts > 0) {
      navigate('/orders');
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
            <div style={{ fontSize: '2rem' }}>📈</div>
            <div style={{ color: 'var(--text-secondary)' }}>Loading trading setup...</div>
          </div>
        </div>
      </div>
    );
  }

  if (connectedAccounts.length === 0) {
    return (
      <div className="app-theme app-layout">
        <AppNavigation />
        <div className="app-main">
          <div className="card" style={{ textAlign: 'center', padding: '3rem' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '500', marginBottom: '1rem' }}>
              No Active Broker Accounts
            </div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Connect and activate a broker account to start trading
            </div>
            <Button 
              onClick={() => navigate('/account-setup')}
            >
              Connect Broker Account
            </Button>
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
            <h1 className="card-title">Place Order</h1>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <Button
                onClick={() => navigate('/orders')}
              >
                📋 View Orders
              </Button>
              <Button
                onClick={() => navigate('/positions')}
              >
                🎯 Positions
              </Button>
            </div>
          </div>
        </div>

        {/* Order Form */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '2rem' }}>
          {/* Main Order Form */}
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Order Details</h2>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Button
                  onClick={() => setOrderForm(prev => ({ ...prev, action: 'BUY' }))}
                  style={{
                    backgroundColor: orderForm.action === 'BUY' ? 'var(--color-profit)' : undefined,
                    color: orderForm.action === 'BUY' ? 'white' : undefined
                  }}
                >
                  BUY
                </Button>
                <Button
                  onClick={() => setOrderForm(prev => ({ ...prev, action: 'SELL' }))}
                  style={{
                    backgroundColor: orderForm.action === 'SELL' ? 'var(--color-loss)' : undefined,
                    color: orderForm.action === 'SELL' ? 'white' : undefined
                  }}
                >
                  SELL
                </Button>
              </div>
            </div>

            <div style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {/* Symbol Search */}
              <div style={{ position: 'relative' }}>
                <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
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
                    className="form-input"
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
                    backgroundColor: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    borderRadius: 'var(--radius-md)',
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
                          borderBottom: index < searchResults.length - 1 ? '1px solid var(--border-secondary)' : 'none'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                          {result.symbol}
                        </div>
                        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
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
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                    Quantity *
                  </label>
                  <input
                    type="number"
                    placeholder="0"
                    value={orderForm.quantity}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, quantity: e.target.value }))}
                    className="form-input"
                    style={{ fontSize: '1rem' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                    Price {orderForm.orderType === 'MARKET' ? '(Market)' : '*'}
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    placeholder="0.00"
                    value={orderForm.price}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, price: e.target.value }))}
                    className="form-input"
                    style={{ fontSize: '1rem' }}
                    disabled={orderForm.orderType === 'MARKET'}
                  />
                </div>
              </div>

              {/* Order Type and Product */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                    Order Type
                  </label>
                  <select
                    value={orderForm.orderType}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, orderType: e.target.value as OrderType }))}
                    className="form-input"
                    style={{ fontSize: '1rem' }}
                  >
                    <option value="MARKET">Market</option>
                    <option value="LIMIT">Limit</option>
                    <option value="SL-LIMIT">Stop Loss Limit</option>
                    <option value="SL-MARKET">Stop Loss Market</option>
                  </select>
                </div>

                <div>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                    Product
                  </label>
                  <select
                    value={orderForm.product}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, product: e.target.value as Product }))}
                    className="form-input"
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
                  <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                    Trigger Price *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    placeholder="0.00"
                    value={orderForm.triggerPrice}
                    onChange={(e) => setOrderForm(prev => ({ ...prev, triggerPrice: e.target.value }))}
                    className="form-input"
                    style={{ fontSize: '1rem' }}
                  />
                </div>
              )}

              {/* Error Display */}
              {error && (
                <div className="alert alert-error">
                  {error}
                </div>
              )}
            </div>

            {/* Action Bar */}
            <div className="action-bar">
              <Button
                onClick={handlePlaceOrder}
                disabled={submitting || !orderForm.symbol || !orderForm.quantity || orderForm.selectedAccounts.length === 0}
                style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '0.75rem' }}
              >
                {submitting
                  ? `Placing Orders on ${orderForm.selectedAccounts.length} Account${orderForm.selectedAccounts.length > 1 ? 's' : ''}...`
                  : `${orderForm.action} ${orderForm.symbol || 'Stock'} on ${orderForm.selectedAccounts.length} Account${orderForm.selectedAccounts.length > 1 ? 's' : ''}`
                }
              </Button>
              {connectedAccounts.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="account-select-toggle"
                  onClick={handleSelectAllAccounts}
                  style={{ width: '100%', justifyContent: 'center', fontSize: '1rem', padding: '0.75rem' }}
                >
                  {orderForm.selectedAccounts.length === connectedAccounts.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
          </div>

          {/* Broker Account Selection - OUTSIDE the order form card */}
          <div className="card account-selection-section" style={{ margin: '2rem 0' }}>
            <div className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="card-title">Select Trading Accounts ({orderForm.selectedAccounts.length} selected)</span>
              {connectedAccounts.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="account-select-toggle"
                  onClick={handleSelectAllAccounts}
                >
                  {orderForm.selectedAccounts.length === connectedAccounts.length ? 'Deselect All' : 'Select All'}
                </Button>
              )}
            </div>
            <div className="account-selection">
              {connectedAccounts.length === 0 ? (
                <div className="no-accounts">
                  No active accounts found. Please activate at least one broker account.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {connectedAccounts.map(account => (
                    <div
                      key={account.id}
                      className={`account-card${orderForm.selectedAccounts.includes(account.id) ? ' selected' : ''}`}
                    >
                      <div className="account-info">
                        <Checkbox
                          checked={orderForm.selectedAccounts.includes(account.id)}
                          onChange={(checked) => handleAccountSelection(account.id, checked)}
                          label={`${account.brokerName || 'Unknown Broker'} (${account.isActive ? 'Active' : 'Inactive'})`}
                          size="base"
                        />
                      </div>
                      <div className="account-meta">
                        ID: {account.id} | User: {account.userName || 'N/A'} | Account: {account.accountId || 'N/A'}
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {orderForm.selectedAccounts.length === 0 && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-loss)', marginTop: '0.25rem' }}>
                  Please select at least one account to place orders
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Order Summary & Margin Info */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {/* Order Summary */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Order Summary</h3>
          </div>
          <div style={{ padding: '1rem' }}>
            {orderForm.symbol ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Symbol:</span>
                  <span style={{ fontWeight: '500' }}>{orderForm.symbol}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Exchange:</span>
                  <span style={{
                    fontWeight: '500',
                    fontSize: '0.75rem',
                    padding: '0.125rem 0.5rem',
                    backgroundColor: orderForm.exchange === 'NSE' ? 'var(--exchange-nse)' : 'var(--exchange-other)',
                    color: 'white',
                    borderRadius: '0.25rem',
                    letterSpacing: '0.5px'
                  }}>
                    {orderForm.exchange}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Action:</span>
                  <span style={{
                    fontWeight: '500',
                    color: orderForm.action === 'BUY' ? 'var(--color-profit)' : 'var(--color-loss)'
                  }}>
                    {orderForm.action}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Quantity:</span>
                  <span style={{ fontWeight: '500' }}>{orderForm.quantity || '0'}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Price:</span>
                  <span style={{ fontWeight: '500', fontFamily: 'var(--font-mono)' }}>
                    {orderForm.orderType === 'MARKET' ? 'Market' : `₹${orderForm.price || '0.00'}`}
                  </span>
                </div>
                {(orderForm.orderType === 'SL-LIMIT' || orderForm.orderType === 'SL-MARKET') && (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>Trigger Price:</span>
                    <span style={{ fontWeight: '500', fontFamily: 'var(--font-mono)' }}>
                      ₹{orderForm.triggerPrice || '0.00'}
                    </span>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Type:</span>
                  <span style={{ fontWeight: '500' }}>{orderForm.orderType}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Product:</span>
                  <span style={{ fontWeight: '500' }}>{orderForm.product}</span>
                </div>
                {orderForm.quantity && orderForm.price && (
                  <>
                    <hr style={{ border: 'none', borderTop: '1px solid var(--border-secondary)', margin: '0.5rem 0' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-secondary)' }}>Total Value:</span>
                      <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                        ₹{formatCurrency(parseInt(orderForm.quantity || '0') * parseFloat(orderForm.price || '0'))}
                      </span>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📋</div>
                <div>Enter order details to see summary</div>
              </div>
            )}
          </div>
        </div>

        {/* Margin Information */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Margin Info</h3>
          </div>
          <div style={{ padding: '1rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Required:</span>
                <span style={{ fontWeight: '500', fontFamily: 'var(--font-mono)' }}>
                  ₹{formatCurrency(marginInfo.required)}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Available:</span>
                <span style={{ fontWeight: '500', fontFamily: 'var(--font-mono)' }}>
                  ₹{formatCurrency(marginInfo.available)}
                </span>
              </div>
              {marginInfo.shortfall > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-loss)' }}>Shortfall:</span>
                  <span style={{ fontWeight: '500', fontFamily: 'var(--font-mono)', color: 'var(--color-loss)' }}>
                    ₹{formatCurrency(marginInfo.shortfall)}
                  </span>
                </div>
              )}

              {marginInfo.shortfall > 0 && (
                <Button
                  className="btn btn-primary"
                  onClick={() => navigate('/funds')}
                  style={{ width: '100%', justifyContent: 'center', marginTop: '0.5rem' }}
                >
                  Add Funds
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Order Result Display Modal/Overlay */}
      {showOrderResult && orderResult && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 1000,
          padding: '1rem'
        }}>
          <div style={{
            maxWidth: '800px',
            width: '100%',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <OrderResultDisplay
              summary={orderResult}
              onClose={handleCloseOrderResult}
              onRetryFailed={handleRetryFailedOrders}
              showRetryOption={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default TradeSetup;
