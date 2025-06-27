/**
 * ENTERPRISE BADGE COMPONENT
 * Consistent status and label badge component following design system
 */

import React from 'react';
import './Badge.css';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Badge variant */
  variant?: 'default' | 'primary' | 'success' | 'error' | 'warning' | 'info';
  /** Badge size */
  size?: 'sm' | 'base' | 'lg';
  /** Icon before text */
  leftIcon?: React.ReactNode;
  /** Icon after text */
  rightIcon?: React.ReactNode;
  /** Dot indicator */
  dot?: boolean;
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = 'default',
      size = 'base',
      leftIcon,
      rightIcon,
      dot = false,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const badgeClasses = [
      'enterprise-badge',
      `enterprise-badge--${size}`,
      `enterprise-badge--${variant}`,
      className
    ].filter(Boolean).join(' ');

    return (
      <span ref={ref} className={badgeClasses} {...props}>
        {dot && <span className="enterprise-status-badge-icon" />}
        {leftIcon && leftIcon}
        {children}
        {rightIcon && rightIcon}
      </span>
    );
  }
);

Badge.displayName = 'Badge';

// StatusBadge Component
export interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  /** Status type */
  status: 'active' | 'inactive' | 'pending' | 'executed' | 'rejected' | 'cancelled' | 'error';
  /** Show status icon */
  showIcon?: boolean;
}

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  ({ status, showIcon = true, children, className = '', ...props }, ref) => {
    const statusClasses = [
      'enterprise-status-badge',
      `enterprise-status-badge--${status}`,
      className
    ].filter(Boolean).join(' ');

    return (
      <span ref={ref} className={statusClasses} {...props}>
        {showIcon && <span className="enterprise-status-badge-icon" />}
        {children || status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  }
);

StatusBadge.displayName = 'StatusBadge';

export default Badge;
