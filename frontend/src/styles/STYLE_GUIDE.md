# CopyTrade Pro - Design System Style Guide

## Overview

This style guide documents the unified design system for CopyTrade Pro, a professional trading platform. The design system provides a consistent, accessible, and scalable foundation for all UI components.

## Design Tokens

### Color System

#### Primary Colors
```css
--color-primary: #1a1a2e;        /* Main brand color */
--color-primary-light: #16213e;  /* Lighter variant */
--color-primary-dark: #0f0f1a;   /* Darker variant */
```

#### Trading Colors
```css
--color-profit: #00d4aa;         /* Profit/gain indicator */
--color-loss: #ff4757;           /* Loss indicator */
--color-neutral: #747d8c;        /* Neutral state */
```

#### Background Colors
```css
--bg-primary: #0f0f23;           /* Main background */
--bg-secondary: #1a1a2e;         /* Secondary background */
--bg-surface: #1e1e3f;           /* Card/surface background */
--bg-tertiary: #16213e;          /* Tertiary background */
```

#### Text Colors
```css
--text-primary: #ffffff;         /* Primary text */
--text-secondary: #a0a9c0;       /* Secondary text */
--text-tertiary: #6b7280;        /* Muted text */
```

### Typography

#### Font Families
```css
--font-sans: 'Inter', sans-serif;                    /* Primary font */
--font-mono: 'JetBrains Mono', 'Consolas', monospace; /* Monospace for data */
```

#### Font Sizes
```css
--text-xs: 0.75rem;    /* 12px */
--text-sm: 0.875rem;   /* 14px */
--text-base: 1rem;     /* 16px */
--text-lg: 1.125rem;   /* 18px */
--text-xl: 1.25rem;    /* 20px */
--text-2xl: 1.5rem;    /* 24px */
```

#### Font Weights
```css
--font-light: 300;
--font-normal: 400;
--font-medium: 500;
--font-semibold: 600;
--font-bold: 700;
```

### Spacing

#### Spacing Scale
```css
--space-1: 0.25rem;    /* 4px */
--space-2: 0.5rem;     /* 8px */
--space-3: 0.75rem;    /* 12px */
--space-4: 1rem;       /* 16px */
--space-5: 1.25rem;    /* 20px */
--space-6: 1.5rem;     /* 24px */
--space-8: 2rem;       /* 32px */
--space-10: 2.5rem;    /* 40px */
--space-12: 3rem;      /* 48px */
```

### Border Radius
```css
--radius-sm: 0.125rem;   /* 2px */
--radius-base: 0.25rem;  /* 4px */
--radius-md: 0.375rem;   /* 6px */
--radius-lg: 0.5rem;     /* 8px */
--radius-xl: 0.75rem;    /* 12px */
--radius-2xl: 1rem;      /* 16px */
--radius-full: 9999px;   /* Fully rounded */
```

### Shadows
```css
--shadow-sm: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
--shadow-base: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
--shadow-md: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
```

## Component Guidelines

### Buttons

#### Primary Button
```css
.btn-primary {
  background-color: var(--interactive-primary);
  color: var(--text-primary);
  border: 1px solid var(--interactive-primary);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-lg);
  font-weight: var(--font-medium);
  transition: all var(--transition-fast);
}
```

#### Usage
- Use primary buttons for main actions (Submit, Save, Buy, Sell)
- Limit to one primary button per section
- Always include hover and focus states

### Cards

#### Basic Card
```css
.card {
  background-color: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
}
```

#### Trading Card
```css
.trading-card {
  background: var(--bg-surface);
  border: 1px solid var(--border-primary);
  border-radius: var(--radius-lg);
  padding: var(--space-6);
  box-shadow: var(--shadow-sm);
  transition: var(--transition-base);
}

.trading-card:hover {
  box-shadow: var(--shadow-md);
  border-color: var(--border-secondary);
}
```

### Tables

#### Trading Table
```css
.table-trading {
  font-size: var(--text-sm);
  font-family: var(--font-mono);
}

.table-trading .table-cell-numeric {
  text-align: right;
  font-variant-numeric: tabular-nums;
}
```

## Utility Classes

### Text Colors
```css
.text-profit { color: var(--color-profit); }
.text-loss { color: var(--color-loss); }
.text-neutral { color: var(--color-neutral); }
```

### P&L Indicators
```css
.pnl-positive { color: var(--color-profit) !important; }
.pnl-negative { color: var(--color-loss) !important; }
.pnl-neutral { color: var(--color-neutral) !important; }
```

### Interactive States
```css
.interactive {
  transition: all var(--transition-fast);
  cursor: pointer;
}

.interactive:hover {
  background-color: var(--hover-bg);
  border-color: var(--hover-border);
}

.interactive:focus {
  outline: var(--focus-ring-width) solid var(--focus-ring);
  outline-offset: var(--focus-ring-offset);
}
```

## Accessibility Guidelines

### Focus States
- All interactive elements must have visible focus indicators
- Use `--focus-ring` color for consistency
- Ensure focus indicators have sufficient contrast

### Color Contrast
- Text on background must meet WCAG AA standards (4.5:1 ratio)
- Interactive elements must maintain contrast in all states

### Keyboard Navigation
- All interactive elements must be keyboard accessible
- Use semantic HTML elements when possible
- Provide skip links for navigation

## Best Practices

### Do's
- ✅ Use design tokens instead of hardcoded values
- ✅ Follow the established spacing scale
- ✅ Use semantic color names (profit/loss vs green/red)
- ✅ Include hover and focus states for all interactive elements
- ✅ Use consistent border radius across similar components

### Don'ts
- ❌ Don't use hardcoded colors or spacing values
- ❌ Don't create new color variants without updating the design system
- ❌ Don't skip accessibility considerations
- ❌ Don't mix different design patterns in the same interface

## File Structure

```
frontend/src/styles/
├── design-system.css     # Core design tokens
├── enterprise-base.css   # Base styles and reset
├── components.css        # Component styles and utilities
├── app-theme.css        # Theme application
└── layout.css           # Layout utilities
```

## Migration Guide

### From Hardcoded Values
```css
/* Before */
.my-component {
  color: #00d4aa;
  padding: 16px;
  border-radius: 8px;
}

/* After */
.my-component {
  color: var(--color-profit);
  padding: var(--space-4);
  border-radius: var(--radius-lg);
}
```

### Legacy Kite Theme
The design system includes legacy Kite theme compatibility:
```css
/* Legacy */
.kite-text-profit { color: var(--color-profit); }

/* Preferred */
.text-profit { color: var(--color-profit); }
```
