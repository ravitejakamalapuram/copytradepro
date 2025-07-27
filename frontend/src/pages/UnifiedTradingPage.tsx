import React, { useState } from 'react';
import UnifiedSymbolSearch from '../components/UnifiedSymbolSearch';
import UnifiedTradingForm from '../components/UnifiedTradingForm';
import './UnifiedTradingPage.css';

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

const UnifiedTradingPage: React.FC = () => {
  const [selectedSymbol, setSelectedSymbol] = useState<UnifiedSymbol | null>(null);
  const [orderHistory, setOrderHistory] = useState<any[]>([]);

  const handleSymbolSelect = (symbol: UnifiedSymbol) => {
    setSelectedSymbol(symbol);
  };

  const handleOrderPlace = async (orderData: any) => {
    try {
      console.log('Placing order:', orderData);
      
      const response = await fetch('/api/broker/place-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(orderData)
      });

      if (response.ok) {
        const result = await response.json();
        console.log('Order placed successfully:', result);
        
        // Add to order history
        setOrderHistory(prev => [
          {
            ...orderData,
            id: Date.now(),
            status: 'PLACED',
            timestamp: new Date().toISOString()
          },
          ...prev
        ]);
        
        alert('Order placed successfully!');
        setSelectedSymbol(null); // Clear selection after order
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Order placement failed');
      }
    } catch (error: any) {
      console.error('Order placement error:', error);
      alert(`Order failed: ${error.message}`);
    }
  };

  const getInstrumentTypeColor = (type: string) => {
    switch (type) {
      case 'EQUITY': return '#1976d2';
      case 'OPTION': return '#7b1fa2';
      case 'FUTURE': return '#388e3c';
      default: return '#6c757d';
    }
  };

  return (
    <div className="unified-trading-page">
      <div className="page-header">
        <h1>Unified Trading</h1>
        <p>Trade equity, options, and futures through a single interface</p>
      </div>

      <div className="trading-container">
        <div className="search-section">
          <h2>Search & Select</h2>
          <UnifiedSymbolSearch 
            onSymbolSelect={handleSymbolSelect}
            selectedSymbol={selectedSymbol}
          />
        </div>

        <div className="trading-section">
          <h2>Place Order</h2>
          <UnifiedTradingForm 
            selectedSymbol={selectedSymbol}
            onOrderPlace={handleOrderPlace}
          />
        </div>
      </div>

      {orderHistory.length > 0 && (
        <div className="order-history-section">
          <h2>Recent Orders</h2>
          <div className="order-history">
            {orderHistory.slice(0, 5).map((order) => (
              <div key={order.id} className="order-item">
                <div className="order-main">
                  <div className="order-symbol">
                    <span className="symbol-name">{order.symbol}</span>
                    <span 
                      className="instrument-type"
                      style={{ color: getInstrumentTypeColor(order.instrument_type) }}
                    >
                      {order.instrument_type}
                    </span>
                  </div>
                  <div className={`order-action ${order.action.toLowerCase()}`}>
                    {order.action}
                  </div>
                </div>
                
                <div className="order-details">
                  <span>Qty: {order.quantity}</span>
                  <span>Price: ₹{order.price}</span>
                  <span>Type: {order.order_type}</span>
                  {order.instrument_type === 'OPTION' && (
                    <>
                      <span>Strike: ₹{order.strike_price}</span>
                      <span>{order.option_type}</span>
                    </>
                  )}
                </div>
                
                <div className="order-meta">
                  <span className="order-status">{order.status}</span>
                  <span className="order-time">
                    {new Date(order.timestamp).toLocaleTimeString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default UnifiedTradingPage;