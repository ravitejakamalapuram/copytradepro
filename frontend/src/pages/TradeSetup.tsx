import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import OrderResultDisplay, { type OrderResultSummary } from '../components/OrderResultDisplay';
import { brokerService, type PlaceMultiAccountOrderRequest } from '../services/brokerService';
import { accountService, type ConnectedAccount } from '../services/accountService';
import { fundsService } from '../services/fundsService';
import { symbolService } from '../services/symbolService';

import { transformBrokerResponseToOrderResult } from '../utils/orderResultTransformer';
import { Checkbox } from '../components/ui/Checkbox';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardContent, CardFooter } from '../components/ui/Card';
import { Grid, Stack, HStack, Flex } from '../components/ui/Layout';
import '../styles/app-theme.css';
import './TradeSetup.css';

type OrderType = 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
type Product = 'CNC' | 'MIS' | 'NRML';
type SymbolSearchResult = {
  symbol: string;
  exchange: string;
  name: string;
  token?: string | null;
  ltp?: number;
  instrumentType?: 'EQUITY' | 'OPTION' | 'FUTURE';
  optionType?: 'CE' | 'PE';
  strikePrice?: number;
  expiryDate?: string;
  relevanceScore?: number;
};

// Symbol search types are now imported from symbolService
type FailedOrderResult = { accountId: string };

interface OrderForm {
  symbol: string;
  exchange: 'NSE' | 'BSE' | 'NFO';
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

  // Function to get broker symbol/icon (consistent with Orders page)
  const getBrokerSymbol = (brokerName: string): string => {
    switch (brokerName?.toLowerCase()) {
      case 'fyers': return '🔥';
      case 'shoonya': return '🏛️';
      case 'zerodha': return '⚡';
      case 'angel': return '👼';
      case 'upstox': return '📈';
      case 'dhan': return '💰';
      default: return '🏢';
    }
  };

