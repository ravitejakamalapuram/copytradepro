import { ErrorLog, TraceLifecycle } from '../models/errorLogModels';
import { errorAggregationService, ErrorAggregationDimensions } from './errorAggregationService';
import { logger } from '../utils/logger';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface ErrorExportOptions {
  format: 'json' | 'csv' | 'structured-logs';
  timeRange: {
    start: Date;
    end: Date;
  };
  filters?: {
    level?: string[];
    source?: string[];
    component?: string[];
    errorType?: string[];
    userId?: string;
    traceId?: string;
  };
  includeTraceLifecycle?: boolean;
  includeAnalytics?: boolean;
  maxRecords?: number;
}

export interface ErrorReport {
  id: string;
  title: string;
  generatedAt: Date;
  timeRange: {
    start: Date;
    end: Date;
  };
  summary: {
    totalErrors: number;
    criticalErrors: number;
    systemHealthScore: number;
    affectedUsers: number;
    topComponents: Array<{
      component: string;
      errorCount: number;
      errorRate: number;
    }>;
    topErrorTypes: Array<{
      errorType: string;
      count: number;
      percentage: number;
    }>;
  };
  patterns: Array<{
    pattern: string;
    description: string;
    occurrences: number;
    severity: string;
    recommendation: string;
  }>;
  recommendations: Array<{
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    category: string;
    title: string;
    description: string;
    actionItems: string[];
    estimatedEffort: string;
  }>;
  developmentTasks: Array<{
    title: string;
    description: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    component: string;
    estimatedHours: number;
    requirements: string[];
    acceptanceCriteria: string[];
  }>;
}

export interface AutomatedReportConfig {
  enabled: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  recipients: string[];
  includePatterns: boolean;
  includeRecommendations: boolean;
  includeDevelopmentTasks: boolean;
  thresholds: {
    criticalErrorCount: number;
    systemHealthScoreMin: number;
    errorRateMax: number;
  };
}

export class ErrorReportingService {
  private reportsDirectory: string;

  constructor() {
    this.reportsDirectory = path.join(process.cwd(), 'reports', 'errors');
    this.ensureReportsDirectory();
  }

  /**
   * Export error data in specified format
   */
  async exportErrorData(options: ErrorExportOptions): Promise<{
    filePath: string;
    recordCount: number;
    fileSize: number;
  }> {
    try {
      logger.info('Starting error data export', {
        component: 'ERROR_REPORTING_SERVICE',
        operation: 'EXPORT_ERROR_DATA',
        format: options.format,
        timeRange: options.timeRange
      });

      // Build query
      const query: any = {
        timestamp: {
          $gte: options.timeRange.start,
          $lte: options.timeRange.end
        }
      };

      // Apply filters
      if (options.filters) {
        if (options.filters.level?.length) query.level = { $in: options.filters.level };
        if (options.filters.source?.length) query.source = { $in: options.filters.source };
        if (options.filters.component?.length) query.component = { $in: options.filters.component };
        if (options.filters.errorType?.length) query.errorType = { $in: options.filters.errorType };
        if (options.filters.userId) query['context.userId'] = options.filters.userId;
        if (options.filters.traceId) query.traceId = options.filters.traceId;
      }

      // Fetch error data
      const errorLogs = await ErrorLog.find(query)
        .sort({ timestamp: -1 })
        .limit(options.maxRecords || 10000)
        .lean();

      let traceLifecycles: any[] = [];
      if (options.includeTraceLifecycle) {
        const traceIds = [...new Set(errorLogs.map(log => log.traceId))];
        traceLifecycles = await TraceLifecycle.find({
          traceId: { $in: traceIds }
        }).lean();
      }

      let analytics: any = null;
      if (options.includeAnalytics) {
        const dimensions: ErrorAggregationDimensions = {
          timeRange: {
            start: options.timeRange.start,
            end: options.timeRange.end,
            granularity: 'day'
          }
        };

        if (options.filters) {
          dimensions.filters = options.filters;
        }
        analytics = await errorAggregationService.aggregateErrors(dimensions);
      }

      // Generate filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `error-export-${timestamp}.${this.getFileExtension(options.format)}`;
      const filePath = path.join(this.reportsDirectory, filename);

      // Export data based on format
      let fileContent: string;
      switch (options.format) {
        case 'json':
          fileContent = await this.exportAsJSON(errorLogs, traceLifecycles, analytics);
          break;
        case 'csv':
          fileContent = await this.exportAsCSV(errorLogs);
          break;
        case 'structured-logs':
          fileContent = await this.exportAsStructuredLogs(errorLogs);
          break;
        default:
          throw new Error(`Unsupported export format: ${options.format}`);
      }

      // Write file
      await fs.writeFile(filePath, fileContent, 'utf8');
      const stats = await fs.stat(filePath);

      logger.info('Error data export completed', {
        component: 'ERROR_REPORTING_SERVICE',
        operation: 'EXPORT_ERROR_DATA_SUCCESS',
        filePath,
        recordCount: errorLogs.length,
        fileSize: stats.size
      });

      return {
        filePath,
        recordCount: errorLogs.length,
        fileSize: stats.size
      };
    } catch (error) {
      logger.error('Error exporting error data:', error);
      throw new Error('Failed to export error data');
    }
  }

