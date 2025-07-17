# CopyTrade Pro - Component Style Guide

## Overview

This guide provides examples and usage patterns for all components in the CopyTrade Pro design system.

## Button Components

### Enterprise Button
The primary button component with consistent styling and interactive states.

```tsx
import { Button } from './ui/Button';

// Primary button
<Button variant="primary" size="base">
  Place Order
</Button>

// Secondary button
<Button variant="secondary" size="base">
  Cancel
</Button>

// Trading-specific buttons
<Button className="btn-trading-buy">
  Buy
</Button>

<Button className="btn-trading-sell">
  Sell
</Button>
```

### CSS Classes
```css
.enterprise-button--primary    /* Primary action button */
.enterprise-button--secondary  /* Secondary action button */
.enterprise-button--outline    /* Outline style button */
.enterprise-button--ghost      /* Minimal button */
.enterprise-button--danger     /* Destructive action button */

/* Sizes */
.enterprise-button--sm         /* Small button */
.enterprise-button--base       /* Default size */
.enterprise-button--lg         /* Large button */

/* Trading-specific */
.btn-trading-buy              /* Buy action button */
.btn-trading-sell             /* Sell action button */
```

## Badge Components

### Status Badge
Used for displaying status information with semantic colors.

```tsx
import { StatusBadge } from './ui/Badge';

<StatusBadge status="active">Active</StatusBadge>
<StatusBadge status="pending">Pending</StatusBadge>
<StatusBadge status="executed">Executed</StatusBadge>
<StatusBadge status="rejected">Rejected</StatusBadge>
```

### CSS Classes
```css
.enterprise-badge--success     /* Success state */
.enterprise-badge--warning     /* Warning state */
.enterprise-badge--error       /* Error state */
.enterprise-badge--info        /* Information state */

/* Status-specific */
.enterprise-status-badge--active
.enterprise-status-badge--pending
.enterprise-status-badge--executed
.enterprise-status-badge--rejected
```

## Card Components

### Trading Card
Specialized card for trading data display.

```tsx
import { Card, CardHeader, CardContent } from './ui/Card';

<Card className="trading-card">
  <CardHeader>
    <h3>Portfolio Summary</h3>
  </CardHeader>
  <CardContent>
    <div className="trading-metric">
      <div className="trading-metric-label">Total P&L</div>
      <div className="trading-metric-value pnl-positive">
        ₹12,345.67
      </div>
    </div>
  </CardContent>
</Card>
```

### CSS Classes
```css
.trading-card                  /* Enhanced card with hover effects */
.trading-card-compact          /* Compact padding variant */
.card-interactive              /* Interactive card with hover states */
```

## Table Components

### Portfolio Table
Specialized table for displaying trading data.

```tsx
<div className="table-container">
  <table className="table table-trading">
    <thead>
      <tr>
        <th>Symbol</th>
        <th className="table-cell-numeric">Qty</th>
        <th className="table-cell-numeric">P&L</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td className="table-cell-symbol">RELIANCE</td>
        <td className="table-cell-numeric">100</td>
        <td className="table-cell-numeric pnl-positive">
          ₹1,234.56
        </td>
      </tr>
    </tbody>
  </table>
</div>
```

### CSS Classes
```css
.table-trading                 /* Trading-optimized table */
.table-cell-numeric            /* Right-aligned numeric cells */
.table-cell-symbol             /* Symbol/instrument cells */
.table-cell-center             /* Center-aligned cells */
```

## Form Components

### Trading Form Elements
```tsx
<div className="form-group">
  <label className="form-label required">
    Quantity
  </label>
  <input 
    type="number" 
    className="form-input focus-ring"
    placeholder="Enter quantity"
  />
</div>

<div className="form-group">
  <label className="form-label">
    Order Type
  </label>
  <select className="form-select focus-ring">
    <option>Market</option>
    <option>Limit</option>
  </select>
</div>
```

## Layout Components

