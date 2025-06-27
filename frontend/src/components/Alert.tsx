import React from 'react';

interface AlertProps {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
  children: React.ReactNode;
  onClose?: () => void;
  className?: string;
  icon?: string;
}

const Alert: React.FC<AlertProps> = ({
  variant = 'info',
  title,
  children,
  onClose,
  className = '',
  icon
}) => {
  const getVariantConfig = () => {
    switch (variant) {
      case 'success':
        return {
          bgColor: 'bg-success-50',
          borderColor: 'border-success-200',
          textColor: 'text-success-800',
          iconColor: 'text-success-600',
          defaultIcon: '✅'
        };
      case 'warning':
        return {
          bgColor: 'bg-warning-50',
          borderColor: 'border-warning-200',
          textColor: 'text-warning-800',
          iconColor: 'text-warning-600',
          defaultIcon: '⚠️'
        };
      case 'danger':
        return {
          bgColor: 'bg-danger-50',
          borderColor: 'border-danger-200',
          textColor: 'text-danger-800',
          iconColor: 'text-danger-600',
          defaultIcon: '❌'
        };
      default:
        return {
          bgColor: 'bg-info-50',
          borderColor: 'border-info-200',
          textColor: 'text-info-800',
          iconColor: 'text-info-600',
          defaultIcon: 'ℹ️'
        };
    }
  };

  const config = getVariantConfig();
  const displayIcon = icon || config.defaultIcon;

  return (
    <div className={`
      ${config.bgColor} 
      ${config.borderColor} 
      ${config.textColor}
      border rounded-lg p-4 
      ${className}
    `}>
      <div className="flex items-start gap-3">
        <span className={`${config.iconColor} text-lg flex-shrink-0`}>
          {displayIcon}
        </span>
        
        <div className="flex-1 min-w-0">
          {title && (
            <h4 className="font-semibold mb-1">{title}</h4>
          )}
          <div className="text-sm">
            {children}
          </div>
        </div>

        {onClose && (
          <button
            onClick={onClose}
            className={`
              ${config.iconColor} 
              hover:opacity-75 
              flex-shrink-0 
              text-lg 
              leading-none
              transition-opacity
            `}
            aria-label="Close alert"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
};

export default Alert;
