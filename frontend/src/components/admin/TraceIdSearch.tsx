import React, { useState, useEffect } from 'react';
import Card, { CardHeader, CardContent } from '../ui/Card';
import { Stack, Flex } from '../ui/Layout';
import Button from '../ui/Button';
import Input from '../ui/Input';
import Badge from '../ui/Badge';
import { useToast } from '../Toast';
import { errorService } from '../../services/errorService';
import type { ErrorLogEntry, TraceLifecycle } from '../../types/errorTypes';
import './TraceIdSearch.css';

export interface TraceIdSearchProps {
  onErrorSelect?: (error: ErrorLogEntry) => void;
  onTraceSelect?: (trace: TraceLifecycle) => void;
}

const TraceIdSearch: React.FC<TraceIdSearchProps> = ({
  onErrorSelect,
  onTraceSelect
}) => {
  const { showToast } = useToast();
  
  // State management
  const [traceId, setTraceId] = useState('');
  const [loading, setLoading] = useState(false);
  const [traceLifecycle, setTraceLifecycle] = useState<TraceLifecycle | null>(null);
  const [relatedErrors, setRelatedErrors] = useState<ErrorLogEntry[]>([]);
  const [recentTraces, setRecentTraces] = useState<string[]>([]);

  // Load recent traces from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('recentTraceSearches');
    if (stored) {
      try {
        setRecentTraces(JSON.parse(stored));
      } catch (error) {
        console.error('Failed to parse recent traces:', error);
      }
    }
  }, []);

  const saveRecentTrace = (id: string) => {
    const updated = [id, ...recentTraces.filter(t => t !== id)].slice(0, 10);
    setRecentTraces(updated);
    localStorage.setItem('recentTraceSearches', JSON.stringify(updated));
  };

  const handleSearch = async () => {
    if (!traceId.trim()) {
      showToast({
        type: 'error',
        title: 'Trace ID required',
        message: 'Please enter a trace ID to search'
      });
      return;
    }

    try {
      setLoading(true);
      
      const [traceResponse, errorsResponse] = await Promise.all([
        errorService.getTraceLifecycle(traceId.trim()),
        errorService.getRelatedErrors(traceId.trim())
      ]);

      if (traceResponse.success) {
        setTraceLifecycle(traceResponse.data);
        saveRecentTrace(traceId.trim());
        onTraceSelect?.(traceResponse.data);
      } else {
        setTraceLifecycle(null);
        showToast({
          type: 'warning',
          title: 'Trace not found',
          message: 'No trace lifecycle found for this ID'
        });
      }

      if (errorsResponse.success) {
        setRelatedErrors(errorsResponse.data);
      } else {
        setRelatedErrors([]);
      }

      if (!traceResponse.success && !errorsResponse.success) {
        showToast({
          type: 'error',
          title: 'No data found',
          message: 'No trace or error data found for this ID'
        });
      }
    } catch (error) {
      console.error('Failed to search trace:', error);
      showToast({
        type: 'error',
        title: 'Search failed',
        message: 'Failed to search for trace data'
      });
      setTraceLifecycle(null);
      setRelatedErrors([]);
    } finally {
      setLoading(false);
    }
  };

  const handleClear = () => {
    setTraceId('');
    setTraceLifecycle(null);
    setRelatedErrors([]);
  };

  const handleRecentTraceClick = (id: string) => {
    setTraceId(id);
  };

  const formatDuration = (startTime: Date, endTime?: Date): string => {
    if (!endTime) return 'Ongoing';
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
  };



  const getStatusBadgeVariant = (status: string): 'default' | 'success' | 'warning' | 'error' => {
    switch (status) {
      case 'SUCCESS': return 'success';
      case 'ERROR': return 'error';
      case 'PENDING': return 'warning';
      default: return 'default';
    }
  };

  const getSeverityBadgeVariant = (level: string): 'default' | 'success' | 'warning' | 'error' => {
    const variants = {
      ERROR: 'error' as const,
      WARN: 'warning' as const,
      INFO: 'success' as const,
      DEBUG: 'default' as const
    };
    return variants[level as keyof typeof variants] || 'default';
  };

  return (
    <div className="trace-id-search">
      <Stack gap={4}>
        {/* Search Input */}
        <Card>
          <CardHeader title="🔍 Trace ID Search" />
          <CardContent>
            <Stack gap={3}>
              <div className="search-input-group">
                <Input
                  type="text"
                  placeholder="Enter trace ID (e.g., trace_abc123def456...)"
                  value={traceId}
                  onChange={(e) => setTraceId(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                  className="trace-input"
                />
                <Flex gap={2}>
                  <Button
                    variant="primary"
                    onClick={handleSearch}
                    disabled={loading || !traceId.trim()}
                  >
                    {loading ? '🔄 Searching...' : '🔍 Search'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleClear}
                    disabled={!traceId && !traceLifecycle && relatedErrors.length === 0}
                  >
                    🗑️ Clear
                  </Button>
                </Flex>
              </div>

              {/* Recent Traces */}
              {recentTraces.length > 0 && (
                <div className="recent-traces">
                  <h4 className="recent-traces-title">Recent Searches</h4>
                  <div className="recent-traces-list">
                    {recentTraces.map(id => (
                      <button
                        key={id}
                        className="recent-trace-item"
                        onClick={() => handleRecentTraceClick(id)}
                      >
                        <code className="trace-id-code">{id}</code>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Stack>
          </CardContent>
        </Card>

        {/* Trace Lifecycle Results */}
        {traceLifecycle && (
          <Card>
            <CardHeader 
              title="📊 Trace Lifecycle"
              action={
                <Badge variant={getStatusBadgeVariant(traceLifecycle.status)}>
                  {traceLifecycle.status}
                </Badge>
              }
            />
            <CardContent>
              <Stack gap={3}>
                {/* Trace Summary */}
                <div className="trace-summary">
                  <div className="trace-summary-grid">
                    <div className="trace-stat">
                      <div className="trace-stat-label">Duration</div>
                      <div className="trace-stat-value">
                        {formatDuration(traceLifecycle.startTime, traceLifecycle.endTime)}
                      </div>
                    </div>
                    <div className="trace-stat">
                      <div className="trace-stat-label">Operations</div>
                      <div className="trace-stat-value">
                        {traceLifecycle.operations.length}
                      </div>
                    </div>
                    <div className="trace-stat">
                      <div className="trace-stat-label">Errors</div>
                      <div className="trace-stat-value error">
                        {traceLifecycle.errorCount}
                      </div>
                    </div>
                    <div className="trace-stat">
                      <div className="trace-stat-label">Warnings</div>
                      <div className="trace-stat-value warning">
                        {traceLifecycle.warningCount}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Operations Timeline */}
                <div className="operations-timeline">
                  <h4 className="timeline-title">Operations Timeline</h4>
                  <div className="timeline">
                    {traceLifecycle.operations.map((operation, index) => (
                      <div key={index} className="timeline-item">
                        <div className={`timeline-marker ${operation.status.toLowerCase()}`} />
                        <div className="timeline-content">
                          <div className="timeline-header">
                            <span className="timeline-operation">{operation.operation}</span>
                            <span className="timeline-component">{operation.component}</span>
                            <Badge variant={getStatusBadgeVariant(operation.status)}>
                              {operation.status}
                            </Badge>
                          </div>
                          <div className="timeline-meta">
                            <span>Duration: {formatDuration(operation.startTime, operation.endTime)}</span>
                            <span>Started: {new Date(operation.startTime).toLocaleTimeString()}</span>
                          </div>
                          {operation.metadata && (
                            <div className="timeline-metadata">
                              <details>
                                <summary>Metadata</summary>
                                <pre>{JSON.stringify(operation.metadata, null, 2)}</pre>
                              </details>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </Stack>
            </CardContent>
          </Card>
        )}

        {/* Related Errors */}
        {relatedErrors.length > 0 && (
          <Card>
            <CardHeader title={`🚨 Related Errors (${relatedErrors.length})`} />
            <CardContent>
              <div className="related-errors-list">
                {relatedErrors.map(error => (
                  <div 
                    key={error.id} 
                    className="related-error-item"
                    onClick={() => onErrorSelect?.(error)}
                  >
                    <div className="error-indicator">
                      <Badge variant={getSeverityBadgeVariant(error.level)}>
                        {error.level}
                      </Badge>
                    </div>
                    <div className="error-content">
                      <div className="error-message">{error.message}</div>
                      <div className="error-meta">
                        <span className="error-component">{error.component}</span>
                        <span className="error-operation">{error.operation}</span>
                        <span className="error-time">
                          {new Date(error.timestamp).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <div className="error-actions">
                      <Button variant="ghost" size="sm">
                        View Details →
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* No Results */}
        {!loading && traceId && !traceLifecycle && relatedErrors.length === 0 && (
          <Card>
            <CardContent>
              <div className="no-results">
                <div className="no-results-icon">🔍</div>
                <h3>No Results Found</h3>
                <p>No trace lifecycle or error data found for trace ID: <code>{traceId}</code></p>
                <p>Please check the trace ID and try again.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </Stack>
    </div>
  );
};

export default TraceIdSearch;