  /**
   * Generate comprehensive error report
   */
  async generateErrorReport(timeRange: { start: Date; end: Date }): Promise<ErrorReport> {
    try {
      logger.info('Generating error report', {
        component: 'ERROR_REPORTING_SERVICE',
        operation: 'GENERATE_ERROR_REPORT',
        timeRange
      });

      const reportId = `error-report-${Date.now()}`;

      // Get aggregated data
      const dimensions: ErrorAggregationDimensions = {
        timeRange: {
          start: timeRange.start,
          end: timeRange.end,
          granularity: 'day'
        }
      };

      const [aggregation, patterns, impact] = await Promise.all([
        errorAggregationService.aggregateErrors(dimensions),
        errorAggregationService.detectErrorPatterns(timeRange),
        errorAggregationService.analyzeErrorImpact(timeRange)
      ]);

      // Build summary
      const summary = {
        totalErrors: aggregation.totalErrors,
        criticalErrors: impact.criticalErrorsCount,
        systemHealthScore: impact.systemHealthScore,
        affectedUsers: impact.userExperienceImpact.affectedUsers,
        topComponents: Object.entries(aggregation.errorsByComponent)
          .map(([component, count]) => ({
            component,
            errorCount: count,
            errorRate: impact.componentReliability[component]?.errorRate || 0
          }))
          .sort((a, b) => b.errorCount - a.errorCount)
          .slice(0, 5),
        topErrorTypes: Object.entries(aggregation.errorsByType)
          .map(([errorType, count]) => ({
            errorType,
            count,
            percentage: (count / aggregation.totalErrors) * 100
          }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
      };

      // Process patterns with recommendations
      const processedPatterns = patterns.slice(0, 10).map(pattern => ({
        pattern: pattern.pattern,
        description: pattern.description,
        occurrences: pattern.occurrences,
        severity: pattern.severity,
        recommendation: this.generatePatternRecommendation(pattern)
      }));

      // Generate recommendations
      const recommendations = await this.generateRecommendations(aggregation, patterns, impact);

      // Generate development tasks
      const developmentTasks = await this.generateDevelopmentTasks(patterns, impact);

      const report: ErrorReport = {
        id: reportId,
        title: `Error Analysis Report - ${timeRange.start.toDateString()} to ${timeRange.end.toDateString()}`,
        generatedAt: new Date(),
        timeRange,
        summary,
        patterns: processedPatterns,
        recommendations,
        developmentTasks
      };

      logger.info('Error report generated successfully', {
        component: 'ERROR_REPORTING_SERVICE',
        operation: 'GENERATE_ERROR_REPORT_SUCCESS',
        reportId,
        totalErrors: summary.totalErrors,
        patternsFound: patterns.length
      });

      return report;
    } catch (error) {
      logger.error('Error generating error report:', error);
      throw new Error('Failed to generate error report');
    }
  }

  /**
   * Save error report to file
   */
  async saveErrorReport(report: ErrorReport, format: 'json' | 'html' | 'markdown' = 'json'): Promise<string> {
    try {
      const filename = `${report.id}.${format}`;
      const filePath = path.join(this.reportsDirectory, filename);

      let content: string;
      switch (format) {
        case 'json':
          content = JSON.stringify(report, null, 2);
          break;
        case 'html':
          content = this.generateHTMLReport(report);
          break;
        case 'markdown':
          content = this.generateMarkdownReport(report);
          break;
        default:
          throw new Error(`Unsupported report format: ${format}`);
      }

      await fs.writeFile(filePath, content, 'utf8');

      logger.info('Error report saved', {
        component: 'ERROR_REPORTING_SERVICE',
        operation: 'SAVE_ERROR_REPORT',
        filePath,
        format
      });

      return filePath;
    } catch (error) {
      logger.error('Error saving error report:', error);
      throw new Error('Failed to save error report');
    }
  }

  /**
   * Generate automated error summary for development task creation
   */
  async generateDevelopmentTaskSummary(timeRange: { start: Date; end: Date }): Promise<{
    summary: string;
    tasks: Array<{
      title: string;
      description: string;
      priority: 'HIGH' | 'MEDIUM' | 'LOW';
      component: string;
      errorCount: number;
      impactScore: number;
    }>;
  }> {
    try {
      const patterns = await errorAggregationService.detectErrorPatterns(timeRange);
      const impact = await errorAggregationService.analyzeErrorImpact(timeRange);

      // Generate summary
      const summary = `
Error Analysis Summary (${timeRange.start.toDateString()} - ${timeRange.end.toDateString()}):
- System Health Score: ${impact.systemHealthScore}%
- Critical Errors: ${impact.criticalErrorsCount}
- Affected Users: ${impact.userExperienceImpact.affectedUsers}
- Top Error Patterns: ${patterns.length}

Key Issues Requiring Attention:
${patterns.slice(0, 5).map(p => `- ${p.pattern} (${p.occurrences} occurrences, ${p.severity} severity)`).join('\n')}

Recommended Actions:
${patterns.filter(p => p.severity === 'CRITICAL' || p.severity === 'HIGH').length > 0 
  ? '- Immediate attention required for critical/high severity patterns'
  : '- Focus on pattern prevention and system reliability improvements'}
      `.trim();

      // Generate development tasks
      const tasks = patterns.slice(0, 10).map(pattern => ({
        title: `Fix: ${pattern.pattern}`,
        description: `${pattern.description}\n\nOccurrences: ${pattern.occurrences}\nComponents: ${pattern.components.join(', ')}\nError Types: ${pattern.errorTypes.join(', ')}`,
        priority: pattern.severity === 'CRITICAL' ? 'HIGH' as const : 
                 pattern.severity === 'HIGH' ? 'HIGH' as const :
                 pattern.severity === 'MEDIUM' ? 'MEDIUM' as const : 'LOW' as const,
        component: pattern.components[0] || 'UNKNOWN',
        errorCount: pattern.occurrences,
        impactScore: pattern.impactScore
      })).sort((a, b) => b.impactScore - a.impactScore);

      return { summary, tasks };
    } catch (error) {
      logger.error('Error generating development task summary:', error);
      throw new Error('Failed to generate development task summary');
    }
  }

  // Private helper methods

  private async ensureReportsDirectory(): Promise<void> {
    try {
      await fs.mkdir(this.reportsDirectory, { recursive: true });
    } catch (error) {
      logger.error('Error creating reports directory:', error);
    }
  }

  private getFileExtension(format: string): string {
    switch (format) {
      case 'json': return 'json';
      case 'csv': return 'csv';
      case 'structured-logs': return 'log';
      default: return 'txt';
    }
  }

  private async exportAsJSON(errorLogs: any[], traceLifecycles: any[], analytics: any): Promise<string> {
    const exportData = {
      metadata: {
        exportedAt: new Date().toISOString(),
        recordCount: errorLogs.length,
        version: '1.0.0'
      },
      errorLogs,
      traceLifecycles: traceLifecycles || [],
      analytics: analytics || null
    };

    return JSON.stringify(exportData, null, 2);
  }

  private async exportAsCSV(errorLogs: any[]): Promise<string> {
    if (errorLogs.length === 0) {
      return 'No data to export';
    }

    // CSV headers
    const headers = [
      'timestamp',
      'traceId',
      'level',
      'source',
      'component',
      'operation',
      'errorType',
      'message',
      'userId',
      'sessionId',
      'brokerName',
      'url',
      'method',
      'statusCode',
      'duration'
    ];

    // CSV rows
    const rows = errorLogs.map(log => [
      log.timestamp?.toISOString() || '',
      log.traceId || '',
      log.level || '',
      log.source || '',
      log.component || '',
      log.operation || '',
      log.errorType || '',
      `"${(log.message || '').replace(/"/g, '""')}"`, // Escape quotes
      log.context?.userId || '',
      log.context?.sessionId || '',
      log.context?.brokerName || '',
      log.context?.url || '',
      log.context?.method || '',
      log.context?.statusCode || '',
      log.context?.duration || ''
    ]);

    return [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  }

  private async exportAsStructuredLogs(errorLogs: any[]): Promise<string> {
    return errorLogs.map(log => {
      const logEntry = {
        '@timestamp': log.timestamp?.toISOString(),
        '@level': log.level,
        '@source': log.source,
        '@component': log.component,
        '@operation': log.operation,
        '@trace_id': log.traceId,
        '@error_type': log.errorType,
        '@message': log.message,
        '@context': log.context,
        '@metadata': log.metadata
      };
      return JSON.stringify(logEntry);
    }).join('\n');
  }

  private generatePatternRecommendation(pattern: any): string {
    switch (pattern.severity) {
      case 'CRITICAL':
        return `Immediate action required: This pattern indicates a critical system issue affecting ${pattern.components.join(', ')}. Implement emergency fixes and monitoring.`;
      case 'HIGH':
        return `High priority fix needed: Pattern shows significant impact on system reliability. Schedule fix within current sprint.`;
      case 'MEDIUM':
        return `Medium priority: Consider addressing this pattern in upcoming development cycles to improve system stability.`;
      case 'LOW':
        return `Low priority: Monitor pattern trends and address during routine maintenance or refactoring.`;
      default:
        return 'Review pattern and determine appropriate action based on business impact.';
    }
  }

  private async generateRecommendations(aggregation: any, patterns: any[], impact: any): Promise<Array<{
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    category: string;
    title: string;
    description: string;
    actionItems: string[];
    estimatedEffort: string;
  }>> {
    const recommendations = [];

    // System health recommendations
    if (impact.systemHealthScore < 95) {
      recommendations.push({
        priority: impact.systemHealthScore < 90 ? 'HIGH' as const : 'MEDIUM' as const,
        category: 'System Health',
        title: 'Improve System Reliability',
        description: `System health score is ${impact.systemHealthScore}%. Focus on reducing error rates and improving stability.`,
        actionItems: [
          'Implement comprehensive error handling',
          'Add retry mechanisms for transient failures',
          'Improve monitoring and alerting',
          'Review and optimize critical code paths'
        ],
        estimatedEffort: impact.systemHealthScore < 90 ? '2-3 weeks' : '1-2 weeks'
      });
    }

    // Critical error recommendations
    if (impact.criticalErrorsCount > 10) {
      recommendations.push({
        priority: 'HIGH' as const,
        category: 'Critical Errors',
        title: 'Address Critical Error Patterns',
        description: `${impact.criticalErrorsCount} critical errors detected. These require immediate attention.`,
        actionItems: [
          'Investigate root causes of critical errors',
          'Implement fixes for high-impact issues',
          'Add preventive measures and validation',
          'Enhance error recovery mechanisms'
        ],
        estimatedEffort: '1-2 weeks'
      });
    }

    // Component-specific recommendations
    const topErrorComponents = Object.entries(aggregation.errorsByComponent)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3);

    topErrorComponents.forEach(([component, count]) => {
      if ((count as number) > 20) {
        recommendations.push({
          priority: (count as number) > 50 ? 'HIGH' as const : 'MEDIUM' as const,
          category: 'Component Reliability',
          title: `Improve ${component} Reliability`,
          description: `${component} has generated ${count} errors. Focus on improving this component's stability.`,
          actionItems: [
            `Review ${component} error handling`,
            'Add comprehensive input validation',
            'Implement proper error recovery',
            'Add component-specific monitoring'
          ],
          estimatedEffort: (count as number) > 50 ? '1-2 weeks' : '3-5 days'
        });
      }
    });

    return recommendations.slice(0, 10); // Limit to top 10 recommendations
  }

  private async generateDevelopmentTasks(patterns: any[], impact: any): Promise<Array<{
    title: string;
    description: string;
    priority: 'HIGH' | 'MEDIUM' | 'LOW';
    component: string;
    estimatedHours: number;
    requirements: string[];
    acceptanceCriteria: string[];
  }>> {
    const tasks = [];

    // Generate tasks from patterns
    patterns.slice(0, 8).forEach((pattern, index) => {
      const priority = pattern.severity === 'CRITICAL' || pattern.severity === 'HIGH' ? 'HIGH' as const :
                     pattern.severity === 'MEDIUM' ? 'MEDIUM' as const : 'LOW' as const;

      const estimatedHours = pattern.severity === 'CRITICAL' ? 16 :
                           pattern.severity === 'HIGH' ? 12 :
                           pattern.severity === 'MEDIUM' ? 8 : 4;

      tasks.push({
        title: `Fix Error Pattern: ${pattern.pattern.substring(0, 50)}...`,
        description: `${pattern.description}\n\nThis pattern has occurred ${pattern.occurrences} times and affects components: ${pattern.components.join(', ')}`,
        priority,
        component: pattern.components[0] || 'UNKNOWN',
        estimatedHours,
        requirements: [
          `Investigate root cause of ${pattern.errorTypes.join(', ')} errors`,
          'Implement proper error handling and validation',
          'Add monitoring and alerting for this error pattern',
          'Test fix thoroughly to prevent regression'
        ],
        acceptanceCriteria: [
          'Error pattern occurrence reduced by at least 80%',
          'Proper error handling implemented with user-friendly messages',
          'Monitoring alerts configured for pattern detection',
          'Unit and integration tests added to prevent regression',
          'Documentation updated with troubleshooting steps'
        ]
      });
    });

    // Add system-wide improvement tasks
    if (impact.systemHealthScore < 95) {
      tasks.push({
        title: 'Improve Overall System Error Handling',
        description: `System health score is ${impact.systemHealthScore}%. Implement comprehensive error handling improvements.`,
        priority: impact.systemHealthScore < 90 ? 'HIGH' as const : 'MEDIUM' as const,
        component: 'SYSTEM',
        estimatedHours: 24,
        requirements: [
          'Audit existing error handling patterns',
          'Implement standardized error response formats',
          'Add comprehensive logging and monitoring',
          'Create error recovery mechanisms'
        ],
        acceptanceCriteria: [
          'System health score improved to >95%',
          'Standardized error handling implemented across all components',
          'Comprehensive error monitoring and alerting in place',
          'Error recovery mechanisms tested and documented',
          'User experience improved with better error messages'
        ]
      });
    }

    return tasks.sort((a, b) => {
      const priorityOrder = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  private generateHTMLReport(report: ErrorReport): string {
    return `
<!DOCTYPE html>
<html>
<head>
    <title>${report.title}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .metric { background: #fff; border: 1px solid #ddd; padding: 15px; border-radius: 5px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 24px; font-weight: bold; color: #007bff; }
        .section { margin: 30px 0; }
        .pattern { background: #f8f9fa; border-left: 4px solid #007bff; padding: 15px; margin: 10px 0; }
        .high-priority { border-left-color: #dc3545; }
        .medium-priority { border-left-color: #ffc107; }
        .low-priority { border-left-color: #28a745; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
    </style>
</head>
<body>
    <div class="header">
        <h1>${report.title}</h1>
        <p>Generated: ${report.generatedAt.toLocaleString()}</p>
        <p>Period: ${report.timeRange.start.toDateString()} - ${report.timeRange.end.toDateString()}</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Total Errors</h3>
            <div class="value">${report.summary.totalErrors}</div>
        </div>
        <div class="metric">
            <h3>Critical Errors</h3>
            <div class="value">${report.summary.criticalErrors}</div>
        </div>
        <div class="metric">
            <h3>System Health</h3>
            <div class="value">${report.summary.systemHealthScore}%</div>
        </div>
        <div class="metric">
            <h3>Affected Users</h3>
            <div class="value">${report.summary.affectedUsers}</div>
        </div>
    </div>

    <div class="section">
        <h2>Error Patterns</h2>
        ${report.patterns.map(pattern => `
            <div class="pattern ${pattern.severity.toLowerCase()}-priority">
                <h3>${pattern.pattern}</h3>
                <p>${pattern.description}</p>
                <p><strong>Occurrences:</strong> ${pattern.occurrences} | <strong>Severity:</strong> ${pattern.severity}</p>
                <p><strong>Recommendation:</strong> ${pattern.recommendation}</p>
            </div>
        `).join('')}
    </div>

    <div class="section">
        <h2>Development Tasks</h2>
        <table>
            <thead>
                <tr>
                    <th>Priority</th>
                    <th>Task</th>
                    <th>Component</th>
                    <th>Estimated Hours</th>
                </tr>
            </thead>
            <tbody>
                ${report.developmentTasks.map(task => `
                    <tr>
                        <td><span class="${task.priority.toLowerCase()}-priority">${task.priority}</span></td>
                        <td>${task.title}</td>
                        <td>${task.component}</td>
                        <td>${task.estimatedHours}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    </div>
</body>
</html>
    `.trim();
  }

  private generateMarkdownReport(report: ErrorReport): string {
    return `
# ${report.title}

**Generated:** ${report.generatedAt.toLocaleString()}  
**Period:** ${report.timeRange.start.toDateString()} - ${report.timeRange.end.toDateString()}

## Summary

| Metric | Value |
|--------|-------|
| Total Errors | ${report.summary.totalErrors} |
| Critical Errors | ${report.summary.criticalErrors} |
| System Health Score | ${report.summary.systemHealthScore}% |
| Affected Users | ${report.summary.affectedUsers} |

## Top Components by Error Count

${report.summary.topComponents.map(comp => 
  `- **${comp.component}**: ${comp.errorCount} errors (${comp.errorRate}% error rate)`
).join('\n')}

## Top Error Types

${report.summary.topErrorTypes.map(type => 
  `- **${type.errorType}**: ${type.count} occurrences (${type.percentage.toFixed(1)}%)`
).join('\n')}

## Error Patterns

${report.patterns.map(pattern => `
### ${pattern.pattern}

**Severity:** ${pattern.severity}  
**Occurrences:** ${pattern.occurrences}

${pattern.description}

**Recommendation:** ${pattern.recommendation}
`).join('\n')}

## Recommendations

${report.recommendations.map(rec => `
### ${rec.title} (${rec.priority} Priority)

**Category:** ${rec.category}  
**Estimated Effort:** ${rec.estimatedEffort}

${rec.description}

**Action Items:**
${rec.actionItems.map(item => `- ${item}`).join('\n')}
`).join('\n')}

## Development Tasks

${report.developmentTasks.map(task => `
### ${task.title}

**Priority:** ${task.priority}  
**Component:** ${task.component}  
**Estimated Hours:** ${task.estimatedHours}

${task.description}

**Requirements:**
${task.requirements.map(req => `- ${req}`).join('\n')}

**Acceptance Criteria:**
${task.acceptanceCriteria.map(criteria => `- ${criteria}`).join('\n')}
`).join('\n')}
    `.trim();
  }
}

export const errorReportingService = new ErrorReportingService();