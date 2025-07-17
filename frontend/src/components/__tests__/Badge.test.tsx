import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Badge, { StatusBadge } from '../ui/Badge';

describe('Badge Component', () => {
  it('renders default badge correctly', () => {
    render(<Badge>Default Badge</Badge>);
    expect(screen.getByText('Default Badge')).toBeInTheDocument();
  });

  it('renders success variant with correct class', () => {
    render(<Badge variant="success">Success Badge</Badge>);
    const badge = screen.getByText('Success Badge');
    expect(badge).toHaveClass('enterprise-badge--success');
  });

  it('renders error variant with correct class', () => {
    render(<Badge variant="error">Error Badge</Badge>);
    const badge = screen.getByText('Error Badge');
    expect(badge).toHaveClass('enterprise-badge--error');
  });

  it('renders warning variant with correct class', () => {
    render(<Badge variant="warning">Warning Badge</Badge>);
    const badge = screen.getByText('Warning Badge');
    expect(badge).toHaveClass('enterprise-badge--warning');
  });
});

describe('StatusBadge Component', () => {
  it('renders active status correctly', () => {
    render(<StatusBadge status="active" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('renders executed status with success styling', () => {
    render(<StatusBadge status="executed" />);
    const badge = screen.getByText('Executed');
    expect(badge).toHaveClass('enterprise-status-badge--executed');
  });

  it('renders rejected status with error styling', () => {
    render(<StatusBadge status="rejected" />);
    const badge = screen.getByText('Rejected');
    expect(badge).toHaveClass('enterprise-status-badge--rejected');
  });

  it('renders pending status with warning styling', () => {
    render(<StatusBadge status="pending" />);
    const badge = screen.getByText('Pending');
    expect(badge).toHaveClass('enterprise-status-badge--pending');
  });
});