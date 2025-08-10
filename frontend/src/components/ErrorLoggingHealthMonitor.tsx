/**
 * Error Logging Health Monitor Component
 * Displays the status of the error logging system and provides admin controls
 */

import React, { useState, useEffect } from 'react';
import api from '../services/api';

interface ErrorLoggingHealth {
  status: 'healthy' | 'degraded' | 'unknown';
  timestamp: string;
  queue: {
    size: number;
    isProcessing: boolean;
  };
  circuitBreaker: {
    isOpen: boolean;
    failureCount: number;
  };
  recommendations: string[];
}

interface ErrorLoggingMetrics {
  timestamp: string;
  queue: {
    currentSize: number;
    isProcessing: boolean;
    status: 'empty' | 'normal' | 'elevated' | 'critical';
  };
  circuitBreaker: {
    isOpen: boolean;
    failureCount: number;
    status: 'open' | 'closed';
  };
  systemHealth: {
    overall: 'healthy' | 'warning' | 'degraded';
    errorLoggingAvailable: boolean;
    queueBackpressure: boolean;
  };
}

const ErrorLoggingHealthMonitor: React.FC = () => {
  const [health, setHealth] = useState<ErrorLoggingHealth | null>(null);
  const [metrics, setMetrics] = useState<ErrorLoggingMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchHealthStatus = async () => {
    try {
      const response = await api.get<{ success: boolean; data: ErrorLoggingHealth }>('/error-logging-health/status');
      setHealth(response.data.data);
      setError(null);
    } catch (err: unknown) {
      setError('Failed to fetch error logging health status');
      console.error('Error fetching health status:', err);
    }
  };

  const fetchMetrics = async () => {
    try {
      const response = await api.get<{ success: boolean; data: ErrorLoggingMetrics }>('/error-logging-health/metrics');
      setMetrics(response.data.data);
    } catch (err: unknown) {
      console.error('Error fetching metrics:', err);
    }
  };

  const resetCircuitBreaker = async () => {
    setActionLoading('reset');
    try {
      await api.post('/error-logging-health/reset-circuit-breaker');
      await fetchHealthStatus();
      await fetchMetrics();
    } catch {
      setError('Failed to reset circuit breaker');
    } finally {
      setActionLoading(null);
    }
  };

  const forceProcessQueue = async () => {
    setActionLoading('process');
    try {
      await api.post('/error-logging-health/force-process-queue');
      await fetchHealthStatus();
      await fetchMetrics();
    } catch {
      setError('Failed to process queue');
    } finally {
      setActionLoading(null);
    }
  };

  const clearQueue = async () => {
    if (!window.confirm('Are you sure you want to clear the error queue? This will permanently delete queued errors.')) {
      return;
    }

    setActionLoading('clear');
    try {
      await api.post('/error-logging-health/clear-queue');
      await fetchHealthStatus();
      await fetchMetrics();
    } catch {
      setError('Failed to clear queue');
    } finally {
      setActionLoading(null);
    }
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      await Promise.all([fetchHealthStatus(), fetchMetrics()]);
      setLoading(false);
    };

    fetchData();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);



  const getStatusBadge = (status: string) => {
    const baseClasses = 'px-2 py-1 rounded-full text-xs font-medium';
    switch (status) {
      case 'healthy':
      case 'empty':
      case 'normal':
      case 'closed':
        return `${baseClasses} bg-green-100 text-green-800`;
      case 'warning':
      case 'elevated':
        return `${baseClasses} bg-yellow-100 text-yellow-800`;
      case 'degraded':
      case 'critical':
      case 'open':
        return `${baseClasses} bg-red-100 text-red-800`;
      default:
        return `${baseClasses} bg-gray-100 text-gray-800`;
    }
  };

  if (loading) {
    return (
      <div className="p-6 bg-white rounded-lg shadow">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-gray-900">Error Logging System Health</h2>
          <button
            onClick={() => Promise.all([fetchHealthStatus(), fetchMetrics()])}
            className="px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {health && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Overall Status */}
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Overall Status</h3>
                <span className={getStatusBadge(health.status)}>
                  {health.status.toUpperCase()}
                </span>
              </div>

              {/* Queue Status */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Error Queue</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Size:</span>
                    <span className={`text-sm font-medium ${health.queue.size > 100 ? 'text-red-600' : 'text-green-600'}`}>
                      {health.queue.size}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Processing:</span>
                    <span className={`text-sm font-medium ${health.queue.isProcessing ? 'text-blue-600' : 'text-gray-600'}`}>
                      {health.queue.isProcessing ? 'Yes' : 'No'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Circuit Breaker Status */}
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-2">Circuit Breaker</h3>
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Status:</span>
                    <span className={getStatusBadge(health.circuitBreaker.isOpen ? 'open' : 'closed')}>
                      {health.circuitBreaker.isOpen ? 'OPEN' : 'CLOSED'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Failures:</span>
                    <span className={`text-sm font-medium ${health.circuitBreaker.failureCount > 0 ? 'text-red-600' : 'text-green-600'}`}>
                      {health.circuitBreaker.failureCount}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Metrics */}
            {metrics && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">System Health</h3>
                  <div className="space-y-1">
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Overall:</span>
                      <span className={getStatusBadge(metrics.systemHealth.overall)}>
                        {metrics.systemHealth.overall.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Logging Available:</span>
                      <span className={`text-sm font-medium ${metrics.systemHealth.errorLoggingAvailable ? 'text-green-600' : 'text-red-600'}`}>
                        {metrics.systemHealth.errorLoggingAvailable ? 'Yes' : 'No'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-gray-600">Backpressure:</span>
                      <span className={`text-sm font-medium ${metrics.systemHealth.queueBackpressure ? 'text-red-600' : 'text-green-600'}`}>
                        {metrics.systemHealth.queueBackpressure ? 'Yes' : 'No'}
                      </span>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-medium text-gray-700 mb-2">Queue Details</h3>
                  <span className={getStatusBadge(metrics.queue.status)}>
                    {metrics.queue.status.toUpperCase()}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recommendations */}
        {health?.recommendations && health.recommendations.length > 0 && (
          <div className="mt-6">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Recommendations</h3>
            <ul className="space-y-1">
              {health.recommendations.map((recommendation, index) => (
                <li key={index} className="text-sm text-yellow-700 bg-yellow-50 p-2 rounded">
                  ⚠️ {recommendation}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Admin Actions */}
        <div className="mt-6 pt-6 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Admin Actions</h3>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={resetCircuitBreaker}
              disabled={actionLoading === 'reset'}
              className="px-3 py-2 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {actionLoading === 'reset' ? 'Resetting...' : 'Reset Circuit Breaker'}
            </button>
            
            <button
              onClick={forceProcessQueue}
              disabled={actionLoading === 'process'}
              className="px-3 py-2 text-sm bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
            >
              {actionLoading === 'process' ? 'Processing...' : 'Force Process Queue'}
            </button>
            
            <button
              onClick={clearQueue}
              disabled={actionLoading === 'clear'}
              className="px-3 py-2 text-sm bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
            >
              {actionLoading === 'clear' ? 'Clearing...' : 'Clear Queue'}
            </button>
          </div>
        </div>

        {/* Last Updated */}
        {health && (
          <div className="mt-4 text-xs text-gray-500">
            Last updated: {new Date(health.timestamp).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorLoggingHealthMonitor;