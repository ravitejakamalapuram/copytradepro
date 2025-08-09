import { v4 as uuidv4 } from 'uuid';
import { ErrorLog } from '../models/errorLogModels';
import { logger } from '../utils/logger';
import { errorAggregationService } from './errorAggregationService';

export interface ErrorResolutionTask {
  id: string;
  errorId: string;
  traceId?: string;
  title: string;
  description: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED';
  assignedTo?: string | undefined;
  assignedBy?: string | undefined;
  assignedAt?: Date | undefined;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  resolvedAt?: Date | undefined;
  resolvedBy?: string | undefined;
  resolution?: string | undefined;
  resolutionType?: 'FIXED' | 'WORKAROUND' | 'DUPLICATE' | 'NOT_REPRODUCIBLE' | 'WONT_FIX' | undefined;
  estimatedEffort?: number | undefined; // in hours
  actualEffort?: number | undefined; // in hours
  tags: string[];
  relatedErrors: string[]; // Related error IDs
  comments: ErrorResolutionComment[];
  attachments: ErrorResolutionAttachment[];
  metadata: {
    component: string;
    errorType: string;
    severity: string;
    affectedUsers?: number | undefined;
    businessImpact?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' | undefined;
    reproducible: boolean;
    environment: string;
  };
}

export interface ErrorResolutionComment {
  id: string;
  taskId: string;
  author: string;
  content: string;
  timestamp: Date;
  type: 'COMMENT' | 'STATUS_CHANGE' | 'ASSIGNMENT' | 'RESOLUTION';
  metadata?: any;
}

export interface ErrorResolutionAttachment {
  id: string;
  taskId: string;
  filename: string;
  contentType: string;
  size: number;
  uploadedBy: string;
  uploadedAt: Date;
  url: string;
  description?: string | undefined;
}

export interface ResolutionAnalytics {
  totalTasks: number;
  tasksByStatus: Record<string, number>;
  tasksByPriority: Record<string, number>;
  tasksByAssignee: Record<string, number>;
  averageResolutionTime: number; // in hours
  resolutionTimeByPriority: Record<string, number>;
  resolutionEffectiveness: {
    fixRate: number; // percentage of tasks marked as FIXED
    reopenRate: number; // percentage of resolved tasks that were reopened
    duplicateRate: number; // percentage of tasks marked as DUPLICATE
  };
  topComponents: Array<{
    component: string;
    taskCount: number;
    averageResolutionTime: number;
  }>;
  trends: {
    createdTasks: Array<{ date: string; count: number }>;
    resolvedTasks: Array<{ date: string; count: number }>;
    backlogSize: Array<{ date: string; count: number }>;
  };
}

export interface TaskAssignmentRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  conditions: {
    component?: string[];
    errorType?: string[];
    priority?: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[];
    severity?: string[];
    tags?: string[];
  };
  assignment: {
    assignTo: string;
    autoAssign: boolean;
    notifyAssignee: boolean;
  };
  order: number; // Rule evaluation order
}

export class ErrorResolutionWorkflowService {
  private static instance: ErrorResolutionWorkflowService;
  private tasks: Map<string, ErrorResolutionTask> = new Map();
  private comments: Map<string, ErrorResolutionComment[]> = new Map();
  private attachments: Map<string, ErrorResolutionAttachment[]> = new Map();
  private assignmentRules: Map<string, TaskAssignmentRule> = new Map();

  private constructor() {
    this.initializeDefaultAssignmentRules();
  }

  public static getInstance(): ErrorResolutionWorkflowService {
    if (!ErrorResolutionWorkflowService.instance) {
      ErrorResolutionWorkflowService.instance = new ErrorResolutionWorkflowService();
    }
    return ErrorResolutionWorkflowService.instance;
  }

