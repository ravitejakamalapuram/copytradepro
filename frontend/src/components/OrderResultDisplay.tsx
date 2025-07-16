import React from 'react';
import Card from './ui/Card';
import Badge from './ui/Badge';
import Button from './ui/Button';
import { getUserFriendlyError } from '../utils/errorMessages';
import './OrderResultDisplay.css';

export interface OrderResult {
  accountId: string;
  brokerName: string;
  brokerDisplayName: string;
  success: boolean;
  orderId?: string;
  brokerOrderId?: string;
  error?: string;
  errorCode?: string;
  errorType?: string;
  message?: string;
  suggestion?: string;
  retryable?: boolean;
}

export interface OrderResultSummary {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  price?: number;
  triggerPrice?: number;
  exchange: string;
  productType: string;
  totalAccounts: number;
  successfulAccounts: number;
  failedAccounts: number;
  results: OrderResult[];
  timestamp: Date;
}

interface OrderResultDisplayProps {
  summary: OrderResultSummary;
  onClose?: () => void;
  onRetryFailed?: (failedResults: OrderResult[]) => void;
  showRetryOption?: boolean;
  className?: string;
}

const OrderResultDisplay: React.FC<OrderResultDisplayProps> = ({
  summary,
  onClose,
  onRetryFailed,
  showRetryOption = true,
  className = '',
}) => {
  const {
    symbol,
    action,
    quantity,
    orderType,
    price,
    triggerPrice,
    exchange,
    productType,
    totalAccounts,
    successfulAccounts,
    failedAccounts,
    results,
    timestamp,
  } = summary;

  const successRate = totalAccounts > 0 ? (successfulAccounts / totalAccounts) * 100 : 0;
  const failedResults = results.filter(result => !result.success);
  const successfulResults = results.filter(result => result.success);

  const getOverallStatus = () => {
    if (successfulAccounts === totalAccounts) return 'success';
    if (successfulAccounts === 0) return 'error';
    return 'warning';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return '✅';
      case 'error': return '❌';
      case 'warning': return '⚠️';
      default: return '❓';
    }
  };

  const getStatusMessage = () => {
    if (successfulAccounts === totalAccounts) {
      return `All ${totalAccounts} orders placed successfully!`;
    }
    if (successfulAccounts === 0) {
      return `All ${totalAccounts} orders failed to place.`;
    }
    return `${successfulAccounts} of ${totalAccounts} orders placed successfully.`;
  };

  const formatPrice = (value?: number) => {
    return value ? `₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}` : 'N/A';
  };

  const formatTimestamp = (date: Date) => {
    return date.toLocaleString('en-IN', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const handleRetryFailed = () => {
    if (onRetryFailed && failedResults.length > 0) {
      onRetryFailed(failedResults);
    }
  };

  return (
    <div className={`order-result-display ${className}`}>
      <Card className="order-result-card">
        {/* Header */}
        <div className="order-result-header">
          <div className="order-result-title">
            <span className="status-icon">
              {getStatusIcon(getOverallStatus())}
            </span>
            <h3>Order Placement Results</h3>
            {onClose && (
              <button 
                className="close-button"
                onClick={onClose}
                aria-label="Close results"
              >
                ×
              </button>
            )}
          </div>
          <div className="order-result-timestamp">
            {formatTimestamp(timestamp)}
          </div>
        </div>

        {/* Summary */}
        <div className="order-result-summary">
          <div className="summary-message">
            <h4>{getStatusMessage()}</h4>
            <div className="success-rate">
              Success Rate: {successRate.toFixed(1)}%
            </div>
          </div>

          <div className="summary-stats">
            <div className="stat-item">
              <span className="stat-label">Total</span>
              <span className="stat-value">{totalAccounts}</span>
            </div>
            <div className="stat-item success">
              <span className="stat-label">Success</span>
              <span className="stat-value">{successfulAccounts}</span>
            </div>
            <div className="stat-item error">
              <span className="stat-label">Failed</span>
              <span className="stat-value">{failedAccounts}</span>
            </div>
          </div>
        </div>

        {/* Order Details */}
        <div className="order-details">
          <h4>Order Details</h4>
          <div className="details-grid">
            <div className="detail-item">
              <span className="detail-label">Symbol:</span>
              <span className="detail-value symbol">{symbol}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Action:</span>
              <Badge variant={action === 'BUY' ? 'success' : 'error'}>
                {action}
              </Badge>
            </div>
            <div className="detail-item">
              <span className="detail-label">Quantity:</span>
              <span className="detail-value">{quantity.toLocaleString()}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Order Type:</span>
              <span className="detail-value">{orderType}</span>
            </div>
            {price && (
              <div className="detail-item">
                <span className="detail-label">Price:</span>
                <span className="detail-value">{formatPrice(price)}</span>
              </div>
            )}
            {triggerPrice && (
              <div className="detail-item">
                <span className="detail-label">Trigger Price:</span>
                <span className="detail-value">{formatPrice(triggerPrice)}</span>
              </div>
            )}
            <div className="detail-item">
              <span className="detail-label">Exchange:</span>
              <span className="detail-value">{exchange}</span>
            </div>
            <div className="detail-item">
              <span className="detail-label">Product:</span>
              <span className="detail-value">{productType}</span>
            </div>
          </div>
        </div>

        {/* Successful Orders */}
        {successfulResults.length > 0 && (
          <div className="result-section">
            <h4 className="section-title success">
              ✅ Successful Orders ({successfulResults.length})
            </h4>
            <div className="result-list">
              {successfulResults.map((result, index) => (
                <div key={`success-${index}`} className="result-item success">
                  <div className="result-header">
                    <div className="account-info">
                      <span className="account-name">{result.brokerDisplayName}</span>
                      <Badge variant="default" size="sm">{result.brokerName}</Badge>
                    </div>
                    <div className="result-status">
                      <span className="status-icon">✅</span>
                      <span className="status-text">Success</span>
                    </div>
                  </div>
                  <div className="result-details">
                    {result.brokerOrderId && (
                      <div className="detail-row">
                        <span className="detail-label">Order ID:</span>
                        <span className="detail-value order-id">{result.brokerOrderId}</span>
                      </div>
                    )}
                    {result.message && (
                      <div className="detail-row">
                        <span className="detail-label">Message:</span>
                        <span className="detail-value">{result.message}</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Failed Orders */}
        {failedResults.length > 0 && (
          <div className="result-section">
            <h4 className="section-title error">
              ❌ Failed Orders ({failedResults.length})
            </h4>
            <div className="result-list">
              {failedResults.map((result, index) => {
                // Get user-friendly error information
                const friendlyError = getUserFriendlyError(result.error || result.message, 'trading');
                const suggestion = result.suggestion || friendlyError.suggestion;
                const isRetryable = result.retryable !== undefined ? result.retryable : friendlyError.retryable;
                
                return (
                  <div key={`failed-${index}`} className="result-item error">
                    <div className="result-header">
                      <div className="account-info">
                        <span className="account-name">{result.brokerDisplayName}</span>
                        <Badge variant="default" size="sm">{result.brokerName}</Badge>
                        {isRetryable && (
                          <Badge variant="info" size="sm">Retryable</Badge>
                        )}
                      </div>
                      <div className="result-status">
                        <span className="status-icon">❌</span>
                        <span className="status-text">Failed</span>
                      </div>
                    </div>
                    <div className="result-details">
                      <div className="detail-row">
                        <span className="detail-label">Error:</span>
                        <span className="detail-value error-message">
                          {friendlyError.title}: {friendlyError.message}
                        </span>
                      </div>
                      {result.errorCode && (
                        <div className="detail-row">
                          <span className="detail-label">Error Code:</span>
                          <span className="detail-value error-code">{result.errorCode}</span>
                        </div>
                      )}
                      {result.errorType && (
                        <div className="detail-row">
                          <span className="detail-label">Error Type:</span>
                          <span className="detail-value error-type">{result.errorType}</span>
                        </div>
                      )}
                      {suggestion && (
                        <div className="detail-row suggestion">
                          <span className="detail-label">💡 Suggestion:</span>
                          <span className="detail-value suggestion-text">{suggestion}</span>
                        </div>
                      )}
                      {result.message && result.message !== result.error && (
                        <div className="detail-row">
                          <span className="detail-label">Details:</span>
                          <span className="detail-value">{result.message}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="order-result-actions">
          {showRetryOption && failedResults.length > 0 && (
            <Button
              variant="outline"
              onClick={handleRetryFailed}
              className="retry-button"
            >
              🔄 Retry Failed Orders ({failedResults.length})
            </Button>
          )}
          {onClose && (
            <Button
              variant="primary"
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
};

export default OrderResultDisplay;