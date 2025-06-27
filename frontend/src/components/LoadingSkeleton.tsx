import React from 'react';

interface SkeletonProps {
  width?: string;
  height?: string;
  className?: string;
  variant?: 'text' | 'rectangular' | 'circular';
}

const Skeleton: React.FC<SkeletonProps> = ({
  width = '100%',
  height = '1rem',
  className = '',
  variant = 'rectangular'
}) => {
  const getVariantClass = () => {
    switch (variant) {
      case 'circular':
        return 'rounded-full';
      case 'text':
        return 'rounded';
      default:
        return 'rounded-md';
    }
  };

  return (
    <div
      className={`bg-neutral-200 animate-pulse ${getVariantClass()} ${className}`}
      style={{ width, height }}
    />
  );
};

// Table Skeleton
export const TableSkeleton: React.FC<{ rows?: number; columns?: number }> = ({
  rows = 5,
  columns = 4
}) => {
  return (
    <div className="table-container">
      <table className="table">
        <thead>
          <tr>
            {Array.from({ length: columns }).map((_, index) => (
              <th key={index}>
                <Skeleton height="1.25rem" width="80%" />
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: rows }).map((_, rowIndex) => (
            <tr key={rowIndex}>
              {Array.from({ length: columns }).map((_, colIndex) => (
                <td key={colIndex}>
                  <Skeleton height="1rem" width={colIndex === 0 ? '60%' : '80%'} />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

// Card Skeleton
export const CardSkeleton: React.FC = () => {
  return (
    <div className="card">
      <div className="card-header">
        <Skeleton height="1.5rem" width="40%" className="mb-2" />
        <Skeleton height="1rem" width="60%" />
      </div>
      <div className="card-body">
        <Skeleton height="1rem" width="100%" className="mb-3" />
        <Skeleton height="1rem" width="80%" className="mb-3" />
        <Skeleton height="1rem" width="90%" className="mb-3" />
        <div className="flex gap-3">
          <Skeleton height="2.5rem" width="6rem" />
          <Skeleton height="2.5rem" width="6rem" />
        </div>
      </div>
    </div>
  );
};

// Form Skeleton
export const FormSkeleton: React.FC = () => {
  return (
    <div className="space-y-5">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={index} className="form-group">
          <Skeleton height="1rem" width="25%" className="mb-2" />
          <Skeleton height="2.5rem" width="100%" />
        </div>
      ))}
      <div className="flex gap-3">
        <Skeleton height="2.5rem" width="6rem" />
        <Skeleton height="2.5rem" width="6rem" />
      </div>
    </div>
  );
};

export default Skeleton;
