import React, { useState } from 'react';
import './UnifiedTradingForm.css';

interface UnifiedSymbol {
  symbol: string;
  tradingSymbol: string;
  name: string;
  instrument_type: 'EQUITY' | 'OPTION' | 'FUTURE';
  exchange: string;
  underlying_symbol?: string;
  strike_price?: number;
  expiry_date?: string;
  option_type?: 'CE' | 'PE' | 'FUT';
  lot_size?: number;
  status?: string;
}

interface Props {
  selectedSymbol: UnifiedSymbol | null;
  onOrderPlace: (orderData: any) => void;
}

const UnifiedTradingForm: React.FC<Props> = ({ selectedSymbol, onOrderPlace }) => {
  const [orderData, setOrderData] = useState({
    action: 'BUY' as 'BUY' | 'SELL',
    quantity: 1,
    price: '',
    order_type: 'LIMIT' as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET',
    product_type: 'CNC'
  });
  const [loading, setLoading] = useState(false);

  const handleInputChange = (field: string, value: any) => {
    setOrderData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedSymbol) {
      alert('Please select a symbol first');
      return;
    }

    setLoading(true);
    
    try {
      const completeOrderData = {
        symbol: selectedSymbol.tradingSymbol,
        instrument_type: selectedSymbol.instrument_type,
        underlying_symbol: selectedSymbol.underlying_symbol,
        strike_price: selectedSymbol.strike_price,
        expiry_date: selectedSymbol.expiry_date,
        option_type: selectedSymbol.option_type,
        lot_size: selectedSymbol.lot_size,
        exchange: selectedSymbol.exchange,
        ...orderData,
        // For F&O, quantity is in lots
        quantity: selectedSymbol.instrument_type !== 'EQUITY' 
          ? orderData.quantity * (selectedSymbol.lot_size || 1)
          : orderData.quantity
      };

      await onOrderPlace(completeOrderData);
      
      // Reset form after successful order
      setOrderData({
        action: 'BUY',
        quantity: 1,
        price: '',
        order_type: 'LIMIT',
        product_type: 'CNC'
      });
      
    } catch (error) {
      console.error('Order placement failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const getQuantityLabel = () => {
    if (selectedSymbol?.instrument_type === 'EQUITY') {
      return 'Quantity';
    }
    return `Lots (1 lot = ${selectedSymbol?.lot_size || 0} shares)`;
  };

  const getEstimatedValue = () => {
    if (!selectedSymbol || !orderData.price) return 0;
    
    const price = parseFloat(orderData.price);
    if (selectedSymbol.instrument_type === 'EQUITY') {
      return price * orderData.quantity;
    } else {
      return price * orderData.quantity * (selectedSymbol.lot_size || 1);
    }
  };

  if (!selectedSymbol) {
    return (
      <div className="unified-trading-form">
        <div className="no-symbol">
          <p>Select a symbol to start trading</p>
        </div>
      </div>
    );
  }

  return (
    <div className="unified-trading-form">
      <div className="symbol-header">
        <div className="symbol-info">
          <h3>{selectedSymbol.symbol}</h3>
          <p>{selectedSymbol.name}</p>
        </div>
        
        <div className={`instrument-badge ${selectedSymbol.instrument_type.toLowerCase()}`}>
          {selectedSymbol.instrument_type}
        </div>
      </div>

      {/* F&O Details */}
      {selectedSymbol.instrument_type === 'OPTION' && (
        <div className="fo-info">
          <div className="fo-detail">
            <label>Strike Price:</label>
            <span>₹{selectedSymbol.strike_price}</span>
          </div>
          <div className="fo-detail">
            <label>Expiry:</label>
            <span>{selectedSymbol.expiry_date}</span>
          </div>
          <div className="fo-detail">
            <label>Type:</label>
            <span className={`option-type ${selectedSymbol.option_type?.toLowerCase()}`}>
              {selectedSymbol.option_type}
            </span>
          </div>
          <div className="fo-detail">
            <label>Lot Size:</label>
            <span>{selectedSymbol.lot_size}</span>
          </div>
        </div>
      )}

      {selectedSymbol.instrument_type === 'FUTURE' && (
        <div className="fo-info">
          <div className="fo-detail">
            <label>Expiry:</label>
            <span>{selectedSymbol.expiry_date}</span>
          </div>
          <div className="fo-detail">
            <label>Lot Size:</label>
            <span>{selectedSymbol.lot_size}</span>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="order-form">
        {/* Action Selector */}
        <div className="form-group">
          <label>Action:</label>
          <div className="action-buttons">
            <button
              type="button"
              className={`action-btn buy ${orderData.action === 'BUY' ? 'active' : ''}`}
              onClick={() => handleInputChange('action', 'BUY')}
            >
              BUY
            </button>
            <button
              type="button"
              className={`action-btn sell ${orderData.action === 'SELL' ? 'active' : ''}`}
              onClick={() => handleInputChange('action', 'SELL')}
            >
              SELL
            </button>
          </div>
        </div>

        {/* Quantity */}
        <div className="form-group">
          <label>{getQuantityLabel()}:</label>
          <input
            type="number"
            min="1"
            value={orderData.quantity}
            onChange={(e) => handleInputChange('quantity', parseInt(e.target.value) || 1)}
            required
          />
        </div>

        {/* Price */}
        <div className="form-group">
          <label>Price (₹):</label>
          <input
            type="number"
            step="0.05"
            min="0"
            value={orderData.price}
            onChange={(e) => handleInputChange('price', e.target.value)}
            placeholder="Enter price"
            required={orderData.order_type !== 'MARKET'}
            disabled={orderData.order_type === 'MARKET'}
          />
        </div>

        {/* Order Type */}
        <div className="form-group">
          <label>Order Type:</label>
          <select
            value={orderData.order_type}
            onChange={(e) => handleInputChange('order_type', e.target.value)}
          >
            <option value="MARKET">Market</option>
            <option value="LIMIT">Limit</option>
            <option value="SL-LIMIT">Stop Loss Limit</option>
            <option value="SL-MARKET">Stop Loss Market</option>
          </select>
        </div>

        {/* Product Type */}
        <div className="form-group">
          <label>Product Type:</label>
          <select
            value={orderData.product_type}
            onChange={(e) => handleInputChange('product_type', e.target.value)}
          >
            {selectedSymbol.instrument_type === 'EQUITY' ? (
              <>
                <option value="CNC">CNC (Delivery)</option>
                <option value="MIS">MIS (Intraday)</option>
                <option value="NRML">NRML (Normal)</option>
              </>
            ) : (
              <>
                <option value="NRML">NRML (Normal)</option>
                <option value="MIS">MIS (Intraday)</option>
              </>
            )}
          </select>
        </div>

        {/* Order Summary */}
        <div className="order-summary">
          <div className="summary-row">
            <span>Estimated Value:</span>
            <span>₹{getEstimatedValue().toLocaleString()}</span>
          </div>
          {selectedSymbol.instrument_type !== 'EQUITY' && (
            <div className="summary-row">
              <span>Total Shares:</span>
              <span>{orderData.quantity * (selectedSymbol.lot_size || 1)}</span>
            </div>
          )}
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          className={`place-order-btn ${orderData.action.toLowerCase()}`}
          disabled={loading || !orderData.price}
        >
          {loading ? 'Placing Order...' : `${orderData.action} ${selectedSymbol.symbol}`}
        </button>
      </form>
    </div>
  );
};

export default UnifiedTradingForm;