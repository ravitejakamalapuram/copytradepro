import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import { brokerService } from '../services/brokerService';
import '../styles/app-theme.css';

interface Order {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  qty: number;
  price?: number;
  triggerPrice?: number;
  status: 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED';
  time: string;
  filledQty: number;
  avgPrice?: number;
  createdAt?: string;
  brokerName?: string;
  brokerOrderId?: string;
  exchange?: string;
}

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'executed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Function to fetch orders (for refresh)
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch orders from broker order history
      const response = await brokerService.getOrderHistory(100, 0);

      if (response.success && response.data) {
        // Convert backend order format to our interface
        const ordersData = response.data.orders.map((order: any) => ({
          id: order.id.toString(),
          symbol: order.symbol,
          type: order.action.toUpperCase() as 'BUY' | 'SELL',
          orderType: order.order_type as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET',
          qty: order.quantity,
          price: order.price,
          triggerPrice: 0, // Not available in broker order history
          status: order.status.toUpperCase() as 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED',
          time: new Date(order.executed_at || order.created_at).toLocaleTimeString('en-IN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
          }),
          filledQty: order.status === 'EXECUTED' ? order.quantity : 0,
          avgPrice: order.status === 'EXECUTED' ? order.price : undefined,
          createdAt: order.executed_at || order.created_at,
          brokerName: order.broker_name,
          brokerOrderId: order.broker_order_id,
          exchange: order.exchange
        }));

        setOrders(ordersData);
        setLastRefresh(new Date());
      } else {
        setError(response.message || 'Failed to load orders');
      }

    } catch (error: any) {
      console.error('Failed to fetch orders:', error);
      setError('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };



  useEffect(() => {
    fetchOrders();
  }, []);

  const filteredOrders = orders.filter(order => {
    if (activeTab === 'pending') return ['PLACED', 'PENDING', 'PARTIALLY_FILLED'].includes(order.status);
    if (activeTab === 'executed') return order.status === 'EXECUTED';
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
      case 'PLACED': return 'var(--kite-neutral)';
      case 'PENDING': return 'var(--kite-neutral)';
      case 'EXECUTED': return 'var(--kite-profit)';
      case 'PARTIALLY_FILLED': return 'var(--kite-neutral)';
      case 'CANCELLED': return 'var(--kite-text-secondary)';
      case 'REJECTED': return 'var(--kite-loss)';
      default: return 'var(--kite-text-primary)';
    }
  };

  const getTypeColor = (type: string): string => {
    return type === 'BUY' ? 'var(--kite-profit)' : 'var(--kite-loss)';
  };

  const handleModifyOrder = (orderId: string) => {
    // TODO: Implement order modification
    console.log('Modify order:', orderId);
  };

  const handleCancelOrder = async (orderId: string) => {
    try {
      // TODO: Implement broker order cancellation
      console.log('Cancel order:', orderId);
      // For now, just refresh the orders
      await fetchOrders();
    } catch (error) {
      console.error('Failed to cancel order:', error);
    }
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
            <div style={{ fontSize: '2rem' }}>📋</div>
            <div style={{ color: 'var(--kite-text-secondary)' }}>Loading orders...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kite-theme">
        <AppNavigation />
        <div className="kite-main">
          <div className="kite-card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
            <div style={{ color: 'var(--kite-loss)', marginBottom: '1rem' }}>{error}</div>
            <button
              className="kite-btn kite-btn-primary"
              onClick={() => window.location.reload()}
            >
              Retry
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
        <div className="kite-card">
          <div className="kite-card-header">
            <div>
              <h2 className="kite-card-title">Orders</h2>
              {lastRefresh && (
                <p style={{
                  margin: 0,
                  fontSize: '0.875rem',
                  color: 'var(--kite-text-secondary)'
                }}>
                  Last updated: {lastRefresh.toLocaleTimeString('en-IN')}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
              <button
                className="kite-btn kite-btn-secondary"
                onClick={fetchOrders}
                disabled={loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                🔄 {loading ? 'Loading...' : 'Refresh'}
              </button>
              <button
                className="kite-btn kite-btn-primary"
                onClick={() => navigate('/trade-setup')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem'
                }}
              >
                + Place Order
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
              { key: 'pending', label: 'Pending', count: orders.filter(o => ['PLACED', 'PENDING', 'PARTIALLY_FILLED'].includes(o.status)).length },
              { key: 'executed', label: 'Executed', count: orders.filter(o => o.status === 'EXECUTED').length }
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
                          {['PLACED', 'PENDING', 'PARTIALLY_FILLED'].includes(order.status) && (
                            <>
                              <button
                                className="kite-btn"
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.75rem'
                                }}
                                onClick={() => handleModifyOrder(order.id)}
                              >
                                Modify
                              </button>
                              <button
                                className="kite-btn kite-btn-danger"
                                style={{
                                  padding: '0.25rem 0.5rem',
                                  fontSize: '0.75rem'
                                }}
                                onClick={() => handleCancelOrder(order.id)}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          {order.status === 'EXECUTED' && (
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
                onClick={() => navigate('/trade-setup')}
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
                {orders.filter(o => o.status === 'EXECUTED').length}
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                Executed
              </div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: '600', color: 'var(--kite-neutral)' }}>
                {orders.filter(o => ['PLACED', 'PENDING', 'PARTIALLY_FILLED'].includes(o.status)).length}
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

export default Orders;
