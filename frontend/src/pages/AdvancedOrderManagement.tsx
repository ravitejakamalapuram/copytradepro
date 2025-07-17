import React, { useState, useEffect } from 'react';
import Navigation from '../components/Navigation';
import {
  Container,
  PageHeader,
  Card,
  CardHeader,
  CardContent,
  Button,
  Flex,
  Stack,
  Grid,
  Select,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHeaderCell,
  TableCell,
  StatusBadge,
  Input
} from '../components/ui';
import { advancedOrderService, type OrderTemplate, type AdvancedOrder } from '../services/advancedOrderService';
import { useFormValidation, commonValidationRules } from '../hooks/useFormValidation';

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

const AdvancedOrderManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'templates' | 'advanced-orders' | 'create'>('templates');
  const [templates, setTemplates] = useState<OrderTemplate[]>([]);
  const [advancedOrders, setAdvancedOrders] = useState<AdvancedOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Form states for creating orders
  const [orderType, setOrderType] = useState<'bracket' | 'iceberg' | 'trailing-stop'>('bracket');

  // Form validation hook
  const {
    values: formData,
    errors: formErrors,
    touched,
    handleChange,
    handleBlur,
    reset: resetForm
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
    {
      symbol: commonValidationRules.symbol,
      quantity: commonValidationRules.quantity,
      price: {
        ...commonValidationRules.price,
        custom: (value: string) => {
          if (orderType === 'bracket' || orderType === 'iceberg') {
            return commonValidationRules.price.custom!(value);
          }
          return null; // Not required for trailing-stop
        }
      },
      stop_loss: {
        ...commonValidationRules.price,
        custom: (value: string) => {
          if (orderType === 'bracket' && (!value || parseFloat(value) <= 0)) {
            return 'Stop loss price is required for bracket orders';
          }
          return null;
        }
      },
      take_profit: {
        ...commonValidationRules.price,
        custom: (value: string) => {
          if (orderType === 'bracket' && (!value || parseFloat(value) <= 0)) {
            return 'Take profit price is required for bracket orders';
          }
          return null;
        }
      },
      iceberg_quantity: {
        ...commonValidationRules.quantity,
        custom: (value: string) => {
          if (orderType === 'iceberg') {
            const icebergQty = parseInt(value);
            const totalQty = parseInt(formData.quantity);
            if (!value || icebergQty <= 0) {
              return 'Iceberg quantity is required for iceberg orders';
            }
            if (icebergQty >= totalQty) {
              return 'Iceberg quantity must be less than total quantity';
            }
          }
          return null;
        }
      },
      trigger_price: {
        ...commonValidationRules.price,
        custom: (value: string) => {
          if (orderType === 'trailing-stop' && (!value || parseFloat(value) <= 0)) {
            return 'Trigger price is required for trailing stop orders';
          }
          return null;
        }
      },
      trail_amount: {
        min: 0.01,
        custom: (value: string) => {
          if (orderType === 'trailing-stop' && !formData.trail_percent && (!value || parseFloat(value) <= 0)) {
            return 'Either trail amount or trail percent is required';
          }
          return null;
        }
      },
      trail_percent: {
        min: 0.1,
        max: 100,
        custom: (value: string) => {
          if (orderType === 'trailing-stop' && !formData.trail_amount && (!value || parseFloat(value) <= 0)) {
            return 'Either trail amount or trail percent is required';
          }
          return null;
        }
      }
    },
    { validateOnChange: true, validateOnBlur: true, debounceMs: 500 }
  );

  useEffect(() => {
    if (activeTab === 'templates') {
      loadTemplates();
    } else if (activeTab === 'advanced-orders') {
      loadAdvancedOrders();
    }
  }, [activeTab]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await advancedOrderService.getOrderTemplates();
      setTemplates(data.templates);
    } catch (err: any) {
      console.error('Failed to load templates:', err);
      setError(err.message || 'Failed to load order templates');
    } finally {
      setLoading(false);
    }
  };

  const loadAdvancedOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const data = await advancedOrderService.getAdvancedOrders();
      setAdvancedOrders(data.orders);
    } catch (err: any) {
      console.error('Failed to load advanced orders:', err);
      setError(err.message || 'Failed to load advanced orders');
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    handleChange(field, value);
  };

  const handleCreateAdvancedOrder = async () => {
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);

      if (orderType === 'bracket') {
        const orderData = {
          symbol: formData.symbol,
          action: formData.action,
          quantity: parseInt(formData.quantity),
          price: parseFloat(formData.price),
          stop_loss: parseFloat(formData.stop_loss),
          take_profit: parseFloat(formData.take_profit),
          exchange: formData.exchange,
          product_type: formData.product_type,
          validity: formData.validity
        };

        const errors = advancedOrderService.validateBracketOrder(orderData);
        if (errors.length > 0) {
          setError(errors.join(', '));
          return;
        }

        const result = await advancedOrderService.createBracketOrder(orderData);
        setSuccessMessage(`Bracket order created successfully! Order Group ID: ${result.order_group_id}`);
        
        // Reset form
        resetForm();

      } else if (orderType === 'iceberg') {
        const orderData = {
          symbol: formData.symbol,
          action: formData.action,
          quantity: parseInt(formData.quantity),
          price: parseFloat(formData.price),
          iceberg_quantity: parseInt(formData.iceberg_quantity),
          exchange: formData.exchange,
          product_type: formData.product_type,
          validity: formData.validity
        };

        const errors = advancedOrderService.validateIcebergOrder(orderData);
        if (errors.length > 0) {
          setError(errors.join(', '));
          return;
        }

        const result = await advancedOrderService.createIcebergOrder(orderData);
        setSuccessMessage(`Iceberg order created successfully! Order ID: ${result.order.id}`);

      } else if (orderType === 'trailing-stop') {
        const orderData = {
          symbol: formData.symbol,
          action: formData.action,
          quantity: parseInt(formData.quantity),
          trigger_price: parseFloat(formData.trigger_price),
          trail_amount: formData.trail_amount ? parseFloat(formData.trail_amount) : undefined,
          trail_percent: formData.trail_percent ? parseFloat(formData.trail_percent) : undefined,
          exchange: formData.exchange,
          product_type: formData.product_type,
          validity: formData.validity
        };

        const errors = advancedOrderService.validateTrailingStopOrder(orderData);
        if (errors.length > 0) {
          setError(errors.join(', '));
          return;
        }

        const result = await advancedOrderService.createTrailingStopOrder(orderData);
        setSuccessMessage(`Trailing stop order created successfully! Order ID: ${result.order.id}`);
      }

      // Auto-clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);

    } catch (err: any) {
      console.error('Failed to create advanced order:', err);
      setError(err.message || 'Failed to create advanced order');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelOrder = async (orderId: number) => {
    try {
      setError(null);
      
      await advancedOrderService.cancelAdvancedOrder(orderId);
      setSuccessMessage('Order cancelled successfully!');
      
      // Reload orders
      await loadAdvancedOrders();
      
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      console.error('Failed to cancel order:', err);
      setError(err.message || 'Failed to cancel order');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'templates':
        return (
          <Stack gap={6}>
            <Card>
              <CardHeader title="Order Templates" subtitle="Manage your saved order templates" />
              <CardContent>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
                    <p>Loading templates...</p>
                  </div>
                ) : templates.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p>No order templates found. Create your first template to get started.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHeaderCell>Name</TableHeaderCell>
                        <TableHeaderCell>Symbol</TableHeaderCell>
                        <TableHeaderCell>Type</TableHeaderCell>
                        <TableHeaderCell>Action</TableHeaderCell>
                        <TableHeaderCell>Quantity</TableHeaderCell>
                        <TableHeaderCell>Price</TableHeaderCell>
                        <TableHeaderCell>Status</TableHeaderCell>
                        <TableHeaderCell>Actions</TableHeaderCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {templates.map((template) => (
                        <TableRow key={template.id}>
                          <TableCell>
                            <div>
                              <div style={{ fontWeight: '600' }}>{template.name}</div>
                              {template.description && (
                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                  {template.description}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{template.symbol}</TableCell>
                          <TableCell>
                            {advancedOrderService.getOrderTypeDisplayName(template.order_type)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={template.action === 'BUY' ? 'active' : 'inactive'}>
                              {template.action}
                            </StatusBadge>
                          </TableCell>
                          <TableCell>{template.quantity}</TableCell>
                          <TableCell>
                            {advancedOrderService.formatPrice(template.price)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={template.is_active ? 'active' : 'inactive'}>
                              {template.is_active ? 'Active' : 'Inactive'}
                            </StatusBadge>
                          </TableCell>
                          <TableCell>
                            <Flex gap={2}>
                              <Button variant="outline" size="sm">
                                Edit
                              </Button>
                              <Button variant="outline" size="sm">
                                Use
                              </Button>
                            </Flex>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </Stack>
        );

      case 'advanced-orders':
        return (
          <Stack gap={6}>
            <Card>
              <CardHeader 
                title="Advanced Orders" 
                subtitle="Monitor your bracket, iceberg, and trailing stop orders"
              />
              <CardContent>
                {loading ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <div className="loading-spinner" style={{ margin: '0 auto 1rem' }}></div>
                    <p>Loading orders...</p>
                  </div>
                ) : advancedOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '2rem' }}>
                    <p>No advanced orders found. Create your first advanced order to get started.</p>
                  </div>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHeaderCell>Symbol</TableHeaderCell>
                        <TableHeaderCell>Type</TableHeaderCell>
                        <TableHeaderCell>Action</TableHeaderCell>
                        <TableHeaderCell>Quantity</TableHeaderCell>
                        <TableHeaderCell>Price</TableHeaderCell>
                        <TableHeaderCell>Status</TableHeaderCell>
                        <TableHeaderCell>Created</TableHeaderCell>
                        <TableHeaderCell>Actions</TableHeaderCell>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {advancedOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell>
                            <div style={{ fontWeight: '600' }}>{order.symbol}</div>
                            {order.order_group_id && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                Group: {order.order_group_id.slice(0, 8)}...
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {advancedOrderService.getOrderTypeDisplayName(order.order_type)}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={order.action === 'BUY' ? 'active' : 'inactive'}>
                              {order.action}
                            </StatusBadge>
                          </TableCell>
                          <TableCell>
                            {order.quantity}
                            {order.order_type === 'ICEBERG' && order.iceberg_quantity && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                Iceberg: {order.iceberg_quantity}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {advancedOrderService.formatPrice(order.price || order.trigger_price)}
                            {order.stop_loss && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--pnl-negative)' }}>
                                SL: {advancedOrderService.formatPrice(order.stop_loss)}
                              </div>
                            )}
                            {order.take_profit && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--pnl-positive)' }}>
                                TP: {advancedOrderService.formatPrice(order.take_profit)}
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            <StatusBadge 
                              status={order.status === 'EXECUTED' ? 'active' : 
                                     order.status === 'CANCELLED' ? 'inactive' : 'pending'}
                            >
                              {advancedOrderService.getStatusDisplayName(order.status)}
                            </StatusBadge>
                          </TableCell>
                          <TableCell>
                            {order.created_at ? new Date(order.created_at).toLocaleDateString() : '-'}
                          </TableCell>
                          <TableCell>
                            <Flex gap={2}>
                              <Button variant="outline" size="sm">
                                View
                              </Button>
                              {['PENDING', 'ACTIVE'].includes(order.status) && (
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => order.id && handleCancelOrder(order.id)}
                                >
                                  Cancel
                                </Button>
                              )}
                            </Flex>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </Stack>
        );

      case 'create':
        return (
          <Stack gap={6}>
            <Card>
              <CardHeader title="Create Advanced Order" subtitle="Create bracket, iceberg, or trailing stop orders" />
              <CardContent>
                <Stack gap={6}>
                  {/* Order Type Selection */}
                  <div>
                    <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                      Order Type
                    </label>
                    <Select
                      value={orderType}
                      onChange={(e) => setOrderType(e.target.value as unknown as 'bracket' | 'iceberg' | 'trailing-stop')}
                    >
                      <option value="bracket">Bracket Order (Entry + Stop Loss + Take Profit)</option>
                      <option value="iceberg">Iceberg Order (Hidden Quantity)</option>
                      <option value="trailing-stop">Trailing Stop Loss</option>
                    </Select>
                  </div>

                  {/* Common Fields */}
                  <Grid cols={3} gap={4}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Symbol *
                      </label>
                      <Input
                        value={formData.symbol}
                        onChange={(e) => handleInputChange('symbol', e.target.value)}
                        onBlur={() => handleBlur('symbol')}
                        placeholder="e.g., RELIANCE"
                        state={formErrors.symbol ? 'error' : 'default'}
                        error={touched.symbol ? formErrors.symbol : ''}
                        required
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Action *
                      </label>
                      <Select
                        value={formData.action}
                        onChange={(e) => handleInputChange('action', e.target.value)}
                      >
                        <option value="BUY">BUY</option>
                        <option value="SELL">SELL</option>
                      </Select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Quantity *
                      </label>
                      <Input
                        type="number"
                        value={formData.quantity}
                        onChange={(e) => handleInputChange('quantity', e.target.value)}
                        onBlur={() => handleBlur('quantity')}
                        placeholder="100"
                        state={formErrors.quantity ? 'error' : 'default'}
                        error={touched.quantity ? formErrors.quantity : ''}
                        required
                      />
                    </div>
                  </Grid>

                  {/* Order Type Specific Fields */}
                  {orderType === 'bracket' && (
                    <Grid cols={3} gap={4}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Entry Price *
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => handleInputChange('price', e.target.value)}
                          placeholder="2500.00"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Stop Loss *
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.stop_loss}
                          onChange={(e) => handleInputChange('stop_loss', e.target.value)}
                          placeholder="2450.00"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Take Profit *
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.take_profit}
                          onChange={(e) => handleInputChange('take_profit', e.target.value)}
                          placeholder="2600.00"
                        />
                      </div>
                    </Grid>
                  )}

                  {orderType === 'iceberg' && (
                    <Grid cols={2} gap={4}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Price *
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.price}
                          onChange={(e) => handleInputChange('price', e.target.value)}
                          placeholder="2500.00"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Iceberg Quantity *
                        </label>
                        <Input
                          type="number"
                          value={formData.iceberg_quantity}
                          onChange={(e) => handleInputChange('iceberg_quantity', e.target.value)}
                          placeholder="10"
                        />
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                          Quantity to show in order book at a time
                        </div>
                      </div>
                    </Grid>
                  )}

                  {orderType === 'trailing-stop' && (
                    <Grid cols={3} gap={4}>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Trigger Price *
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.trigger_price}
                          onChange={(e) => handleInputChange('trigger_price', e.target.value)}
                          placeholder="2500.00"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Trail Amount
                        </label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.trail_amount}
                          onChange={(e) => handleInputChange('trail_amount', e.target.value)}
                          placeholder="50.00"
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                          Trail Percent
                        </label>
                        <Input
                          type="number"
                          step="0.1"
                          value={formData.trail_percent}
                          onChange={(e) => handleInputChange('trail_percent', e.target.value)}
                          placeholder="2.0"
                        />
                      </div>
                    </Grid>
                  )}

                  {/* Additional Settings */}
                  <Grid cols={3} gap={4}>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Exchange
                      </label>
                      <Select
                        value={formData.exchange}
                        onChange={(e) => handleInputChange('exchange', e.target.value)}
                      >
                        <option value="NSE">NSE</option>
                        <option value="BSE">BSE</option>
                      </Select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Product Type
                      </label>
                      <Select
                        value={formData.product_type}
                        onChange={(e) => handleInputChange('product_type', e.target.value)}
                      >
                        <option value="C">Cash & Carry</option>
                        <option value="M">Margin</option>
                        <option value="I">Intraday</option>
                      </Select>
                    </div>
                    <div>
                      <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>
                        Validity
                      </label>
                      <Select
                        value={formData.validity}
                        onChange={(e) => handleInputChange('validity', e.target.value)}
                      >
                        <option value="DAY">Day</option>
                        <option value="IOC">Immediate or Cancel</option>
                        <option value="GTD">Good Till Date</option>
                      </Select>
                    </div>
                  </Grid>

                  {/* Action Buttons */}
                  <Flex justify="end" gap={3}>
                    <Button variant="outline" onClick={() => resetForm()}>
                      Reset
                    </Button>
                    <Button 
                      variant="primary" 
                      onClick={handleCreateAdvancedOrder}
                      disabled={loading}
                    >
                      {loading ? 'Creating...' : `Create ${orderType.charAt(0).toUpperCase() + orderType.slice(1)} Order`}
                    </Button>
                  </Flex>
                </Stack>
              </CardContent>
            </Card>
          </Stack>
        );

      default:
        return null;
    }
  };

  return (
    <div className="enterprise-app">
      <Navigation />

      <main className="enterprise-main">
        <Container>
          <PageHeader
            title="Advanced Order Management"
            subtitle="Create and manage sophisticated order types including bracket orders, iceberg orders, and trailing stops"
          />

          {/* Success/Error Messages */}
          {successMessage && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--pnl-positive-bg)',
              border: '1px solid var(--pnl-positive-border)',
              borderRadius: '0.5rem',
              color: 'var(--pnl-positive)',
              fontSize: '0.875rem',
              marginBottom: '1rem'
            }}>
              {successMessage}
            </div>
          )}

          {error && (
            <div style={{
              padding: '0.75rem 1rem',
              backgroundColor: 'var(--pnl-negative-bg)',
              border: '1px solid var(--pnl-negative-border)',
              borderRadius: '0.5rem',
              color: 'var(--pnl-negative)',
              fontSize: '0.875rem',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          {/* Tab Navigation */}
          <Card style={{ marginBottom: '2rem' }}>
            <CardContent>
              <Flex gap={1}>
                {[
                  { key: 'templates', label: 'Order Templates' },
                  { key: 'advanced-orders', label: 'Advanced Orders' },
                  { key: 'create', label: 'Create Order' },
                ].map((tab) => (
                  <Button
                    key={tab.key}
                    variant={activeTab === tab.key ? 'primary' : 'ghost'}
                    onClick={() => setActiveTab(tab.key as unknown as 'templates' | 'advanced-orders' | 'create')}
                  >
                    {tab.label}
                  </Button>
                ))}
              </Flex>
            </CardContent>
          </Card>

          {/* Tab Content */}
          {renderTabContent()}
        </Container>
      </main>
    </div>
  );
};

export default AdvancedOrderManagement;
