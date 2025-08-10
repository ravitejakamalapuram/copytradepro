import React, { useState, useMemo } from 'react';
import Card, { CardHeader, CardContent } from '../ui/Card';
import { Stack, Flex } from '../ui/Layout';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Table from '../ui/Table';
import Badge from '../ui/Badge';
import { useToast } from '../Toast';
import type { ErrorLogEntry, ErrorSearchFilters } from '../../types/errorTypes';
import './ErrorList.css';

export interface ErrorListProps {
  errors: ErrorLogEntry[];
  totalErrors: number;
  loading: boolean;
  filters: ErrorSearchFilters;
  selectedError: ErrorLogEntry | null;
  onErrorSelect: (error: ErrorLogEntry) => void;
  onFiltersChange: (filters: Partial<ErrorSearchFilters>) => void;
  onRefresh: () => void;
}

const ErrorList: React.FC<ErrorListProps> = ({
  errors,
  totalErrors,
  loading,
  selectedError,
  onErrorSelect,
  onFiltersChange,
  onRefresh
}) => {
  const { showToast } = useToast();
  
  // Local state for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLevel, setSelectedLevel] = useState<string>('all');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedComponent, setSelectedComponent] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('24h');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 25;

  // Memoized filtered and sorted errors
  const filteredErrors = useMemo(() => {
    let filtered = [...errors];

    // Apply search term filter
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(error => 
        error.message.toLowerCase().includes(term) ||
        error.component.toLowerCase().includes(term) ||
        error.operation.toLowerCase().includes(term) ||
        error.traceId.toLowerCase().includes(term)
      );
    }

    // Apply level filter
    if (selectedLevel !== 'all') {
      filtered = filtered.filter(error => error.level === selectedLevel);
    }

    // Apply source filter
    if (selectedSource !== 'all') {
      filtered = filtered.filter(error => error.source === selectedSource);
    }

    // Apply component filter
    if (selectedComponent !== 'all') {
      filtered = filtered.filter(error => error.component === selectedComponent);
    }

    return filtered;
  }, [errors, searchTerm, selectedLevel, selectedSource, selectedComponent]);

  // Paginated errors
  const paginatedErrors = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredErrors.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredErrors, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredErrors.length / itemsPerPage);

  // Get unique values for filter dropdowns
  const uniqueComponents = useMemo(() => {
    const components = [...new Set(errors.map(error => error.component))];
    return components.sort();
  }, [errors]);

  // Helper functions


  const getSeverityBadgeVariant = (level: string): 'default' | 'success' | 'warning' | 'error' => {
    const variants = {
      ERROR: 'error' as const,
      WARN: 'warning' as const,
      INFO: 'success' as const,
      DEBUG: 'default' as const
    };
    return variants[level as keyof typeof variants] || 'default';
  };

  const getSourceIcon = (source: string): string => {
    const icons = {
      UI: '🖥️',
      BE: '⚙️',
      DB: '🗄️',
      API: '🌐'
    };
    return icons[source as keyof typeof icons] || '❓';
  };

  const formatTimestamp = (timestamp: Date): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  const handleApplyFilters = () => {
    const newFilters: Partial<ErrorSearchFilters> = {
      offset: 0 // Reset pagination
    };

    if (selectedLevel !== 'all') {
      newFilters.level = [selectedLevel];
    }

    if (selectedSource !== 'all') {
      newFilters.source = [selectedSource];
    }

    if (selectedComponent !== 'all') {
      newFilters.component = [selectedComponent];
    }

    // Apply date range
    if (dateRange !== 'all') {
      const now = new Date();
      const ranges = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };
      
      const rangeMs = ranges[dateRange as keyof typeof ranges];
      if (rangeMs) {
        newFilters.startDate = new Date(now.getTime() - rangeMs);
        newFilters.endDate = now;
      }
    }

    onFiltersChange(newFilters);
    setCurrentPage(1);
  };

  const handleClearFilters = () => {
    setSearchTerm('');
    setSelectedLevel('all');
    setSelectedSource('all');
    setSelectedComponent('all');
    setDateRange('24h');
    onFiltersChange({
      level: undefined,
      source: undefined,
      component: undefined,
      startDate: undefined,
      endDate: undefined,
      offset: 0
    });
    setCurrentPage(1);
  };

  const handleExportErrors = () => {
    const csvContent = [
      ['Timestamp', 'Level', 'Source', 'Component', 'Operation', 'Message', 'Trace ID'],
      ...filteredErrors.map(error => [
        new Date(error.timestamp).toISOString(),
        error.level,
        error.source,
        error.component,
        error.operation,
        error.message.replace(/,/g, ';'), // Replace commas to avoid CSV issues
        error.traceId
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `error-logs-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    showToast({
      type: 'success',
      title: 'Export completed',
      message: `Exported ${filteredErrors.length} error logs`
    });
  };

  return (
    <div className="error-list">
      <Stack gap={4}>
        {/* Filters Section */}
        <Card>
          <CardHeader 
            title={`Error Logs (${filteredErrors.length} of ${totalErrors})`}
            action={
              <Flex gap={2}>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                >
                  🔍 {showAdvancedFilters ? 'Hide' : 'Show'} Filters
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportErrors}>
                  📊 Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={onRefresh}>
                  🔄 Refresh
                </Button>
              </Flex>
            }
          />
          <CardContent>
            <Stack gap={3}>
              {/* Search Bar */}
              <Input
                type="text"
                placeholder="Search errors by message, component, operation, or trace ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="search-input"
              />

              {/* Quick Filters */}
              <Flex gap={2} wrap>
                <select
                  value={selectedLevel}
                  onChange={(e) => setSelectedLevel(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Levels</option>
                  <option value="ERROR">Error</option>
                  <option value="WARN">Warning</option>
                  <option value="INFO">Info</option>
                  <option value="DEBUG">Debug</option>
                </select>

                <select
                  value={selectedSource}
                  onChange={(e) => setSelectedSource(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Sources</option>
                  <option value="UI">Frontend (UI)</option>
                  <option value="BE">Backend (BE)</option>
                  <option value="DB">Database (DB)</option>
                  <option value="API">External API</option>
                </select>

                <select
                  value={selectedComponent}
                  onChange={(e) => setSelectedComponent(e.target.value)}
                  className="filter-select"
                >
                  <option value="all">All Components</option>
                  {uniqueComponents.map(component => (
                    <option key={component} value={component}>
                      {component}
                    </option>
                  ))}
                </select>

                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="filter-select"
                >
                  <option value="1h">Last Hour</option>
                  <option value="24h">Last 24 Hours</option>
                  <option value="7d">Last 7 Days</option>
                  <option value="30d">Last 30 Days</option>
                  <option value="all">All Time</option>
                </select>

                <Button variant="primary" size="sm" onClick={handleApplyFilters}>
                  Apply Filters
                </Button>
                <Button variant="outline" size="sm" onClick={handleClearFilters}>
                  Clear All
                </Button>
              </Flex>

              {/* Advanced Filters */}
              {showAdvancedFilters && (
                <div className="advanced-filters">
                  <h4>Advanced Filters</h4>
                  <Flex gap={2} wrap>
                    <Input
                      type="text"
                      placeholder="Trace ID"
                      className="filter-input"
                    />
                    <Input
                      type="text"
                      placeholder="User ID"
                      className="filter-input"
                    />
                    <Input
                      type="text"
                      placeholder="Broker Name"
                      className="filter-input"
                    />
                    <select className="filter-select">
                      <option value="">Resolution Status</option>
                      <option value="resolved">Resolved</option>
                      <option value="unresolved">Unresolved</option>
                    </select>
                  </Flex>
                </div>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Error Table */}
        <Card>
          <CardContent>
            {loading ? (
              <div className="loading-state">
                <div className="loading-spinner" />
                <p>Loading error logs...</p>
              </div>
            ) : paginatedErrors.length > 0 ? (
              <div className="error-table-container">
                <Table>
                  <thead>
                    <tr>
                      <th>Level</th>
                      <th>Source</th>
                      <th>Component</th>
                      <th>Message</th>
                      <th>Time</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedErrors.map(error => (
                      <tr 
                        key={error.id}
                        className={`error-row ${selectedError?.id === error.id ? 'selected' : ''}`}
                        onClick={() => onErrorSelect(error)}
                      >
                        <td>
                          <Badge variant={getSeverityBadgeVariant(error.level)}>
                            {error.level}
                          </Badge>
                        </td>
                        <td>
                          <div className="source-cell">
                            <span className="source-icon">{getSourceIcon(error.source)}</span>
                            <span className="source-text">{error.source}</span>
                          </div>
                        </td>
                        <td>
                          <span className="component-name">{error.component}</span>
                        </td>
                        <td>
                          <div className="message-cell">
                            <div className="message-text" title={error.message}>
                              {error.message}
                            </div>
                            <div className="message-meta">
                              {error.operation} • {error.traceId.substring(0, 8)}...
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="time-cell">
                            <div className="time-relative">{formatTimestamp(error.timestamp)}</div>
                            <div className="time-absolute">
                              {new Date(error.timestamp).toLocaleTimeString()}
                            </div>
                          </div>
                        </td>
                        <td>
                          <Flex gap={1}>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                onErrorSelect(error);
                              }}
                            >
                              View
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(error.traceId);
                                showToast({
                                  type: 'success',
                                  title: 'Copied',
                                  message: 'Trace ID copied to clipboard'
                                });
                              }}
                            >
                              Copy ID
                            </Button>
                          </Flex>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            ) : (
              <div className="empty-state">
                <div className="empty-icon">🔍</div>
                <h3>No errors found</h3>
                <p>Try adjusting your filters or search criteria</p>
                <Button variant="outline" onClick={handleClearFilters}>
                  Clear Filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {totalPages > 1 && (
          <Card>
            <CardContent>
              <Flex justify="between" align="center">
                <div className="pagination-info">
                  Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredErrors.length)} of {filteredErrors.length} errors
                </div>
                <Flex gap={2}>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === 1}
                    onClick={() => setCurrentPage(currentPage - 1)}
                  >
                    ← Previous
                  </Button>
                  
                  <div className="page-numbers">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = Math.max(1, Math.min(totalPages - 4, currentPage - 2)) + i;
                      return (
                        <button
                          key={pageNum}
                          className={`page-number ${currentPage === pageNum ? 'active' : ''}`}
                          onClick={() => setCurrentPage(pageNum)}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    disabled={currentPage === totalPages}
                    onClick={() => setCurrentPage(currentPage + 1)}
                  >
                    Next →
                  </Button>
                </Flex>
              </Flex>
            </CardContent>
          </Card>
        )}
      </Stack>
    </div>
  );
};

export default ErrorList;