  /**
   * Create a new error resolution task
   */
  public async createTask(
    errorId: string,
    taskData: {
      title: string;
      description: string;
      priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
      assignedTo?: string;
      createdBy: string;
      estimatedEffort?: number;
      tags?: string[];
      relatedErrors?: string[];
    }
  ): Promise<ErrorResolutionTask> {
    try {
      // Get error details
      const error = await ErrorLog.findOne({ errorId }).lean();
      if (!error) {
        throw new Error(`Error ${errorId} not found`);
      }

      const taskId = uuidv4();
      const now = new Date();

      // Determine priority if not provided
      let priority = taskData.priority || 'MEDIUM';
      if (error.level === 'ERROR' && !taskData.priority) {
        priority = 'HIGH';
      }

      // Auto-assign based on rules if no assignee provided
      let assignedTo = taskData.assignedTo;
      let assignedBy: string | undefined;
      let assignedAt: Date | undefined;

      if (!assignedTo) {
        const autoAssignment = this.findAutoAssignment(error, priority, taskData.tags || []);
        if (autoAssignment) {
          assignedTo = autoAssignment.assignTo;
          assignedBy = 'SYSTEM';
          assignedAt = now;
        }
      } else {
        assignedBy = taskData.createdBy;
        assignedAt = now;
      }

      const task: ErrorResolutionTask = {
        id: taskId,
        errorId,
        traceId: error.traceId,
        title: taskData.title,
        description: taskData.description,
        priority,
        status: 'OPEN',
        assignedTo,
        assignedBy,
        assignedAt,
        createdBy: taskData.createdBy,
        createdAt: now,
        updatedAt: now,
        estimatedEffort: taskData.estimatedEffort,
        tags: taskData.tags || [],
        relatedErrors: taskData.relatedErrors || [],
        comments: [],
        attachments: [],
        metadata: {
          component: error.component,
          errorType: error.errorType,
          severity: error.level,
          reproducible: true, // Default assumption
          environment: error.metadata?.environment || 'unknown',
          businessImpact: this.calculateBusinessImpact(error, priority)
        }
      };

      this.tasks.set(taskId, task);
      this.comments.set(taskId, []);
      this.attachments.set(taskId, []);

      // Add creation comment
      await this.addComment(taskId, {
        author: taskData.createdBy,
        content: `Task created for error: ${error.message}`,
        type: 'COMMENT'
      });

      // Add assignment comment if auto-assigned
      if (assignedTo && assignedBy === 'SYSTEM') {
        await this.addComment(taskId, {
          author: 'SYSTEM',
          content: `Task automatically assigned to ${assignedTo}`,
          type: 'ASSIGNMENT'
        });
      }

      logger.info('Error resolution task created', {
        component: 'ERROR_RESOLUTION_WORKFLOW_SERVICE',
        taskId,
        errorId,
        priority,
        assignedTo,
        createdBy: taskData.createdBy
      });

      return task;
    } catch (error) {
      logger.error('Error creating resolution task:', error);
      throw error;
    }
  }

  /**
   * Update task status
   */
  public async updateTaskStatus(
    taskId: string,
    status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED',
    updatedBy: string,
    resolution?: string,
    resolutionType?: 'FIXED' | 'WORKAROUND' | 'DUPLICATE' | 'NOT_REPRODUCIBLE' | 'WONT_FIX',
    actualEffort?: number
  ): Promise<ErrorResolutionTask> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const previousStatus = task.status;
    const now = new Date();

    task.status = status;
    task.updatedAt = now;

    if (status === 'RESOLVED' || status === 'CLOSED') {
      task.resolvedAt = now;
      task.resolvedBy = updatedBy;
      if (resolution) task.resolution = resolution;
      if (resolutionType) task.resolutionType = resolutionType;
      if (actualEffort) task.actualEffort = actualEffort;

      // Mark related error as resolved if resolution type is FIXED
      if (resolutionType === 'FIXED') {
        try {
          await ErrorLog.updateOne(
            { errorId: task.errorId },
            { 
              resolved: true,
              resolvedAt: now,
              resolvedBy: updatedBy,
              resolution: resolution || 'Fixed via resolution task'
            }
          );
        } catch (error) {
          logger.error('Error updating error log resolution status:', error);
        }
      }
    }

    // Add status change comment
    await this.addComment(taskId, {
      author: updatedBy,
      content: `Status changed from ${previousStatus} to ${status}${resolution ? `: ${resolution}` : ''}`,
      type: 'STATUS_CHANGE',
      metadata: { previousStatus, newStatus: status, resolutionType }
    });

    logger.info('Task status updated', {
      component: 'ERROR_RESOLUTION_WORKFLOW_SERVICE',
      taskId,
      previousStatus,
      newStatus: status,
      updatedBy,
      resolutionType
    });

