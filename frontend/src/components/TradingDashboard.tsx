import React from 'react';
import StatsCard from './StatsCard';
import StatusBadge from './StatusBadge';
import Alert from './Alert';

interface DashboardStats {
  totalOrders: number;
  executedOrders: number;
  totalValue: number;
  profitLoss: number;
  activeAccounts: number;
}

interface TradingDashboardProps {
  stats: DashboardStats;
  loading?: boolean;
  className?: string;
}

const TradingDashboard: React.FC<TradingDashboardProps> = ({
  stats,
  loading = false,
  className = ''
}) => {
  const executionRate = stats.totalOrders > 0 
    ? (stats.executedOrders / stats.totalOrders) * 100 
    : 0;

  const profitLossPercentage = stats.totalValue > 0 
    ? (stats.profitLoss / stats.totalValue) * 100 
    : 0;

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Alert for important information */}
      <Alert variant="info" title="Trading Status">
        Your trading system is active and monitoring {stats.activeAccounts} broker account{stats.activeAccounts !== 1 ? 's' : ''}.
      </Alert>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6">
        <StatsCard
          title="Total Orders"
          value={stats.totalOrders}
          icon="📊"
          loading={loading}
        />
        
        <StatsCard
          title="Executed Orders"
          value={stats.executedOrders}
          icon="✅"
          trend={{
            value: executionRate,
            isPositive: executionRate >= 80
          }}
          loading={loading}
        />
        
        <StatsCard
          title="Portfolio Value"
          value={stats.totalValue}
          currency="₹"
          icon="💰"
          loading={loading}
        />
        
        <StatsCard
          title="P&L"
          value={stats.profitLoss}
          currency="₹"
          icon={stats.profitLoss >= 0 ? "📈" : "📉"}
          trend={{
            value: Math.abs(profitLossPercentage),
            isPositive: stats.profitLoss >= 0
          }}
          loading={loading}
        />
      </div>

      {/* Quick Status Overview */}
      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Quick Status Overview</h3>
          <p className="card-subtitle">Real-time status of your trading operations</p>
        </div>
        <div className="card-body">
          <div className="grid grid-cols-3 gap-6">
            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
              <div>
                <p className="text-sm text-secondary">Execution Rate</p>
                <p className="text-lg font-semibold">{executionRate.toFixed(1)}%</p>
              </div>
              <StatusBadge 
                status={executionRate >= 80 ? 'EXECUTED' : executionRate >= 50 ? 'PENDING' : 'REJECTED'} 
              />
            </div>
            
            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
              <div>
                <p className="text-sm text-secondary">Active Accounts</p>
                <p className="text-lg font-semibold">{stats.activeAccounts}</p>
              </div>
              <StatusBadge 
                status={stats.activeAccounts > 0 ? 'EXECUTED' : 'PENDING'} 
              />
            </div>
            
            <div className="flex items-center justify-between p-4 bg-neutral-50 rounded-lg">
              <div>
                <p className="text-sm text-secondary">System Status</p>
                <p className="text-lg font-semibold">Online</p>
              </div>
              <StatusBadge status="EXECUTED" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TradingDashboard;
