import React, { useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import Navigation from '../components/Navigation';
import { brokerService } from '../services/brokerService';
import type { PlaceOrderRequest } from '../services/brokerService';
import './TradeSetup.css';

interface Trade {
  id: string;
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  price: number;
  orderType: 'MARKET' | 'LIMIT';
  status: 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'FAILED';
  timestamp: Date;
  brokerAccounts: string[];
}

const TradeSetup: React.FC = () => {
  const { } = useAuth();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [showTradeForm, setShowTradeForm] = useState(false);
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

  // Mock broker accounts (in real app, this would come from API)
  const mockBrokerAccounts = [
    { id: '1', name: 'Shoonya - Connected', broker: 'Shoonya' },
  ];

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
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
      const orderRequest: PlaceOrderRequest = {
        brokerName: 'shoonya',
        symbol: formData.symbol.toUpperCase().trim(),
        action: formData.action,
        quantity: Number(formData.quantity),
        orderType: formData.orderType === 'MARKET' ? 'MARKET' : 'LIMIT',
        price: formData.orderType === 'LIMIT' ? Number(formData.price) : undefined,
        exchange: 'NSE',
        productType: 'C', // Cash product
        remarks: `Order placed via CopyTrade Pro at ${new Date().toISOString()}`,
      };

      const response = await brokerService.placeOrder(orderRequest);

      if (response.success && response.data) {
        const newTrade: Trade = {
          id: response.data.orderId,
          symbol: response.data.symbol,
          action: response.data.action as 'BUY' | 'SELL',
          quantity: response.data.quantity,
          price: response.data.price || 0,
          orderType: response.data.orderType as 'MARKET' | 'LIMIT',
          status: 'EXECUTED',
          timestamp: new Date(response.data.timestamp),
          brokerAccounts: formData.brokerAccounts,
        };

        setTrades(prev => [newTrade, ...prev]);
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
      } else {
        setErrors({ general: response.message || 'Failed to place order' });
      }
    } catch (error: any) {
      console.error('🚨 Trade submission error:', error);
      setErrors({ general: error.message || 'Failed to submit trade. Please try again.' });
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
                  Broker Accounts
                </label>
                <div className="account-selection">
                  {mockBrokerAccounts.map(account => (
                    <label key={account.id} className="account-checkbox">
                      <input
                        type="checkbox"
                        checked={formData.brokerAccounts.includes(account.id)}
                        onChange={() => handleAccountSelection(account.id)}
                        disabled={isSubmitting}
                      />
                      <span className="checkmark"></span>
                      <span className="account-name">{account.name}</span>
                    </label>
                  ))}
                </div>
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
          </div>

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
