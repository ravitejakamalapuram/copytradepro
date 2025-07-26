import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import { brokerService } from '../services/brokerService';
import { accountService } from '../services/accountService';
import '../styles/app-theme.css';
import Button from '../components/ui/Button';
import { useToast } from '../components/Toast'; // Added import for Button

interface Order {
  id: string;
  symbol: string;
  type: 'BUY' | 'SELL';
  orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  qty: number;
  price?: number;
  triggerPrice?: number;
  status: 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED' | 'FAILED';
  time: string;
  filledQty: number;
  avgPrice?: number;
  createdAt?: string;
  brokerName?: string;
  brokerOrderId?: string;
  exchange?: string;
  // Enhanced fields for error handling
  errorMessage?: string;
  errorCode?: string;
  errorType?: 'NETWORK' | 'BROKER' | 'VALIDATION' | 'AUTH' | 'SYSTEM' | 'MARKET';
  retryCount?: number;
  maxRetries?: number;
  isRetryable?: boolean;
  failureReason?: string;
  accountInfo?: {
    account_id: string;
    user_name: string;
    email: string;
  };
}

const Orders: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 'executed' | 'failed'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [checkingStatus, setCheckingStatus] = useState<Set<string>>(new Set());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);


  const [dateFilter, setDateFilter] = useState<'today' | 'week'>('today');
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

    // Handle custom date range first
    if (customStartDate && customEndDate) {
      startDate = new Date(customStartDate).toISOString();
      endDate = new Date(customEndDate + 'T23:59:59.999Z').toISOString();
      return { startDate, endDate };
    }

    switch (dateFilter) {
      case 'today': {
        // Today's orders - set start and end of today
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
        const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
        startDate = startOfDay.toISOString();
        endDate = endOfDay.toISOString();
        break;
      }
      case 'week': {
        // Last 7 days
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        startDate = weekAgo.toISOString();
        endDate = now.toISOString();
        break;
      }
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
          status: order.status.toUpperCase() as 'PLACED' | 'PENDING' | 'EXECUTED' | 'CANCELLED' | 'REJECTED' | 'PARTIALLY_FILLED' | 'FAILED',
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
          // Enhanced error information
          errorMessage: order.error_message,
          errorCode: order.error_code,
          errorType: order.error_type,
          retryCount: order.retry_count || 0,
          maxRetries: order.max_retries || 3,
          isRetryable: order.is_retryable || false,
          failureReason: order.failure_reason,
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
    if (activeTab === 'failed') return ['FAILED', 'REJECTED', 'CANCELLED'].includes(order.status);
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
      case 'PLACED': return 'var(--color-neutral)';
      case 'PENDING': return 'var(--color-neutral)';
      case 'EXECUTED': return 'var(--color-profit)';
      case 'PARTIALLY_FILLED': return 'var(--color-neutral)';
      case 'CANCELLED': return 'var(--text-secondary)';
      case 'REJECTED': return 'var(--color-loss)';
      case 'FAILED': return 'var(--color-loss)';
      default: return 'var(--text-primary)';
    }
  };

  const getTypeColor = (type: string): string => {
    return type === 'BUY' ? 'var(--color-profit)' : 'var(--color-loss)';
  };

  const handleModifyOrder = (orderId: string) => {
    // TODO: Implement order modification UI
    showToast({
      type: 'info',
      title: 'Feature Coming Soon',
      message: 'Order modification feature is under development.'
    });
    console.log('Modify order:', orderId);
  };

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order?')) {
      return;
    }

    try {
      setCheckingStatus(prev => new Set(prev).add(orderId));

      const response = await brokerService.cancelOrder(orderId);

      if (response.success) {
        showToast({
          type: 'success',
          title: 'Order Cancelled',
          message: 'Order has been cancelled successfully.'
        });

        // Refresh orders to show updated status
        await fetchOrders();
      } else {
        showToast({
          type: 'error',
          title: 'Cancellation Failed',
          message: response.message || 'Failed to cancel order.'
        });
      }
    } catch (error: any) {
      console.error('Failed to cancel order:', error);
      showToast({
        type: 'error',
        title: 'Cancellation Error',
        message: 'An error occurred while cancelling the order.'
      });
    } finally {
      setCheckingStatus(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
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
        const { statusChanged, previousStatus, status: currentStatus } = response.data;

        // Show success message based on status change
        const message = statusChanged 
          ? `Order status changed from ${previousStatus} to ${currentStatus}`
          : `Order status confirmed: ${currentStatus}`;
        
        setStatusMessage(message);
        setTimeout(() => setStatusMessage(null), 5000);

        // Update the specific order in the local state
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === orderId
              ? { ...order, status: currentStatus.toUpperCase() as unknown as Order['status'] }
              : order
          )
        );

        console.log(`✅ Manual status check result: ${previousStatus || 'N/A'} → ${currentStatus}${statusChanged ? ' (CHANGED)' : ' (NO CHANGE)'}`);

        if (statusChanged) {
          showToast({
            type: 'success',
            title: 'Status Updated',
            message: `Order status changed from ${previousStatus} to ${currentStatus}`
          });
        } else {
          showToast({
            type: 'info',
            title: 'Status Checked',
            message: `Order status confirmed: ${currentStatus}`
          });
        }
      } else {
        // Handle standardized error response format
        const errorMessage = response.error?.message || response.message || 'Failed to check order status.';
        showToast({
          type: 'error',
          title: 'Status Check Failed',
          message: errorMessage
        });
        console.error('Failed to check order status:', errorMessage);
      }

    } catch (error: any) {
      console.error('Failed to check order status:', error);
      
      // Handle both network errors and API error responses
      let errorMessage = 'Failed to check order status.';
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      showToast({
        type: 'error',
        title: 'Status Check Error',
        message: errorMessage
      });
    } finally {
      // Remove from checking set
      setCheckingStatus(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const handleRetryOrder = async (orderId: string) => {
    try {
      setCheckingStatus(prev => new Set(prev).add(orderId));

      const response = await brokerService.retryOrder(orderId);

      if (response.success) {
        showToast({
          type: 'success',
          title: 'Order Retry Successful',
          message: `Order ${orderId} has been retried successfully.`
        });

        // Refresh orders to show updated status
        await fetchOrders();
      } else {
        showToast({
          type: 'error',
          title: 'Retry Failed',
          message: response.message || 'Failed to retry order.'
        });
      }
    } catch (error: any) {
      console.error('Failed to retry order:', error);
      showToast({
        type: 'error',
        title: 'Retry Error',
        message: 'An error occurred while retrying the order.'
      });
    } finally {
      setCheckingStatus(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
  };

  const handleDeleteOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to delete this failed order? This action cannot be undone.')) {
      return;
    }

    try {
      setCheckingStatus(prev => new Set(prev).add(orderId));

      const response = await brokerService.deleteOrder(orderId);

      if (response.success) {
        showToast({
          type: 'success',
          title: 'Order Deleted',
          message: 'Failed order has been deleted successfully.'
        });

        // Remove order from local state
        setOrders(prev => prev.filter(order => order.id !== orderId));
      } else {
        showToast({
          type: 'error',
          title: 'Delete Failed',
          message: response.message || 'Failed to delete order.'
        });
      }
    } catch (error: any) {
      console.error('Failed to delete order:', error);
      showToast({
        type: 'error',
        title: 'Delete Error',
        message: 'An error occurred while deleting the order.'
      });
    } finally {
      setCheckingStatus(prev => {
        const newSet = new Set(prev);
        newSet.delete(orderId);
        return newSet;
      });
    }
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
            <div style={{ fontSize: '2rem' }}>📋</div>
            <div style={{ color: 'var(--text-secondary)' }}>Loading orders...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="app-theme app-layout">
        <AppNavigation />
        <div className="app-main">
          <div className="card" style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>⚠️</div>
            <div style={{ color: 'var(--color-loss)', marginBottom: '1rem' }}>{error}</div>
            <Button
              variant="primary"
              onClick={() => window.location.reload()}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-theme app-layout">
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .orders-header {
          background: var(--bg-surface);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-lg);
          padding: 1rem 1.5rem;
          margin-bottom: 1rem;
          box-shadow: var(--shadow-sm);
        }

        .orders-filters {
          display: flex;
          align-items: center;
          gap: 1.5rem;
          flex-wrap: wrap;
          margin-bottom: 0.75rem;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .filter-label {
          font-size: 0.8rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          min-width: fit-content;
        }

        .orders-table-container {
          background: var(--bg-surface);
          border: 1px solid var(--border-primary);
          border-radius: var(--radius-lg);
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }

        .orders-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.85rem;
        }

        .orders-table th {
          background: var(--bg-tertiary);
          color: var(--text-secondary);
          font-weight: 600;
          padding: 0.75rem 0.5rem;
          text-align: left;
          font-size: 0.75rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid var(--border-primary);
          white-space: nowrap;
        }

        .orders-table td {
          padding: 0.75rem 0.5rem;
          border-bottom: 1px solid var(--border-secondary);
          vertical-align: top;
        }

        .orders-table tr:hover {
          background: var(--hover-bg);
        }

        .instrument-cell {
          min-width: 140px;
        }

        .time-cell {
          font-family: var(--font-mono);
          font-size: 0.8rem;
          color: var(--text-secondary);
          min-width: 80px;
        }

        .actions-cell {
          min-width: 120px;
        }

        .compact-info {
          display: flex;
          flex-direction: column;
          gap: 0.25rem;
        }

        .symbol-row {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .account-row {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          font-size: 0.7rem;
          color: var(--text-secondary);
        }

        .exchange-badge {
          font-size: 0.6rem;
          padding: 0.1rem 0.3rem;
          border-radius: 0.25rem;
          font-weight: 600;
          letter-spacing: 0.5px;
        }

        .account-badge {
          font-size: 0.6rem;
          padding: 0.1rem 0.25rem;
          background: var(--bg-secondary);
          border-radius: 0.2rem;
          font-weight: 500;
          color: var(--text-primary);
        }

        .status-badge {
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.25rem 0.5rem;
          border-radius: 0.375rem;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .numeric-cell {
          font-family: var(--font-mono);
          text-align: right;
          font-size: 0.8rem;
        }

        .action-buttons {
          display: flex;
          gap: 0.25rem;
          flex-wrap: wrap;
        }

        .compact-button {
          padding: 0.25rem 0.5rem;
          font-size: 0.7rem;
          border-radius: 0.25rem;
          border: 1px solid var(--border-primary);
          background: var(--bg-primary);
          color: var(--text-primary);
          cursor: pointer;
          transition: all 0.2s;
        }

        .compact-button:hover {
          background: var(--bg-secondary);
        }

        .compact-button.danger {
          color: var(--color-loss);
          border-color: var(--color-loss);
        }

        .compact-button.danger:hover {
          background: var(--color-loss);
          color: white;
        }
      `}</style>
      <AppNavigation />

      <div className="app-main">
        {/* Compact Header */}
        <div className="orders-header">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem' }}>
            <div>
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '600', color: 'var(--text-primary)' }}>Orders</h1>
              {lastRefresh && (
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                  Updated: {lastRefresh.toLocaleTimeString('en-IN')} • {getSelectedAccountsText()}
                </div>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <Button variant="secondary" onClick={fetchOrders} disabled={loading} size="sm">
                🔄 {loading ? 'Loading...' : 'Refresh'}
              </Button>
              <Button variant="primary" onClick={() => navigate('/trade-setup')} size="sm">
                + Place Order
              </Button>
            </div>
          </div>

          {/* Compact Filters */}
          <div className="orders-filters">
            {/* Date Filter */}
            <div className="filter-group">
              <span className="filter-label">Date:</span>
              {(['today', 'week'] as const).map((filter) => (
                <Button
                  key={filter}
                  variant={dateFilter === filter ? 'primary' : 'secondary'}
                  onClick={() => {
                    setDateFilter(filter);
                    setShowDatePicker(false);
                    setCustomStartDate('');
                    setCustomEndDate('');
                  }}
                  size="sm"
                >
                  {filter === 'today' ? 'Today' : 'Week'}
                </Button>
              ))}
              <Button
                variant={showDatePicker ? 'primary' : 'secondary'}
                onClick={() => setShowDatePicker(!showDatePicker)}
                size="sm"
              >
                📅 Custom
              </Button>
            </div>

            {/* Account Filter */}
            <div data-account-filter className="filter-group" style={{ position: 'relative' }}>
              <span className="filter-label">Account:</span>
              <Button
                variant="secondary"
                onClick={() => setShowAccountFilter(!showAccountFilter)}
                size="sm"
              >
                {getSelectedAccountsText()}
                <span style={{ marginLeft: '0.5rem' }}>{showAccountFilter ? '▲' : '▼'}</span>
              </Button>

              {/* Account Filter Dropdown */}
              {showAccountFilter && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  left: '4rem',
                  zIndex: 1000,
                  backgroundColor: 'var(--bg-primary)',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-sm)',
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
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '0.875rem',
                    fontWeight: '500',
                    backgroundColor: isAccountSelected('all') ? 'var(--bg-secondary)' : 'transparent'
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
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.875rem',
                        backgroundColor: isAccountSelected(account.id) ? 'var(--bg-secondary)' : 'transparent'
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
                      color: 'var(--text-secondary)',
                      textAlign: 'center'
                    }}>
                      No accounts available
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Order Status Tabs */}
            <div className="filter-group">
              <span className="filter-label">Status:</span>
              {[
                { key: 'all', label: 'All', count: orders.length },
                { key: 'pending', label: 'Pending', count: orders.filter(o => ['PLACED', 'PENDING', 'PARTIALLY_FILLED'].includes(o.status)).length },
                { key: 'executed', label: 'Executed', count: orders.filter(o => o.status === 'EXECUTED').length },
                { key: 'failed', label: 'Failed', count: orders.filter(o => ['FAILED', 'REJECTED', 'CANCELLED'].includes(o.status)).length }
              ].map(tab => (
                <Button
                  key={tab.key}
                  variant={activeTab === tab.key ? 'primary' : 'secondary'}
                  onClick={() => setActiveTab(tab.key as unknown as 'all' | 'pending' | 'executed' | 'failed')}
                  size="sm"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                >
                  {tab.label}
                  <span style={{
                    backgroundColor: activeTab === tab.key ? 'rgba(255,255,255,0.2)' : 'var(--bg-tertiary)',
                    padding: '0.1rem 0.3rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.65rem',
                    fontWeight: '600'
                  }}>
                    {tab.count}
                  </span>
                </Button>
              ))}
            </div>
          </div>

          {/* Custom Date Picker */}
          {showDatePicker && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.75rem',
              backgroundColor: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid var(--border-primary)',
              display: 'flex',
              gap: '0.5rem',
              alignItems: 'center',
              flexWrap: 'wrap'
            }}>
              <label style={{ fontSize: '0.8rem', fontWeight: '500' }}>From:</label>
              <input
                type="date"
                value={customStartDate}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  padding: '0.25rem 0.5rem',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem'
                }}
              />
              <label style={{ fontSize: '0.8rem', fontWeight: '500' }}>To:</label>
              <input
                type="date"
                value={customEndDate}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  padding: '0.25rem 0.5rem',
                  border: '1px solid var(--border-primary)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '0.8rem'
                }}
              />
              <Button
                variant="primary"
                onClick={() => {
                  if (customStartDate && customEndDate) {
                    setDateFilter('today'); // Reset to trigger useEffect
                    fetchOrders();
                  }
                }}
                disabled={!customStartDate || !customEndDate}
                size="sm"
              >
                Apply
              </Button>
            </div>
          )}

          {statusMessage && (
            <div style={{
              marginTop: '0.75rem',
              padding: '0.5rem',
              fontSize: '0.8rem',
              color: statusMessage.includes('Failed') ? 'var(--color-loss)' : 'var(--color-profit)',
              fontWeight: '500',
              backgroundColor: statusMessage.includes('Failed') ? 'rgba(239, 68, 68, 0.1)' : 'rgba(34, 197, 94, 0.1)',
              borderRadius: 'var(--radius-sm)',
              border: `1px solid ${statusMessage.includes('Failed') ? 'var(--color-loss)' : 'var(--color-profit)'}`
            }}>
              {statusMessage}
            </div>
          )}
        </div>

        {/* Optimized Orders Table */}
        {filteredOrders.length > 0 ? (
          <div className="orders-table-container">
            <div style={{ overflowX: 'auto' }}>
              <table className="orders-table">
                <thead>
                  <tr>
                    <th className="time-cell">Time</th>
                    <th className="instrument-cell">Instrument</th>
                    <th>Type</th>
                    <th>Order Type</th>
                    <th>Qty.</th>
                    <th>Price</th>
                    <th>Trigger</th>
                    <th>Status</th>
                    <th>Filled</th>
                    <th>Avg. Price</th>
                    <th className="actions-cell">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((order) => (
                    <tr key={order.id}>
                      <td className="time-cell">
                        {order.time}
                      </td>
                      <td className="instrument-cell">
                        <div className="compact-info">
                          <div className="symbol-row">
                            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                              {order.symbol?.replace(/-[A-Z]+$/, '') || order.symbol}
                            </span>
                            {order.exchange && (
                              <span className="exchange-badge" style={{
                                backgroundColor: order.exchange === 'NSE' ? '#1e40af' : '#7c3aed',
                                color: 'white'
                              }}>
                                {order.exchange}
                              </span>
                            )}
                          </div>
                          {order.accountInfo && (
                            <div className="account-row">
                              <span className="account-badge">
                                {order.accountInfo.account_id}
                              </span>
                              <span>{order.accountInfo.user_name}</span>
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <span style={{
                          color: getTypeColor(order.type),
                          fontWeight: '600',
                          fontSize: '0.8rem'
                        }}>
                          {order.type}
                        </span>
                      </td>
                      <td style={{ fontSize: '0.8rem' }}>
                        {order.orderType}
                      </td>
                      <td className="numeric-cell">
                        {order.qty}
                      </td>
                      <td className="numeric-cell">
                        {order.price ? formatCurrency(order.price) : '-'}
                      </td>
                      <td className="numeric-cell">
                        {order.triggerPrice ? formatCurrency(order.triggerPrice) : '-'}
                      </td>
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <span className="status-badge" style={{
                            color: getStatusColor(order.status),
                            backgroundColor: `${getStatusColor(order.status)}15`
                          }}>
                            {order.status}
                          </span>

                          {/* Error details for failed orders */}
                          {['FAILED', 'REJECTED'].includes(order.status) && order.errorMessage && (
                            <div
                              style={{
                                fontSize: '0.7rem',
                                color: 'var(--color-loss)',
                                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                                padding: '0.25rem 0.5rem',
                                borderRadius: 'var(--radius-sm)',
                                border: '1px solid rgba(239, 68, 68, 0.2)',
                                maxWidth: '200px',
                                wordWrap: 'break-word'
                              }}
                              title={`Error: ${order.errorMessage}\nType: ${order.errorType || 'Unknown'}\nRetries: ${order.retryCount || 0}/${order.maxRetries || 3}`}
                            >
                              <div style={{ fontWeight: '600', marginBottom: '0.1rem' }}>
                                {order.errorType || 'Error'}
                              </div>
                              <div style={{ opacity: 0.8 }}>
                                {order.failureReason || order.errorMessage}
                              </div>
                              {order.isRetryable && (
                                <div style={{
                                  marginTop: '0.1rem',
                                  fontSize: '0.65rem',
                                  color: 'var(--color-warning)',
                                  fontWeight: '500'
                                }}>
                                  Retryable ({order.retryCount || 0}/{order.maxRetries || 3})
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="numeric-cell">
                        {order.filledQty}/{order.qty}
                      </td>
                      <td className="numeric-cell">
                        {order.avgPrice ? formatCurrency(order.avgPrice) : '-'}
                      </td>
                      <td className="actions-cell">
                        <div className="action-buttons">
                          {/* Check Status button */}
                          <button
                            className="compact-button"
                            onClick={() => handleCheckOrderStatus(order.id)}
                            disabled={checkingStatus.has(order.id)}
                            title="Check current order status from broker"
                          >
                            {checkingStatus.has(order.id) ? (
                              <>
                                <span style={{
                                  display: 'inline-block',
                                  width: '0.6rem',
                                  height: '0.6rem',
                                  border: '1px solid currentColor',
                                  borderTop: '1px solid transparent',
                                  borderRadius: '50%',
                                  animation: 'spin 1s linear infinite'
                                }}></span>
                              </>
                            ) : (
                              '🔄'
                            )}
                          </button>

                          {['PLACED', 'PENDING', 'PARTIALLY_FILLED'].includes(order.status) && (
                            <>
                              <button
                                className="compact-button"
                                onClick={() => handleModifyOrder(order.id)}
                                title="Modify order"
                              >
                                Modify
                              </button>
                              <button
                                className="compact-button danger"
                                onClick={() => handleCancelOrder(order.id)}
                                title="Cancel order"
                              >
                                Cancel
                              </button>
                            </>
                          )}

                          {/* Retry and Delete buttons for failed orders */}
                          {['FAILED', 'REJECTED'].includes(order.status) && (
                            <>
                              {order.isRetryable && (order.retryCount || 0) < (order.maxRetries || 3) && (
                                <button
                                  className="compact-button"
                                  onClick={() => handleRetryOrder(order.id)}
                                  disabled={checkingStatus.has(order.id)}
                                  title={`Retry failed order (${order.retryCount || 0}/${order.maxRetries || 3} attempts)`}
                                  style={{
                                    backgroundColor: 'var(--color-warning)',
                                    color: 'white'
                                  }}
                                >
                                  {checkingStatus.has(order.id) ? (
                                    <span style={{
                                      display: 'inline-block',
                                      width: '0.6rem',
                                      height: '0.6rem',
                                      border: '1px solid currentColor',
                                      borderTop: '1px solid transparent',
                                      borderRadius: '50%',
                                      animation: 'spin 1s linear infinite'
                                    }}></span>
                                  ) : (
                                    '🔄 Retry'
                                  )}
                                </button>
                              )}
                              <button
                                className="compact-button danger"
                                onClick={() => handleDeleteOrder(order.id)}
                                disabled={checkingStatus.has(order.id)}
                                title="Delete failed order"
                              >
                                {checkingStatus.has(order.id) ? '...' : '🗑️ Delete'}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="orders-table-container">
            <div style={{
              textAlign: 'center',
              padding: '3rem 1rem',
              color: 'var(--text-secondary)'
            }}>
              <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📋</div>
              <div style={{ fontSize: '1rem', marginBottom: '0.5rem', fontWeight: '500' }}>
                No {activeTab === 'all' ? '' : activeTab} orders
              </div>
              <div style={{ fontSize: '0.8rem', marginBottom: '1.5rem' }}>
                {activeTab === 'all'
                  ? 'Place your first order to get started'
                  : `No ${activeTab} orders found`
                }
              </div>
              <Button
                variant="primary"
                onClick={() => navigate('/trade-setup')}
                size="sm"
              >
                Place Order
              </Button>
            </div>
          </div>
        )}

        {/* Compact Summary */}
        {orders.length > 0 && (
          <div style={{
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-primary)',
            borderRadius: 'var(--radius-lg)',
            padding: '1rem',
            marginTop: '1rem',
            boxShadow: 'var(--shadow-sm)'
          }}>
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
              gap: '1rem',
              textAlign: 'center'
            }}>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                  {orders.length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Total
                </div>
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-profit)' }}>
                  {orders.filter(o => o.status === 'EXECUTED').length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Executed
                </div>
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-neutral)' }}>
                  {orders.filter(o => ['PLACED', 'PENDING', 'PARTIALLY_FILLED'].includes(o.status)).length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Pending
                </div>
              </div>
              <div>
                <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-loss)' }}>
                  {orders.filter(o => ['CANCELLED', 'REJECTED', 'FAILED'].includes(o.status)).length}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Failed
                </div>
              </div>

              {/* Show retry stats if there are retryable failed orders */}
              {orders.filter(o => ['FAILED', 'REJECTED'].includes(o.status) && o.isRetryable).length > 0 && (
                <div>
                  <div style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--color-warning)' }}>
                    {orders.filter(o => ['FAILED', 'REJECTED'].includes(o.status) && o.isRetryable && (o.retryCount || 0) < (o.maxRetries || 3)).length}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Retryable
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Orders;
