import React from 'react';
import { useFormValidation, commonValidationRules } from '../hooks/useFormValidation';
import { Input, Button, Select } from './ui';
import { Checkbox } from './ui/Checkbox';
import type { ConnectedAccount } from '../services/accountService';
import { brokerService } from '../services/brokerService';

type SearchResult = { symbol: string; name: string };

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
    data?: unknown;
  }) => void;
  loading?: boolean;
  searchResults?: SearchResult[];
  showSearchResults?: boolean;
  searchLoading?: boolean;
  onSymbolSearch?: (searchTerm: string) => void;
  onSymbolSelect?: (symbol: unknown) => void;
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
    <div className="trading-form-layout">
      {/* Action Buttons */}
      <div className="trading-action-btns">
        <Button
          className={`trading-action-btn ${action === 'BUY' ? 'trading-action-btn--buy' : ''}`}
          onClick={() => setAction('BUY')}
        >
          BUY
        </Button>
        <Button
          className={`trading-action-btn ${action === 'SELL' ? 'trading-action-btn--sell' : ''}`}
          onClick={() => setAction('SELL')}
        >
          SELL
        </Button>
      </div>

      {/* Symbol Search */}
      <div className="trading-symbol-search-container">
        <Input
          label="Symbol"
          value={values.symbol}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
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
          <div className="trading-search-results-dropdown">
            {searchResults.map((result: SearchResult, index) => (
              <div
                key={index}
                onClick={() => {
                  onSymbolSelect?.(result);
                  handleChange('symbol', result.symbol);
                }}
                className={`trading-search-result-item ${index < searchResults.length - 1 ? 'trading-search-result-item--divider' : ''}`}
                onMouseEnter={(e: React.MouseEvent) => e.currentTarget.classList.add('trading-search-result-item--hover')}
                onMouseLeave={(e: React.MouseEvent) => e.currentTarget.classList.remove('trading-search-result-item--hover')}
              >
                <div className="trading-search-result-item__symbol">{result.symbol}</div>
                <div className="trading-search-result-item__name">{result.name}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quantity and Price */}
      <div className="trading-quantity-price-grid">
        <Input
          label="Quantity"
          type="number"
          value={values.quantity}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('quantity', e.target.value)}
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
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('price', e.target.value)}
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
      <div className="trading-order-type-product-grid">
        <Select
          label="Order Type"
          value={orderType}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setOrderType(e.target.value as 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET')}
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
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setProduct(e.target.value as 'CNC' | 'MIS' | 'NRML')}
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
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('triggerPrice', e.target.value)}
          onBlur={() => handleBlur('triggerPrice')}
          placeholder="0.00"
          state={errors.triggerPrice ? 'error' : 'default'}
          error={touched.triggerPrice ? errors.triggerPrice : ''}
          required
          fullWidth
        />
      )}

      {/* Exchange and Validity */}
      <div className="trading-exchange-validity-grid">
        <Select
          label="Exchange"
          value={exchange}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setExchange(e.target.value as 'NSE' | 'BSE')}
          fullWidth
        >
          <option value="NSE">NSE</option>
          <option value="BSE">BSE</option>
        </Select>

        <Select
          label="Validity"
          value={validity}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setValidity(e.target.value as 'DAY' | 'IOC')}
          fullWidth
        >
          <option value="DAY">Day</option>
          <option value="IOC">Immediate or Cancel</option>
        </Select>
      </div>

      {/* Account Selection */}
      <div className="trading-account-selection-container">
        <div className="trading-account-selection-header">
          <label className="trading-account-selection-label">
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

        <div className="trading-account-list-container">
          {connectedAccounts.length === 0 ? (
            <div className="trading-account-list-empty">
              No active accounts found. Please activate at least one broker account.
            </div>
          ) : (
            <div className="trading-account-list">
              {connectedAccounts.map(account => (
                <div
                  key={account.id}
                  className={`trading-account-card ${selectedAccounts.includes(account.id) ? 'trading-account-card--selected' : ''}`}
                >
                  <Checkbox
                    checked={selectedAccounts.includes(account.id)}
                    onChange={(checked: boolean) => handleAccountSelection(account.id, checked)}
                  />
                  <div className="trading-account-card__details">
                    <div className="trading-account-card__name">{account.brokerName}</div>
                    <div className="trading-account-card__id">{account.id}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <Button
        onClick={() => { void handleSubmit(handleFormSubmit); }}
        loading={isSubmitting}
        fullWidth
      >
        {loading ? 'Placing Order...' : 'Place Order'}
      </Button>
    </div>
  );
};

export default TradingForm;