import React from 'react';

interface Column<T extends { [key: string]: any }> {
  key: string;
  label: string;
  width?: string;
  align?: 'left' | 'center' | 'right';
  render?: (value: T[keyof T], row: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T extends { [key: string]: any }> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
  onSort?: (key: string) => void;
  sortKey?: string;
  sortDirection?: 'asc' | 'desc';
}

function DataTable<T extends { [key: string]: any }>({ columns, data, loading = false, emptyMessage = 'No data available', className = '', onSort, sortKey, sortDirection }: DataTableProps<T>) {
  const handleSort = (key: string) => {
    if (!onSort) return;
    
    const newDirection = sortKey === key && sortDirection === 'asc' ? 'desc' : 'asc';
    onSort(key);
  };

  const getSortIcon = (key: string) => {
    if (sortKey !== key) return '↕️';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  if (loading) {
    return (
      <div className={`table-container ${className}`}>
        <div className="flex items-center justify-center p-8">
          <div className="spinner mr-3"></div>
          <span className="text-secondary">Loading...</span>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className={`table-container ${className}`}>
        <div className="flex flex-col items-center justify-center p-8 text-center">
          <span className="text-4xl mb-4">📊</span>
          <h3 className="text-lg font-semibold mb-2">No Data</h3>
          <p className="text-secondary">{emptyMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`table-container ${className}`}>
      <table className="table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{ width: column.width }}
                className={`
                  ${column.align === 'center' ? 'table-cell-center' : ''}
                  ${column.align === 'right' ? 'table-cell-numeric' : ''}
                  ${column.sortable ? 'cursor-pointer hover:bg-neutral-100' : ''}
                `}
                onClick={() => column.sortable && handleSort(column.key)}
              >
                <div className="flex items-center gap-2">
                  <span>{column.label}</span>
                  {column.sortable && (
                    <span className="text-xs opacity-60">
                      {getSortIcon(column.key)}
                    </span>
                  )}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row, index) => (
            <tr key={index}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`
                    ${column.align === 'center' ? 'table-cell-center' : ''}
                    ${column.align === 'right' ? 'table-cell-numeric' : ''}
                  `}
                >
                  {column.render 
                    ? column.render(row[column.key], row)
                    : row[column.key]
                  }
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default DataTable;
