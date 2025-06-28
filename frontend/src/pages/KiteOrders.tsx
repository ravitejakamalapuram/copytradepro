import React, { useState, useEffect } from 'react';
import KiteNavigation from '../components/KiteNavigation';
import '../styles/kite-theme.css';

interface Order {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'SL' | 'SL-M';
  qty: number;
  price?: number;
  triggerPrice?: number;
  status: 'PENDING' | 'COMPLETE' | 'CANCELLED' | 'REJECTED';
  time: string;
  filledQty: number;
  avgPrice?: number;
}

const KiteOrders: React.FC = () => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'completed'>('all');

  useEffect(() => {
    // Mock orders data
    const mockOrders: Order[] = [
      {
        id: 'ORD001',
        symbol: 'RELIANCE',
        type: 'BUY',
        orderType: 'LIMIT',
        qty: 10,
        price: 2850.00,
        status: 'PENDING',
        time: '09:15:23',
        filledQty: 0
      },
      {
        id: 'ORD002',
        symbol: 'TCS',
        type: 'SELL',
        orderType: 'MARKET',
        qty: 5,
        status: 'COMPLETE',
        time: '09:12:45',
        filledQty: 5,
        avgPrice: 4156.30
      },
      {
        id: 'ORD003',
        symbol: 'INFY',
        type: 'BUY',
        orderType: 'SL',
        qty: 15,
        price: 1800.00,
        triggerPrice: 1795.00,
        status: 'PENDING',
        time: '09:10:12',
        filledQty: 0
      },
      {
        id: 'ORD004',
        symbol: 'HDFC',
        type: 'SELL',
        orderType: 'LIMIT',
        qty: 8,
        price: 1650.00,
        status: 'CANCELLED',
        time: '09:08:30',
        filledQty: 0
      },
      {
        id: 'ORD005',
        symbol: 'ICICIBANK',
        type: 'BUY',
        orderType: 'MARKET',
        qty: 12,
        status: 'COMPLETE',
        time: '09:05:15',
        filledQty: 12,
        avgPrice: 1234.50
      }
    ];

    setOrders(mockOrders);
  }, []);

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'pending') return order.status === 'PENDING';
    if (activeTab === 'completed') return order.status === 'COMPLETE';
    return true;
  });

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'COMPLETE': return 'var(--kite-profit)';
      case 'PENDING': return 'var(--kite-neutral)';
      case 'CANCELLED': return 'var(--kite-text-secondary)';
      case 'REJECTED': return 'var(--kite-loss)';
      default: return 'var(--kite-text-primary)';
    }
  };

  const getTypeColor = (type: string): string => {
    return type === 'BUY' ? 'var(--kite-profit)' : 'var(--kite-loss)';
  };

  return (
    <div className="kite-theme">
      <KiteNavigation />
      
      <div className="kite-main">
        <div className="kite-card">
          <div className="kite-card-header">
            <h2 className="kite-card-title">Orders</h2>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button className="kite-btn kite-btn-primary">
                + Place Order
              </button>
              <button className="kite-btn">
                📥 Export
              </button>
            </div>
          </div>

          {/* Order Tabs */}
          <div style={{ 
            display: 'flex', 
            gap: '0.5rem',
            marginBottom: '1.5rem',
            borderBottom: '1px solid var(--kite-border-secondary)',
            paddingBottom: '1rem'
          }}>
            {[
              { key: 'all', label: 'All Orders', count: orders.length },
              { key: 'pending', label: 'Pending', count: orders.filter(o => o.status === 'PENDING').length },
              { key: 'completed', label: 'Completed', count: orders.filter(o => o.status === 'COMPLETE').length }
            ].map(tab => (
              <button
                key={tab.key}
                className={`kite-btn ${activeTab === tab.key ? 'kite-btn-primary' : ''}`}
                onClick={() => setActiveTab(tab.key as any)}
                style={{ 
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                {tab.label}
                <span style={{ 
                  backgroundColor: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : 'var(--kite-bg-tertiary)',
                  padding: '0.125rem 0.375rem',
                  borderRadius: '0.75rem',
                  fontSize: '0.75rem',
                  fontWeight: '500'
                }}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Orders Table */}
          {filteredOrders.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="kite-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Instrument</th>
                    <th>Type</th>
                    <th>Order Type</th>
                    <th>Qty.</th>
                    <th>Price</th>
                    <th>Trigger</th>
                    <th>Status</th>
                    <th>Filled</th>
                    <th>Avg. Price</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td style={{ fontFamily: 'var(--kite-font-mono)', fontSize: '0.875rem' }}>
                        {order.time}
                      </td>
                      <td>
                        <div style={{ fontWeight: '500', color: 'var(--kite-text-primary)' }}>
                          {order.symbol}
                        </div>
                      </td>
                      <td>
                        <span style={{ 
                          color: getTypeColor(order.type),
                          fontWeight: '500',
                          fontSize: '0.875rem'
                        }}>
                          {order.type}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.875rem' }}>
                        {order.orderType}
                      </td>
                      <td style={{ fontFamily: 'var(--kite-font-mono)' }}>
                        {order.qty}
                      </td>
                      <td style={{ fontFamily: 'var(--kite-font-mono)' }}>
                        {order.price ? formatCurrency(order.price) : '-'}
                      </td>
                      <td style={{ fontFamily: 'var(--kite-font-mono)' }}>
                        {order.triggerPrice ? formatCurrency(order.triggerPrice) : '-'}
                      </td>
                      <td>
                        <span style={{ 
                          color: getStatusColor(order.status),
                          fontWeight: '500',
                          fontSize: '0.875rem'
                        }}>
                          {order.status}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'var(--kite-font-mono)' }}>
                        {order.filledQty}/{order.qty}
                      </td>
                      <td style={{ fontFamily: 'var(--kite-font-mono)' }}>
                        {order.avgPrice ? formatCurrency(order.avgPrice) : '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {order.status === 'PENDING' && (
                            <>
                              <button 
                                className="kite-btn"
                                style={{ 
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.75rem'
                                }}
                              >
                                Modify
                              </button>
                              <button 
                                className="kite-btn kite-btn-danger"
                                style={{ 
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.75rem'
                                }}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {order.status === 'COMPLETE' && (
                            <button 
                              className="kite-btn"
                              style={{ 
                                padding: '0.25rem 0.5rem',
                                fontSize: '0.75rem'
                              }}
                            >
                              View
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ 
              textAlign: 'center', 
              padding: '3rem',
              color: 'var(--kite-text-secondary)'
            }}>
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
              <div style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>
                No {activeTab === 'all' ? '' : activeTab} orders
              </div>
              <div style={{ fontSize: '0.875rem' }}>
                {activeTab === 'all' 
                  ? 'Place your first order to get started'
                  : `No ${activeTab} orders found`
                }
              </div>
              <button 
                className="kite-btn kite-btn-primary"
                style={{ marginTop: '1rem' }}
              >
                Place Order
              </button>
            </div>
          )}
        </div>

        {/* Order Summary */}
        <div className="kite-card">
          <div className="kite-card-header">
            <h2 className="kite-card-title">Today's Summary</h2>
          </div>
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '1rem'
          }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--kite-text-primary)' }}>
                {orders.length}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                Total Orders
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--kite-profit)' }}>
                {orders.filter(o => o.status === 'COMPLETE').length}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                Executed
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--kite-neutral)' }}>
                {orders.filter(o => o.status === 'PENDING').length}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                Pending
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--kite-loss)' }}>
                {orders.filter(o => o.status === 'CANCELLED' || o.status === 'REJECTED').length}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                Cancelled/Rejected
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KiteOrders;
