import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import KiteNavigation from '../components/KiteNavigation';
import { brokerService, type PlaceOrderRequest } from '../services/brokerService';
import { accountService, type ConnectedAccount } from '../services/accountService';
import { fundsService } from '../services/fundsService';
import { marketDataService } from '../services/marketDataService';
import '../styles/kite-theme.css';

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
  brokerAccount: string;
}

interface MarginInfo {
  required: number;
  available: number;
  shortfall: number;
}

const KiteTradeSetup: React.FC = () => {
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
    brokerAccount: ''
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
        const activeAccounts = accounts.filter(account => account.isActive);
        setConnectedAccounts(activeAccounts);

        if (activeAccounts.length > 0) {
          setOrderForm(prev => ({ ...prev, brokerAccount: activeAccounts[0].id }));
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
            // Use live broker API search with fallback to market data service
            const results = await marketDataService.searchSymbols(searchTerm, 8, orderForm.exchange);

            // Transform results to match expected format
            const transformedResults = results.map(result => ({
              symbol: result.symbol,
              name: result.name,
              exchange: result.exchange,
              ltp: result.price || 0,
              token: result.token || null
            }));

            setSearchResults(transformedResults);
            setShowSearchResults(transformedResults.length > 0);

            if (transformedResults.length === 0) {
              console.log('No results found for:', searchTerm);
            }
          } catch (error) {
            console.error('Symbol search failed:', error);
            // Fallback to empty results on error
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
      price: selectedSymbol.ltp.toString()
    }));
    setShowSearchResults(false);
  };

  const handlePlaceOrder = async () => {
    if (!orderForm.symbol || !orderForm.quantity || !orderForm.brokerAccount) {
      setError('Please fill all required fields');
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

      const orderRequest: PlaceOrderRequest = {
        brokerName: connectedAccounts.find(acc => acc.id === orderForm.brokerAccount)?.brokerName || 'Unknown',
        accountId: orderForm.brokerAccount,
        symbol: orderForm.symbol,
        action: orderForm.action,
        quantity: parseInt(orderForm.quantity),
        price: orderForm.orderType === 'MARKET' ? undefined : parseFloat(orderForm.price),
        orderType: orderForm.orderType,
        exchange: orderForm.exchange,
        productType: orderForm.product,
        remarks: `${orderForm.validity} order`
      };

      const result = await brokerService.placeOrder(orderRequest);
      
      if (result.success) {
        alert(`Order placed successfully! Order ID: ${result.data?.orderId}`);
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
        setError(result.message || 'Failed to place order');
      }

    } catch (error: any) {
      console.error('Order placement failed:', error);
      setError(error.message || 'Failed to place order');
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
        <KiteNavigation />
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
        <KiteNavigation />
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
      <KiteNavigation />
      
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
                          {result.name} • ₹{result.ltp}
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
                <label style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.5rem', display: 'block' }}>
                  Broker Account
                </label>
                <select
                  value={orderForm.brokerAccount}
                  onChange={(e) => setOrderForm(prev => ({ ...prev, brokerAccount: e.target.value }))}
                  className="kite-input"
                  style={{ fontSize: '1rem' }}
                >
                  {connectedAccounts.map(account => (
                    <option key={account.id} value={account.id}>
                      {account.brokerName} - {account.userId}
                    </option>
                  ))}
                </select>
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
                disabled={submitting || !orderForm.symbol || !orderForm.quantity || !orderForm.brokerAccount}
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  fontSize: '1rem',
                  padding: '0.75rem'
                }}
              >
                {submitting ? 'Placing Order...' : `${orderForm.action} ${orderForm.symbol || 'Stock'}`}
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

export default KiteTradeSetup;
