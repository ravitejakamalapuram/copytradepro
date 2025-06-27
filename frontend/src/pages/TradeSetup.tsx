import React, { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import { brokerService } from '../services/brokerService';
import { accountService } from '../services/accountService';
import type { PlaceOrderRequest } from '../services/brokerService';
import type { ConnectedAccount } from '../services/accountService';
import './TradeSetup.css';

interface Trade {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  status: 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED' | 'FAILED';
  timestamp: Date;
  brokerAccounts: string[];
}

const TradeSetup: React.FC = () => {
  // const { user } = useAuth(); // Not currently used
  const [trades, setTrades] = useState<Trade[]>([]);
  const [showTradeForm, setShowTradeForm] = useState(false);
  const [connectedAccounts, setConnectedAccounts] = useState<ConnectedAccount[]>([]);
  const [loadingAccounts, setLoadingAccounts] = useState(true);
  const [formData, setFormData] = useState({
    symbol: '',
    action: 'BUY' as 'BUY' | 'SELL',
    quantity: '',
    price: '',
    orderType: 'MARKET' as 'MARKET' | 'LIMIT',
    brokerAccounts: [] as string[],
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Order history filtering state
  const [orderFilters, setOrderFilters] = useState({
    status: '',
    symbol: '',
    brokerName: '',
    startDate: '',
    endDate: '',
    action: '' as '' | 'BUY' | 'SELL',
  });
  const [showFilters, setShowFilters] = useState(false);

  // Load connected accounts and order history on component mount
  useEffect(() => {
    loadConnectedAccounts();
    loadOrderHistory();
  }, []);

  const loadConnectedAccounts = async () => {
    try {
      setLoadingAccounts(true);
      const accounts = await accountService.getConnectedAccounts();
      // Filter to show only active accounts for trading
      const activeAccounts = accounts.filter(account => account.isActive);
      setConnectedAccounts(activeAccounts);
    } catch (error) {
      console.error('Failed to load connected accounts:', error);
      setErrors({ general: 'Failed to load connected accounts. Please refresh the page.' });
    } finally {
      setLoadingAccounts(false);
    }
  };

  const loadOrderHistory = async (filters?: typeof orderFilters) => {
    try {
      // Prepare filters for API call
      const apiFilters = filters || orderFilters;
      const cleanFilters = Object.fromEntries(
        Object.entries(apiFilters).filter(([_, value]) => value !== '')
      );

      const response = await brokerService.getOrderHistory(50, 0, Object.keys(cleanFilters).length > 0 ? cleanFilters : undefined);
      if (response.success && response.data) {
        // Convert order history to Trade format for display
        const historyTrades: Trade[] = response.data.orders.map(order => ({
          id: order.broker_order_id,
          symbol: order.symbol,
          action: order.action,
          quantity: order.quantity,
          price: order.price,
          orderType: order.order_type,
          status: order.status as 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED' | 'FAILED',
          timestamp: new Date(order.executed_at),
          brokerAccounts: [order.broker_name], // Use broker name as identifier
        }));
        setTrades(historyTrades);
      }
    } catch (error) {
      console.error('Failed to load order history:', error);
      // Don't show error for order history loading failure
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleFilterChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setOrderFilters(prev => ({ ...prev, [name]: value }));
  };

  const applyFilters = () => {
    loadOrderHistory(orderFilters);
  };

  const clearFilters = () => {
    const emptyFilters = {
      status: '',
      symbol: '',
      brokerName: '',
      startDate: '',
      endDate: '',
      action: '' as '' | 'BUY' | 'SELL',
    };
    setOrderFilters(emptyFilters);
    loadOrderHistory(emptyFilters);
  };

  const handleAccountSelection = (accountId: string) => {
    setFormData(prev => ({
      ...prev,
      brokerAccounts: prev.brokerAccounts.includes(accountId)
        ? prev.brokerAccounts.filter(id => id !== accountId)
        : [...prev.brokerAccounts, accountId]
    }));
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.symbol.trim()) {
      newErrors.symbol = 'Symbol is required';
    }

    if (!formData.quantity || Number(formData.quantity) <= 0) {
      newErrors.quantity = 'Valid quantity is required';
    }

    if (formData.orderType === 'LIMIT' && (!formData.price || Number(formData.price) <= 0)) {
      newErrors.price = 'Valid price is required for limit orders';
    }

    if (formData.brokerAccounts.length === 0) {
      newErrors.brokerAccounts = 'Select at least one broker account';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmitTrade = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      // Place orders for each selected broker account
      const orderPromises = formData.brokerAccounts.map(async (accountId) => {
        const account = connectedAccounts.find(acc => acc.id === accountId);
        if (!account) {
          throw new Error(`Account ${accountId} not found`);
        }

        const orderRequest: PlaceOrderRequest = {
          brokerName: account.brokerName,
          accountId: account.id, // Include the specific account ID
          symbol: formData.symbol.toUpperCase().trim(),
          action: formData.action,
          quantity: Number(formData.quantity),
          orderType: formData.orderType === 'MARKET' ? 'MARKET' : 'LIMIT',
          price: formData.orderType === 'LIMIT' ? Number(formData.price) : undefined,
          exchange: 'NSE',
          productType: 'C', // Cash product
          remarks: `Order placed via CopyTrade Pro at ${new Date().toISOString()}`,
        };

        return brokerService.placeOrder(orderRequest);
      });

      const responses = await Promise.allSettled(orderPromises);

      // Process results
      const successfulOrders: Trade[] = [];
      const failedOrders: string[] = [];

      responses.forEach((result, index) => {
        const accountId = formData.brokerAccounts[index];
        const account = connectedAccounts.find(acc => acc.id === accountId);

        if (result.status === 'fulfilled' && result.value.success && result.value.data) {
          const response = result.value;
          const orderData = response.data!; // We know it exists from the condition above
          const newTrade: Trade = {
            id: `${orderData.orderId}-${accountId}`,
            symbol: orderData.symbol,
            action: orderData.action as 'BUY' | 'SELL',
            quantity: orderData.quantity,
            price: orderData.price || 0,
            orderType: orderData.orderType as 'MARKET' | 'LIMIT',
            status: 'PLACED',
            timestamp: new Date(orderData.timestamp),
            brokerAccounts: [accountId],
          };
          successfulOrders.push(newTrade);
        } else {
          const errorMsg = result.status === 'rejected'
            ? result.reason?.message || 'Unknown error'
            : result.value.message || 'Order failed';
          failedOrders.push(`${account?.brokerDisplayName || accountId}: ${errorMsg}`);
        }
      });

      // Update trades with successful orders and reload history
      if (successfulOrders.length > 0) {
        setTrades(prev => [...successfulOrders, ...prev]);
        // Reload order history to get the latest data from database
        loadOrderHistory();
      }

      // Handle results
      if (successfulOrders.length === formData.brokerAccounts.length) {
        // All orders successful
        setFormData({
          symbol: '',
          action: 'BUY',
          quantity: '',
          price: '',
          orderType: 'MARKET',
          brokerAccounts: [],
        });
        setShowTradeForm(false);
        setErrors({});
      } else if (successfulOrders.length > 0) {
        // Partial success
        setErrors({
          general: `${successfulOrders.length}/${formData.brokerAccounts.length} orders placed successfully. Failed: ${failedOrders.join(', ')}`
        });
      } else {
        // All failed
        setErrors({
          general: `All orders failed: ${failedOrders.join(', ')}`
        });
      }
    } catch (error) {
      console.error('🚨 Trade submission error:', error);
      setErrors({ general: error instanceof Error ? error.message : 'Failed to submit trade. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: Trade['status']) => {
    switch (status) {
      case 'PENDING': return 'warning';
      case 'EXECUTED': return 'success';
      case 'CANCELLED': return 'secondary';
      case 'FAILED': return 'error';
      default: return 'secondary';
    }
  };

  return (
    <div className="page-container">
      <Navigation />
      
      <div className="container">
        <div className="page-header">
          <h1>Trade Setup & History</h1>
          <p>Execute trades across multiple broker accounts</p>
        </div>

        {/* Trade Form */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">New Trade</h3>
            <button
              className="btn btn-primary"
              onClick={() => setShowTradeForm(!showTradeForm)}
            >
              {showTradeForm ? 'Cancel' : 'Place Trade'}
            </button>
          </div>

          {showTradeForm && (
            <form onSubmit={handleSubmitTrade} className="trade-form">
              {errors.general && (
                <div className="form-error mb-3">{errors.general}</div>
              )}

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="symbol" className="form-label">
                    Symbol
                  </label>
                  <input
                    type="text"
                    id="symbol"
                    name="symbol"
                    value={formData.symbol}
                    onChange={handleInputChange}
                    className={`form-input ${errors.symbol ? 'error' : ''}`}
                    placeholder="e.g., RELIANCE, TCS"
                    disabled={isSubmitting}
                  />
                  {errors.symbol && <div className="form-error">{errors.symbol}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="action" className="form-label">
                    Action
                  </label>
                  <select
                    id="action"
                    name="action"
                    value={formData.action}
                    onChange={handleInputChange}
                    className="form-input"
                    disabled={isSubmitting}
                  >
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="quantity" className="form-label">
                    Quantity
                  </label>
                  <input
                    type="number"
                    id="quantity"
                    name="quantity"
                    value={formData.quantity}
                    onChange={handleInputChange}
                    className={`form-input ${errors.quantity ? 'error' : ''}`}
                    placeholder="Enter quantity"
                    min="1"
                    disabled={isSubmitting}
                  />
                  {errors.quantity && <div className="form-error">{errors.quantity}</div>}
                </div>

                <div className="form-group">
                  <label htmlFor="orderType" className="form-label">
                    Order Type
                  </label>
                  <select
                    id="orderType"
                    name="orderType"
                    value={formData.orderType}
                    onChange={handleInputChange}
                    className="form-input"
                    disabled={isSubmitting}
                  >
                    <option value="MARKET">MARKET</option>
                    <option value="LIMIT">LIMIT</option>
                  </select>
                </div>
              </div>

              {formData.orderType === 'LIMIT' && (
                <div className="form-group">
                  <label htmlFor="price" className="form-label">
                    Limit Price
                  </label>
                  <input
                    type="number"
                    id="price"
                    name="price"
                    value={formData.price}
                    onChange={handleInputChange}
                    className={`form-input ${errors.price ? 'error' : ''}`}
                    placeholder="Enter limit price"
                    step="0.01"
                    min="0.01"
                    disabled={isSubmitting}
                  />
                  {errors.price && <div className="form-error">{errors.price}</div>}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  Broker Accounts (Active Only)
                </label>
                {loadingAccounts ? (
                  <div className="loading-accounts">Loading connected accounts...</div>
                ) : connectedAccounts.length === 0 ? (
                  <div className="no-accounts">
                    <p>No active broker accounts found.</p>
                    <p>Please connect and activate a broker account first.</p>
                  </div>
                ) : (
                  <div className="account-selection">
                    {connectedAccounts.map(account => (
                      <label key={account.id} className="account-checkbox">
                        <input
                          type="checkbox"
                          checked={formData.brokerAccounts.includes(account.id)}
                          onChange={() => handleAccountSelection(account.id)}
                          disabled={isSubmitting}
                        />
                        <span className="checkmark"></span>
                        <span className="account-name">
                          {account.brokerDisplayName} - {account.accountId}
                          <span className="account-status">✓ Active</span>
                        </span>
                      </label>
                    ))}
                  </div>
                )}
                {errors.brokerAccounts && <div className="form-error">{errors.brokerAccounts}</div>}
              </div>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowTradeForm(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Placing Trade...' : 'Place Trade'}
                </button>
              </div>
            </form>
          )}
        </div>

        {/* Trade History */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Trade History</h3>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className="btn btn-secondary"
            >
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
          </div>

          {/* Order History Filters */}
          {showFilters && (
            <div className="filters-section">
              <div className="filters-grid">
                <div className="form-group">
                  <label htmlFor="filterStatus" className="form-label">Status</label>
                  <select
                    id="filterStatus"
                    name="status"
                    value={orderFilters.status}
                    onChange={handleFilterChange}
                    className="form-input"
                  >
                    <option value="">All Statuses</option>
                    <option value="PLACED">PLACED</option>
                    <option value="PENDING">PENDING</option>
                    <option value="EXECUTED">EXECUTED</option>
                    <option value="CANCELLED">CANCELLED</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="filterSymbol" className="form-label">Symbol</label>
                  <input
                    type="text"
                    id="filterSymbol"
                    name="symbol"
                    value={orderFilters.symbol}
                    onChange={handleFilterChange}
                    className="form-input"
                    placeholder="e.g., RELIANCE"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="filterAction" className="form-label">Action</label>
                  <select
                    id="filterAction"
                    name="action"
                    value={orderFilters.action}
                    onChange={handleFilterChange}
                    className="form-input"
                  >
                    <option value="">All Actions</option>
                    <option value="BUY">BUY</option>
                    <option value="SELL">SELL</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="filterBroker" className="form-label">Broker</label>
                  <select
                    id="filterBroker"
                    name="brokerName"
                    value={orderFilters.brokerName}
                    onChange={handleFilterChange}
                    className="form-input"
                  >
                    <option value="">All Brokers</option>
                    <option value="shoonya">Shoonya</option>
                    <option value="fyers">Fyers</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="filterStartDate" className="form-label">From Date</label>
                  <input
                    type="date"
                    id="filterStartDate"
                    name="startDate"
                    value={orderFilters.startDate}
                    onChange={handleFilterChange}
                    className="form-input"
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="filterEndDate" className="form-label">To Date</label>
                  <input
                    type="date"
                    id="filterEndDate"
                    name="endDate"
                    value={orderFilters.endDate}
                    onChange={handleFilterChange}
                    className="form-input"
                  />
                </div>
              </div>

              <div className="filters-actions">
                <button type="button" onClick={applyFilters} className="btn btn-primary">
                  Apply Filters
                </button>
                <button type="button" onClick={clearFilters} className="btn btn-secondary">
                  Clear Filters
                </button>
              </div>
            </div>
          )}

          {trades.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📊</div>
              <h4>No trades yet</h4>
              <p>Place your first trade to see it here</p>
            </div>
          ) : (
            <div className="trades-list">
              {trades.map(trade => (
                <div key={trade.id} className="trade-item">
                  <div className="trade-info">
                    <div className="trade-header">
                      <h4>{trade.symbol}</h4>
                      <span className={`status-badge ${getStatusColor(trade.status)}`}>
                        {trade.status}
                      </span>
                    </div>
                    <div className="trade-details">
                      <span className={`action-badge ${trade.action.toLowerCase()}`}>
                        {trade.action}
                      </span>
                      <span>Qty: {trade.quantity}</span>
                      <span>Type: {trade.orderType}</span>
                      {trade.price > 0 && <span>Price: ₹{trade.price}</span>}
                    </div>
                    <div className="trade-meta">
                      <span>Accounts: {trade.brokerAccounts.length}</span>
                      <span>{trade.timestamp.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TradeSetup;
