import React, { useState, useEffect } from 'react';
// import { useNavigate } from 'react-router-dom';
import KiteNavigation from '../components/KiteNavigation';
import { fundsService, type FundTransaction, type FundsBalance } from '../services/fundsService';
import '../styles/kite-theme.css';

const KiteFunds: React.FC = () => {
  // const navigate = useNavigate(); // Will be used for navigation features
  const [fundsBalance, setFundsBalance] = useState<FundsBalance>({
    availableFunds: 0,
    usedMargin: 0,
    totalBalance: 0,
    withdrawableBalance: 0,
    marginUtilized: 0,
    marginAvailable: 0
  });
  const [transactions, setTransactions] = useState<FundTransaction[]>([]);
  const [addFundsAmount, setAddFundsAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [selectedMethod, setSelectedMethod] = useState<'UPI' | 'NETBANKING' | 'BANK_TRANSFER'>('UPI');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    const fetchFundsData = async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch funds balance
        const balance = await fundsService.getFundsBalance();
        setFundsBalance(balance);

        // Fetch transactions
        const transactionHistory = await fundsService.getTransactions(20);
        setTransactions(transactionHistory);

      } catch (error: any) {
        console.error('Failed to fetch funds data:', error);
        setError('Failed to load funds data');
      } finally {
        setLoading(false);
      }
    };

    fetchFundsData();
  }, []);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const getStatusColor = (status: string): string => {
    switch (status) {
      case 'SUCCESS': return 'var(--kite-profit)';
      case 'PENDING': return 'var(--kite-neutral)';
      case 'FAILED': return 'var(--kite-loss)';
      default: return 'var(--kite-text-secondary)';
    }
  };

  const getTypeColor = (type: string): string => {
    return type === 'CREDIT' ? 'var(--kite-profit)' : 'var(--kite-loss)';
  };

  const handleAddFunds = async () => {
    if (!addFundsAmount || parseFloat(addFundsAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    try {
      setActionLoading(true);
      const result = await fundsService.addFunds({
        amount: parseFloat(addFundsAmount),
        method: selectedMethod
      });

      if (result.success) {
        alert(result.message);
        setAddFundsAmount('');
        // Refresh data
        const balance = await fundsService.getFundsBalance();
        setFundsBalance(balance);
        const transactionHistory = await fundsService.getTransactions(20);
        setTransactions(transactionHistory);
      }
    } catch (error: any) {
      alert('Failed to add funds: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }

    if (parseFloat(withdrawAmount) > fundsBalance.withdrawableBalance) {
      alert('Insufficient withdrawable balance');
      return;
    }

    try {
      setActionLoading(true);
      const result = await fundsService.withdrawFunds({
        amount: parseFloat(withdrawAmount),
        bankAccount: 'Primary Bank Account'
      });

      if (result.success) {
        alert(result.message);
        setWithdrawAmount('');
        // Refresh data
        const balance = await fundsService.getFundsBalance();
        setFundsBalance(balance);
        const transactionHistory = await fundsService.getTransactions(20);
        setTransactions(transactionHistory);
      }
    } catch (error: any) {
      alert('Failed to withdraw funds: ' + error.message);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
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
            <div style={{ fontSize: '2rem' }}>💰</div>
            <div style={{ color: 'var(--kite-text-secondary)' }}>Loading funds...</div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="kite-theme">
        <KiteNavigation />
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
      <KiteNavigation />

      <div className="kite-main">
        {/* Funds Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
          <div className="kite-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
              Available Funds
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: 'var(--kite-text-primary)' }}>
              ₹{formatCurrency(fundsBalance.availableFunds)}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)', marginTop: '0.25rem' }}>
              Ready for trading
            </div>
          </div>

          <div className="kite-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
              Used Margin
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: 'var(--kite-neutral)' }}>
              ₹{formatCurrency(fundsBalance.usedMargin)}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)', marginTop: '0.25rem' }}>
              {((fundsBalance.usedMargin / fundsBalance.totalBalance) * 100).toFixed(1)}% utilized
            </div>
          </div>

          <div className="kite-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
              Total Balance
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: 'var(--kite-text-primary)' }}>
              ₹{formatCurrency(fundsBalance.totalBalance)}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)', marginTop: '0.25rem' }}>
              Available + Used
            </div>
          </div>
        </div>

        {/* Fund Actions */}
        <div className="kite-card">
          <div className="kite-card-header">
            <h2 className="kite-card-title">Fund Management</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
            {/* Add Funds */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '1rem' }}>
                Add Funds
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={addFundsAmount}
                  onChange={(e) => setAddFundsAmount(e.target.value)}
                  className="kite-input"
                  style={{ fontSize: '1rem' }}
                />

                {/* Payment Method Selection */}
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {(['UPI', 'NETBANKING', 'BANK_TRANSFER'] as const).map(method => (
                    <button
                      key={method}
                      className={`kite-btn ${selectedMethod === method ? 'kite-btn-primary' : ''}`}
                      onClick={() => setSelectedMethod(method)}
                      style={{ fontSize: '0.875rem' }}
                    >
                      {method.replace('_', ' ')}
                    </button>
                  ))}
                </div>

                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  {[5000, 10000, 25000, 50000].map(amount => (
                    <button
                      key={amount}
                      className="kite-btn"
                      onClick={() => setAddFundsAmount(amount.toString())}
                      style={{ fontSize: '0.875rem' }}
                    >
                      ₹{amount.toLocaleString()}
                    </button>
                  ))}
                </div>
                <button
                  className="kite-btn kite-btn-primary"
                  onClick={handleAddFunds}
                  disabled={!addFundsAmount || parseFloat(addFundsAmount) <= 0 || actionLoading}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {actionLoading ? 'Processing...' : `Add Funds via ${selectedMethod.replace('_', ' ')}`}
                </button>
              </div>
            </div>

            {/* Withdraw Funds */}
            <div>
              <h3 style={{ fontSize: '1rem', fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '1rem' }}>
                Withdraw Funds
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input
                  type="number"
                  placeholder="Enter amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  className="kite-input"
                  style={{ fontSize: '1rem' }}
                  max={fundsBalance.withdrawableBalance}
                />
                <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                  Maximum withdrawable: ₹{formatCurrency(fundsBalance.withdrawableBalance)}
                </div>
                <button
                  className="kite-btn kite-btn-danger"
                  onClick={handleWithdraw}
                  disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > fundsBalance.withdrawableBalance || actionLoading}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {actionLoading ? 'Processing...' : 'Withdraw to Bank Account'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Transaction History */}
        <div className="kite-card">
          <div className="kite-card-header">
            <h2 className="kite-card-title">Transaction History</h2>
            <button className="kite-btn">📥 Download Statement</button>
          </div>
          
          {transactions.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table className="kite-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Description</th>
                    <th>Type</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((transaction) => (
                    <tr key={transaction.id}>
                      <td style={{ fontFamily: 'var(--kite-font-mono)', fontSize: '0.875rem' }}>
                        {formatDate(transaction.date)}
                      </td>
                      <td>
                        <div style={{ fontWeight: '500', color: 'var(--kite-text-primary)' }}>
                          {transaction.description}
                        </div>
                      </td>
                      <td>
                        <span style={{ 
                          color: getTypeColor(transaction.type),
                          fontWeight: '500',
                          fontSize: '0.875rem'
                        }}>
                          {transaction.type}
                        </span>
                      </td>
                      <td style={{ 
                        fontFamily: 'var(--kite-font-mono)',
                        color: getTypeColor(transaction.type),
                        fontWeight: '500'
                      }}>
                        {transaction.type === 'CREDIT' ? '+' : '-'}₹{formatCurrency(transaction.amount)}
                      </td>
                      <td>
                        <span style={{ 
                          color: getStatusColor(transaction.status),
                          fontWeight: '500',
                          fontSize: '0.875rem'
                        }}>
                          {transaction.status}
                        </span>
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
              <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>💰</div>
              <div style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No transactions yet</div>
              <div style={{ fontSize: '0.875rem' }}>Add funds to start trading</div>
            </div>
          )}
        </div>

        {/* Payment Methods */}
        <div className="kite-card">
          <div className="kite-card-header">
            <h2 className="kite-card-title">Payment Methods</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
            <div style={{ 
              padding: '1rem',
              backgroundColor: 'var(--kite-bg-tertiary)',
              borderRadius: 'var(--kite-radius-md)',
              border: '1px solid var(--kite-border-secondary)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>🏦</div>
              <div style={{ fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.25rem' }}>
                Bank Transfer
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                NEFT/RTGS/IMPS
              </div>
            </div>
            <div style={{ 
              padding: '1rem',
              backgroundColor: 'var(--kite-bg-tertiary)',
              borderRadius: 'var(--kite-radius-md)',
              border: '1px solid var(--kite-border-secondary)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>📱</div>
              <div style={{ fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.25rem' }}>
                UPI
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                Instant transfer
              </div>
            </div>
            <div style={{ 
              padding: '1rem',
              backgroundColor: 'var(--kite-bg-tertiary)',
              borderRadius: 'var(--kite-radius-md)',
              border: '1px solid var(--kite-border-secondary)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '2rem', marginBottom: '0.5rem' }}>💳</div>
              <div style={{ fontWeight: '500', color: 'var(--kite-text-primary)', marginBottom: '0.25rem' }}>
                Net Banking
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                All major banks
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KiteFunds;
