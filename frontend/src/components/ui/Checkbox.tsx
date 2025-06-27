import React from 'react';
import './Checkbox.css';

export interface CheckboxProps {
  /** Checkbox label text */
  label?: string;
  /** Whether the checkbox is checked */
  checked?: boolean;
  /** Whether the checkbox is disabled */
  disabled?: boolean;
  /** Whether the checkbox is in an indeterminate state */
  indeterminate?: boolean;
  /** Size variant */
  size?: 'sm' | 'base' | 'lg';
  /** Visual state */
  state?: 'default' | 'error' | 'success';
  /** Error message to display */
  error?: string;
  /** Helper text to display below the checkbox */
  helperText?: string;
  /** Additional CSS classes */
  className?: string;
  /** Change handler */
  onChange?: (checked: boolean, event: React.ChangeEvent<HTMLInputElement>) => void;
  /** Click handler for the entire checkbox container */
  onClick?: (event: React.MouseEvent<HTMLLabelElement>) => void;
  /** Name attribute for the input */
  name?: string;
  /** Value attribute for the input */
  value?: string;
  /** ID for the input element */
  id?: string;
  /** Children to render instead of label (for custom content) */
  children?: React.ReactNode;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked = false,
  disabled = false,
  indeterminate = false,
  size = 'base',
  state = 'default',
  error,
  helperText,
  className = '',
  onChange,
  onClick,
  name,
  value,
  id,
  children,
  ...props
}) => {
  const checkboxId = id || `checkbox-${Math.random().toString(36).substr(2, 9)}`;
  
  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled) return;
    onChange?.(event.target.checked, event);
  };

  const handleClick = (event: React.MouseEvent<HTMLLabelElement>) => {
    if (disabled) return;
    onClick?.(event);
  };

  const checkboxClasses = [
    'enterprise-checkbox',
    `enterprise-checkbox--${size}`,
    `enterprise-checkbox--${state}`,
    disabled && 'enterprise-checkbox--disabled',
    indeterminate && 'enterprise-checkbox--indeterminate',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={checkboxClasses}>
      <label 
        className="enterprise-checkbox__container" 
        htmlFor={checkboxId}
        onClick={handleClick}
      >
        <input
          type="checkbox"
          id={checkboxId}
          name={name}
          value={value}
          checked={checked}
          disabled={disabled}
          onChange={handleChange}
          className="enterprise-checkbox__input"
          {...props}
        />
        <span className="enterprise-checkbox__checkmark">
          {indeterminate ? (
            <svg className="enterprise-checkbox__icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M4 8h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : checked ? (
            <svg className="enterprise-checkbox__icon" viewBox="0 0 16 16" fill="currentColor">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
          ) : null}
        </span>
        
        {(children || label) && (
          <span className="enterprise-checkbox__label">
            {children || label}
          </span>
        )}
      </label>
      
      {(error || helperText) && (
        <div className="enterprise-checkbox__help">
          {error && (
            <span className="enterprise-checkbox__error">{error}</span>
          )}
          {helperText && !error && (
            <span className="enterprise-checkbox__helper">{helperText}</span>
          )}
        </div>
      )}
    </div>
  );
};

export default Checkbox;
