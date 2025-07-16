import React from 'react';
import { useFormValidation, commonValidationRules } from '../hooks/useFormValidation';
import { Input, Button, Select, Grid, Stack } from './ui';

interface AdvancedOrderFormData {
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: string;
  price: string;
  stop_loss: string;
  take_profit: string;
  iceberg_quantity: string;
  trigger_price: string;
  trail_amount: string;
  trail_percent: string;
  exchange: string;
  product_type: string;
  validity: 'DAY' | 'IOC' | 'GTD';
}

interface AdvancedOrderFormProps {
  orderType: 'bracket' | 'iceberg' | 'trailing-stop';
  onSubmit: (formData: AdvancedOrderFormData) => Promise<void>;
  loading?: boolean;
  onReset?: () => void;
}

const AdvancedOrderForm: React.FC<AdvancedOrderFormProps> = ({
  orderType,
  onSubmit,
  loading = false,
  onReset
}) => {
  const getValidationRules = () => {
    const baseRules = {
      symbol: commonValidationRules.symbol,
      quantity: commonValidationRules.quantity,
      exchange: { required: true },
      product_type: { required: true },
      validity: { required: true }
    };

    switch (orderType) {
      case 'bracket':
        return {
          ...baseRules,
          price: {
            ...commonValidationRules.price,
            custom: (value: string) => {
              if (!value || parseFloat(value) <= 0) {
                return 'Entry price is required for bracket orders';
              }
              return null;
            }
          },
          stop_loss: {
            ...commonValidationRules.price,
            custom: (value: string) => {
              if (!value || parseFloat(value) <= 0) {
                return 'Stop loss price is required for bracket orders';
              }
              const price = parseFloat(values.price);
              const stopLoss = parseFloat(value);
              if (price && stopLoss) {
                if (values.action === 'BUY' && stopLoss >= price) {
                  return 'Stop loss must be below entry price for BUY orders';
                }
                if (values.action === 'SELL' && stopLoss <= price) {
                  return 'Stop loss must be above entry price for SELL orders';
                }
              }
              return null;
            }
          },
          take_profit: {
            ...commonValidationRules.price,
            custom: (value: string) => {
              if (!value || parseFloat(value) <= 0) {
                return 'Take profit price is required for bracket orders';
              }
              const price = parseFloat(values.price);
              const takeProfit = parseFloat(value);
              if (price && takeProfit) {
                if (values.action === 'BUY' && takeProfit <= price) {
                  return 'Take profit must be above entry price for BUY orders';
                }
                if (values.action === 'SELL' && takeProfit >= price) {
                  return 'Take profit must be below entry price for SELL orders';
                }
              }
              return null;
            }
          }
        };

      case 'iceberg':
        return {
          ...baseRules,
          price: {
            ...commonValidationRules.price,
            custom: (value: string) => {
              if (!value || parseFloat(value) <= 0) {
                return 'Price is required for iceberg orders';
              }
              return null;
            }
          },
          iceberg_quantity: {
            ...commonValidationRules.quantity,
            custom: (value: string) => {
              if (!value || parseInt(value) <= 0) {
                return 'Iceberg quantity is required for iceberg orders';
              }
              const totalQty = parseInt(values.quantity);
              const icebergQty = parseInt(value);
              if (totalQty && icebergQty && icebergQty >= totalQty) {
                return 'Iceberg quantity must be less than total quantity';
              }
              if (icebergQty && icebergQty < 1) {
                return 'Iceberg quantity must be at least 1';
              }
              return null;
            }
          }
        };

      case 'trailing-stop':
        return {
          ...baseRules,
          trigger_price: {
            ...commonValidationRules.price,
            custom: (value: string) => {
              if (!value || parseFloat(value) <= 0) {
                return 'Trigger price is required for trailing stop orders';
              }
              return null;
            }
          },
          trail_amount: {
            min: 0.01,
            custom: (value: string) => {
              const hasTrailAmount = value && parseFloat(value) > 0;
              const hasTrailPercent = values.trail_percent && parseFloat(values.trail_percent) > 0;
              
              if (!hasTrailAmount && !hasTrailPercent) {
                return 'Either trail amount or trail percent is required';
              }
              if (hasTrailAmount && hasTrailPercent) {
                return 'Please specify either trail amount OR trail percent, not both';
              }
              return null;
            }
          },
          trail_percent: {
            min: 0.1,
            max: 100,
            custom: (value: string) => {
              const hasTrailAmount = values.trail_amount && parseFloat(values.trail_amount) > 0;
              const hasTrailPercent = value && parseFloat(value) > 0;
              
              if (!hasTrailAmount && !hasTrailPercent) {
                return 'Either trail amount or trail percent is required';
              }
              if (hasTrailAmount && hasTrailPercent) {
                return 'Please specify either trail amount OR trail percent, not both';
              }
              return null;
            }
          }
        };

      default:
        return baseRules;
    }
  };

  const {
    values,
    errors,
    touched,
    isSubmitting,
    handleChange,
    handleBlur,
    handleSubmit,
    reset
  } = useFormValidation<AdvancedOrderFormData>(
    {
      symbol: '',
      action: 'BUY',
      quantity: '',
      price: '',
      stop_loss: '',
      take_profit: '',
      iceberg_quantity: '',
      trigger_price: '',
      trail_amount: '',
      trail_percent: '',
      exchange: 'NSE',
      product_type: 'C',
      validity: 'DAY'
    },
    getValidationRules(),
    { validateOnChange: true, validateOnBlur: true, debounceMs: 500 }
  );

  const handleFormSubmit = async (formData: AdvancedOrderFormData) => {
    try {
      await onSubmit(formData);
      reset(); // Reset form on successful submission
    } catch (error) {
      // Error handling is done in parent component
      throw error;
    }
  };

  const handleReset = () => {
    reset();
    onReset?.();
  };

  const getOrderTypeDisplayName = () => {
    switch (orderType) {
      case 'bracket':
        return 'Bracket Order';
      case 'iceberg':
        return 'Iceberg Order';
      case 'trailing-stop':
        return 'Trailing Stop Order';
      default:
        return 'Advanced Order';
    }
  };

  return (
    <Stack gap={6}>
      {/* Common Fields */}
      <Grid cols={3} gap={4}>
        <Input
          label="Symbol"
          value={values.symbol}
          onChange={(e) => handleChange('symbol', e.target.value)}
          onBlur={() => handleBlur('symbol')}
          placeholder="e.g., RELIANCE"
          state={errors.symbol ? 'error' : 'default'}
          error={touched.symbol ? errors.symbol : ''}
          required
          fullWidth
        />

        <Select
          label="Action"
          value={values.action}
          onChange={(e) => handleChange('action', e.target.value)}
          state={errors.action ? 'error' : 'default'}
          error={touched.action ? errors.action : ''}
          required
          fullWidth
        >
          <option value="BUY">BUY</option>
          <option value="SELL">SELL</option>
        </Select>

        <Input
          label="Quantity"
          type="number"
          value={values.quantity}
          onChange={(e) => handleChange('quantity', e.target.value)}
          onBlur={() => handleBlur('quantity')}
          placeholder="100"
          state={errors.quantity ? 'error' : 'default'}
          error={touched.quantity ? errors.quantity : ''}
          required
          fullWidth
        />
      </Grid>

      {/* Order Type Specific Fields */}
      {orderType === 'bracket' && (
        <Grid cols={3} gap={4}>
          <Input
            label="Entry Price"
            type="number"
            step="0.01"
            value={values.price}
            onChange={(e) => handleChange('price', e.target.value)}
            onBlur={() => handleBlur('price')}
            placeholder="2500.00"
            state={errors.price ? 'error' : 'default'}
            error={touched.price ? errors.price : ''}
            required
            fullWidth
          />

          <Input
            label="Stop Loss"
            type="number"
            step="0.01"
            value={values.stop_loss}
            onChange={(e) => handleChange('stop_loss', e.target.value)}
            onBlur={() => handleBlur('stop_loss')}
            placeholder="2450.00"
            state={errors.stop_loss ? 'error' : 'default'}
            error={touched.stop_loss ? errors.stop_loss : ''}
            helperText={values.action === 'BUY' ? 'Must be below entry price' : 'Must be above entry price'}
            required
            fullWidth
          />

          <Input
            label="Take Profit"
            type="number"
            step="0.01"
            value={values.take_profit}
            onChange={(e) => handleChange('take_profit', e.target.value)}
            onBlur={() => handleBlur('take_profit')}
            placeholder="2600.00"
            state={errors.take_profit ? 'error' : 'default'}
            error={touched.take_profit ? errors.take_profit : ''}
            helperText={values.action === 'BUY' ? 'Must be above entry price' : 'Must be below entry price'}
            required
            fullWidth
          />
        </Grid>
      )}

      {orderType === 'iceberg' && (
        <Grid cols={2} gap={4}>
          <Input
            label="Price"
            type="number"
            step="0.01"
            value={values.price}
            onChange={(e) => handleChange('price', e.target.value)}
            onBlur={() => handleBlur('price')}
            placeholder="2500.00"
            state={errors.price ? 'error' : 'default'}
            error={touched.price ? errors.price : ''}
            required
            fullWidth
          />

          <Input
            label="Iceberg Quantity"
            type="number"
            value={values.iceberg_quantity}
            onChange={(e) => handleChange('iceberg_quantity', e.target.value)}
            onBlur={() => handleBlur('iceberg_quantity')}
            placeholder="10"
            state={errors.iceberg_quantity ? 'error' : 'default'}
            error={touched.iceberg_quantity ? errors.iceberg_quantity : ''}
            helperText="Quantity to show in order book at a time"
            required
            fullWidth
          />
        </Grid>
      )}

      {orderType === 'trailing-stop' && (
        <Grid cols={3} gap={4}>
          <Input
            label="Trigger Price"
            type="number"
            step="0.01"
            value={values.trigger_price}
            onChange={(e) => handleChange('trigger_price', e.target.value)}
            onBlur={() => handleBlur('trigger_price')}
            placeholder="2500.00"
            state={errors.trigger_price ? 'error' : 'default'}
            error={touched.trigger_price ? errors.trigger_price : ''}
            required
            fullWidth
          />

          <Input
            label="Trail Amount"
            type="number"
            step="0.01"
            value={values.trail_amount}
            onChange={(e) => handleChange('trail_amount', e.target.value)}
            onBlur={() => handleBlur('trail_amount')}
            placeholder="50.00"
            state={errors.trail_amount ? 'error' : 'default'}
            error={touched.trail_amount ? errors.trail_amount : ''}
            helperText="Fixed amount to trail (₹)"
            fullWidth
          />

          <Input
            label="Trail Percent"
            type="number"
            step="0.1"
            value={values.trail_percent}
            onChange={(e) => handleChange('trail_percent', e.target.value)}
            onBlur={() => handleBlur('trail_percent')}
            placeholder="2.0"
            state={errors.trail_percent ? 'error' : 'default'}
            error={touched.trail_percent ? errors.trail_percent : ''}
            helperText="Percentage to trail (%)"
            fullWidth
          />
        </Grid>
      )}

      {/* Additional Settings */}
      <Grid cols={3} gap={4}>
        <Select
          label="Exchange"
          value={values.exchange}
          onChange={(e) => handleChange('exchange', e.target.value)}
          state={errors.exchange ? 'error' : 'default'}
          error={touched.exchange ? errors.exchange : ''}
          required
          fullWidth
        >
          <option value="NSE">NSE</option>
          <option value="BSE">BSE</option>
        </Select>

        <Select
          label="Product Type"
          value={values.product_type}
          onChange={(e) => handleChange('product_type', e.target.value)}
          state={errors.product_type ? 'error' : 'default'}
          error={touched.product_type ? errors.product_type : ''}
          required
          fullWidth
        >
          <option value="C">Cash & Carry</option>
          <option value="M">Margin</option>
          <option value="I">Intraday</option>
        </Select>

        <Select
          label="Validity"
          value={values.validity}
          onChange={(e) => handleChange('validity', e.target.value)}
          state={errors.validity ? 'error' : 'default'}
          error={touched.validity ? errors.validity : ''}
          required
          fullWidth
        >
          <option value="DAY">Day</option>
          <option value="IOC">Immediate or Cancel</option>
          <option value="GTD">Good Till Date</option>
        </Select>
      </Grid>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
        <Button
          variant="outline"
          onClick={handleReset}
          disabled={isSubmitting || loading}
        >
          Reset
        </Button>
        
        <Button
          variant="primary"
          onClick={() => handleSubmit(handleFormSubmit)}
          disabled={isSubmitting || loading}
          loading={isSubmitting || loading}
        >
          {isSubmitting || loading 
            ? 'Creating...' 
            : `Create ${getOrderTypeDisplayName()}`
          }
        </Button>
      </div>
    </Stack>
  );
};

export default AdvancedOrderForm;