  // Function to get broker display name
  const getBrokerDisplayName = (brokerName: string): string => {
    switch (brokerName?.toLowerCase()) {
      case 'fyers': return 'Fyers';
      case 'shoonya': return 'Shoonya';
      case 'zerodha': return 'Zerodha';
      case 'angel': return 'Angel';
      case 'upstox': return 'Upstox';
      case 'dhan': return 'Dhan';
      default: return brokerName || 'Unknown';
    }
  };
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
    selectedAccounts: []
  });
  const [marginInfo, setMarginInfo] = useState<MarginInfo>({
    required: 0,
    available: 0,
    shortfall: 0
  });
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchResults, setSearchResults] = useState<SymbolSearchResult[]>([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchLoading, setSearchLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'EQUITY' | 'OPTION' | 'FUTURE'>('EQUITY');
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

  // Unified symbol search with support for equity, options, and futures
  const handleSymbolSearch = React.useCallback((searchTerm: string) => {
    if (searchTerm.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchLoading(false);
      return;
    }

    setSearchLoading(true);
    const timeoutId = setTimeout(async () => {
      try {
        console.log(`🔍 Frontend: Searching for "${searchTerm}" type: ${activeTab}`);

        let results: SymbolSearchResult[] = [];

        // Use symbol service for search
        try {
          const searchType = activeTab === 'EQUITY' ? 'equity' :
                            activeTab === 'OPTION' ? 'options' :
                            activeTab === 'FUTURE' ? 'futures' : 'all';

          const response = await symbolService.searchSymbolsByType(searchTerm, searchType, 8);

          if (response.success && response.data) {
            results = response.data.map((result) => ({
              symbol: result.tradingSymbol || result.symbol || '',
              name: result.name || result.displayName || '',
              exchange: result.exchange,
              ltp: 0, // No price data
              token: result.token || null,
              instrumentType: activeTab,
              relevanceScore: result.relevanceScore || 0,
              // Options specific
              strikePrice: result.strikePrice,
              expiryDate: result.expiryDate,
              optionType: result.optionType
            }));
          }
        } catch (error) {
          console.error('Symbol search error:', error);
          results = [];
        }

        console.log(`✅ Frontend: Found ${results.length} results for ${activeTab}:`, results);

        setSearchResults(results);
        setShowSearchResults(results.length > 0);

        if (results.length === 0) {
          console.log('❌ Frontend: No results found for:', searchTerm);
        }
      } catch (error: unknown) {
        console.error('❌ Frontend: Symbol search failed:', error);
        setSearchResults([]);
        setShowSearchResults(false);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [activeTab]);

  const handleSymbolSelect = (selectedSymbol: unknown) => {
    if (
      typeof selectedSymbol === 'object' &&
      selectedSymbol !== null &&
      'symbol' in selectedSymbol &&
      'exchange' in selectedSymbol &&
      typeof (selectedSymbol as { symbol: unknown }).symbol === 'string'
    ) {
      const result = selectedSymbol as SymbolSearchResult;
      
      // Handle different exchanges including F&O (NFO)
      let exchange: 'NSE' | 'BSE' | 'NFO' = 'NSE'; // Default to NSE
      
      if (result.exchange === 'BSE') {
        exchange = 'BSE';
      } else if (result.exchange === 'NFO' || result.instrumentType === 'OPTION' || result.instrumentType === 'FUTURE') {
        // F&O instruments should be sent to NFO exchange
        exchange = 'NFO';
      } else {
        exchange = 'NSE';
      }
      
      setOrderForm(prev => ({
        ...prev,
        symbol: result.symbol,
        exchange,
        price: prev.price
      }));
      setShowSearchResults(false);
      
      console.log(`✅ Selected ${result.instrumentType || 'EQUITY'} instrument:`, {
        symbol: result.symbol,
        exchange: result.exchange,
        orderExchange: exchange,
        instrumentType: result.instrumentType
      });
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

      setOrderResult(orderResultSummary);
      setShowOrderResult(true);

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
    
    setOrderForm(prev => ({
      ...prev,
      selectedAccounts: failedAccountIds
    }));
    
    setShowOrderResult(false);
    setError('Ready to retry failed orders. You can modify the order details if needed, then click Place Order again.');
  };

  const handleCloseOrderResult = () => {
    setShowOrderResult(false);
    setOrderResult(null);
    
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
          <Card padding="lg" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔗</div>
            <div style={{ fontSize: '1.25rem', fontWeight: '500', marginBottom: '1rem' }}>
              No Active Broker Accounts
            </div>
            <div style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
              Connect and activate a broker account to start trading
            </div>
            <Button onClick={() => navigate('/account-setup')}>
              Connect Broker Account
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="app-theme app-layout">
      <AppNavigation />
      
      <div className="app-main">
        <Stack gap={6}>
          {/* Main Content Grid */}
          <Grid cols={3} gap={6}>
            {/* Order Form - Takes 2 columns */}
            <div style={{ gridColumn: 'span 2' }}>
              <Stack gap={4}>
                {/* Order Details Card */}
                <Card>
                  <CardHeader
                    title="Order Details"
                    action={
                      <HStack gap={2}>
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
                      </HStack>
                    }
                  />

                  <CardContent>
                    <Stack gap={5}>
                      {/* Unified Symbol Search with Tabs */}
                      <div style={{ position: 'relative' }}>
                        <label className="form-label">Symbol *</label>
                        
                        {/* Instrument Type Tabs */}
                        <div style={{ 
                          display: 'flex', 
                          gap: '0.5rem', 
                          marginBottom: '0.75rem',
                          borderBottom: '1px solid var(--border-secondary)',
                          paddingBottom: '0.5rem'
                        }}>
                          {(['EQUITY', 'OPTION', 'FUTURE'] as const).map((tab) => (
                            <button
                              key={tab}
                              type="button"
                              onClick={() => {
                                setActiveTab(tab);
                                setSearchResults([]);
                                setShowSearchResults(false);
                                // Clear the selected symbol when switching tabs
                                setOrderForm(prev => ({
                                  ...prev,
                                  symbol: '',
                                  price: '',
                                  triggerPrice: ''
                                }));
                                console.log(`🔄 Switched to ${tab} tab, cleared symbol selection`);
                              }}
                              style={{
                                padding: '0.5rem 1rem',
                                border: 'none',
                                borderRadius: '0.375rem',
                                fontSize: '0.875rem',
                                fontWeight: '500',
                                cursor: 'pointer',
                                backgroundColor: activeTab === tab ? 'var(--color-primary)' : 'var(--bg-secondary)',
                                color: activeTab === tab ? 'white' : 'var(--text-secondary)',
                                transition: 'all 0.2s ease'
                              }}
                            >
                              {tab === 'EQUITY' ? 'Stocks' : tab === 'OPTION' ? 'Options' : 'Futures'}
                            </button>
                          ))}
                        </div>

                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            placeholder={
                              activeTab === 'EQUITY' ? "Search stocks (e.g., RELIANCE, TCS)" :
                              activeTab === 'OPTION' ? "Search options (e.g., RELIANCE, NIFTY)" :
                              "Search futures (e.g., RELIANCE, NIFTY)"
                            }
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

                        {/* Enhanced Search Results Dropdown */}
                        {showSearchResults && searchResults.length > 0 && (
                          <div className="search-dropdown">
                            {searchResults.map((result, index) => (
                              <div
                                key={index}
                                onClick={() => handleSymbolSelect(result)}
                                className="search-result-item"
                              >
                                <div style={{ 
                                  display: 'flex', 
                                  justifyContent: 'space-between', 
                                  alignItems: 'flex-start',
                                  width: '100%'
                                }}>
                                  <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: '500', color: 'var(--text-primary)' }}>
                                      {result.symbol}
                                    </div>
                                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                                      {result.name}
                                    </div>
                                    {result.instrumentType === 'EQUITY' && (
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                        {result.exchange}
                                      </div>
                                    )}
                                    {result.instrumentType === 'OPTION' && (
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                        {result.optionType} | Strike: ₹{result.strikePrice} | Exp: {result.expiryDate} | {result.exchange}
                                      </div>
                                    )}
                                    {result.instrumentType === 'FUTURE' && (
                                      <div style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                                        Future | Exp: {result.expiryDate} | {result.exchange}
                                      </div>
                                    )}
                                  </div>
                                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                                    <div style={{
                                      fontSize: '0.75rem',
                                      padding: '0.25rem 0.5rem',
                                      borderRadius: '0.25rem',
                                      backgroundColor: 
                                        result.instrumentType === 'EQUITY' ? 'var(--color-info-bg)' :
                                        result.instrumentType === 'OPTION' ? 'var(--color-warning-bg)' :
                                        'var(--color-success-bg)',
                                      color:
                                        result.instrumentType === 'EQUITY' ? 'var(--color-info)' :
                                        result.instrumentType === 'OPTION' ? 'var(--color-warning)' :
                                        'var(--color-success)',
                                      fontWeight: '500'
                                    }}>
                                      {result.instrumentType}
                                    </div>
                                    <div style={{
                                      fontSize: '0.7rem',
                                      padding: '0.2rem 0.4rem',
                                      borderRadius: '0.25rem',
                                      backgroundColor: 
                                        result.exchange === 'NSE' ? 'var(--color-bg-secondary)' :
                                        result.exchange === 'BSE' ? 'var(--color-bg-tertiary)' :
                                        result.exchange === 'NFO' ? 'var(--color-bg-card)' :
                                        'var(--color-bg-secondary)',
                                      color:
                                        result.exchange === 'NSE' ? 'var(--color-profit)' :
                                        result.exchange === 'BSE' ? 'var(--color-secondary-light)' :
                                        result.exchange === 'NFO' ? 'var(--color-accent)' :
                                        'var(--color-text-secondary)',
                                      fontWeight: '500',
                                      border: '1px solid',
                                      borderColor:
                                        result.exchange === 'NSE' ? 'var(--color-profit)' :
                                        result.exchange === 'BSE' ? 'var(--color-secondary-light)' :
                                        result.exchange === 'NFO' ? 'var(--color-accent)' :
                                        'var(--color-border-secondary)'
                                    }}>
                                      {result.exchange}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Quantity and Price */}
                      <Grid cols={2} gap={4}>
                        <div>
                          <label className="form-label">Quantity *</label>
                          <input
                            type="number"
                            placeholder="0"
                            value={orderForm.quantity}
                            onChange={(e) => setOrderForm(prev => ({ ...prev, quantity: e.target.value }))}
                            className="form-input"
                          />
                        </div>

                        <div>
                          <label className="form-label">
                            Price {orderForm.orderType === 'MARKET' ? '(Market)' : '*'}
                          </label>
                          <input
                            type="number"
                            step="0.05"
                            placeholder="0.00"
                            value={orderForm.price}
                            onChange={(e) => setOrderForm(prev => ({ ...prev, price: e.target.value }))}
                            className="form-input"
                            disabled={orderForm.orderType === 'MARKET'}
                          />
                        </div>
                      </Grid>

                      {/* Order Type and Product */}
                      <Grid cols={2} gap={4}>
                        <div>
                          <label className="form-label">Order Type</label>
                          <select
                            value={orderForm.orderType}
                            onChange={(e) => setOrderForm(prev => ({ ...prev, orderType: e.target.value as OrderType }))}
                            className="form-input"
                          >
                            <option value="MARKET">Market</option>
                            <option value="LIMIT">Limit</option>
                            <option value="SL-LIMIT">Stop Loss Limit</option>
                            <option value="SL-MARKET">Stop Loss Market</option>
                          </select>
                        </div>

                        <div>
                          <label className="form-label">Product</label>
                          <select
                            value={orderForm.product}
                            onChange={(e) => setOrderForm(prev => ({ ...prev, product: e.target.value as Product }))}
                            className="form-input"
                          >
                            <option value="CNC">CNC (Delivery)</option>
                            <option value="MIS">MIS (Intraday)</option>
                            <option value="NRML">NRML (Normal)</option>
                          </select>
                        </div>
                      </Grid>

                      {/* Trigger Price for Stop Loss Orders */}
                      {(orderForm.orderType === 'SL-LIMIT' || orderForm.orderType === 'SL-MARKET') && (
                        <div>
                          <label className="form-label">Trigger Price *</label>
                          <input
                            type="number"
                            step="0.05"
                            placeholder="0.00"
                            value={orderForm.triggerPrice}
                            onChange={(e) => setOrderForm(prev => ({ ...prev, triggerPrice: e.target.value }))}
                            className="form-input"
                          />
                        </div>
                      )}

                      {/* Error Display */}
                      {error && (
                        <div className="alert alert-error">
                          {error}
                        </div>
                      )}
                    </Stack>
                  </CardContent>

                  <CardFooter>
                    <Button
                      onClick={handlePlaceOrder}
                      disabled={submitting || !orderForm.symbol || !orderForm.quantity || orderForm.selectedAccounts.length === 0}
                      style={{ width: '100%' }}
                    >
                      {submitting
                        ? `Placing Orders on ${orderForm.selectedAccounts.length} Account${orderForm.selectedAccounts.length > 1 ? 's' : ''}...`
                        : `${orderForm.action} ${orderForm.symbol || 'Stock'} on ${orderForm.selectedAccounts.length} Account${orderForm.selectedAccounts.length > 1 ? 's' : ''}`
                      }
                    </Button>
                  </CardFooter>
                </Card>

                {/* Account Selection */}
                <Card>
                  <CardHeader
                    title={`Trading Accounts (${orderForm.selectedAccounts.length} selected)`}
                    action={
                      connectedAccounts.length > 1 && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={handleSelectAllAccounts}
                        >
                          {orderForm.selectedAccounts.length === connectedAccounts.length ? 'Deselect All' : 'Select All'}
                        </Button>
                      )
                    }
                  />
                  <CardContent>
                    <Stack gap={3}>
                      {connectedAccounts.map(account => (
                        <div
                          key={account.id}
                          className={`account-card${orderForm.selectedAccounts.includes(account.id) ? ' selected' : ''}`}
                        >
                          <div className="account-info">
                            <Checkbox
                              checked={orderForm.selectedAccounts.includes(account.id)}
                              onChange={(checked) => handleAccountSelection(account.id, checked)}
                              label={`${getBrokerSymbol(account.brokerName || '')} ${getBrokerDisplayName(account.brokerName || 'Unknown')} (${account.isActive ? 'Active' : 'Inactive'})`}
                              size="base"
                            />
                          </div>
                          <div className="account-meta">
                            ID: {account.id} | User: {account.userName || 'N/A'} | Account: {account.accountId || 'N/A'}
                          </div>
                        </div>
                      ))}
                      {orderForm.selectedAccounts.length === 0 && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--color-loss)' }}>
                          Please select at least one account to place orders
                        </div>
                      )}
                    </Stack>
                  </CardContent>
                </Card>
              </Stack>
            </div>

            {/* Right Sidebar - Order Summary & Margin Info */}
            <div>
              <Stack gap={4}>
                {/* Order Summary */}
                <Card>
                  <CardHeader title="Order Summary" />
                  <CardContent>
                    {orderForm.symbol ? (
                      <Stack gap={3}>
                        <Flex justify="between">
                          <span style={{ color: 'var(--text-secondary)' }}>Symbol:</span>
                          <span style={{ fontWeight: '500' }}>{orderForm.symbol}</span>
                        </Flex>
                        <Flex justify="between">
                          <span style={{ color: 'var(--text-secondary)' }}>Exchange:</span>
                          <span className={`exchange-badge ${orderForm.exchange.toLowerCase()}`}>
                            {orderForm.exchange}
                          </span>
                        </Flex>
                        <Flex justify="between">
                          <span style={{ color: 'var(--text-secondary)' }}>Action:</span>
                          <span className={`action-badge ${orderForm.action.toLowerCase()}`}>
                            {orderForm.action}
                          </span>
                        </Flex>
                        <Flex justify="between">
                          <span style={{ color: 'var(--text-secondary)' }}>Quantity:</span>
                          <span style={{ fontWeight: '500' }}>{orderForm.quantity || '0'}</span>
                        </Flex>
                        <Flex justify="between">
                          <span style={{ color: 'var(--text-secondary)' }}>Price:</span>
                          <span style={{ fontWeight: '500', fontFamily: 'var(--font-mono)' }}>
                            {orderForm.orderType === 'MARKET' ? 'Market' : `₹${orderForm.price || '0.00'}`}
                          </span>
                        </Flex>
                        {(orderForm.orderType === 'SL-LIMIT' || orderForm.orderType === 'SL-MARKET') && (
                          <Flex justify="between">
                            <span style={{ color: 'var(--text-secondary)' }}>Trigger Price:</span>
                            <span style={{ fontWeight: '500', fontFamily: 'var(--font-mono)' }}>
                              ₹{orderForm.triggerPrice || '0.00'}
                            </span>
                          </Flex>
                        )}
                        <Flex justify="between">
                          <span style={{ color: 'var(--text-secondary)' }}>Type:</span>
                          <span style={{ fontWeight: '500' }}>{orderForm.orderType}</span>
                        </Flex>
                        <Flex justify="between">
                          <span style={{ color: 'var(--text-secondary)' }}>Product:</span>
                          <span style={{ fontWeight: '500' }}>{orderForm.product}</span>
                        </Flex>
                        {orderForm.quantity && orderForm.price && (
                          <>
                            <hr style={{ border: 'none', borderTop: '1px solid var(--border-secondary)', margin: '0.5rem 0' }} />
                            <Flex justify="between">
                              <span style={{ color: 'var(--text-secondary)' }}>Total Value:</span>
                              <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                                ₹{formatCurrency(parseInt(orderForm.quantity || '0') * parseFloat(orderForm.price || '0'))}
                              </span>
                            </Flex>
                          </>
                        )}
                      </Stack>
                    ) : (
                      <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>
                        Fill order details to see summary
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Margin Info */}
                {marginInfo.required > 0 && (
                  <Card>
                    <CardHeader title="Margin Information" />
                    <CardContent>
                      <Stack gap={3}>
                        <Flex justify="between">
                          <span style={{ color: 'var(--text-secondary)' }}>Required:</span>
                          <span style={{ fontWeight: '500', fontFamily: 'var(--font-mono)' }}>
                            ₹{formatCurrency(marginInfo.required)}
                          </span>
                        </Flex>
                        <Flex justify="between">
                          <span style={{ color: 'var(--text-secondary)' }}>Available:</span>
                          <span style={{ fontWeight: '500', fontFamily: 'var(--font-mono)' }}>
                            ₹{formatCurrency(marginInfo.available)}
                          </span>
                        </Flex>
                        {marginInfo.shortfall > 0 && (
                          <Flex justify="between">
                            <span style={{ color: 'var(--color-loss)' }}>Shortfall:</span>
                            <span style={{ fontWeight: '500', fontFamily: 'var(--font-mono)', color: 'var(--color-loss)' }}>
                              ₹{formatCurrency(marginInfo.shortfall)}
                            </span>
                          </Flex>
                        )}
                      </Stack>
                    </CardContent>
                  </Card>
                )}
              </Stack>
            </div>
          </Grid>
        </Stack>
      </div>

      {/* Order Result Modal */}
      {showOrderResult && orderResult && (
        <OrderResultDisplay
          summary={orderResult}
          onRetryFailed={handleRetryFailedOrders}
          onClose={handleCloseOrderResult}
        />
      )}
    </div>
  );
};

export default TradeSetup;