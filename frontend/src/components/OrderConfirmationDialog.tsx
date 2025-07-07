import React from 'react';
import './OrderConfirmationDialog.css';
import { Button, HStack } from './ui';

interface OrderConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  orderDetails: {
    symbol: string;
    action: 'BUY' | 'SELL';
    quantity: number;
    orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
    price?: number;
    triggerPrice?: number;
    exchange: string;
    productType: string;
    selectedAccounts: Array<{
      id: string;
      brokerDisplayName: string;
      brokerName: string;
    }>;
  };
  isSubmitting?: boolean;
}

const OrderConfirmationDialog: React.FC<OrderConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  orderDetails,
  isSubmitting = false,
}) => {
  if (!isOpen) return null;

  const {
    symbol,
    action,
    quantity,
    orderType,
    price,
    triggerPrice,
    exchange,
    productType,
    selectedAccounts,
  } = orderDetails;

  // Calculate estimated order value
  const estimatedValue = orderType === 'MARKET'
    ? 'Market Price'
    : price
      ? (price * quantity).toLocaleString('en-IN', { style: 'currency', currency: 'INR' })
      : 'N/A';

  // Handle escape key to close dialog
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden'; // Prevent background scrolling
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, isSubmitting, onClose]);

  // Risk warnings based on order type and action
  const getRiskWarnings = () => {
    const warnings = [];
    
    if (orderType === 'MARKET') {
      warnings.push('Market orders execute immediately at current market price');
      warnings.push('Final execution price may differ from displayed price');
    }
    
    if (action === 'SELL') {
      warnings.push('Ensure you have sufficient holdings before selling');
    }
    
    if (quantity > 100) {
      warnings.push('Large quantity order - consider market impact');
    }
    
    if (selectedAccounts.length > 1) {
      warnings.push(`Order will be placed across ${selectedAccounts.length} accounts`);
    }

    return warnings;
  };

  const riskWarnings = getRiskWarnings();

  return (
    <div className="dialog-overlay" onClick={onClose}>
      <div className="dialog-content" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h3>Confirm Order</h3>
          <button 
            type="button" 
            className="dialog-close" 
            onClick={onClose}
            disabled={isSubmitting}
          >
            ×
          </button>
        </div>

        <div className="dialog-body">
          {/* Order Summary */}
          <div className="order-summary">
            <h4>Order Summary</h4>
            <div className="summary-grid">
              <div className="summary-item">
                <span className="label">Symbol:</span>
                <span className="value symbol-value">{symbol}</span>
              </div>
              <div className="summary-item">
                <span className="label">Action:</span>
                <span className={`value action-badge ${action.toLowerCase()}`}>
                  {action}
                </span>
              </div>
              <div className="summary-item">
                <span className="label">Quantity:</span>
                <span className="value">{quantity.toLocaleString()}</span>
              </div>
              <div className="summary-item">
                <span className="label">Order Type:</span>
                <span className="value">{orderType}</span>
              </div>
              {price && (
                <div className="summary-item">
                  <span className="label">Price:</span>
                  <span className="value">₹{price.toLocaleString()}</span>
                </div>
              )}
              {triggerPrice && (
                <div className="summary-item">
                  <span className="label">Trigger Price:</span>
                  <span className="value">₹{triggerPrice.toLocaleString()}</span>
                </div>
              )}
              <div className="summary-item">
                <span className="label">Exchange:</span>
                <span className="value">{exchange}</span>
              </div>
              <div className="summary-item">
                <span className="label">Product:</span>
                <span className="value">{productType}</span>
              </div>
              <div className="summary-item">
                <span className="label">Estimated Value:</span>
                <span className="value estimated-value">{estimatedValue}</span>
              </div>
            </div>
          </div>

          {/* Selected Accounts */}
          <div className="selected-accounts">
            <h4>Selected Accounts ({selectedAccounts.length})</h4>
            <div className="accounts-list">
              {selectedAccounts.map((account) => (
                <div key={account.id} className="account-item">
                  <span className="account-name">{account.brokerDisplayName}</span>
                  <span className="broker-badge">{account.brokerName}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Risk Warnings */}
          {riskWarnings.length > 0 && (
            <div className="risk-warnings">
              <h4>⚠️ Important Notices</h4>
              <ul>
                {riskWarnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Disclaimer */}
          <div className="disclaimer">
            <p>
              <strong>Disclaimer:</strong> Trading involves risk. Please ensure you understand
              the risks involved and trade responsibly. Orders once submitted cannot be undone.
            </p>
          </div>
        </div>

        <div className="dialog-footer">
          <HStack gap={3}>
            <Button
              variant="secondary"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onConfirm}
              disabled={isSubmitting}
              loading={isSubmitting}
            >
              {isSubmitting ? 'Submitting Order...' : 'Confirm & Submit Order'}
            </Button>
          </HStack>
        </div>
      </div>
    </div>
  );
};

export default OrderConfirmationDialog;
