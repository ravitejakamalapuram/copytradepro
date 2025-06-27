/**
 * ENTERPRISE TABLE COMPONENT
 * CSS-only implementation to avoid CSSStyleDeclaration issues
 */

import React from 'react';
import './Table.css';

export interface TableProps extends React.TableHTMLAttributes<HTMLTableElement> {
  /** Table variant */
  variant?: 'default' | 'striped' | 'bordered';
  /** Table size */
  size?: 'sm' | 'base' | 'lg';
  /** Hover effect on rows */
  hoverable?: boolean;
}

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  (
    {
      variant = 'default',
      size = 'base',
      hoverable = true,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const tableClasses = [
      'enterprise-table',
      `enterprise-table--${variant}`,
      `enterprise-table--${size}`,
      hoverable && 'enterprise-table--hoverable',
      className
    ].filter(Boolean).join(' ');

    return (
      <div className="enterprise-table-container">
        <table
          ref={ref}
          className={tableClasses}
          {...props}
        >
          {children}
        </table>
      </div>
    );
  }
);

Table.displayName = 'Table';

// Table Header Component
export interface TableHeaderProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export const TableHeader = React.forwardRef<HTMLTableSectionElement, TableHeaderProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <thead
        ref={ref}
        className={`enterprise-table-header ${className}`}
        {...props}
      >
        {children}
      </thead>
    );
  }
);

TableHeader.displayName = 'TableHeader';

// Table Body Component
export interface TableBodyProps extends React.HTMLAttributes<HTMLTableSectionElement> {}

export const TableBody = React.forwardRef<HTMLTableSectionElement, TableBodyProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <tbody
        ref={ref}
        className={`enterprise-table-body ${className}`}
        {...props}
      >
        {children}
      </tbody>
    );
  }
);

TableBody.displayName = 'TableBody';

// Table Row Component
export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  /** Clickable row */
  clickable?: boolean;
  /** Selected state */
  selected?: boolean;
}

export const TableRow = React.forwardRef<HTMLTableRowElement, TableRowProps>(
  (
    {
      clickable = false,
      selected = false,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const rowClasses = [
      'enterprise-table-row',
      clickable && 'enterprise-table-row--clickable',
      selected && 'enterprise-table-row--selected',
      className
    ].filter(Boolean).join(' ');

    return (
      <tr
        ref={ref}
        className={rowClasses}
        {...props}
      >
        {children}
      </tr>
    );
  }
);

TableRow.displayName = 'TableRow';

// Table Header Cell Component
export interface TableHeaderCellProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  /** Sortable column */
  sortable?: boolean;
  /** Sort direction */
  sortDirection?: 'asc' | 'desc' | null;
}

export const TableHeaderCell = React.forwardRef<HTMLTableCellElement, TableHeaderCellProps>(
  (
    {
      sortable = false,
      sortDirection = null,
      children,
      className = '',
      ...props
    },
    ref
  ) => {
    const headerClasses = [
      'enterprise-table-header-cell',
      sortable && 'enterprise-table-header-cell--sortable',
      sortDirection && `enterprise-table-header-cell--sort-${sortDirection}`,
      className
    ].filter(Boolean).join(' ');

    const sortIcon = sortDirection === 'asc' ? '↑' : sortDirection === 'desc' ? '↓' : '';

    return (
      <th
        ref={ref}
        className={headerClasses}
        {...props}
      >
        <div className="enterprise-table-header-cell-content">
          {children}
          {sortable && (
            <span className="enterprise-table-header-cell-sort-icon">
              {sortIcon || '↕'}
            </span>
          )}
        </div>
      </th>
    );
  }
);

TableHeaderCell.displayName = 'TableHeaderCell';

// Table Cell Component
export interface TableCellProps extends React.TdHTMLAttributes<HTMLTableCellElement> {}

export const TableCell = React.forwardRef<HTMLTableCellElement, TableCellProps>(
  ({ children, className = '', ...props }, ref) => {
    return (
      <td
        ref={ref}
        className={`enterprise-table-cell ${className}`}
        {...props}
      >
        {children}
      </td>
    );
  }
);

TableCell.displayName = 'TableCell';

export default Table;
