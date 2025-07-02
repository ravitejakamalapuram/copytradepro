import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import { brokerService } from '../services/brokerService';
import { accountService } from '../services/accountService';
// Styles now imported via main.scss

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
  accountInfo?: {
    account_id: string;
    user_name: string;
    email: string;
  };
}

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'executed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<'today' | 'week' | 'month' | 'all'>('today');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [selectedAccounts, setSelectedAccounts] = useState<string[]>(['all']); // Array of selected account IDs
  const [availableAccounts, setAvailableAccounts] = useState<Array<{id: string, name: string, broker: string, mongoId: string}>>([]);
  const [showAccountFilter, setShowAccountFilter] = useState(false);

  // Function to get date range based on filter
  const getDateRange = () => {
    const now = new Date();
    let startDate: string | undefined;
    let endDate: string | undefined;

    switch (dateFilter) {
      case 'today':
        // Today's orders - set start and end of today
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        startDate = startOfDay.toISOString();
        endDate = endOfDay.toISOString();
        break;
      case 'week':
        // Last 7 days
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString();
        endDate = now.toISOString();
        break;
      case 'month':
        // Last 30 days
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        startDate = monthAgo.toISOString();
        endDate = now.toISOString();
        break;
      case 'all':
        // All orders - no date filtering
        startDate = undefined;
        endDate = undefined;
        break;
    }

    return { startDate, endDate };
  };

  // Function to fetch available accounts
  const fetchAccounts = async () => {
    try {
      const response = await accountService.getConnectedAccounts();
      console.log('🔍 Fetched accounts response:', response); // Debug log

      // The response should be an array of accounts
      const accounts = Array.isArray(response) ? response : [];

      const accountOptions = accounts.map((account: any) => ({
        id: account.accountId, // Use the broker account ID (like "FN135006") as the filter value
        name: `${account.userName || account.accountId || 'Unknown'} (${account.brokerDisplayName || account.brokerName})`,
        broker: account.brokerName,
        mongoId: account.id // Keep the MongoDB ObjectId for reference
      }));

      console.log('🔍 Account options:', accountOptions); // Debug log
      setAvailableAccounts(accountOptions);
    } catch (error) {
      console.error('Failed to fetch accounts:', error);
    }
  };

  // Function to fetch orders (for refresh)
  const fetchOrders = async () => {
    try {
      setLoading(true);
      setError(null);

      const { startDate, endDate } = getDateRange();

      // Build filters object
      const filters: any = {};
      if (startDate) filters.startDate = startDate;
      if (endDate) filters.endDate = endDate;
      if (customStartDate && customEndDate) {
        filters.startDate = new Date(customStartDate).toISOString();
        filters.endDate = new Date(customEndDate + 'T23:59:59').toISOString();
      }

      // Fetch orders from broker order history with filters
      const response = await brokerService.getOrderHistory(100, 0, filters);

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
          exchange: order.exchange,
          accountInfo: order.account_info
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

  // Function to filter orders by selected accounts
  const filterOrdersByAccount = (orders: Order[]) => {
    // If 'all' is selected, show all orders
    if (selectedAccounts.includes('all')) {
      return orders;
    }

    // If no accounts are selected, show no orders
    if (selectedAccounts.length === 0) {
      return [];
    }

    console.log('🔍 Filtering orders by accounts:', selectedAccounts); // Debug log
    console.log('🔍 Sample order accountInfo:', orders[0]?.accountInfo); // Debug log

    return orders.filter(order => {
      // Match the broker account ID from order's account_info with any of the selected accounts
      const orderBrokerAccountId = order.accountInfo?.account_id;

      console.log('🔍 Order broker account ID:', orderBrokerAccountId, 'Selected accounts:', selectedAccounts); // Debug log

      return selectedAccounts.includes(orderBrokerAccountId || '');
    });
  };

  // Account selection helper functions
  const handleAccountToggle = (accountId: string) => {
    if (accountId === 'all') {
      // If selecting "All", clear other selections
      setSelectedAccounts(['all']);
    } else {
      setSelectedAccounts(prev => {
        // Remove "all" if it was selected
        const withoutAll = prev.filter(id => id !== 'all');

        if (withoutAll.includes(accountId)) {
          // Remove the account if it's already selected
          const newSelection = withoutAll.filter(id => id !== accountId);
          // If no accounts are selected, default to "all"
          return newSelection.length === 0 ? ['all'] : newSelection;
        } else {
          // Add the account to selection
          return [...withoutAll, accountId];
        }
      });
    }
  };

  const isAccountSelected = (accountId: string) => {
    return selectedAccounts.includes(accountId);
  };

  const getSelectedAccountsText = () => {
    if (selectedAccounts.includes('all')) {
      return 'All Accounts';
    }
    if (selectedAccounts.length === 0) {
      return 'No Accounts';
    }
    if (selectedAccounts.length === 1) {
      const account = availableAccounts.find(acc => acc.id === selectedAccounts[0]);
      return account ? account.name : 'Unknown Account';
    }
    return `${selectedAccounts.length} Accounts Selected`;
  };



  useEffect(() => {
    fetchAccounts();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [dateFilter, customStartDate, customEndDate, selectedAccounts]);

  // Close account filter dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showAccountFilter && !target.closest('[data-account-filter]')) {
        setShowAccountFilter(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showAccountFilter]);

  // Apply both status and account filters
  const filteredOrders = filterOrdersByAccount(orders).filter(order => {
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

  const handleCheckOrderStatus = async (orderId: string) => {
    try {
      // Add to checking set to show loading state
      setCheckingStatus(prev => new Set(prev).add(orderId));
      setStatusMessage(null);

      console.log('🔍 Manually checking status for order:', orderId);

      const response = await brokerService.checkOrderStatus(orderId);

      if (response.success) {
        const { statusChanged, previousStatus, currentStatus, message } = response.data;

        // Show success message
        setStatusMessage(message);
        setTimeout(() => setStatusMessage(null), 5000);

        // Update the specific order in the local state
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === orderId
              ? { ...order, status: currentStatus.toUpperCase() as any }
              : order
          )
        );

        console.log(`✅ Manual status check result: ${previousStatus} → ${currentStatus}${statusChanged ? ' (CHANGED)' : ' (NO CHANGE)'}`);
      } else {
        setStatusMessage(`Failed to check status: ${response.message}`);
        setTimeout(() => setStatusMessage(null), 5000);
        console.error('Failed to check order status:', response.message);
      }

    } catch (error: any) {
      console.error('Failed to check order status:', error);
      setStatusMessage('Failed to check order status. Please try again.');
      setTimeout(() => setStatusMessage(null), 5000);
    } finally {
      // Remove from checking set
      setCheckingStatus(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
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
    <div className="trading-theme">
      <AppNavigation />

      <div className="orders-page">
        <div className="orders-page__container">
          <div className="orders-page__header">
            <h1 className="header-title">Orders</h1>
            <div className="header-actions">
              <button
                className="btn btn--secondary"
                onClick={() => navigate('/trade-setup')}
              >
                📈 Place Order
              </button>
              <button
                className="btn btn--outline"
                onClick={fetchOrders}
                disabled={loading}
              >
                🔄 Refresh
              </button>
            </div>
          </div>

          <div className="orders-page__content">
            <div className="orders-filters">
              <div className="orders-filters__row">
                <div className="orders-filters__group">
                  <div className="orders-filters__label">Date:</div>
                  <div className="date-filters">
                    {(['today', 'week', 'month', 'all'] as const).map((filter) => (
                      <button
                        key={filter}
                        className={`date-filter ${dateFilter === filter ? 'active' : ''}`}
                        onClick={() => {
                          setDateFilter(filter);
                          setShowDatePicker(false);
                          setCustomStartDate('');
                          setCustomEndDate('');
                        }}
                      >
                        {filter === 'today' ? 'Today' :
                         filter === 'week' ? 'Week' :
                         filter === 'month' ? 'Month' : 'All'}
                      </button>
                    ))}
                    <button
                      className={`date-filter ${showDatePicker ? 'active' : ''}`}
                      onClick={() => setShowDatePicker(!showDatePicker)}
                    >
                      📅 Custom
                    </button>
                  </div>
                </div>

                <div className="orders-filters__group">

                {/* Account Filter Checkboxes */}
                <div data-account-filter style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', position: 'relative' }}>
                  <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--kite-text-secondary)' }}>Account:</span>
                  <button
                    className="kite-btn kite-btn-secondary"
                    onClick={() => setShowAccountFilter(!showAccountFilter)}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem',
                      minWidth: '140px',
                      textAlign: 'left',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <span>{getSelectedAccountsText()}</span>
                    <span style={{ marginLeft: '0.5rem' }}>{showAccountFilter ? '▲' : '▼'}</span>
                  </button>

                  {/* Account Filter Dropdown */}
                  {showAccountFilter && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: '4rem',
                      zIndex: 1000,
                      backgroundColor: 'var(--kite-bg-primary)',
                      border: '1px solid var(--kite-border)',
                      borderRadius: 'var(--kite-radius-sm)',
                      boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                      minWidth: '250px',
                      maxHeight: '300px',
                      overflowY: 'auto',
                      padding: '0.5rem'
                    }}>
                      {/* All Accounts Option */}
                      <label style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.5rem',
                        cursor: 'pointer',
                        borderRadius: 'var(--kite-radius-sm)',
                        fontSize: '0.875rem',
                        fontWeight: '500',
                        backgroundColor: isAccountSelected('all') ? 'var(--kite-bg-secondary)' : 'transparent'
                      }}>
                        <input
                          type="checkbox"
                          checked={isAccountSelected('all')}
                          onChange={() => handleAccountToggle('all')}
                          style={{ margin: 0 }}
                        />
                        <span>All Accounts</span>
                      </label>

                      {/* Individual Account Options */}
                      {availableAccounts.map((account) => (
                        <label
                          key={account.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem',
                            padding: '0.5rem',
                            cursor: 'pointer',
                            borderRadius: 'var(--kite-radius-sm)',
                            fontSize: '0.875rem',
                            backgroundColor: isAccountSelected(account.id) ? 'var(--kite-bg-secondary)' : 'transparent'
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isAccountSelected(account.id)}
                            onChange={() => handleAccountToggle(account.id)}
                            style={{ margin: 0 }}
                          />
                          <span>{account.name}</span>
                        </label>
                      ))}

                      {availableAccounts.length === 0 && (
                        <div style={{
                          padding: '0.5rem',
                          fontSize: '0.875rem',
                          color: 'var(--kite-text-secondary)',
                          textAlign: 'center'
                        }}>
                          No accounts available
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Custom Date Picker */}
              {showDatePicker && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  backgroundColor: 'var(--kite-bg-secondary)',
                  borderRadius: 'var(--kite-radius-sm)',
                  border: '1px solid var(--kite-border)',
                  display: 'flex',
                  gap: '0.5rem',
                  alignItems: 'center',
                  flexWrap: 'wrap'
                }}>
                  <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>From:</label>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      border: '1px solid var(--kite-border)',
                      borderRadius: 'var(--kite-radius-sm)',
                      fontSize: '0.875rem'
                    }}
                  />
                  <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>To:</label>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    style={{
                      padding: '0.25rem 0.5rem',
                      border: '1px solid var(--kite-border)',
                      borderRadius: 'var(--kite-radius-sm)',
                      fontSize: '0.875rem'
                    }}
                  />
                  <button
                    className="kite-btn kite-btn-primary"
                    onClick={() => {
                      if (customStartDate && customEndDate) {
                        setDateFilter('today'); // Reset to trigger useEffect
                        fetchOrders();
                      }
                    }}
                    disabled={!customStartDate || !customEndDate}
                    style={{
                      fontSize: '0.75rem',
                      padding: '0.25rem 0.5rem'
                    }}
                  >
                    Apply
                  </button>
                </div>
              )}

              {lastRefresh && (
                <p style={{
                  margin: '0.5rem 0 0 0',
                  fontSize: '0.875rem',
                  color: 'var(--kite-text-secondary)'
                }}>
                  Last updated: {lastRefresh.toLocaleTimeString('en-IN')}
                  {dateFilter === 'today' && ' • Showing today\'s orders'}
                  {dateFilter === 'week' && ' • Showing last 7 days'}
                  {dateFilter === 'month' && ' • Showing last 30 days'}
                  {dateFilter === 'all' && ' • Showing all orders'}
                  {customStartDate && customEndDate && ` • Custom range: ${new Date(customStartDate).toLocaleDateString()} - ${new Date(customEndDate).toLocaleDateString()}`}
                  {` • ${getSelectedAccountsText()}`}
                </p>
              )}
              {statusMessage && (
                <p style={{
                  margin: '0.5rem 0 0 0',
                  fontSize: '0.875rem',
                  color: statusMessage.includes('Failed') ? 'var(--kite-loss)' : 'var(--kite-profit)',
                  fontWeight: '500'
                }}>
                  {statusMessage}
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                          <div style={{ fontWeight: '500', color: 'var(--kite-text-primary)' }}>
                            {order.symbol?.replace(/-[A-Z]+$/, '') || order.symbol}
                          </div>
                          {order.exchange && (
                            <span style={{
                              fontSize: '0.625rem',
                              padding: '0.125rem 0.375rem',
                              backgroundColor: order.exchange === 'NSE' ? '#1f77b4' : '#ff7f0e',
                              color: 'white',
                              borderRadius: '0.25rem',
                              fontWeight: '600',
                              letterSpacing: '0.5px'
                            }}>
                              {order.exchange}
                            </span>
                          )}
                        </div>
                        {order.accountInfo && (
                          <div style={{
                            fontSize: '0.75rem',
                            color: 'var(--kite-text-secondary)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}>
                            <span style={{
                              fontSize: '0.625rem',
                              padding: '0.125rem 0.25rem',
                              backgroundColor: 'var(--kite-bg-secondary)',
                              borderRadius: '0.25rem',
                              fontWeight: '500',
                              color: 'var(--kite-text-primary)'
                            }}>
                              {order.accountInfo.account_id}
                            </span>
                            <span>{order.accountInfo.user_name}</span>
                          </div>
                        )}
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
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                          {/* Check Status button - available for all orders */}
                          <button
                            className="kite-btn"
                            style={{
                              padding: '0.25rem 0.5rem',
                              fontSize: '0.75rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem',
                              opacity: checkingStatus.has(order.id) ? 0.6 : 1
                            }}
                            onClick={() => handleCheckOrderStatus(order.id)}
                            disabled={checkingStatus.has(order.id)}
                            title="Check current order status from broker"
                          >
                            {checkingStatus.has(order.id) ? (
                              <>
                                <span style={{
                                  display: 'inline-block',
                                  width: '0.75rem',
                                  height: '0.75rem',
                                  border: '1px solid currentColor',
                                  borderTop: '1px solid transparent',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite'
                                }}></span>
                                Checking...
                              </>
                            ) : (
                              <>🔄 Check</>
                            )}
                          </button>

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
    </div>
  );
};

export default Orders;