### Trading Grid
Responsive grid layout for trading components.

```tsx
<div className="trading-grid">
  <div className="trading-card">Card 1</div>
  <div className="trading-card">Card 2</div>
  <div className="trading-card">Card 3</div>
</div>
```

### Trading Flex
Flexible layout for trading controls.

```tsx
<div className="trading-flex">
  <div className="trading-metric">
    <div className="trading-metric-label">Current Price</div>
    <div className="trading-metric-value">₹2,450.75</div>
  </div>
  <Button variant="primary">Trade</Button>
</div>
```

## Utility Classes

### P&L Indicators
```css
.pnl-positive                  /* Profit color */
.pnl-negative                  /* Loss color */
.pnl-neutral                   /* Neutral color */
.pnl-bg-positive               /* Profit background */
.pnl-bg-negative               /* Loss background */
```

### Trading Metrics
```css
.trading-metric                /* Metric container */
.trading-metric-label          /* Metric label */
.trading-metric-value          /* Metric value */
.trading-metric-change         /* Change indicator */
```

### Interactive States
```css
.interactive                   /* Base interactive element */
.hover-bg                      /* Hover background */
.hover-lift                    /* Hover lift effect */
.focus-ring                    /* Focus ring indicator */
```

### Status Indicators
```css
.status-active                 /* Active status color */
.status-inactive               /* Inactive status color */
.status-pending                /* Pending status color */
.status-error                  /* Error status color */
```

## Usage Examples

### Portfolio Dashboard
```tsx
<div className="trading-grid">
  <Card className="trading-card">
    <CardContent>
      <div className="trading-metric">
        <div className="trading-metric-label">Portfolio Value</div>
        <div className="trading-metric-value">₹1,25,000</div>
        <div className="trading-metric-change pnl-positive">
          +2.5%
        </div>
      </div>
    </CardContent>
  </Card>
  
  <Card className="trading-card">
    <CardContent>
      <div className="trading-metric">
        <div className="trading-metric-label">Day P&L</div>
        <div className="trading-metric-value pnl-positive">
          +₹3,250
        </div>
        <div className="trading-metric-change">Today</div>
      </div>
    </CardContent>
  </Card>
</div>
```

### Order Form
```tsx
<Card className="trading-card">
  <CardHeader>
    <h3>Place Order</h3>
  </CardHeader>
  <CardContent>
    <div className="trading-stack">
      <div className="form-group">
        <label className="form-label required">Symbol</label>
        <input className="form-input focus-ring" />
      </div>
      
      <div className="trading-flex">
        <Button className="btn-trading-buy">
          Buy
        </Button>
        <Button className="btn-trading-sell">
          Sell
        </Button>
      </div>
    </div>
  </CardContent>
</Card>
```

### Status Display
```tsx
<div className="trading-flex">
  <span>Order Status:</span>
  <StatusBadge status="executed">
    Executed
  </StatusBadge>
</div>
```

## Responsive Considerations

### Mobile Adaptations
```css
@media (max-width: 768px) {
  .trading-grid {
    grid-template-columns: 1fr;
  }
  
  .trading-flex {
    flex-direction: column;
    align-items: stretch;
  }
  
  .trading-metric-value {
    font-size: var(--text-base);
  }
}
```

## Accessibility Features

### Focus Management
- All interactive elements include focus rings
- Keyboard navigation is fully supported
- Skip links are provided for main navigation

### Screen Reader Support
- Semantic HTML elements are used
- ARIA labels are provided where needed
- Status changes are announced

### Color Accessibility
- All color combinations meet WCAG AA standards
- Color is not the only indicator of state
- High contrast mode is supported

## Performance Considerations

### CSS Optimization
- Design tokens reduce CSS bundle size
- Utility classes prevent style duplication
- Critical styles are inlined

### Component Efficiency
- Minimal re-renders through proper CSS structure
- Efficient hover and focus state handling
- Optimized animation performance
