import React from 'react';
import './PortfolioTable.css';
import Button from './ui/Button';

export interface PortfolioItem {
  symbol: string;
  qty: number;
  avgPrice: number;
  ltp: number;
  invested: number;
  currentValue: number;
  pnl: number;
  pnlPercent: number;
  dayChange: number;
  dayChangePercent: number;
  product: 'CNC' | 'MIS' | 'NRML';
  exchange: 'NSE' | 'BSE';
  type: 'holding' | 'position';
  lastTradeDate?: string;
  brokerAccounts?: string[];
}

export type SortField = 'symbol' | 'pnl' | 'pnlPercent' | 'currentValue' | 'dayChange';
export type SortOrder = 'asc' | 'desc';

interface PortfolioTableProps {
  items: PortfolioItem[];
  sortField: SortField;
  sortOrder: SortOrder;
  onSort: (field: SortField) => void;
  emptyStateConfig?: {
    icon: string;
    title: string;
    description: string;
    actionLabel: string;
    onAction: () => void;
  };
}

const PortfolioTable: React.FC<PortfolioTableProps> = ({
  items,
  sortField,
  sortOrder,
  onSort,
  emptyStateConfig
}) => {
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  };

  const formatNumber = (num: number, decimals: number = 2): string => {
    return new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  };

  const getItemIcon = (item: PortfolioItem) => {
    return item.type === 'holding' ? '📊' : '⚡';
  };

  const getItemTypeLabel = (item: PortfolioItem) => {
    return item.type === 'holding' ? 'Long Term' : 'Intraday';
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '';
    return sortOrder === 'asc' ? '↑' : '↓';
  };

  if (items.length === 0 && emptyStateConfig) {
    return (
      <div className="portfolio-table">
        <div className="portfolio-table__empty">
          <div className="portfolio-table__empty-icon">{emptyStateConfig.icon}</div>
          <div className="portfolio-table__empty-title">{emptyStateConfig.title}</div>
          <div className="portfolio-table__empty-description">{emptyStateConfig.description}</div>
          <Button
            onClick={emptyStateConfig.onAction}
          >
            {emptyStateConfig.actionLabel}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="portfolio-table">
      <div className="portfolio-table__container">
        <table className="portfolio-table__table">
          <thead className="portfolio-table__header">
            <tr>
              <th 
                className="portfolio-table__header-cell portfolio-table__header-cell--sortable"
                onClick={() => onSort('symbol')}
              >
                Instrument {getSortIcon('symbol')}
              </th>
              <th className="portfolio-table__header-cell portfolio-table__header-cell--right">
                Qty
              </th>
              <th className="portfolio-table__header-cell portfolio-table__header-cell--right">
                Avg
              </th>
              <th className="portfolio-table__header-cell portfolio-table__header-cell--right">
                LTP
              </th>
              <th 
                className="portfolio-table__header-cell portfolio-table__header-cell--right portfolio-table__header-cell--sortable"
                onClick={() => onSort('currentValue')}
              >
                Current Value {getSortIcon('currentValue')}
              </th>
              <th 
                className="portfolio-table__header-cell portfolio-table__header-cell--right portfolio-table__header-cell--sortable"
                onClick={() => onSort('pnl')}
              >
                P&L {getSortIcon('pnl')}
              </th>
              <th 
                className="portfolio-table__header-cell portfolio-table__header-cell--right portfolio-table__header-cell--sortable"
                onClick={() => onSort('dayChange')}
              >
                Day Change {getSortIcon('dayChange')}
              </th>
            </tr>
          </thead>
          <tbody className="portfolio-table__body">
            {items.map((item, index) => (
              <tr key={`${item.symbol}-${index}`} className="portfolio-table__row">
                <td className="portfolio-table__cell">
                  <div className="portfolio-table__instrument">
                    <span className="portfolio-table__instrument-icon">
                      {getItemIcon(item)}
                    </span>
                    <div className="portfolio-table__instrument-info">
                      <div className="portfolio-table__instrument-symbol">
                        {item.symbol}
                      </div>
                      <div className="portfolio-table__instrument-meta">
                        {getItemTypeLabel(item)} • {item.exchange}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="portfolio-table__cell portfolio-table__cell--right portfolio-table__cell--mono">
                  {formatNumber(item.qty, 0)}
                </td>
                <td className="portfolio-table__cell portfolio-table__cell--right portfolio-table__cell--mono">
                  ₹{formatNumber(item.avgPrice)}
                </td>
                <td className="portfolio-table__cell portfolio-table__cell--right portfolio-table__cell--mono">
                  ₹{formatNumber(item.ltp)}
                </td>
                <td className="portfolio-table__cell portfolio-table__cell--right portfolio-table__cell--mono portfolio-table__cell--bold">
                  {formatCurrency(item.currentValue)}
                </td>
                <td className="portfolio-table__cell portfolio-table__cell--right portfolio-table__cell--mono portfolio-table__cell--bold">
                  <div className={
                    item.pnl > 0 ? 'pnl-positive' : item.pnl < 0 ? 'pnl-negative' : 'pnl-neutral'
                  }>
                    {item.pnl >= 0 ? '+' : ''}{formatCurrency(item.pnl)}
                    <div className="portfolio-table__cell-sub">
                      ({item.pnlPercent >= 0 ? '+' : ''}{formatNumber(item.pnlPercent)}%)
                    </div>
                  </div>
                </td>
                <td className="portfolio-table__cell portfolio-table__cell--right portfolio-table__cell--mono">
                  <div className={
                    item.dayChange > 0 ? 'pnl-positive' : item.dayChange < 0 ? 'pnl-negative' : 'pnl-neutral'
                  }>
                    {item.dayChange >= 0 ? '+' : ''}{formatCurrency(item.dayChange)}
                    <div className="portfolio-table__cell-sub">
                      ({item.dayChangePercent >= 0 ? '+' : ''}{formatNumber(item.dayChangePercent)}%)
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PortfolioTable;
