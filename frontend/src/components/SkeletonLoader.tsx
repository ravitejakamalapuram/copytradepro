import React from 'react';
import './SkeletonLoader.css';

interface SkeletonProps {
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  className?: string;
  animate?: boolean;
}

// Base skeleton component
export const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  borderRadius = '4px',
  className = '',
  animate = true,
}) => {
  const style = {
    width: typeof width === 'number' ? `${width}px` : width,
    height: typeof height === 'number' ? `${height}px` : height,
    borderRadius: typeof borderRadius === 'number' ? `${borderRadius}px` : borderRadius,
  };

  return (
    <div 
      className={`skeleton ${animate ? 'skeleton--animate' : ''} ${className}`}
      style={style}
    />
  );
};

// Text skeleton for lines of text
export const SkeletonText: React.FC<{
  lines?: number;
  className?: string;
  lastLineWidth?: string;
}> = ({ lines = 1, className = '', lastLineWidth = '75%' }) => {
  return (
    <div className={`skeleton-text ${className}`}>
      {Array.from({ length: lines }, (_, index) => (
        <Skeleton
          key={index}
          height="1rem"
          width={index === lines - 1 && lines > 1 ? lastLineWidth : '100%'}
          className="skeleton-text__line"
        />
      ))}
    </div>
  );
};

// Avatar skeleton
export const SkeletonAvatar: React.FC<{
  size?: 'small' | 'medium' | 'large';
  shape?: 'circle' | 'square';
  className?: string;
}> = ({ size = 'medium', shape = 'circle', className = '' }) => {
  const sizeMap = {
    small: 32,
    medium: 48,
    large: 64,
  };

  const borderRadius = shape === 'circle' ? '50%' : '8px';

  return (
    <Skeleton
      width={sizeMap[size]}
      height={sizeMap[size]}
      borderRadius={borderRadius}
      className={`skeleton-avatar ${className}`}
    />
  );
};

// Card skeleton for content cards
export const SkeletonCard: React.FC<{
  hasImage?: boolean;
  imageHeight?: number;
  lines?: number;
  className?: string;
}> = ({ hasImage = false, imageHeight = 200, lines = 3, className = '' }) => {
  return (
    <div className={`skeleton-card ${className}`}>
      {hasImage && (
        <Skeleton
          height={imageHeight}
          borderRadius="8px 8px 0 0"
          className="skeleton-card__image"
        />
      )}
      <div className="skeleton-card__content">
        <Skeleton height="1.5rem" width="80%" className="skeleton-card__title" />
        <SkeletonText lines={lines} className="skeleton-card__text" />
        <div className="skeleton-card__footer">
          <Skeleton height="2rem" width="100px" borderRadius="6px" />
          <Skeleton height="2rem" width="80px" borderRadius="6px" />
        </div>
      </div>
    </div>
  );
};

