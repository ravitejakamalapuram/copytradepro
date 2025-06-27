/**
 * ENTERPRISE INPUT COMPONENT
 * CSS-only implementation to avoid CSSStyleDeclaration issues
 */

import React from 'react';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /** Input size */
  size?: 'sm' | 'base' | 'lg';
  /** Input state */
  state?: 'default' | 'error' | 'success';
  /** Label text */
  label?: string;
  /** Helper text */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Left icon */
  leftIcon?: React.ReactNode;
  /** Right icon */
  rightIcon?: React.ReactNode;
  /** Full width */
  fullWidth?: boolean;
  /** Required field */
  required?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = 'base',
      state = 'default',
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      fullWidth = false,
      required = false,
      className = '',
      disabled,
      ...props
    },
    ref
  ) => {
    const actualState = error ? 'error' : state;

    const containerClasses = [
      'enterprise-input-container',
      fullWidth && 'enterprise-input-container--full-width',
      className
    ].filter(Boolean).join(' ');

    const labelClasses = [
      'enterprise-input-label',
      required && 'enterprise-input-label--required'
    ].filter(Boolean).join(' ');

    const inputClasses = [
      'enterprise-input',
      `enterprise-input--${size}`,
      `enterprise-input--${actualState}`,
      leftIcon && 'enterprise-input--with-left-icon',
      rightIcon && 'enterprise-input--with-right-icon'
    ].filter(Boolean).join(' ');

    const helperClasses = [
      'enterprise-input-helper',
      actualState === 'error' && 'enterprise-input-helper--error'
    ].filter(Boolean).join(' ');

    return (
      <div className={containerClasses}>
        {label && (
          <label className={labelClasses}>
            {label}
          </label>
        )}
        
        <div className="enterprise-input-wrapper">
          {leftIcon && (
            <div className="enterprise-input-icon enterprise-input-icon--left">
              {leftIcon}
            </div>
          )}
          
          <input
            ref={ref}
            className={inputClasses}
            disabled={disabled}
            {...props}
          />
          
          {rightIcon && (
            <div className="enterprise-input-icon enterprise-input-icon--right">
              {rightIcon}
            </div>
          )}
        </div>
        
        {(helperText || error) && (
          <div className={helperClasses}>
            {error || helperText}
          </div>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

// Select Component
export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  /** Select size */
  size?: 'sm' | 'base' | 'lg';
  /** Select state */
  state?: 'default' | 'error' | 'success';
  /** Label text */
  label?: string;
  /** Helper text */
  helperText?: string;
  /** Error message */
  error?: string;
  /** Full width */
  fullWidth?: boolean;
  /** Required field */
  required?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      size = 'base',
      state = 'default',
      label,
      helperText,
      error,
      fullWidth = false,
      required = false,
      className = '',
      disabled,
      children,
      ...props
    },
    ref
  ) => {
    const actualState = error ? 'error' : state;

    const containerClasses = [
      'enterprise-input-container',
      fullWidth && 'enterprise-input-container--full-width',
      className
    ].filter(Boolean).join(' ');

    const labelClasses = [
      'enterprise-input-label',
      required && 'enterprise-input-label--required'
    ].filter(Boolean).join(' ');

    const selectClasses = [
      'enterprise-input',
      'enterprise-select',
      `enterprise-input--${size}`,
      `enterprise-input--${actualState}`
    ].filter(Boolean).join(' ');

    const helperClasses = [
      'enterprise-input-helper',
      actualState === 'error' && 'enterprise-input-helper--error'
    ].filter(Boolean).join(' ');

    return (
      <div className={containerClasses}>
        {label && (
          <label className={labelClasses}>
            {label}
          </label>
        )}
        
        <select
          ref={ref}
          className={selectClasses}
          disabled={disabled}
          {...props}
        >
          {children}
        </select>
        
        {(helperText || error) && (
          <div className={helperClasses}>
            {error || helperText}
          </div>
        )}
      </div>
    );
  }
);

Select.displayName = 'Select';

export default Input;
