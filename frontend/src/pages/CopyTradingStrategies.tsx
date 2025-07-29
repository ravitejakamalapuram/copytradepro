import React, { useState } from 'react';
import AppNavigation from '../components/AppNavigation';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import { Stack, Grid, Flex } from '../components/ui/Layout';
import { useToast } from '../components/Toast';
import '../styles/app-theme.css';

interface CopyStrategy {
  id: string;
  name: string;
  description: string;
  sourceAccount: string;
  targetAccounts: string[];
  isActive: boolean;
  copyRatio: number; // Percentage of source position to copy
  maxPositionSize: number;
  allowedSymbols: string[];
  excludedSymbols: string[];
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  performance: {
    totalTrades: number;
    successRate: number;
    totalPnL: number;
    avgReturn: number;
  };
}

interface TradeExecution {
  id: string;
  strategyId: string;
  sourceSymbol: string;
  sourceAction: 'BUY' | 'SELL';
  sourceQuantity: number;
  sourcePrice: number;
  targetExecutions: {
    account: string;
    quantity: number;
    price: number;
    status: 'PENDING' | 'EXECUTED' | 'FAILED';
    timestamp: string;
  }[];
  timestamp: string;
}

const CopyTradingStrategies: React.FC = () => {
  const { showToast } = useToast();
  
  const [strategies, setStrategies] = useState<CopyStrategy[]>([
    {
      id: '1',
      name: 'Conservative Growth',
      description: 'Copy large-cap trades with 50% allocation',
      sourceAccount: 'Master Account 1',
      targetAccounts: ['Account A', 'Account B'],
      isActive: true,
      copyRatio: 50,
      maxPositionSize: 100000,
      allowedSymbols: ['RELIANCE', 'TCS', 'INFY', 'HDFC'],
      excludedSymbols: [],
      riskLevel: 'LOW',
      createdAt: '2024-01-10T10:00:00Z',
      performance: {
        totalTrades: 45,
        successRate: 73.3,
        totalPnL: 25600,
        avgReturn: 2.8
      }
    },
    {
      id: '2',
      name: 'Aggressive Momentum',
      description: 'Copy all trades with full allocation',
      sourceAccount: 'Master Account 2',
      targetAccounts: ['Account C'],
      isActive: false,
      copyRatio: 100,
      maxPositionSize: 200000,
      allowedSymbols: [],
      excludedSymbols: ['PENNY_STOCKS'],
      riskLevel: 'HIGH',
      createdAt: '2024-01-08T14:30:00Z',
      performance: {
        totalTrades: 78,
        successRate: 65.4,
        totalPnL: -8900,
        avgReturn: -1.2
      }
    }
  ]);

  const [recentExecutions] = useState<TradeExecution[]>([
    {
      id: '1',
      strategyId: '1',
      sourceSymbol: 'RELIANCE',
      sourceAction: 'BUY',
      sourceQuantity: 100,
      sourcePrice: 2485,
      targetExecutions: [
        {
          account: 'Account A',
          quantity: 50,
          price: 2486,
          status: 'EXECUTED',
          timestamp: '2024-01-15T11:30:00Z'
        },
        {
          account: 'Account B',
          quantity: 50,
          price: 2487,
          status: 'EXECUTED',
          timestamp: '2024-01-15T11:30:15Z'
        }
      ],
      timestamp: '2024-01-15T11:29:45Z'
    }
  ]);

  const [activeTab, setActiveTab] = useState<'strategies' | 'executions' | 'create'>('strategies');
  const [showCreateForm, setShowCreateForm] = useState(false);
  
  // New strategy form state
  const [newStrategy, setNewStrategy] = useState({
    name: '',
    description: '',
    sourceAccount: '',
    targetAccounts: [] as string[],
    copyRatio: 100,
    maxPositionSize: 100000,
    allowedSymbols: '',
    excludedSymbols: '',
    riskLevel: 'MEDIUM' as const
  });

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'LOW': return 'var(--color-profit)';
      case 'MEDIUM': return 'var(--color-neutral)';
      case 'HIGH': return 'var(--color-loss)';
      default: return 'var(--text-secondary)';
    }
  };

  const toggleStrategy = (id: string) => {
    setStrategies(prev => 
      prev.map(strategy => 
        strategy.id === id ? { ...strategy, isActive: !strategy.isActive } : strategy
      )
    );
    showToast({ type: 'success', title: 'Strategy updated' });
  };

  const createStrategy = () => {
    if (!newStrategy.name || !newStrategy.sourceAccount) {
      showToast({ type: 'error', title: 'Please fill required fields' });
      return;
    }

    const strategy: CopyStrategy = {
      id: Date.now().toString(),
      name: newStrategy.name,
      description: newStrategy.description,
      sourceAccount: newStrategy.sourceAccount,
      targetAccounts: newStrategy.targetAccounts,
      isActive: false,
      copyRatio: newStrategy.copyRatio,
      maxPositionSize: newStrategy.maxPositionSize,
      allowedSymbols: newStrategy.allowedSymbols.split(',').map(s => s.trim()).filter(Boolean),
      excludedSymbols: newStrategy.excludedSymbols.split(',').map(s => s.trim()).filter(Boolean),
      riskLevel: newStrategy.riskLevel,
      createdAt: new Date().toISOString(),
      performance: {
        totalTrades: 0,
        successRate: 0,
        totalPnL: 0,
        avgReturn: 0
      }
    };

    setStrategies(prev => [...prev, strategy]);
    setNewStrategy({
      name: '',
      description: '',
      sourceAccount: '',
      targetAccounts: [],
      copyRatio: 100,
      maxPositionSize: 100000,
      allowedSymbols: '',
      excludedSymbols: '',
      riskLevel: 'MEDIUM'
    });
    setShowCreateForm(false);
    showToast({ type: 'success', title: 'Strategy created successfully' });
  };

  return (
    <div className="app-theme app-layout">
      <AppNavigation />
      <div className="app-main">
        <Stack gap={6}>
          {/* Header */}
          <Flex justify="between" align="center">
            <div>
              <h1 style={{ fontSize: '1.5rem', fontWeight: '600', margin: 0 }}>
                Copy Trading Strategies
              </h1>
              <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>
                Automate trade copying across multiple accounts
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => setShowCreateForm(true)}
            >
              + Create Strategy
            </Button>
          </Flex>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-primary)' }}>
            {[
              { key: 'strategies', label: 'Active Strategies', count: strategies.filter(s => s.isActive).length },
              { key: 'executions', label: 'Recent Executions', count: recentExecutions.length },
              { key: 'performance', label: 'Performance', count: 0 }
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as any)}
                style={{
                  padding: '0.75rem 1rem',
                  border: 'none',
                  background: 'none',
                  color: activeTab === tab.key ? 'var(--interactive-primary)' : 'var(--text-secondary)',
                  borderBottom: activeTab === tab.key ? '2px solid var(--interactive-primary)' : '2px solid transparent',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: '500'
                }}
              >
                {tab.label} {tab.count > 0 && `(${tab.count})`}
              </button>
            ))}
          </div>

          {/* Strategies Tab */}
          {activeTab === 'strategies' && (
            <Stack gap={4}>
              {strategies.map(strategy => (
                <Card key={strategy.id}>
                  <CardHeader
                    title={strategy.name}
                    action={
                      <Flex gap={2}>
                        <span style={{ 
                          padding: '0.25rem 0.5rem',
                          borderRadius: 'var(--radius-sm)',
                          backgroundColor: getRiskColor(strategy.riskLevel),
                          color: 'white',
                          fontSize: '0.75rem',
                          fontWeight: '500'
                        }}>
                          {strategy.riskLevel}
                        </span>
                        <Button
                          variant={strategy.isActive ? "danger" : "success"}
                          size="sm"
                          onClick={() => toggleStrategy(strategy.id)}
                        >
                          {strategy.isActive ? 'Pause' : 'Activate'}
                        </Button>
                        <Button variant="outline" size="sm">
                          Edit
                        </Button>
                      </Flex>
                    }
                  />
                  <CardContent>
                    <Grid cols={2} gap={4}>
                      <div>
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Description
                          </div>
                          <div>{strategy.description}</div>
                        </div>
                        
                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Source Account
                          </div>
                          <div style={{ fontWeight: '500' }}>{strategy.sourceAccount}</div>
                        </div>

                        <div style={{ marginBottom: '1rem' }}>
                          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                            Target Accounts
                          </div>
                          <div>{strategy.targetAccounts.join(', ')}</div>
                        </div>
                      </div>

                      <div>
                        <Grid cols={2} gap={3}>
                          <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Copy Ratio</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>{strategy.copyRatio}%</div>
                          </div>
                          
                          <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Max Position</div>
                            <div style={{ fontSize: '1.25rem', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                              {formatCurrency(strategy.maxPositionSize)}
                            </div>
                          </div>

                          <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Success Rate</div>
                            <div style={{ 
                              fontSize: '1.25rem', 
                              fontWeight: '600',
                              color: strategy.performance.successRate > 70 ? 'var(--color-profit)' : 'var(--color-neutral)'
                            }}>
                              {strategy.performance.successRate.toFixed(1)}%
                            </div>
                          </div>

                          <div style={{ textAlign: 'center', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total P&L</div>
                            <div style={{ 
                              fontSize: '1.25rem', 
                              fontWeight: '600',
                              fontFamily: 'var(--font-mono)',
                              color: strategy.performance.totalPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
                            }}>
                              {strategy.performance.totalPnL >= 0 ? '+' : ''}{formatCurrency(strategy.performance.totalPnL)}
                            </div>
                          </div>
                        </Grid>
                      </div>
                    </Grid>
                  </CardContent>
                </Card>
              ))}
            </Stack>
          )}

          {/* Executions Tab */}
          {activeTab === 'executions' && (
            <Card>
              <CardHeader title="Recent Trade Executions" />
              <CardContent>
                {recentExecutions.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📋</div>
                    <div style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No recent executions</div>
                    <div style={{ fontSize: '0.875rem' }}>Trade executions will appear here when strategies are active</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table table-trading">
                      <thead>
                        <tr>
                          <th>Time</th>
                          <th>Strategy</th>
                          <th>Symbol</th>
                          <th>Action</th>
                          <th>Source Qty</th>
                          <th>Source Price</th>
                          <th>Target Executions</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentExecutions.map(execution => (
                          <tr key={execution.id}>
                            <td style={{ fontSize: '0.875rem' }}>
                              {new Date(execution.timestamp).toLocaleTimeString()}
                            </td>
                            <td>
                              {strategies.find(s => s.id === execution.strategyId)?.name || 'Unknown'}
                            </td>
                            <td style={{ fontWeight: '600' }}>{execution.sourceSymbol}</td>
                            <td>
                              <span style={{ 
                                color: execution.sourceAction === 'BUY' ? 'var(--color-profit)' : 'var(--color-loss)',
                                fontWeight: '500'
                              }}>
                                {execution.sourceAction}
                              </span>
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>{execution.sourceQuantity}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              {formatCurrency(execution.sourcePrice)}
                            </td>
                            <td>
                              <div style={{ fontSize: '0.875rem' }}>
                                {execution.targetExecutions.map((target, idx) => (
                                  <div key={idx} style={{ marginBottom: '0.25rem' }}>
                                    {target.account}: {target.quantity} @ {formatCurrency(target.price)}
                                  </div>
                                ))}
                              </div>
                            </td>
                            <td>
                              {execution.targetExecutions.every(t => t.status === 'EXECUTED') ? (
                                <span style={{ color: 'var(--color-profit)', fontWeight: '500', fontSize: '0.875rem' }}>
                                  Completed
                                </span>
                              ) : (
                                <span style={{ color: 'var(--color-neutral)', fontWeight: '500', fontSize: '0.875rem' }}>
                                  Partial
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Create Strategy Modal */}
          {showCreateForm && (
            <div style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}>
              <Card style={{ width: '600px', maxHeight: '80vh', overflow: 'auto' }}>
                <CardHeader title="Create Copy Trading Strategy" />
                <CardContent>
                  <Stack gap={4}>
                    <Grid cols={2} gap={4}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Strategy Name *
                        </label>
                        <input
                          type="text"
                          value={newStrategy.name}
                          onChange={(e) => setNewStrategy(prev => ({ ...prev, name: e.target.value }))}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Risk Level
                        </label>
                        <select
                          value={newStrategy.riskLevel}
                          onChange={(e) => setNewStrategy(prev => ({ ...prev, riskLevel: e.target.value as any }))}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                          }}
                        >
                          <option value="LOW">Low Risk</option>
                          <option value="MEDIUM">Medium Risk</option>
                          <option value="HIGH">High Risk</option>
                        </select>
                      </div>
                    </Grid>

                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Description
                      </label>
                      <textarea
                        value={newStrategy.description}
                        onChange={(e) => setNewStrategy(prev => ({ ...prev, description: e.target.value }))}
                        rows={3}
                        style={{
                          width: '100%',
                          padding: '0.75rem',
                          border: '1px solid var(--border-primary)',
                          borderRadius: 'var(--radius-md)',
                          fontSize: '0.875rem',
                          resize: 'vertical'
                        }}
                      />
                    </div>

                    <Grid cols={2} gap={4}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Copy Ratio (%)
                        </label>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          value={newStrategy.copyRatio}
                          onChange={(e) => setNewStrategy(prev => ({ ...prev, copyRatio: parseInt(e.target.value) }))}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                          }}
                        />
                      </div>
                      
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Max Position Size
                        </label>
                        <input
                          type="number"
                          value={newStrategy.maxPositionSize}
                          onChange={(e) => setNewStrategy(prev => ({ ...prev, maxPositionSize: parseInt(e.target.value) }))}
                          style={{
                            width: '100%',
                            padding: '0.75rem',
                            border: '1px solid var(--border-primary)',
                            borderRadius: 'var(--radius-md)',
                            fontSize: '0.875rem'
                          }}
                        />
                      </div>
                    </Grid>

                    <Flex gap={3}>
                      <Button variant="primary" onClick={createStrategy}>
                        Create Strategy
                      </Button>
                      <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                        Cancel
                      </Button>
                    </Flex>
                  </Stack>
                </CardContent>
              </Card>
            </div>
          )}
        </Stack>
      </div>
    </div>
  );
};

export default CopyTradingStrategies;