// Table skeleton
export const SkeletonTable: React.FC<{
  rows?: number;
  columns?: number;
  hasHeader?: boolean;
  className?: string;
}> = ({ rows = 5, columns = 4, hasHeader = true, className = '' }) => {
  return (
    <div className={`skeleton-table ${className}`}>
      {hasHeader && (
        <div className="skeleton-table__header">
          {Array.from({ length: columns }, (_, index) => (
            <Skeleton
              key={index}
              height="1.25rem"
              width="80%"
              className="skeleton-table__header-cell"
            />
          ))}
        </div>
      )}
      <div className="skeleton-table__body">
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={rowIndex} className="skeleton-table__row">
            {Array.from({ length: columns }, (_, colIndex) => (
              <Skeleton
                key={colIndex}
                height="1rem"
                width={colIndex === 0 ? '60%' : '90%'}
                className="skeleton-table__cell"
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};

// Form skeleton
export const SkeletonForm: React.FC<{
  fields?: number;
  hasSubmitButton?: boolean;
  className?: string;
}> = ({ fields = 4, hasSubmitButton = true, className = '' }) => {
  return (
    <div className={`skeleton-form ${className}`}>
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="skeleton-form__field">
          <Skeleton height="1rem" width="30%" className="skeleton-form__label" />
          <Skeleton height="2.5rem" borderRadius="6px" className="skeleton-form__input" />
        </div>
      ))}
      {hasSubmitButton && (
        <div className="skeleton-form__actions">
          <Skeleton height="2.5rem" width="120px" borderRadius="6px" />
          <Skeleton height="2.5rem" width="80px" borderRadius="6px" />
        </div>
      )}
    </div>
  );
};

// Trade history skeleton (specific to our app)
export const SkeletonTradeHistory: React.FC<{
  items?: number;
  className?: string;
}> = ({ items = 5, className = '' }) => {
  return (
    <div className={`skeleton-trade-history ${className}`}>
      {Array.from({ length: items }, (_, index) => (
        <div key={index} className="skeleton-trade-history__item">
          <div className="skeleton-trade-history__header">
            <Skeleton height="1.25rem" width="120px" />
            <Skeleton height="1rem" width="80px" borderRadius="12px" />
          </div>
          <div className="skeleton-trade-history__details">
            <div className="skeleton-trade-history__detail">
              <Skeleton height="0.875rem" width="60px" />
              <Skeleton height="0.875rem" width="40px" />
            </div>
            <div className="skeleton-trade-history__detail">
              <Skeleton height="0.875rem" width="50px" />
              <Skeleton height="0.875rem" width="70px" />
            </div>
            <div className="skeleton-trade-history__detail">
              <Skeleton height="0.875rem" width="40px" />
              <Skeleton height="0.875rem" width="90px" />
            </div>
          </div>
          <div className="skeleton-trade-history__meta">
            <Skeleton height="0.75rem" width="150px" />
            <Skeleton height="0.75rem" width="100px" />
          </div>
        </div>
      ))}
    </div>
  );
};

// Account list skeleton
export const SkeletonAccountList: React.FC<{
  accounts?: number;
  className?: string;
}> = ({ accounts = 3, className = '' }) => {
  return (
    <div className={`skeleton-account-list ${className}`}>
      {Array.from({ length: accounts }, (_, index) => (
        <div key={index} className="skeleton-account-list__item">
          <SkeletonAvatar size="medium" />
          <div className="skeleton-account-list__content">
            <Skeleton height="1.125rem" width="140px" />
            <Skeleton height="0.875rem" width="100px" />
            <Skeleton height="0.75rem" width="80px" />
          </div>
          <div className="skeleton-account-list__actions">
            <Skeleton height="2rem" width="60px" borderRadius="6px" />
            <Skeleton height="2rem" width="80px" borderRadius="6px" />
          </div>
        </div>
      ))}
    </div>
  );
};

// Page skeleton for full page loading
export const SkeletonPage: React.FC<{
  hasHeader?: boolean;
  hasSidebar?: boolean;
  className?: string;
}> = ({ hasHeader = true, hasSidebar = false, className = '' }) => {
  return (
    <div className={`skeleton-page ${className}`}>
      {hasHeader && (
        <div className="skeleton-page__header">
          <Skeleton height="3rem" width="200px" />
          <div className="skeleton-page__header-actions">
            <Skeleton height="2.5rem" width="100px" borderRadius="6px" />
            <Skeleton height="2.5rem" width="120px" borderRadius="6px" />
          </div>
        </div>
      )}
      <div className="skeleton-page__content">
        {hasSidebar && (
          <div className="skeleton-page__sidebar">
            <SkeletonText lines={8} />
          </div>
        )}
        <div className="skeleton-page__main">
          <SkeletonCard hasImage lines={4} />
          <SkeletonTable rows={6} columns={5} />
        </div>
      </div>
    </div>
  );
};

export default Skeleton;
