import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppNavigation from '../components/AppNavigation';
import Button from '../components/ui/Button';
import Card, { CardHeader, CardContent } from '../components/ui/Card';
import { Stack, Grid, Flex } from '../components/ui/Layout';
import { useToast } from '../components/Toast';
import '../styles/app-theme.css';

interface RiskMetrics {
  portfolioValue: number;
  totalExposure: number;
  availableMargin: number;
  usedMargin: number;
  marginUtilization: number;
  dayPnL: number;
  maxDrawdown: number;
  sharpeRatio: number;
  volatility: number;
  beta: number;
}

interface PositionRisk {
  symbol: string;
  quantity: number;
  value: number;
  exposure: number;
  riskPercent: number;
  stopLoss?: number;
  target?: number;
  riskRewardRatio?: number;
}

interface RiskRule {
  id: string;
  name: string;
  type: 'POSITION_SIZE' | 'PORTFOLIO_EXPOSURE' | 'DAILY_LOSS' | 'MARGIN_UTILIZATION';
  limit: number;
  currentValue: number;
  isActive: boolean;
  isViolated: boolean;
}

const RiskManagement: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  
  const [riskMetrics] = useState<RiskMetrics>({
    portfolioValue: 500000,
    totalExposure: 350000,
    availableMargin: 150000,
    usedMargin: 200000,
    marginUtilization: 57.1,
    dayPnL: -12500,
    maxDrawdown: -8.5,
    sharpeRatio: 1.2,
    volatility: 18.5,
    beta: 1.15
  });

  const [positionRisks] = useState<PositionRisk[]>([
    {
      symbol: 'RELIANCE',
      quantity: 100,
      value: 248500,
      exposure: 248500,
      riskPercent: 49.7,
      stopLoss: 2400,
      target: 2600,
      riskRewardRatio: 1.2
    },
    {
      symbol: 'TCS',
      quantity: 50,
      value: 175000,
      exposure: 175000,
      riskPercent: 35.0,
      stopLoss: 3400,
      target: 3700,
      riskRewardRatio: 1.5
    }
  ]);

  const [riskRules, setRiskRules] = useState<RiskRule[]>([
    {
      id: '1',
      name: 'Max Position Size',
      type: 'POSITION_SIZE',
      limit: 50,
      currentValue: 49.7,
      isActive: true,
      isViolated: false
    },
    {
      id: '2',
      name: 'Portfolio Exposure',
      type: 'PORTFOLIO_EXPOSURE',
      limit: 80,
      currentValue: 70,
      isActive: true,
      isViolated: false
    },
    {
      id: '3',
      name: 'Daily Loss Limit',
      type: 'DAILY_LOSS',
      limit: 15000,
      currentValue: 12500,
      isActive: true,
      isViolated: false
    },
    {
      id: '4',
      name: 'Margin Utilization',
      type: 'MARGIN_UTILIZATION',
      limit: 60,
      currentValue: 57.1,
      isActive: true,
      isViolated: false
    }
  ]);

  const [activeTab, setActiveTab] = useState<'overview' | 'positions' | 'rules'>('overview');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  const getRiskColor = (riskPercent: number) => {
    if (riskPercent < 30) return 'var(--color-profit)';
    if (riskPercent < 50) return 'var(--color-neutral)';
    return 'var(--color-loss)';
  };

  const getRiskLevel = (riskPercent: number) => {
    if (riskPercent < 30) return 'Low';
    if (riskPercent < 50) return 'Medium';
    return 'High';
  };

  const toggleRiskRule = (id: string) => {
    setRiskRules(prev => 
      prev.map(rule => 
        rule.id === id ? { ...rule, isActive: !rule.isActive } : rule
      )
    );
    showToast({ type: 'success', title: 'Risk rule updated' });
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
                Risk Management
              </h1>
              <p style={{ color: 'var(--text-secondary)', margin: '0.5rem 0 0 0' }}>
                Monitor and control your portfolio risk exposure
              </p>
            </div>
            <Button
              variant="primary"
              onClick={() => navigate('/trade-setup')}
            >
              Adjust Positions
            </Button>
          </Flex>

          {/* Risk Alert Banner */}
          {riskMetrics.marginUtilization > 50 && (
            <Card style={{ border: '1px solid var(--color-loss)', backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <CardContent>
                <Flex align="center" gap={3}>
                  <div style={{ fontSize: '1.5rem' }}>⚠️</div>
                  <div>
                    <div style={{ fontWeight: '600', color: 'var(--color-loss)' }}>
                      High Risk Alert
                    </div>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      Margin utilization is at {riskMetrics.marginUtilization}%. Consider reducing exposure.
                    </div>
                  </div>
                </Flex>
              </CardContent>
            </Card>
          )}

          {/* Tab Navigation */}
          <div style={{ display: 'flex', gap: '1rem', borderBottom: '1px solid var(--border-primary)' }}>
            {[
              { key: 'overview', label: 'Risk Overview' },
              { key: 'positions', label: 'Position Risk' },
              { key: 'rules', label: 'Risk Rules' }
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
                {tab.label}
              </button>
            ))}
          </div>

          {/* Risk Overview Tab */}
          {activeTab === 'overview' && (
            <Stack gap={4}>
              {/* Key Risk Metrics */}
              <Grid cols={4} gap={4}>
                <Card>
                  <CardContent style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Portfolio Value
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(riskMetrics.portfolioValue)}
                    </div>
                  </CardContent>
                </Card>
                
                <Card>
                  <CardContent style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Total Exposure
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(riskMetrics.totalExposure)}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--color-neutral)' }}>
                      {((riskMetrics.totalExposure / riskMetrics.portfolioValue) * 100).toFixed(1)}% of portfolio
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Margin Utilization
                    </div>
                    <div style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: '600', 
                      fontFamily: 'var(--font-mono)',
                      color: riskMetrics.marginUtilization > 60 ? 'var(--color-loss)' : 'var(--color-profit)'
                    }}>
                      {riskMetrics.marginUtilization.toFixed(1)}%
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {formatCurrency(riskMetrics.usedMargin)} / {formatCurrency(riskMetrics.usedMargin + riskMetrics.availableMargin)}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent style={{ textAlign: 'center', padding: '1.5rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                      Day's P&L
                    </div>
                    <div style={{ 
                      fontSize: '1.5rem', 
                      fontWeight: '600', 
                      fontFamily: 'var(--font-mono)',
                      color: riskMetrics.dayPnL >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'
                    }}>
                      {riskMetrics.dayPnL >= 0 ? '+' : ''}{formatCurrency(riskMetrics.dayPnL)}
                    </div>
                  </CardContent>
                </Card>
              </Grid>

              {/* Advanced Risk Metrics */}
              <Card>
                <CardHeader title="Advanced Risk Metrics" />
                <CardContent>
                  <Grid cols={4} gap={4}>
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Max Drawdown
                      </div>
                      <div style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: '600',
                        color: 'var(--color-loss)'
                      }}>
                        {riskMetrics.maxDrawdown}%
                      </div>
                    </div>
                    
                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Sharpe Ratio
                      </div>
                      <div style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: '600',
                        color: riskMetrics.sharpeRatio > 1 ? 'var(--color-profit)' : 'var(--color-neutral)'
                      }}>
                        {riskMetrics.sharpeRatio.toFixed(2)}
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Volatility
                      </div>
                      <div style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: '600',
                        color: 'var(--color-neutral)'
                      }}>
                        {riskMetrics.volatility}%
                      </div>
                    </div>

                    <div style={{ textAlign: 'center', padding: '1rem' }}>
                      <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: '0.5rem' }}>
                        Portfolio Beta
                      </div>
                      <div style={{ 
                        fontSize: '1.25rem', 
                        fontWeight: '600',
                        color: 'var(--color-neutral)'
                      }}>
                        {riskMetrics.beta.toFixed(2)}
                      </div>
                    </div>
                  </Grid>
                </CardContent>
              </Card>
            </Stack>
          )}

          {/* Position Risk Tab */}
          {activeTab === 'positions' && (
            <Card>
              <CardHeader title="Position Risk Analysis" />
              <CardContent>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table table-trading">
                    <thead>
                      <tr>
                        <th>Symbol</th>
                        <th>Quantity</th>
                        <th>Value</th>
                        <th>Risk %</th>
                        <th>Risk Level</th>
                        <th>Stop Loss</th>
                        <th>Target</th>
                        <th>R:R Ratio</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {positionRisks.map((position, index) => (
                        <tr key={index}>
                          <td style={{ fontWeight: '600' }}>{position.symbol}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>{position.quantity}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>
                            {formatCurrency(position.value)}
                          </td>
                          <td style={{ 
                            fontFamily: 'var(--font-mono)',
                            color: getRiskColor(position.riskPercent),
                            fontWeight: '600'
                          }}>
                            {position.riskPercent.toFixed(1)}%
                          </td>
                          <td>
                            <span style={{ 
                              color: getRiskColor(position.riskPercent),
                              fontWeight: '500',
                              fontSize: '0.875rem'
                            }}>
                              {getRiskLevel(position.riskPercent)}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>
                            {position.stopLoss ? formatCurrency(position.stopLoss) : '-'}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>
                            {position.target ? formatCurrency(position.target) : '-'}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>
                            {position.riskRewardRatio ? `1:${position.riskRewardRatio}` : '-'}
                          </td>
                          <td>
                            <Flex gap={1}>
                              <Button variant="outline" size="sm">
                                Set SL
                              </Button>
                              <Button variant="danger" size="sm">
                                Reduce
                              </Button>
                            </Flex>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Risk Rules Tab */}
          {activeTab === 'rules' && (
            <Card>
              <CardHeader title="Risk Management Rules" />
              <CardContent>
                <div style={{ overflowX: 'auto' }}>
                  <table className="table table-trading">
                    <thead>
                      <tr>
                        <th>Rule Name</th>
                        <th>Type</th>
                        <th>Limit</th>
                        <th>Current</th>
                        <th>Status</th>
                        <th>Active</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {riskRules.map((rule) => (
                        <tr key={rule.id}>
                          <td style={{ fontWeight: '600' }}>{rule.name}</td>
                          <td>{rule.type.replace('_', ' ')}</td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>
                            {rule.type.includes('LOSS') ? formatCurrency(rule.limit) : `${rule.limit}%`}
                          </td>
                          <td style={{ fontFamily: 'var(--font-mono)' }}>
                            {rule.type.includes('LOSS') ? formatCurrency(rule.currentValue) : `${rule.currentValue}%`}
                          </td>
                          <td>
                            <span style={{ 
                              color: rule.isViolated ? 'var(--color-loss)' : 'var(--color-profit)',
                              fontWeight: '500',
                              fontSize: '0.875rem'
                            }}>
                              {rule.isViolated ? 'Violated' : 'OK'}
                            </span>
                          </td>
                          <td>
                            <button
                              onClick={() => toggleRiskRule(rule.id)}
                              style={{
                                padding: '0.25rem 0.5rem',
                                border: 'none',
                                borderRadius: 'var(--radius-sm)',
                                backgroundColor: rule.isActive ? 'var(--color-profit)' : 'var(--color-neutral)',
                                color: 'white',
                                fontSize: '0.75rem',
                                cursor: 'pointer'
                              }}
                            >
                              {rule.isActive ? 'ON' : 'OFF'}
                            </button>
                          </td>
                          <td>
                            <Button variant="outline" size="sm">
                              Edit
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </Stack>
      </div>
    </div>
  );
};

export default RiskManagement;