import React, { useState, useEffect } from 'react';
import Card, { CardHeader, CardContent } from '../ui/Card';
import { Stack, Grid, Flex } from '../ui/Layout';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { useToast } from '../Toast';
import { errorService } from '../../services/errorService';
import type { ErrorSearchFilters, SavedSearch } from '../../types/errorTypes';
import './ErrorAdvancedSearch.css';

export interface ErrorAdvancedSearchProps {
  filters: ErrorSearchFilters;
  onFiltersChange: (filters: ErrorSearchFilters) => void;
  onSearch: () => void;
  onClear: () => void;
}

const ErrorAdvancedSearch: React.FC<ErrorAdvancedSearchProps> = ({
  filters,
  onFiltersChange,
  onSearch,
  onClear
}) => {
  const { showToast } = useToast();
  
  // Local state for form inputs
  const [localFilters, setLocalFilters] = useState<ErrorSearchFilters>(filters);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [saveSearchName, setSaveSearchName] = useState('');
  const [saveSearchDescription, setSaveSearchDescription] = useState('');
  const [loading, setLoading] = useState(false);

  // Load saved searches on mount
  useEffect(() => {
    loadSavedSearches();
  }, []);

  // Update local filters when props change
  useEffect(() => {
    setLocalFilters(filters);
  }, [filters]);

  const loadSavedSearches = async () => {
    try {
      const response = await errorService.getSavedSearches();
      if (response.success) {
        setSavedSearches(response.data);
      }
    } catch (error) {
      console.error('Failed to load saved searches:', error);
    }
  };

  const handleInputChange = (field: keyof ErrorSearchFilters, value: any) => {
    setLocalFilters(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleArrayInputChange = (field: keyof ErrorSearchFilters, value: string) => {
    const values = value.split(',').map(v => v.trim()).filter(v => v);
    setLocalFilters(prev => ({
      ...prev,
      [field]: values.length > 0 ? values : undefined
    }));
  };

  const handleDateRangeChange = (range: string) => {
    const now = new Date();
    let startDate: Date | undefined;
    let endDate: Date | undefined = now;

    switch (range) {
      case '1h':
        startDate = new Date(now.getTime() - 60 * 60 * 1000);
        break;
      case '24h':
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        // Keep existing dates or clear them
        return;
      default:
        startDate = undefined;
        endDate = undefined;
    }

    setLocalFilters(prev => ({
      ...prev,
      startDate,
      endDate
    }));
  };

  const handleApplyFilters = () => {
    onFiltersChange(localFilters);
    onSearch();
  };

  const handleClearFilters = () => {
    const clearedFilters: ErrorSearchFilters = {
      limit: 50,
      offset: 0
    };
    setLocalFilters(clearedFilters);
    onFiltersChange(clearedFilters);
    onClear();
  };

  const handleSaveSearch = async () => {
    if (!saveSearchName.trim()) {
      showToast({
        type: 'error',
        title: 'Name required',
        message: 'Please provide a name for the saved search'
      });
      return;
    }

    try {
      setLoading(true);
      const response = await errorService.createSavedSearch({
        name: saveSearchName,
        description: saveSearchDescription,
        filters: localFilters
      });

      if (response.success) {
        setSavedSearches(prev => [...prev, response.data]);
        setShowSaveDialog(false);
        setSaveSearchName('');
        setSaveSearchDescription('');
        showToast({
          type: 'success',
          title: 'Search saved',
          message: 'Your search has been saved successfully'
        });
      }
    } catch (error) {
      console.error('Failed to save search:', error);
      showToast({
        type: 'error',
        title: 'Failed to save search',
        message: 'Please try again'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleLoadSavedSearch = (search: SavedSearch) => {
    setLocalFilters(search.filters);
    onFiltersChange(search.filters);
    showToast({
      type: 'success',
      title: 'Search loaded',
      message: `Loaded search: ${search.name}`
    });
  };

  const handleDeleteSavedSearch = async (searchId: string) => {
    try {
      const response = await errorService.deleteSavedSearch(searchId);
      if (response.success) {
        setSavedSearches(prev => prev.filter(s => s.id !== searchId));
        showToast({
          type: 'success',
          title: 'Search deleted',
          message: 'Saved search has been deleted'
        });
      }
    } catch (error) {
      console.error('Failed to delete search:', error);
      showToast({
        type: 'error',
        title: 'Failed to delete search',
        message: 'Please try again'
      });
    }
  };

  const formatDateForInput = (date: Date | undefined): string => {
    if (!date) return '';
    return date.toISOString().slice(0, 16); // Format for datetime-local input
  };

  const parseInputDate = (value: string): Date | undefined => {
    if (!value) return undefined;
    return new Date(value);
  };

  return (
    <div className="error-advanced-search">
      <Card>
        <CardHeader 
          title="Advanced Error Search"
          action={
            <Flex gap={2}>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSaveDialog(true)}
                disabled={Object.keys(localFilters).length <= 2} // Only limit and offset
              >
                💾 Save Search
              </Button>
              <Button variant="outline" size="sm" onClick={handleClearFilters}>
                🗑️ Clear All
              </Button>
              <Button variant="primary" size="sm" onClick={handleApplyFilters}>
                🔍 Search
              </Button>
            </Flex>
          }
        />
        <CardContent>
          <Stack gap={4}>
            {/* Basic Filters */}
            <div className="filter-section">
              <h4 className="filter-section-title">Basic Filters</h4>
              <Grid cols={3} gap={3}>
                <div className="filter-group">
                  <label className="filter-label">Trace ID</label>
                  <Input
                    type="text"
                    placeholder="Enter trace ID..."
                    value={localFilters.traceId || ''}
                    onChange={(e) => handleInputChange('traceId', e.target.value || undefined)}
                  />
                </div>

                <div className="filter-group">
                  <label className="filter-label">Error Levels</label>
                  <Input
                    type="text"
                    placeholder="ERROR, WARN, INFO, DEBUG"
                    value={localFilters.level?.join(', ') || ''}
                    onChange={(e) => handleArrayInputChange('level', e.target.value)}
                  />
                </div>

                <div className="filter-group">
                  <label className="filter-label">Sources</label>
                  <Input
                    type="text"
                    placeholder="UI, BE, DB, API"
                    value={localFilters.source?.join(', ') || ''}
                    onChange={(e) => handleArrayInputChange('source', e.target.value)}
                  />
                </div>

                <div className="filter-group">
                  <label className="filter-label">Components</label>
                  <Input
                    type="text"
                    placeholder="Component names..."
                    value={localFilters.component?.join(', ') || ''}
                    onChange={(e) => handleArrayInputChange('component', e.target.value)}
                  />
                </div>

                <div className="filter-group">
                  <label className="filter-label">Error Types</label>
                  <Input
                    type="text"
                    placeholder="Error type names..."
                    value={localFilters.errorType?.join(', ') || ''}
                    onChange={(e) => handleArrayInputChange('errorType', e.target.value)}
                  />
                </div>

                <div className="filter-group">
                  <label className="filter-label">Resolution Status</label>
                  <select
                    className="filter-select"
                    value={localFilters.resolved === undefined ? '' : localFilters.resolved.toString()}
                    onChange={(e) => handleInputChange('resolved', 
                      e.target.value === '' ? undefined : e.target.value === 'true'
                    )}
                  >
                    <option value="">All</option>
                    <option value="true">Resolved</option>
                    <option value="false">Unresolved</option>
                  </select>
                </div>
              </Grid>
            </div>

            {/* Context Filters */}
            <div className="filter-section">
              <h4 className="filter-section-title">Context Filters</h4>
              <Grid cols={2} gap={3}>
                <div className="filter-group">
                  <label className="filter-label">User ID</label>
                  <Input
                    type="text"
                    placeholder="Enter user ID..."
                    value={localFilters.userId || ''}
                    onChange={(e) => handleInputChange('userId', e.target.value || undefined)}
                  />
                </div>

                <div className="filter-group">
                  <label className="filter-label">Broker Name</label>
                  <Input
                    type="text"
                    placeholder="Enter broker name..."
                    value={localFilters.brokerName || ''}
                    onChange={(e) => handleInputChange('brokerName', e.target.value || undefined)}
                  />
                </div>
              </Grid>
            </div>

            {/* Date Range Filters */}
            <div className="filter-section">
              <h4 className="filter-section-title">Date Range</h4>
              <Stack gap={3}>
                <div className="date-range-presets">
                  <Flex gap={2} wrap>
                    {[
                      { label: 'Last Hour', value: '1h' },
                      { label: 'Last 24 Hours', value: '24h' },
                      { label: 'Last 7 Days', value: '7d' },
                      { label: 'Last 30 Days', value: '30d' },
                      { label: 'Custom Range', value: 'custom' },
                      { label: 'All Time', value: 'all' }
                    ].map(preset => (
                      <Button
                        key={preset.value}
                        variant="outline"
                        size="sm"
                        onClick={() => handleDateRangeChange(preset.value)}
                        className={`date-preset ${
                          (preset.value === 'all' && !localFilters.startDate && !localFilters.endDate) ||
                          (preset.value !== 'all' && preset.value !== 'custom' && localFilters.startDate)
                            ? 'active' : ''
                        }`}
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </Flex>
                </div>

                <Grid cols={2} gap={3}>
                  <div className="filter-group">
                    <label className="filter-label">Start Date</label>
                    <Input
                      type="datetime-local"
                      value={formatDateForInput(localFilters.startDate)}
                      onChange={(e) => handleInputChange('startDate', parseInputDate(e.target.value))}
                    />
                  </div>

                  <div className="filter-group">
                    <label className="filter-label">End Date</label>
                    <Input
                      type="datetime-local"
                      value={formatDateForInput(localFilters.endDate)}
                      onChange={(e) => handleInputChange('endDate', parseInputDate(e.target.value))}
                    />
                  </div>
                </Grid>
              </Stack>
            </div>

            {/* Pagination */}
            <div className="filter-section">
              <h4 className="filter-section-title">Results</h4>
              <Grid cols={2} gap={3}>
                <div className="filter-group">
                  <label className="filter-label">Limit</label>
                  <select
                    className="filter-select"
                    value={localFilters.limit || 50}
                    onChange={(e) => handleInputChange('limit', parseInt(e.target.value))}
                  >
                    <option value={25}>25 results</option>
                    <option value={50}>50 results</option>
                    <option value={100}>100 results</option>
                    <option value={200}>200 results</option>
                  </select>
                </div>

                <div className="filter-group">
                  <label className="filter-label">Offset</label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    placeholder="0"
                    value={localFilters.offset || 0}
                    onChange={(e) => handleInputChange('offset', parseInt(e.target.value) || 0)}
                  />
                </div>
              </Grid>
            </div>
          </Stack>
        </CardContent>
      </Card>

      {/* Saved Searches */}
      {savedSearches.length > 0 && (
        <Card>
          <CardHeader title="Saved Searches" />
          <CardContent>
            <div className="saved-searches">
              {savedSearches.map(search => (
                <div key={search.id} className="saved-search-item">
                  <div className="saved-search-info">
                    <div className="saved-search-name">{search.name}</div>
                    {search.description && (
                      <div className="saved-search-description">{search.description}</div>
                    )}
                    <div className="saved-search-meta">
                      Created: {new Date(search.createdAt).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="saved-search-actions">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadSavedSearch(search)}
                    >
                      Load
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeleteSavedSearch(search.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Save Search Dialog */}
      {showSaveDialog && (
        <div className="save-dialog-overlay">
          <div className="save-dialog">
            <Card>
              <CardHeader 
                title="Save Search"
                action={
                  <Button variant="ghost" onClick={() => setShowSaveDialog(false)}>
                    ✕
                  </Button>
                }
              />
              <CardContent>
                <Stack gap={3}>
                  <div className="filter-group">
                    <label className="filter-label">Search Name *</label>
                    <Input
                      type="text"
                      placeholder="Enter a name for this search..."
                      value={saveSearchName}
                      onChange={(e) => setSaveSearchName(e.target.value)}
                    />
                  </div>

                  <div className="filter-group">
                    <label className="filter-label">Description</label>
                    <textarea
                      className="filter-textarea"
                      placeholder="Optional description..."
                      value={saveSearchDescription}
                      onChange={(e) => setSaveSearchDescription(e.target.value)}
                      rows={3}
                    />
                  </div>

                  <Flex gap={2} justify="end">
                    <Button
                      variant="outline"
                      onClick={() => setShowSaveDialog(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleSaveSearch}
                      disabled={loading || !saveSearchName.trim()}
                    >
                      {loading ? 'Saving...' : 'Save Search'}
                    </Button>
                  </Flex>
                </Stack>
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default ErrorAdvancedSearch;