    return task;
  }

  /**
   * Assign task to user
   */
  public async assignTask(
    taskId: string,
    assignedTo: string,
    assignedBy: string
  ): Promise<ErrorResolutionTask> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const previousAssignee = task.assignedTo;
    task.assignedTo = assignedTo;
    task.assignedBy = assignedBy;
    task.assignedAt = new Date();
    task.updatedAt = new Date();

    // Add assignment comment
    const assignmentMessage = previousAssignee 
      ? `Task reassigned from ${previousAssignee} to ${assignedTo}`
      : `Task assigned to ${assignedTo}`;

    await this.addComment(taskId, {
      author: assignedBy,
      content: assignmentMessage,
      type: 'ASSIGNMENT',
      metadata: { previousAssignee, newAssignee: assignedTo }
    });

    logger.info('Task assigned', {
      component: 'ERROR_RESOLUTION_WORKFLOW_SERVICE',
      taskId,
      previousAssignee,
      newAssignee: assignedTo,
      assignedBy
    });

    return task;
  }

  /**
   * Add comment to task
   */
  public async addComment(
    taskId: string,
    commentData: {
      author: string;
      content: string;
      type?: 'COMMENT' | 'STATUS_CHANGE' | 'ASSIGNMENT' | 'RESOLUTION';
      metadata?: any;
    }
  ): Promise<ErrorResolutionComment> {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const commentId = uuidv4();
    const comment: ErrorResolutionComment = {
      id: commentId,
      taskId,
      author: commentData.author,
      content: commentData.content,
      timestamp: new Date(),
      type: commentData.type || 'COMMENT',
      metadata: commentData.metadata
    };

    const comments = this.comments.get(taskId) || [];
    comments.push(comment);
    this.comments.set(taskId, comments);

    // Update task's updated timestamp
    task.updatedAt = new Date();

    return comment;
  }

  /**
   * Get task by ID
   */
  public getTask(taskId: string): ErrorResolutionTask | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    // Include comments and attachments
    return {
      ...task,
      comments: this.comments.get(taskId) || [],
      attachments: this.attachments.get(taskId) || []
    };
  }

  /**
   * Search tasks with filters
   */
  public searchTasks(filters: {
    status?: ('OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED' | 'CANCELLED')[];
    priority?: ('LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL')[];
    assignedTo?: string;
    createdBy?: string;
    component?: string[];
    errorType?: string[];
    tags?: string[];
    dateRange?: { start: Date; end: Date };
    limit?: number;
    offset?: number;
  }): {
    tasks: ErrorResolutionTask[];
    total: number;
    hasMore: boolean;
  } {
    let filteredTasks = Array.from(this.tasks.values());

    // Apply filters
    if (filters.status?.length) {
      filteredTasks = filteredTasks.filter(task => filters.status!.includes(task.status));
    }

    if (filters.priority?.length) {
      filteredTasks = filteredTasks.filter(task => filters.priority!.includes(task.priority));
    }

    if (filters.assignedTo) {
      filteredTasks = filteredTasks.filter(task => task.assignedTo === filters.assignedTo);
    }

    if (filters.createdBy) {
      filteredTasks = filteredTasks.filter(task => task.createdBy === filters.createdBy);
    }

    if (filters.component?.length) {
      filteredTasks = filteredTasks.filter(task => 
        filters.component!.includes(task.metadata.component)
      );
    }

    if (filters.errorType?.length) {
      filteredTasks = filteredTasks.filter(task => 
        filters.errorType!.includes(task.metadata.errorType)
      );
    }

    if (filters.tags?.length) {
      filteredTasks = filteredTasks.filter(task => 
        filters.tags!.some(tag => task.tags.includes(tag))
      );
    }

    if (filters.dateRange) {
      filteredTasks = filteredTasks.filter(task => 
        task.createdAt >= filters.dateRange!.start && 
        task.createdAt <= filters.dateRange!.end
      );
    }

    // Sort by creation date (newest first)
    filteredTasks.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

    const total = filteredTasks.length;
    const limit = filters.limit || 50;
    const offset = filters.offset || 0;

    // Apply pagination
    const paginatedTasks = filteredTasks.slice(offset, offset + limit);

    // Include comments and attachments for each task
    const tasksWithDetails = paginatedTasks.map(task => ({
      ...task,
      comments: this.comments.get(task.id) || [],
      attachments: this.attachments.get(task.id) || []
    }));

    return {
      tasks: tasksWithDetails,
      total,
      hasMore: offset + paginatedTasks.length < total
    };
  }

  /**
   * Get resolution analytics
   */
  public async getResolutionAnalytics(timeRange?: { start: Date; end: Date }): Promise<ResolutionAnalytics> {
    let tasks = Array.from(this.tasks.values());

    // Apply time range filter if provided
    if (timeRange) {
      tasks = tasks.filter(task => 
        task.createdAt >= timeRange.start && task.createdAt <= timeRange.end
      );
    }

    const totalTasks = tasks.length;

    // Tasks by status
    const tasksByStatus = tasks.reduce((acc, task) => {
      acc[task.status] = (acc[task.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Tasks by priority
    const tasksByPriority = tasks.reduce((acc, task) => {
      acc[task.priority] = (acc[task.priority] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Tasks by assignee
    const tasksByAssignee = tasks.reduce((acc, task) => {
      if (task.assignedTo) {
        acc[task.assignedTo] = (acc[task.assignedTo] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    // Resolution time calculations
    const resolvedTasks = tasks.filter(task => task.resolvedAt);
    const resolutionTimes = resolvedTasks.map(task => {
      const resolutionTime = task.resolvedAt!.getTime() - task.createdAt.getTime();
      return resolutionTime / (1000 * 60 * 60); // Convert to hours
    });

    const averageResolutionTime = resolutionTimes.length > 0 
      ? resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length 
      : 0;

    // Resolution time by priority
    const resolutionTimeByPriority: Record<string, number> = {};
    ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].forEach(priority => {
      const priorityTasks = resolvedTasks.filter(task => task.priority === priority);
      if (priorityTasks.length > 0) {
        const priorityTimes = priorityTasks.map(task => 
          (task.resolvedAt!.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60)
        );
        resolutionTimeByPriority[priority] = priorityTimes.reduce((sum, time) => sum + time, 0) / priorityTimes.length;
      } else {
        resolutionTimeByPriority[priority] = 0;
      }
    });

    // Resolution effectiveness
    const fixedTasks = resolvedTasks.filter(task => task.resolutionType === 'FIXED').length;
    const duplicateTasks = resolvedTasks.filter(task => task.resolutionType === 'DUPLICATE').length;
    const reopenedTasks = 0; // This would require tracking reopened tasks

    const resolutionEffectiveness = {
      fixRate: resolvedTasks.length > 0 ? (fixedTasks / resolvedTasks.length) * 100 : 0,
      reopenRate: 0, // Would be calculated from actual reopened tasks
      duplicateRate: resolvedTasks.length > 0 ? (duplicateTasks / resolvedTasks.length) * 100 : 0
    };

    // Top components
    const componentStats = tasks.reduce((acc, task) => {
      const component = task.metadata.component;
      if (!acc[component]) {
        acc[component] = { count: 0, totalResolutionTime: 0, resolvedCount: 0 };
      }
      acc[component].count++;
      
      if (task.resolvedAt) {
        const resolutionTime = (task.resolvedAt.getTime() - task.createdAt.getTime()) / (1000 * 60 * 60);
        acc[component].totalResolutionTime += resolutionTime;
        acc[component].resolvedCount++;
      }
      
      return acc;
    }, {} as Record<string, { count: number; totalResolutionTime: number; resolvedCount: number }>);

    const topComponents = Object.entries(componentStats)
      .map(([component, stats]) => ({
        component,
        taskCount: stats.count,
        averageResolutionTime: stats.resolvedCount > 0 ? stats.totalResolutionTime / stats.resolvedCount : 0
      }))
      .sort((a, b) => b.taskCount - a.taskCount)
      .slice(0, 10);

    // Trends (simplified - would be more complex with real data)
    const trends = {
      createdTasks: this.generateTrendData(tasks, 'createdAt'),
      resolvedTasks: this.generateTrendData(resolvedTasks, 'resolvedAt'),
      backlogSize: this.generateBacklogTrend(tasks)
    };

    return {
      totalTasks,
      tasksByStatus,
      tasksByPriority,
      tasksByAssignee,
      averageResolutionTime: Math.round(averageResolutionTime * 100) / 100,
      resolutionTimeByPriority,
      resolutionEffectiveness,
      topComponents,
      trends
    };
  }

  /**
   * Set assignment rule
   */
  public setAssignmentRule(rule: TaskAssignmentRule): void {
    this.assignmentRules.set(rule.id, rule);
    logger.info('Assignment rule updated', {
      component: 'ERROR_RESOLUTION_WORKFLOW_SERVICE',
      ruleId: rule.id,
      ruleName: rule.name,
      enabled: rule.enabled
    });
  }

  /**
   * Get assignment rules
   */
  public getAssignmentRules(): TaskAssignmentRule[] {
    return Array.from(this.assignmentRules.values()).sort((a, b) => a.order - b.order);
  }

  /**
   * Remove assignment rule
   */
  public removeAssignmentRule(ruleId: string): boolean {
    return this.assignmentRules.delete(ruleId);
  }

  // Private helper methods

  private findAutoAssignment(error: any, priority: string, tags: string[]): { assignTo: string } | null {
    const rules = Array.from(this.assignmentRules.values())
      .filter(rule => rule.enabled && rule.assignment.autoAssign)
      .sort((a, b) => a.order - b.order);

    for (const rule of rules) {
      if (this.matchesAssignmentRule(rule, error, priority, tags)) {
        return { assignTo: rule.assignment.assignTo };
      }
    }

    return null;
  }

  private matchesAssignmentRule(rule: TaskAssignmentRule, error: any, priority: string, tags: string[]): boolean {
    const { conditions } = rule;

    // Check component
    if (conditions.component?.length && !conditions.component.includes(error.component)) {
      return false;
    }

    // Check error type
    if (conditions.errorType?.length && !conditions.errorType.includes(error.errorType)) {
      return false;
    }

    // Check priority
    if (conditions.priority?.length && !conditions.priority.includes(priority as any)) {
      return false;
    }

    // Check severity
    if (conditions.severity?.length && !conditions.severity.includes(error.level)) {
      return false;
    }

    // Check tags
    if (conditions.tags?.length) {
      const hasMatchingTag = conditions.tags.some(tag => tags.includes(tag));
      if (!hasMatchingTag) return false;
    }

    return true;
  }

  private calculateBusinessImpact(error: any, priority: string): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    // Business impact calculation logic
    if (priority === 'CRITICAL') return 'CRITICAL';
    if (priority === 'HIGH') return 'HIGH';
    
    // Check if it's a trading-related error
    if (error.component?.toLowerCase().includes('broker') || 
        error.component?.toLowerCase().includes('trading') ||
        error.component?.toLowerCase().includes('order')) {
      return 'HIGH';
    }

    // Check if it's an authentication error
    if (error.component?.toLowerCase().includes('auth')) {
      return 'MEDIUM';
    }

    return priority === 'MEDIUM' ? 'MEDIUM' : 'LOW';
  }

  private generateTrendData(tasks: ErrorResolutionTask[], dateField: 'createdAt' | 'resolvedAt'): Array<{ date: string; count: number }> {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    const tasksByDate = tasks.reduce((acc, task) => {
      const date = dateField === 'resolvedAt' && task.resolvedAt 
        ? task.resolvedAt.toISOString().split('T')[0]
        : task.createdAt.toISOString().split('T')[0];
      
      if (date) {
        acc[date] = (acc[date] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    return last30Days.map(date => ({
      date: date || '',
      count: tasksByDate[date || ''] || 0
    }));
  }

  private generateBacklogTrend(tasks: ErrorResolutionTask[]): Array<{ date: string; count: number }> {
    const last30Days = Array.from({ length: 30 }, (_, i) => {
      const date = new Date();
      date.setDate(date.getDate() - (29 - i));
      return date.toISOString().split('T')[0];
    });

    return last30Days.map(date => {
      const targetDate = new Date(date || '');
      const openTasks = tasks.filter(task => {
        const createdBefore = task.createdAt <= targetDate;
        const notResolvedYet = !task.resolvedAt || task.resolvedAt > targetDate;
        return createdBefore && notResolvedYet && task.status !== 'CANCELLED';
      });

      return {
        date: date || '',
        count: openTasks.length
      };
    });
  }

  private initializeDefaultAssignmentRules(): void {
    const defaultRules: TaskAssignmentRule[] = [
      {
        id: 'critical_broker_errors',
        name: 'Critical Broker Errors',
        description: 'Auto-assign critical broker errors to senior developer',
        enabled: true,
        conditions: {
          component: ['BROKER_CONTROLLER', 'BROKER_SERVICE'],
          priority: ['CRITICAL'],
          severity: ['ERROR']
        },
        assignment: {
          assignTo: 'senior-dev-team',
          autoAssign: true,
          notifyAssignee: true
        },
        order: 1
      },
      {
        id: 'auth_errors',
        name: 'Authentication Errors',
        description: 'Auto-assign authentication errors to security team',
        enabled: true,
        conditions: {
          component: ['AUTH_CONTROLLER', 'AUTH_MIDDLEWARE'],
          priority: ['HIGH', 'CRITICAL']
        },
        assignment: {
          assignTo: 'security-team',
          autoAssign: true,
          notifyAssignee: true
        },
        order: 2
      },
      {
        id: 'database_errors',
        name: 'Database Errors',
        description: 'Auto-assign database errors to backend team',
        enabled: true,
        conditions: {
          errorType: ['DATABASE_ERROR', 'CONNECTION_ERROR'],
          priority: ['MEDIUM', 'HIGH', 'CRITICAL']
        },
        assignment: {
          assignTo: 'backend-team',
          autoAssign: true,
          notifyAssignee: true
        },
        order: 3
      }
    ];

    defaultRules.forEach(rule => {
      this.assignmentRules.set(rule.id, rule);
    });
  }
}

export const errorResolutionWorkflowService = ErrorResolutionWorkflowService.getInstance();