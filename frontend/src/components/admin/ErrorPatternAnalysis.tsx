import React, { useState, useEffect } from 'react';
import Card, { CardHeader, CardContent } from '../ui/Card';
import { Stack, Flex } from '../ui/Layout';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import { useToast } from '../Toast';
import { errorService } from '../../services/errorService';
import type { ErrorPatterns, ErrorInsights } from '../../types/errorTypes';
import './ErrorPatternAnalysis.css';

export interface ErrorPatternAnalysisProps {
  timeWindow?: number;
  onPatternSelect?: (pattern: unknown) => void;
  onInsightAction?: (insight: unknown, action: string) => void;
}

const ErrorPatternAnalysis: React.FC<ErrorPatternAnalysisProps> = ({
  timeWindow = 86400000, // 24 hours
  onPatternSelect,
  onInsightAction
}) => {
  const { showToast } = useToast();
  
  // State management
  const [loading, setLoading] = useState(false);
  const [patterns, setPatterns] = useState<ErrorPatterns | null>(null);
  const [insights, setInsights] = useState<ErrorInsights | null>(null);
  const [activeTab, setActiveTab] = useState<'patterns' | 'insights' | 'recommendations'>('patterns');
  const [, setSelectedPattern] = useState<unknown>(null);


  // Load pattern data
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        
        const [patternsResponse, insightsResponse] = await Promise.all([
          errorService.getErrorPatterns(timeWindow),
          errorService.getErrorInsights(timeWindow)
        ]);

        if (patternsResponse.success) {
          setPatterns(patternsResponse.data);
        }

        if (insightsResponse.success) {
          setInsights(insightsResponse.data);
        }
      } catch (error) {
        console.error('Failed to load pattern data:', error);
        showToast({
          type: 'error',
          title: 'Failed to load pattern analysis',
          message: 'Please try refreshing the data'
        });
      } finally {
        setLoading(false);
      }
    };
    
    loadData();
  }, [timeWindow, showToast]);

  const loadPatternData = async () => {
    try {
      setLoading(true);
      
      const [patternsResponse, insightsResponse] = await Promise.all([
        errorService.getErrorPatterns(timeWindow),
        errorService.getErrorInsights(timeWindow)
      ]);

      if (patternsResponse.success) {
        setPatterns(patternsResponse.data);
      }

      if (insightsResponse.success) {
        setInsights(insightsResponse.data);
      }
    } catch (error) {
      console.error('Failed to load pattern data:', error);
      showToast({
        type: 'error',
        title: 'Failed to load pattern analysis',
        message: 'Please try refreshing the data'
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePatternClick = (pattern: unknown) => {
    setSelectedPattern(pattern);
    onPatternSelect?.(pattern);
  };

  const handleInsightAction = (insight: unknown, action: string) => {
    onInsightAction?.(insight, action);
    showToast({
      type: 'info',
      title: 'Action initiated',
      message: `${action} action started for insight`
    });
  };

  const formatTimeAgo = (date: Date): string => {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };



  const getPriorityBadgeVariant = (priority: string): 'default' | 'success' | 'warning' | 'error' => {
    const variants = {
      critical: 'error' as const,
      high: 'warning' as const,
      medium: 'success' as const,
      low: 'default' as const
    };
    return variants[priority as keyof typeof variants] || 'default';
  };

  const getHealthScoreColor = (score: number): string => {
    if (score >= 80) return 'var(--color-profit)';
    if (score >= 60) return 'var(--color-neutral)';
    return 'var(--color-loss)';
  };

  if (loading) {
    return (
      <div className="error-pattern-analysis loading">
        <Card>
          <CardContent>
            <div className="loading-state">
              <div className="loading-spinner" />
              <p>Analyzing error patterns...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="error-pattern-analysis">
      <Stack gap={4}>
        {/* Header */}
        <Flex justify="between" align="center">
          <div>
            <h2 className="analysis-title">🔍 Error Pattern Analysis</h2>
            <p className="analysis-subtitle">
              Intelligent analysis of error patterns and system insights
            </p>
          </div>
          <Button variant="outline" onClick={loadPatternData}>
            🔄 Refresh Analysis
          </Button>
        </Flex>

        {/* Tab Navigation */}
        <div className="analysis-tabs">
          {[
            { key: 'patterns', label: 'Recurring Patterns', icon: '🔄' },
            { key: 'insights', label: 'Critical Insights', icon: '💡' },
            { key: 'recommendations', label: 'Recommendations', icon: '🎯' }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as 'patterns' | 'insights' | 'recommendations')}
              className={`tab-button ${activeTab === tab.key ? 'active' : ''}`}
            >
              <span className="tab-icon">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Patterns Tab */}
        {activeTab === 'patterns' && patterns && (
          <Stack gap={4}>
            {/* Recurring Errors */}
            <Card>
              <CardHeader title={`🔄 Recurring Error Patterns (${patterns.recurringErrors.length})`} />
              <CardContent>
                {patterns.recurringErrors.length > 0 ? (
                  <div className="recurring-patterns">
                    {patterns.recurringErrors.map((pattern, index) => (
                      <div 
                        key={index} 
                        className="pattern-item"
                        onClick={() => handlePatternClick(pattern)}
                      >
                        <div className="pattern-header">
                          <div className="pattern-info">
                            <div className="pattern-title">{pattern.pattern}</div>
                            <div className="pattern-meta">
                              <span className="pattern-count">{pattern.count} occurrences</span>
                              <span className="pattern-timespan">
                                {formatTimeAgo(pattern.firstSeen)} - {formatTimeAgo(pattern.lastSeen)}
                              </span>
                            </div>
                          </div>
                          <div className="pattern-severity">
                            <Badge variant={pattern.count > 10 ? 'error' : pattern.count > 5 ? 'warning' : 'default'}>
                              {pattern.count > 10 ? 'High' : pattern.count > 5 ? 'Medium' : 'Low'}
                            </Badge>
                          </div>
                        </div>
                        
                        <div className="pattern-details">
                          <div className="pattern-components">
                            <strong>Affected Components:</strong>
                            <div className="component-tags">
                              {pattern.affectedComponents.map(component => (
                                <span key={component} className="component-tag">
                                  {component}
                                </span>
                              ))}
                            </div>
                          </div>
                          
                          <div className="pattern-suggestion">
                            <strong>Suggested Fix:</strong>
                            <span className="suggestion-text">{pattern.suggestedFix}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">✅</div>
                    <h3>No Recurring Patterns</h3>
                    <p>No recurring error patterns detected in the selected time window</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Error Spikes */}
            <Card>
              <CardHeader title={`📈 Error Spikes (${patterns.errorSpikes.length})`} />
              <CardContent>
                {patterns.errorSpikes.length > 0 ? (
                  <div className="error-spikes">
                    {patterns.errorSpikes.map((spike, index) => (
                      <div key={index} className="spike-item">
                        <div className="spike-header">
                          <div className="spike-time">
                            {new Date(spike.timestamp).toLocaleString()}
                          </div>
                          <div className="spike-count">
                            <Badge variant="error">{spike.errorCount} errors</Badge>
                          </div>
                        </div>
                        
                        <div className="spike-details">
                          <div className="spike-cause">
                            <strong>Primary Cause:</strong> {spike.primaryCause}
                          </div>
                          <div className="spike-systems">
                            <strong>Affected Systems:</strong>
                            <div className="system-tags">
                              {spike.affectedSystems.map(system => (
                                <span key={system} className="system-tag">
                                  {system}
                                </span>
                              ))}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">📊</div>
                    <h3>No Error Spikes</h3>
                    <p>No significant error spikes detected</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Correlated Errors */}
            <Card>
              <CardHeader title={`🔗 Correlated Error Chains (${patterns.correlatedErrors.length})`} />
              <CardContent>
                {patterns.correlatedErrors.length > 0 ? (
                  <div className="correlated-errors">
                    {patterns.correlatedErrors.slice(0, 5).map((correlation, index) => (
                      <div key={index} className="correlation-item">
                        <div className="correlation-header">
                          <div className="correlation-trace">
                            <strong>Trace ID:</strong>
                            <code className="trace-id">{correlation.traceId}</code>
                          </div>
                          <div className="correlation-count">
                            {correlation.errorChain.length} linked errors
                          </div>
                        </div>
                        
                        <div className="error-chain">
                          {correlation.errorChain.map((error, errorIndex) => (
                            <div key={errorIndex} className="chain-item">
                              <div className="chain-step">{errorIndex + 1}</div>
                              <div className="chain-content">
                                <div className="chain-component">{error.component}</div>
                                <div className="chain-operation">{error.operation}</div>
                                <div className="chain-message">{error.message}</div>
                                <div className="chain-time">
                                  {new Date(error.timestamp).toLocaleTimeString()}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">🔗</div>
                    <h3>No Error Correlations</h3>
                    <p>No correlated error chains found</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </Stack>
        )}

        {/* Insights Tab */}
        {activeTab === 'insights' && insights && (
          <Stack gap={4}>
            {/* Critical Issues */}
            <Card>
              <CardHeader title={`🚨 Critical Issues (${insights.criticalIssues.length})`} />
              <CardContent>
                {insights.criticalIssues.length > 0 ? (
                  <div className="critical-issues">
                    {insights.criticalIssues.map((issue, index) => (
                      <div key={index} className="issue-item">
                        <div className="issue-header">
                          <div className="issue-info">
                            <div className="issue-title">{issue.title}</div>
                            <div className="issue-description">{issue.description}</div>
                          </div>
                          <Badge variant={getPriorityBadgeVariant(issue.priority)}>
                            {issue.priority.toUpperCase()}
                          </Badge>
                        </div>
                        
                        <div className="issue-impact">
                          <strong>Impact:</strong> {issue.impact}
                        </div>
                        
                        <div className="issue-actions-section">
                          <strong>Recommended Actions:</strong>
                          <ul className="action-list">
                            {issue.recommendedActions.map((action, actionIndex) => (
                              <li key={actionIndex} className="action-item">
                                {action}
                              </li>
                            ))}
                          </ul>
                          
                          <div className="issue-buttons">
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleInsightAction(issue, 'investigate')}
                            >
                              🔍 Investigate
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleInsightAction(issue, 'create-task')}
                            >
                              📝 Create Task
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">✅</div>
                    <h3>No Critical Issues</h3>
                    <p>No critical issues identified in the current analysis</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Performance Impacts */}
            <Card>
              <CardHeader title={`⚡ Performance Impacts (${insights.performanceImpacts.length})`} />
              <CardContent>
                {insights.performanceImpacts.length > 0 ? (
                  <div className="performance-impacts">
                    {insights.performanceImpacts.map((impact, index) => (
                      <div key={index} className="impact-item">
                        <div className="impact-header">
                          <div className="impact-component">{impact.component}</div>
                          <div className="impact-rate">
                            {impact.avgErrorRate.toFixed(1)} errors/hour
                          </div>
                        </div>
                        
                        <div className="impact-ux">
                          <strong>User Experience Impact:</strong>
                          <span className="ux-description">{impact.impactOnUserExperience}</span>
                        </div>
                        
                        <div className="impact-suggestions">
                          <strong>Optimization Suggestions:</strong>
                          <ul className="suggestion-list">
                            {impact.optimizationSuggestions.map((suggestion, suggestionIndex) => (
                              <li key={suggestionIndex} className="suggestion-item">
                                {suggestion}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="empty-state">
                    <div className="empty-icon">⚡</div>
                    <h3>No Performance Issues</h3>
                    <p>No significant performance impacts detected</p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* System Health Score */}
            <Card>
              <CardHeader title="🏥 System Health Overview" />
              <CardContent>
                <div className="health-overview">
                  <div className="overall-health">
                    <div className="health-score-circle">
                      <div 
                        className="health-score-value"
                        style={{ color: getHealthScoreColor(insights.systemHealthScore.overall) }}
                      >
                        {insights.systemHealthScore.overall}%
                      </div>
                      <div className="health-score-label">Overall Health</div>
                    </div>
                  </div>
                  
                  <div className="health-breakdown">
                    <h4>Component Health Breakdown</h4>
                    <div className="health-components">
                      {Object.entries(insights.systemHealthScore.breakdown).map(([component, score]) => (
                        <div key={component} className="health-component">
                          <div className="component-name">{component.toUpperCase()}</div>
                          <div className="component-score-bar">
                            <div 
                              className="score-fill"
                              style={{ 
                                width: `${score}%`,
                                backgroundColor: getHealthScoreColor(score)
                              }}
                            />
                          </div>
                          <div 
                            className="component-score"
                            style={{ color: getHealthScoreColor(score) }}
                          >
                            {score}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Stack>
        )}

        {/* Recommendations Tab */}
        {activeTab === 'recommendations' && (
          <Card>
            <CardHeader title="🎯 AI-Powered Recommendations" />
            <CardContent>
              <div className="recommendations">
                <div className="recommendation-item">
                  <div className="recommendation-header">
                    <div className="recommendation-title">
                      🔧 Implement Circuit Breaker Pattern
                    </div>
                    <Badge variant="warning">High Priority</Badge>
                  </div>
                  <div className="recommendation-description">
                    Based on recurring broker API failures, implementing a circuit breaker pattern 
                    could prevent cascade failures and improve system resilience.
                  </div>
                  <div className="recommendation-actions">
                    <Button variant="primary" size="sm">
                      📋 Create Implementation Task
                    </Button>
                    <Button variant="outline" size="sm">
                      📚 View Documentation
                    </Button>
                  </div>
                </div>

                <div className="recommendation-item">
                  <div className="recommendation-header">
                    <div className="recommendation-title">
                      📊 Enhanced Error Monitoring
                    </div>
                    <Badge variant="success">Medium Priority</Badge>
                  </div>
                  <div className="recommendation-description">
                    Set up proactive monitoring for error rate thresholds to catch issues 
                    before they impact users significantly.
                  </div>
                  <div className="recommendation-actions">
                    <Button variant="primary" size="sm">
                      ⚙️ Configure Alerts
                    </Button>
                    <Button variant="outline" size="sm">
                      📈 View Metrics
                    </Button>
                  </div>
                </div>

                <div className="recommendation-item">
                  <div className="recommendation-header">
                    <div className="recommendation-title">
                      🔄 Automated Error Recovery
                    </div>
                    <Badge variant="default">Low Priority</Badge>
                  </div>
                  <div className="recommendation-description">
                    Implement automated retry mechanisms with exponential backoff for 
                    transient errors to reduce manual intervention.
                  </div>
                  <div className="recommendation-actions">
                    <Button variant="primary" size="sm">
                      🤖 Setup Automation
                    </Button>
                    <Button variant="outline" size="sm">
                      🔍 Analyze Patterns
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </Stack>
    </div>
  );
};

export default ErrorPatternAnalysis;