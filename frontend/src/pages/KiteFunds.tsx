import React, { useState, useEffect } from 'react';
import KiteNavigation from '../components/KiteNavigation';
import '../styles/kite-theme.css';

interface FundTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  description: string;
  date: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
}

const KiteFunds: React.FC = () => {
  const [availableFunds, setAvailableFunds] = useState(125000);
  const [usedMargin, setUsedMargin] = useState(75000);
  const [transactions, setTransactions] = useState<FundTransaction[]>([]);
  const [addFundsAmount, setAddFundsAmount] = useState('');
  const [withdrawAmount, setWithdrawAmount] = useState('');

  useEffect(() => {
    // Mock transaction data
    const mockTransactions: FundTransaction[] = [
      {
        id: 'TXN001',
        type: 'CREDIT',
        amount: 50000,
        description: 'Bank Transfer - HDFC Bank',
        date: '2024-01-15 09:30:00',
        status: 'SUCCESS'
      },
      {
        id: 'TXN002',
        type: 'DEBIT',
        amount: 25000,
        description: 'Withdrawal to Bank',
        date: '2024-01-14 14:20:00',
        status: 'SUCCESS'
      },
      {
        id: 'TXN003',
        type: 'CREDIT',
        amount: 100000,
        description: 'Initial Deposit - UPI',
        date: '2024-01-10 10:15:00',
        status: 'SUCCESS'
      },
      {
        id: 'TXN004',
        type: 'DEBIT',
        amount: 5000,
        description: 'Trading Charges',
        date: '2024-01-09 16:45:00',
        status: 'SUCCESS'
      }
    ];

    setTransactions(mockTransactions);
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

  const handleAddFunds = () => {
    if (addFundsAmount && parseFloat(addFundsAmount) > 0) {
      // Mock add funds logic
      console.log('Adding funds:', addFundsAmount);
      setAddFundsAmount('');
    }
  };

  const handleWithdraw = () => {
    if (withdrawAmount && parseFloat(withdrawAmount) > 0) {
      // Mock withdraw logic
      console.log('Withdrawing funds:', withdrawAmount);
      setWithdrawAmount('');
    }
  };

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
              ₹{formatCurrency(availableFunds)}
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
              ₹{formatCurrency(usedMargin)}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)', marginTop: '0.25rem' }}>
              {((usedMargin / (availableFunds + usedMargin)) * 100).toFixed(1)}% utilized
            </div>
          </div>

          <div className="kite-card" style={{ padding: '1.5rem' }}>
            <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)', marginBottom: '0.5rem' }}>
              Total Balance
            </div>
            <div style={{ fontSize: '2rem', fontWeight: '600', fontFamily: 'var(--kite-font-mono)', color: 'var(--kite-text-primary)' }}>
              ₹{formatCurrency(availableFunds + usedMargin)}
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
                  disabled={!addFundsAmount || parseFloat(addFundsAmount) <= 0}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Add Funds via UPI/Bank Transfer
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
                  max={availableFunds}
                />
                <div style={{ fontSize: '0.875rem', color: 'var(--kite-text-secondary)' }}>
                  Maximum withdrawable: ₹{formatCurrency(availableFunds)}
                </div>
                <button 
                  className="kite-btn kite-btn-danger"
                  onClick={handleWithdraw}
                  disabled={!withdrawAmount || parseFloat(withdrawAmount) <= 0 || parseFloat(withdrawAmount) > availableFunds}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  Withdraw to Bank Account
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
                        {new Date(transaction.date).toLocaleDateString('en-IN')}
                        <div style={{ fontSize: '0.75rem', color: 'var(--kite-text-secondary)' }}>
                          {new Date(transaction.date).toLocaleTimeString('en-IN', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </div>
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
