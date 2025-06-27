/**
 * ENTERPRISE BUTTON COMPONENT
 * Consistent, accessible button component following design system
 */

import React from 'react';
import './Button.css';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Button variant */
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  /** Button size */
  size?: 'sm' | 'base' | 'lg';
  /** Loading state */
  loading?: boolean;
  /** Icon before text */
  leftIcon?: React.ReactNode;
  /** Icon after text */
  rightIcon?: React.ReactNode;
  /** Full width button */
  fullWidth?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'base',
      loading = false,
      leftIcon,
      rightIcon,
      fullWidth = false,
      children,
      disabled,
      className = '',
      ...props
    },
    ref
  ) => {
    const buttonClasses = [
      'enterprise-button',
      `enterprise-button--${variant}`,
      `enterprise-button--${size}`,
      fullWidth && 'enterprise-button--full-width',
      className
    ].filter(Boolean).join(' ');

    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={buttonClasses}
        {...props}
      >
        {loading && (
          <div className="enterprise-button__spinner" />
        )}
        {!loading && leftIcon && <span>{leftIcon}</span>}
        {children && <span>{children}</span>}
        {!loading && rightIcon && <span>{rightIcon}</span>}
      </button>
    );
  }
);

Button.displayName = 'Button';

export default Button;
