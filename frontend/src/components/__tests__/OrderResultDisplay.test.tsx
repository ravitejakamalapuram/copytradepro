import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import OrderResultDisplay, { type OrderResultSummary } from '../OrderResultDisplay';

// Mock the error messages utility
vi.mock('../../utils/errorMessages', () => ({
  getUserFriendlyError: vi.fn((error: string) => ({
    title: 'Test Error',
    message: 'Test error message',
    suggestion: 'Test suggestion',
    retryable: true,
    type: 'error' as const,
    icon: '❌'
  }))
}));

describe('OrderResultDisplay', () => {
  const mockOrderResult: OrderResultSummary = {
    symbol: 'RELIANCE',
    action: 'BUY',
    quantity: 100,
    orderType: 'LIMIT',
    price: 2500.50,
    exchange: 'NSE',
    productType: 'CNC',
    totalAccounts: 3,
    successfulAccounts: 2,
    failedAccounts: 1,
    results: [
      {
        accountId: 'acc1',
        brokerName: 'FYERS',
        brokerDisplayName: 'Fyers Account 1',
        success: true,
        brokerOrderId: 'FY123456',
        message: 'Order placed successfully'
      },
      {
        accountId: 'acc2',
        brokerName: 'SHOONYA',
        brokerDisplayName: 'Shoonya Account 1',
        success: true,
        brokerOrderId: 'SH789012',
        message: 'Order placed successfully'
      },
      {
        accountId: 'acc3',
        brokerName: 'FYERS',
        brokerDisplayName: 'Fyers Account 2',
        success: false,
        error: 'Insufficient funds',
        errorType: 'MARGIN_SHORTFALL',
        suggestion: 'Add funds to your account or reduce the order quantity.',
        retryable: false
      }
    ],
    timestamp: new Date('2024-01-15T10:30:00Z')
  };

  it('renders order result summary correctly', () => {
    render(<OrderResultDisplay summary={mockOrderResult} />);
    
    // Check header
    expect(screen.getByText('Order Placement Results')).toBeInTheDocument();
    
    // Check summary message
    expect(screen.getByText('2 of 3 orders placed successfully.')).toBeInTheDocument();
    
    // Check success rate
    expect(screen.getByText('Success Rate: 66.7%')).toBeInTheDocument();
    
    // Check order details
    expect(screen.getByText('RELIANCE')).toBeInTheDocument();
    expect(screen.getByText('BUY')).toBeInTheDocument();
    expect(screen.getByText('100')).toBeInTheDocument();
    expect(screen.getByText('LIMIT')).toBeInTheDocument();
    expect(screen.getByText('₹2,500.50')).toBeInTheDocument();
  });

  it('displays successful orders correctly', () => {
    render(<OrderResultDisplay summary={mockOrderResult} />);
    
    // Check successful orders section
    expect(screen.getByText('✅ Successful Orders (2)')).toBeInTheDocument();
    
    // Check individual successful orders
    expect(screen.getByText('Fyers Account 1')).toBeInTheDocument();
    expect(screen.getByText('Shoonya Account 1')).toBeInTheDocument();
    expect(screen.getByText('FY123456')).toBeInTheDocument();
    expect(screen.getByText('SH789012')).toBeInTheDocument();
  });

  it('displays failed orders with error details and suggestions', () => {
    render(<OrderResultDisplay summary={mockOrderResult} />);
    
    // Check failed orders section
    expect(screen.getByText('❌ Failed Orders (1)')).toBeInTheDocument();
    
    // Check failed order details
    expect(screen.getByText('Fyers Account 2')).toBeInTheDocument();
    expect(screen.getByText('Test Error: Test error message')).toBeInTheDocument();
    expect(screen.getByText('💡 Suggestion:')).toBeInTheDocument();
    expect(screen.getByText('Add funds to your account or reduce the order quantity.')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', () => {
    const mockOnClose = vi.fn();
    render(<OrderResultDisplay summary={mockOrderResult} onClose={mockOnClose} />);
    
    const closeButton = screen.getByLabelText('Close results');
    fireEvent.click(closeButton);
    
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it('calls onRetryFailed when retry button is clicked', () => {
    const mockOnRetryFailed = vi.fn();
    render(
      <OrderResultDisplay 
        summary={mockOrderResult} 
        onRetryFailed={mockOnRetryFailed}
        showRetryOption={true}
      />
    );
    
    const retryButton = screen.getByText('🔄 Retry Failed Orders (1)');
    fireEvent.click(retryButton);
    
    expect(mockOnRetryFailed).toHaveBeenCalledTimes(1);
    expect(mockOnRetryFailed).toHaveBeenCalledWith([mockOrderResult.results[2]]);
  });

  it('shows correct status for all successful orders', () => {
    const allSuccessfulResult: OrderResultSummary = {
      ...mockOrderResult,
      failedAccounts: 0,
      successfulAccounts: 3,
      results: mockOrderResult.results.slice(0, 2).concat([{
        ...mockOrderResult.results[2],
        success: true,
        error: undefined,
        brokerOrderId: 'FY345678'
      }])
    };

    render(<OrderResultDisplay summary={allSuccessfulResult} />);
    
    expect(screen.getByText('All 3 orders placed successfully!')).toBeInTheDocument();
    expect(screen.getByText('Success Rate: 100.0%')).toBeInTheDocument();
    expect(screen.getAllByText('✅')).toHaveLength(4); // Header + 3 successful orders
  });

  it('shows correct status for all failed orders', () => {
    const allFailedResult: OrderResultSummary = {
      ...mockOrderResult,
      failedAccounts: 3,
      successfulAccounts: 0,
      results: mockOrderResult.results.map(result => ({
        ...result,
        success: false,
        error: 'Test error',
        brokerOrderId: undefined
      }))
    };

    render(<OrderResultDisplay summary={allFailedResult} />);
    
    expect(screen.getByText('All 3 orders failed to place.')).toBeInTheDocument();
    expect(screen.getByText('Success Rate: 0.0%')).toBeInTheDocument();
    expect(screen.getAllByText('❌')).toHaveLength(4); // Header + 3 failed orders
  });

  it('formats timestamp correctly', () => {
    render(<OrderResultDisplay summary={mockOrderResult} />);
    
    // Check that timestamp is displayed (format may vary based on locale)
    expect(screen.getByText(/15 Jan 2024/)).toBeInTheDocument();
  });

  it('handles missing optional props gracefully', () => {
    const minimalResult: OrderResultSummary = {
      symbol: 'TCS',
      action: 'SELL',
      quantity: 50,
      orderType: 'MARKET',
      exchange: 'NSE',
      productType: 'MIS',
      totalAccounts: 1,
      successfulAccounts: 1,
      failedAccounts: 0,
      results: [{
        accountId: 'acc1',
        brokerName: 'FYERS',
        brokerDisplayName: 'Fyers Account',
        success: true,
        message: 'Order placed successfully'
      }],
      timestamp: new Date()
    };

    expect(() => render(<OrderResultDisplay summary={minimalResult} />)).not.toThrow();
    expect(screen.getByText('TCS')).toBeInTheDocument();
    expect(screen.getByText('SELL')).toBeInTheDocument();
    expect(screen.getByText('MARKET')).toBeInTheDocument();
  });
});