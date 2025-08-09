import React, { useState, useEffect } from 'react';
import AppNavigation from '../components/AppNavigation';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import { Stack, Grid, Flex } from '../components/ui/Layout';
import { useToast } from '../components/Toast';
import '../styles/app-theme.css';

interface PriceAlert {
  id: string;
  symbol: string;
  alertType: 'PRICE_ABOVE' | 'PRICE_BELOW' | 'PERCENT_CHANGE' | 'VOLUME_SPIKE';
  condition: number;
  currentValue: number;
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
  message?: string;
}

interface PortfolioAlert {
  id: string;
  alertType: 'PORTFOLIO_VALUE' | 'DAILY_PNL' | 'POSITION_SIZE' | 'MARGIN_UTILIZATION';
  condition: number;
  currentValue: number;
  isActive: boolean;
  createdAt: string;
  triggeredAt?: string;
  message?: string;
}

const AlertsManagement: React.FC = () => {
  const { showToast } = useToast();
  
  const [priceAlerts, setPriceAlerts] = useState<PriceAlert[]>([]);
  const [portfolioAlerts, setPortfolioAlerts] = useState<PortfolioAlert[]>([]);
  const [activeTab, setActiveTab] = useState<'price' | 'portfolio' | 'create'>('price');

  // New Alert Form State
  const [newAlert, setNewAlert] = useState({
    symbol: '',
    alertType: 'PRICE_ABOVE' as const,
    condition: '',
    message: ''
  });

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    try {
      // Mock data for now - replace with actual API calls
      setPriceAlerts([
        {
          id: '1',
          symbol: 'RELIANCE',
          alertType: 'PRICE_ABOVE',
          condition: 2500,
          currentValue: 2485,
          isActive: true,
          createdAt: '2024-01-15T10:30:00Z',
          message: 'RELIANCE crossed ₹2500'
        }
      ]);

      setPortfolioAlerts([
        {
          id: '1',
          alertType: 'DAILY_PNL',
          condition: -10000,
          currentValue: -8500,
          isActive: true,
          createdAt: '2024-01-15T09:00:00Z',
          message: 'Daily loss exceeds ₹10,000'
        }
      ]);
    } catch {
      showToast({ type: 'error', title: 'Failed to load alerts' });
    }
  };

  const createAlert = async () => {
    if (!newAlert.symbol || !newAlert.condition) {
      showToast({ type: 'error', title: 'Please fill all required fields' });
      return;
    }

    try {
      const alert: PriceAlert = {
        id: Date.now().toString(),
        symbol: newAlert.symbol.toUpperCase(),
        alertType: newAlert.alertType,
        condition: parseFloat(newAlert.condition),
        currentValue: 0,
        isActive: true,
        createdAt: new Date().toISOString(),
        message: newAlert.message || `${newAlert.symbol} alert`
      };

      setPriceAlerts(prev => [...prev, alert]);
      setNewAlert({ symbol: '', alertType: 'PRICE_ABOVE', condition: '', message: '' });
      showToast({ type: 'success', title: 'Alert created successfully' });
      setActiveTab('price');
    } catch {
      showToast({ type: 'error', title: 'Failed to create alert' });
    }
  };

  const toggleAlert = async (id: string, type: 'price' | 'portfolio') => {
    try {
      if (type === 'price') {
        setPriceAlerts(prev => 
          prev.map(alert => 
            alert.id === id ? { ...alert, isActive: !alert.isActive } : alert
          )
        );
      } else {
        setPortfolioAlerts(prev => 
          prev.map(alert => 
            alert.id === id ? { ...alert, isActive: !alert.isActive } : alert
          )
        );
      }
      showToast({ type: 'success', title: 'Alert updated' });
    } catch {
      showToast({ type: 'error', title: 'Failed to update alert' });
    }
  };

  const deleteAlert = async (id: string, type: 'price' | 'portfolio') => {
    try {
      if (type === 'price') {
        setPriceAlerts(prev => prev.filter(alert => alert.id !== id));
      } else {
        setPortfolioAlerts(prev => prev.filter(alert => alert.id !== id));
      }
      showToast({ type: 'success', title: 'Alert deleted' });
    } catch {
      showToast({ type: 'error', title: 'Failed to delete alert' });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
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
                Alerts Management
              </h1>
              <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>
                Set up price and portfolio alerts to stay informed
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => setActiveTab('create')}
            >
              + Create Alert
            </Button>
          </Flex>

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-primary)' }}>
            {[
              { key: 'price', label: 'Price Alerts', count: priceAlerts.length },
              { key: 'portfolio', label: 'Portfolio Alerts', count: portfolioAlerts.length },
              { key: 'create', label: 'Create New', count: 0 }
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

          {/* Price Alerts Tab */}
          {activeTab === 'price' && (
            <Card>
              <CardHeader title="Price Alerts" />
              <CardContent>
                {priceAlerts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🔔</div>
                    <div style={{ fontSize: '1.125rem', marginBottom: '0.5rem' }}>No price alerts set</div>
                    <div style={{ fontSize: '0.875rem' }}>Create alerts to get notified about price movements</div>
                  </div>
                ) : (
                  <div style={{ overflowX: 'auto' }}>
                    <table className="table table-trading">
                      <thead>
                        <tr>
                          <th>Symbol</th>
                          <th>Alert Type</th>
                          <th>Condition</th>
                          <th>Current</th>
                          <th>Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {priceAlerts.map(alert => (
                          <tr key={alert.id}>
                            <td style={{ fontWeight: '600' }}>{alert.symbol}</td>
                            <td>{alert.alertType.replace('_', ' ')}</td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              {alert.alertType.includes('PERCENT') ? `${alert.condition}%` : formatCurrency(alert.condition)}
                            </td>
                            <td style={{ fontFamily: 'var(--font-mono)' }}>
                              {alert.alertType.includes('PERCENT') ? `${alert.currentValue}%` : formatCurrency(alert.currentValue)}
                            </td>
                            <td>
                              <span style={{ 
                                color: alert.isActive ? 'var(--color-profit)' : 'var(--text-secondary)',
                                fontWeight: '500',
                                fontSize: '0.875rem'
                              }}>
                                {alert.isActive ? 'Active' : 'Inactive'}
                              </span>
                            </td>
                            <td>
                              <Flex gap={1}>
                                <Button
                                  variant={alert.isActive ? "outline" : "success"}
                                  size="sm"
                                  onClick={() => toggleAlert(alert.id, 'price')}
                                >
                                  {alert.isActive ? 'Pause' : 'Activate'}
                                </Button>
                                <Button
                                  variant="danger"
                                  size="sm"
                                  onClick={() => deleteAlert(alert.id, 'price')}
                                >
                                  Delete
                                </Button>
                              </Flex>
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

          {/* Create Alert Tab */}
          {activeTab === 'create' && (
            <Card>
              <CardHeader title="Create New Alert" />
              <CardContent>
                <Stack gap={4}>
                  <Grid cols={2} gap={4}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Symbol
                      </label>
                      <input
                        type="text"
                        placeholder="e.g., RELIANCE, TCS"
                        value={newAlert.symbol}
                        onChange={(e) => setNewAlert(prev => ({ ...prev, symbol: e.target.value }))}
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
                        Condition Value
                      </label>
                      <input
                        type="number"
                        placeholder="2500"
                        value={newAlert.condition}
                        onChange={(e) => setNewAlert(prev => ({ ...prev, condition: e.target.value }))}
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

                  <Flex gap={2}>
                    <Button variant="primary" onClick={createAlert}>
                      Create Alert
                    </Button>
                    <Button variant="outline" onClick={() => setActiveTab('price')}>
                      Cancel
                    </Button>
                  </Flex>
                </Stack>
              </CardContent>
            </Card>
          )}
        </Stack>
      </div>
    </div>
  );
};

export default AlertsManagement;