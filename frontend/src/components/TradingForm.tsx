import React from 'react';
import { useFormValidation, commonValidationRules } from '../hooks/useFormValidation';
import { Input, Button, Select } from './ui';
import { Checkbox } from './ui/Checkbox';
import type { ConnectedAccount } from '../services/accountService';
import { brokerService } from '../services/brokerService';

interface TradingFormData {
  symbol: string;
  quantity: string;
  price: string;
  triggerPrice: string;
}

interface TradingFormProps {
  connectedAccounts: ConnectedAccount[];
  onSubmit?: (formData: TradingFormData & {
    exchange: 'NSE' | 'BSE';
    action: 'BUY' | 'SELL';
    orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
    product: 'CNC' | 'MIS' | 'NRML';
    validity: 'DAY' | 'IOC';
    selectedAccounts: string[];
  }) => Promise<void>;
  onOrderResult?: (result: {
    success: boolean;
    message: string;
    data?: any;
  }) => void;
  loading?: boolean;
  searchResults?: any[];
  showSearchResults?: boolean;
  searchLoading?: boolean;
  onSymbolSearch?: (searchTerm: string) => void;
  onSymbolSelect?: (symbol: any) => void;
}

const TradingForm: React.FC<TradingFormProps> = ({
  connectedAccounts,
  onSubmit,
  onOrderResult,
  loading = false,
  searchResults = [],
  showSearchResults = false,
  searchLoading = false,
  onSymbolSearch,
  onSymbolSelect
}) => {
  const [exchange, setExchange] = React.useState<'NSE' | 'BSE'>('NSE');
  const [action, setAction] = React.useState<'BUY' | 'SELL'>('BUY');
  const [orderType, setOrderType] = React.useState<'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET'>('MARKET');
  const [product, setProduct] = React.useState<'CNC' | 'MIS' | 'NRML'>('CNC');
  const [validity, setValidity] = React.useState<'DAY' | 'IOC'>('DAY');
  const [selectedAccounts, setSelectedAccounts] = React.useState<string[]>([]);

  // Initialize selected accounts when connectedAccounts change
  React.useEffect(() => {
    if (connectedAccounts.length > 0 && selectedAccounts.length === 0) {
      setSelectedAccounts(connectedAccounts.map(account => account.id));
    }
  }, [connectedAccounts, selectedAccounts.length]);

  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset,
    setFieldError
  } = useFormValidation<TradingFormData>(
    {
      symbol: '',
      quantity: '',
      price: '',
      triggerPrice: ''
    },
    {
      symbol: commonValidationRules.symbol,
      quantity: commonValidationRules.quantity,
      price: {
        ...commonValidationRules.price,
        custom: (value: string) => {
          if (orderType !== 'MARKET' && (!value || parseFloat(value) <= 0)) {
            return 'Price is required for limit orders';
          }
          return null;
        }
      },
      triggerPrice: {
        ...commonValidationRules.price,
        custom: (value: string) => {
          if ((orderType === 'SL-LIMIT' || orderType === 'SL-MARKET') && (!value || parseFloat(value) <= 0)) {
            return 'Trigger price is required for stop loss orders';
          }
          return null;
        }
      }
    },
    { validateOnChange: true, validateOnBlur: true, debounceMs: 300 }
  );

  const handleAccountSelection = (accountId: string, checked: boolean) => {
    setSelectedAccounts(prev =>
      checked
        ? [...prev, accountId]
        : prev.filter(id => id !== accountId)
    );
  };

  const handleSelectAllAccounts = () => {
    const allSelected = selectedAccounts.length === connectedAccounts.length;
    setSelectedAccounts(allSelected ? [] : connectedAccounts.map(account => account.id));
  };

  const handleFormSubmit = async (formData: TradingFormData) => {
    // Validate account selection
    if (selectedAccounts.length === 0) {
      setFieldError('symbol', 'Please select at least one account to place orders');
      return;
    }

    try {
      // Use the new multi-account order placement service
      const orderRequest = {
        selectedAccounts,
        symbol: formData.symbol,
        action,
        quantity: parseInt(formData.quantity),
        orderType,
        price: formData.price ? parseFloat(formData.price) : undefined,
        triggerPrice: formData.triggerPrice ? parseFloat(formData.triggerPrice) : undefined,
        exchange,
        productType: product,
        remarks: `Multi-account order placed via CopyTrade Pro`
      };

      const result = await brokerService.placeMultiAccountOrder(orderRequest);
      
      // Notify parent component of the result
      onOrderResult?.(result);

      // If using legacy onSubmit prop, call it as well
      if (onSubmit) {
        await onSubmit({
          ...formData,
          exchange,
          action,
          orderType,
          product,
          validity,
          selectedAccounts
        });
      }
      
      // Reset form on successful submission
      if (result.success) {
        reset();
        setSelectedAccounts(connectedAccounts.map(account => account.id));
      }
    } catch (error) {
      // Notify parent component of the error
      onOrderResult?.({
        success: false,
        message: error instanceof Error ? error.message : 'An unexpected error occurred'
      });
      
      // If using legacy onSubmit prop, re-throw the error
      if (onSubmit) {
        throw error;
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '0.5rem' }}>
        <Button
          variant={action === 'BUY' ? 'primary' : 'outline'}
          onClick={() => setAction('BUY')}
          style={{
            backgroundColor: action === 'BUY' ? '#10b981' : undefined,
            color: action === 'BUY' ? 'white' : undefined
          }}
        >
          BUY
        </Button>
        <Button
          variant={action === 'SELL' ? 'primary' : 'outline'}
          onClick={() => setAction('SELL')}
          style={{
            backgroundColor: action === 'SELL' ? '#ef4444' : undefined,
            color: action === 'SELL' ? 'white' : undefined
          }}
        >
          SELL
        </Button>
      </div>

      {/* Symbol Search */}
      <div style={{ position: 'relative' }}>
        <Input
          label="Symbol"
          value={values.symbol}
          onChange={(e) => {
            handleChange('symbol', e.target.value);
            onSymbolSearch?.(e.target.value);
          }}
          onBlur={() => handleBlur('symbol')}
          placeholder="Search stocks (e.g., RELIANCE, TCS)"
          state={errors.symbol ? 'error' : 'default'}
          error={touched.symbol ? errors.symbol : ''}
          rightIcon={searchLoading ? '⏳' : undefined}
          required
          fullWidth
        />

        {/* Search Results Dropdown */}
        {showSearchResults && searchResults.length > 0 && (
          <div style={{
            position: 'absolute',
            top: '100%',
            left: 0,
            right: 0,
            backgroundColor: 'white',
            border: '1px solid #cbd5e1',
            borderRadius: '0.5rem',
            zIndex: 1000,
            maxHeight: '200px',
            overflowY: 'auto',
            boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
          }}>
            {searchResults.map((result, index) => (
              <div
                key={index}
                onClick={() => {
                  onSymbolSelect?.(result);
                  handleChange('symbol', result.symbol);
                }}
                style={{
                  padding: '0.75rem',
                  cursor: 'pointer',
                  borderBottom: index < searchResults.length - 1 ? '1px solid #e2e8f0' : 'none'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#f8fafc'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <div style={{ fontWeight: '500' }}>{result.symbol}</div>
                <div style={{ fontSize: '0.875rem', color: '#64748b' }}>{result.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quantity and Price */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Input
          label="Quantity"
          type="number"
          value={values.quantity}
          onChange={(e) => handleChange('quantity', e.target.value)}
          onBlur={() => handleBlur('quantity')}
          placeholder="0"
          state={errors.quantity ? 'error' : 'default'}
          error={touched.quantity ? errors.quantity : ''}
          required
          fullWidth
        />

        <Input
          label={`Price ${orderType === 'MARKET' ? '(Market)' : ''}`}
          type="number"
          step="0.05"
          value={values.price}
          onChange={(e) => handleChange('price', e.target.value)}
          onBlur={() => handleBlur('price')}
          placeholder="0.00"
          disabled={orderType === 'MARKET'}
          state={errors.price ? 'error' : 'default'}
          error={touched.price ? errors.price : ''}
          required={orderType !== 'MARKET'}
          fullWidth
        />
      </div>

      {/* Order Type and Product */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Select
          label="Order Type"
          value={orderType}
          onChange={(e) => setOrderType(e.target.value as any)}
          fullWidth
        >
          <option value="MARKET">Market</option>
          <option value="LIMIT">Limit</option>
          <option value="SL-LIMIT">Stop Loss Limit</option>
          <option value="SL-MARKET">Stop Loss Market</option>
        </Select>

        <Select
          label="Product"
          value={product}
          onChange={(e) => setProduct(e.target.value as any)}
          fullWidth
        >
          <option value="CNC">CNC (Delivery)</option>
          <option value="MIS">MIS (Intraday)</option>
          <option value="NRML">NRML (Normal)</option>
        </Select>
      </div>

      {/* Trigger Price for Stop Loss Orders */}
      {(orderType === 'SL-LIMIT' || orderType === 'SL-MARKET') && (
        <Input
          label="Trigger Price"
          type="number"
          step="0.05"
          value={values.triggerPrice}
          onChange={(e) => handleChange('triggerPrice', e.target.value)}
          onBlur={() => handleBlur('triggerPrice')}
          placeholder="0.00"
          state={errors.triggerPrice ? 'error' : 'default'}
          error={touched.triggerPrice ? errors.triggerPrice : ''}
          required
          fullWidth
        />
      )}

      {/* Exchange and Validity */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        <Select
          label="Exchange"
          value={exchange}
          onChange={(e) => setExchange(e.target.value as any)}
          fullWidth
        >
          <option value="NSE">NSE</option>
          <option value="BSE">BSE</option>
        </Select>

        <Select
          label="Validity"
          value={validity}
          onChange={(e) => setValidity(e.target.value as any)}
          fullWidth
        >
          <option value="DAY">Day</option>
          <option value="IOC">Immediate or Cancel</option>
        </Select>
      </div>

      {/* Account Selection */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
          <label style={{ fontSize: '0.875rem', fontWeight: '500' }}>
            Select Trading Accounts ({selectedAccounts.length} selected)
          </label>
          {connectedAccounts.length > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSelectAllAccounts}
            >
              {selectedAccounts.length === connectedAccounts.length ? 'Deselect All' : 'Select All'}
            </Button>
          )}
        </div>

        <div style={{
          border: '1px solid #cbd5e1',
          borderRadius: '0.5rem',
          padding: '1rem',
          backgroundColor: '#f8fafc',
          maxHeight: '300px',
          overflowY: 'auto'
        }}>
          {connectedAccounts.length === 0 ? (
            <div style={{
              color: '#64748b',
              fontSize: '0.875rem',
              textAlign: 'center',
              padding: '1rem'
            }}>
              No active accounts found. Please activate at least one broker account.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {connectedAccounts.map(account => (
                <div
                  key={account.id}
                  style={{
                    padding: '0.75rem',
                    border: selectedAccounts.includes(account.id)
                      ? '2px solid #3b82f6'
                      : '1px solid #e2e8f0',
                    borderRadius: '0.375rem',
                    backgroundColor: selectedAccounts.includes(account.id)
                      ? '#eff6ff'
                      : 'white',
                    transition: 'all 0.2s ease'
                  }}
                >
                  <Checkbox
                    checked={selectedAccounts.includes(account.id)}
                    onChange={(checked) => handleAccountSelection(account.id, checked)}
                    label={`${account.brokerName || 'Unknown Broker'} (${account.isActive ? 'Active' : 'Inactive'})`}
                    size="base"
                  />
                  <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.25rem' }}>
                    Account: {account.accountId || 'N/A'} | User: {account.userName || 'N/A'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {selectedAccounts.length === 0 && (
          <div style={{
            fontSize: '0.75rem',
            color: '#ef4444',
            marginTop: '0.25rem'
          }}>
            Please select at least one account to place orders
          </div>
        )}
      </div>

      {/* Submit Button */}
      <Button
        variant="primary"
        size="lg"
        onClick={() => handleSubmit(handleFormSubmit)}
        disabled={isSubmitting || loading || !values.symbol || !values.quantity || selectedAccounts.length === 0}
        loading={isSubmitting || loading}
        fullWidth
      >
        {isSubmitting || loading
          ? `Placing Orders on ${selectedAccounts.length} Account${selectedAccounts.length > 1 ? 's' : ''}...`
          : `${action} ${values.symbol || 'Stock'} on ${selectedAccounts.length} Account${selectedAccounts.length > 1 ? 's' : ''}`
        }
      </Button>
    </div>
  );
};

export default TradingForm;