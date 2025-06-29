import React from 'react';
import './SortControls.css';

export interface SortOption {
  value: string;
  label: string;
}

interface SortControlsProps {
  sortOptions: SortOption[];
  selectedSort: string;
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortField: string) => void;
  onOrderChange: () => void;
  className?: string;
}

const SortControls: React.FC<SortControlsProps> = ({
  sortOptions,
  selectedSort,
  sortOrder,
  onSortChange,
  onOrderChange,
  className = ''
}) => {
  return (
    <div className={`sort-controls ${className}`}>
      <span className="sort-controls__label">Sort by:</span>
      <select
        value={selectedSort}
        onChange={(e) => onSortChange(e.target.value)}
        className="sort-controls__select"
      >
        {sortOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <button
        onClick={onOrderChange}
        className="sort-controls__order-btn"
        title={`Sort ${sortOrder === 'asc' ? 'Descending' : 'Ascending'}`}
      >
        {sortOrder === 'asc' ? '↑' : '↓'}
      </button>
    </div>
  );
};

export default SortControls;
