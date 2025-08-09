import React, { useState, useEffect } from 'react';
import Card, { CardHeader, CardContent } from '../ui/Card';
import { Stack, Grid, Flex } from '../ui/Layout';
import Button from '../ui/Button';

import Badge from '../ui/Badge';
import { useToast } from '../Toast';
import { errorService } from '../../services/errorService';
import type { ErrorLogEntry, TraceLifecycle } from '../../types/errorTypes';
import './ErrorDetail.css';

export interface ErrorDetailProps {
  error: ErrorLogEntry;
  onClose: () => void;
  onResolve: (errorId: string, resolution: string) => void;
}

const ErrorDetail: React.FC<ErrorDetailProps> = ({
  error,
  onClose,
  onResolve
}) => {
  const { showToast } = useToast();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [traceLifecycle, setTraceLifecycle] = useState<TraceLifecycle | null>(null);
  const [relatedErrors, setRelatedErrors] = useState<ErrorLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<'details' | 'trace' | 'context' | 'resolution'>('details');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  const loadErrorDetails = async () => {
    try {
      setLoading(true);
      
      const [traceResponse, relatedResponse] = await Promise.all([
        errorService.getTraceLifecycle(error.traceId),
        errorService.getRelatedErrors(error.traceId)
      ]);

      if (traceResponse.success) {
        setTraceLifecycle(traceResponse.data);
      }

      if (relatedResponse.success) {
        setRelatedErrors(relatedResponse.data.filter(e => e.id !== error.id));
      }
    } catch (err) {
      console.error('Failed to load error details:', err);
      showToast({
        type: 'error',
        title: 'Failed to load error details',
        message: 'Some information may be incomplete'
      });
    } finally {
      setLoading(false);
    }
  };

  // Load additional error data
  useEffect(() => {
    loadErrorDetails();
  }, [error.id, loadErrorDetails]);

  const handleResolve = async () => {
    if (!resolutionNotes.trim()) {
      showToast({
        type: 'error',
        title: 'Resolution notes required',
        message: 'Please provide details about how this error was resolved'
      });
      return;
    }

    try {
      setResolving(true);
      const response = await errorService.resolveError(error.id, resolutionNotes);
      
      if (response.success) {
        showToast({
          type: 'success',
          title: 'Error resolved',
          message: 'Error has been marked as resolved'
        });
        onResolve(error.id, resolutionNotes);
      }
    } catch (err) {
      console.error('Failed to resolve error:', err);
      showToast({
        type: 'error',
        title: 'Failed to resolve error',
        message: 'Please try again'
      });
    } finally {
      setResolving(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    showToast({
      type: 'success',
      title: 'Copied',
      message: `${label} copied to clipboard`
    });
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

  const getSourceIcon = (source: string): string => {
    const icons = {
      UI: '🖥️',
      BE: '⚙️',
      DB: '🗄️',
      API: '🌐'
    };
    return icons[source as keyof typeof icons] || '❓';
  };

  const formatDuration = (startTime: Date, endTime?: Date): string => {
    if (!endTime) return 'Ongoing';
    const durationMs = new Date(endTime).getTime() - new Date(startTime).getTime();
    if (durationMs < 1000) return `${durationMs}ms`;
    if (durationMs < 60000) return `${(durationMs / 1000).toFixed(1)}s`;
    return `${(durationMs / 60000).toFixed(1)}m`;
  };

  return (
    <div className="error-detail-modal">
      <div className="error-detail-backdrop" onClick={onClose} />
      <div className="error-detail-container">
        <Card className="error-detail-card">
          {/* Header */}
          <CardHeader
            title="Error Details"
            action={
              <Button variant="ghost" onClick={onClose}>
                ✕
              </Button>
            }
          />

          <CardContent>
            <Stack gap={4}>
              {/* Error Summary */}
              <div className="error-summary">
                <h3 className="error-message">{error.message}</h3>
                <div className="error-meta">
                  <span className="meta-item">
                    <strong>Component:</strong> {error.component}
                  </span>
                  <span className="meta-item">
                    <strong>Operation:</strong> {error.operation}
                  </span>
                  <span className="meta-item">
                    <strong>Time:</strong> {new Date(error.timestamp).toLocaleString()}
                  </span>
                  <span className="meta-item">
                    <strong>Trace ID:</strong> 
                    <code 
                      className="trace-id"
                      onClick={() => copyToClipboard(error.traceId, 'Trace ID')}
                    >
                      {error.traceId}
                    </code>
                  </span>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="error-detail-tabs">
                {[
                  { key: 'details', label: 'Details', icon: '📋' },
                  { key: 'trace', label: 'Trace Lifecycle', icon: '🔄' },
                  { key: 'context', label: 'Context', icon: '🔍' },
                  { key: 'resolution', label: 'Resolution', icon: '✅' }
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
                  >
                    <span className="tab-icon">{tab.icon}</span>
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Tab Content */}
              <div className="tab-content">
                {/* Details Tab */}
                {activeTab === 'details' && (
                  <Stack gap={3}>
                    <Grid cols={2} gap={4}>
                      <div className="detail-section">
                        <h4>Error Information</h4>
                        <div className="detail-grid">
                          <div className="detail-item">
                            <span className="detail-label">Error Type:</span>
                            <span className="detail-value">{error.errorType}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Source:</span>
                            <span className="detail-value">
                              {getSourceIcon(error.source)} {error.source}
                            </span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Component:</span>
                            <span className="detail-value">{error.component}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Operation:</span>
                            <span className="detail-value">{error.operation}</span>
                          </div>
                        </div>
                      </div>

                      <div className="detail-section">
                        <h4>System Information</h4>
                        <div className="detail-grid">
                          <div className="detail-item">
                            <span className="detail-label">Environment:</span>
                            <span className="detail-value">{error.metadata.environment}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Version:</span>
                            <span className="detail-value">{error.metadata.version}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Platform:</span>
                            <span className="detail-value">{error.metadata.platform}</span>
                          </div>
                          <div className="detail-item">
                            <span className="detail-label">Node Version:</span>
                            <span className="detail-value">{error.metadata.nodeVersion}</span>
                          </div>
                        </div>
                      </div>
                    </Grid>

                    {/* Stack Trace */}
                    {error.stackTrace && (
                      <div className="detail-section">
                        <Flex justify="between" align="center">
                          <h4>Stack Trace</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => copyToClipboard(error.stackTrace!, 'Stack trace')}
                          >
                            📋 Copy
                          </Button>
                        </Flex>
                        <pre className="stack-trace">
                          {error.stackTrace}
                        </pre>
                      </div>
                    )}

                    {/* Related Errors */}
                    {relatedErrors.length > 0 && (
                      <div className="detail-section">
                        <h4>Related Errors ({relatedErrors.length})</h4>
                        <div className="related-errors">
                          {relatedErrors.slice(0, 3).map(relatedError => (
                            <div key={relatedError.id} className="related-error-item">
                              <Badge variant={getSeverityBadgeVariant(relatedError.level)}>
                                {relatedError.level}
                              </Badge>
                              <div className="related-error-info">
                                <div className="related-error-message">
                                  {relatedError.message}
                                </div>
                                <div className="related-error-meta">
                                  {relatedError.component} • {new Date(relatedError.timestamp).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          ))}
                          {relatedErrors.length > 3 && (
                            <div className="related-errors-more">
                              +{relatedErrors.length - 3} more errors in this trace
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Stack>
                )}

                {/* Trace Lifecycle Tab */}
                {activeTab === 'trace' && (
                  <div className="trace-section">
                    {loading ? (
                      <div className="loading-state">
                        <div className="loading-spinner" />
                        <p>Loading trace lifecycle...</p>
                      </div>
                    ) : traceLifecycle ? (
                      <Stack gap={3}>
                        <div className="trace-summary">
                          <Grid cols={3} gap={4}>
                            <div className="trace-stat">
                              <div className="trace-stat-value">
                                {formatDuration(traceLifecycle.startTime, traceLifecycle.endTime)}
                              </div>
                              <div className="trace-stat-label">Total Duration</div>
                            </div>
                            <div className="trace-stat">
                              <div className="trace-stat-value">
                                {traceLifecycle.operations.length}
                              </div>
                              <div className="trace-stat-label">Operations</div>
                            </div>
                            <div className="trace-stat">
                              <div className="trace-stat-value error">
                                {traceLifecycle.errorCount}
                              </div>
                              <div className="trace-stat-label">Errors</div>
                            </div>
                          </Grid>
                        </div>

                        <div className="trace-timeline">
                          <h4>Operation Timeline</h4>
                          <div className="timeline">
                            {traceLifecycle.operations.map((operation, index) => (
                              <div key={index} className="timeline-item">
                                <div className={`timeline-marker ${operation.status.toLowerCase()}`} />
                                <div className="timeline-content">
                                  <div className="timeline-header">
                                    <span className="timeline-operation">{operation.operation}</span>
                                    <span className="timeline-component">{operation.component}</span>
                                    <Badge 
                                      variant={operation.status === 'SUCCESS' ? 'success' : 
                                              operation.status === 'ERROR' ? 'error' : 'default'}
                                    >
                                      {operation.status}
                                    </Badge>
                                  </div>
                                  <div className="timeline-meta">
                                    <span>Duration: {formatDuration(operation.startTime, operation.endTime)}</span>
                                    <span>Started: {new Date(operation.startTime).toLocaleTimeString()}</span>
                                  </div>
                                  {operation.metadata && (
                                    <div className="timeline-metadata">
                                      <pre>{JSON.stringify(operation.metadata, null, 2)}</pre>
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </Stack>
                    ) : (
                      <div className="empty-state">
                        <div className="empty-icon">🔄</div>
                        <h3>No trace data available</h3>
                        <p>Trace lifecycle information could not be loaded</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Context Tab */}
                {activeTab === 'context' && (
                  <Stack gap={3}>
                    <div className="context-section">
                      <h4>Request Context</h4>
                      <div className="context-grid">
                        {Object.entries(error.context).map(([key, value]) => (
                          value && (
                            <div key={key} className="context-item">
                              <span className="context-label">{key}:</span>
                              <span className="context-value">
                                {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                              </span>
                            </div>
                          )
                        ))}
                      </div>
                    </div>

                    <div className="context-section">
                      <h4>Raw Error Data</h4>
                      <pre className="raw-data">
                        {JSON.stringify(error, null, 2)}
                      </pre>
                    </div>
                  </Stack>
                )}

                {/* Resolution Tab */}
                {activeTab === 'resolution' && (
                  <Stack gap={3}>
                    <div className="resolution-section">
                      <h4>Mark Error as Resolved</h4>
                      <p className="resolution-description">
                        Provide details about how this error was resolved to help with future debugging.
                      </p>
                      
                      <div className="resolution-form">
                        <textarea
                          className="resolution-textarea"
                          placeholder="Describe how this error was resolved, what caused it, and any preventive measures taken..."
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          rows={6}
                        />
                        
                        <Flex gap={2} justify="end">
                          <Button variant="outline" onClick={onClose}>
                            Cancel
                          </Button>
                          <Button
                            variant="primary"
                            onClick={handleResolve}
                            disabled={resolving || !resolutionNotes.trim()}
                          >
                            {resolving ? 'Resolving...' : 'Mark as Resolved'}
                          </Button>
                        </Flex>
                      </div>
                    </div>
                  </Stack>
                )}
              </div>
            </Stack>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ErrorDetail;