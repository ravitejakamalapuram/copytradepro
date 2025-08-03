import { Request, Response } from 'express';
import { errorResolutionWorkflowService, TaskAssignmentRule } from '../services/errorResolutionWorkflowService';
import { logger } from '../utils/logger';
import { traceIdService } from '../services/traceIdService';

export class ErrorResolutionController {
  /**
   * Create a new error resolution task
   */
  async createTask(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'CREATE_RESOLUTION_TASK', 'ERROR_RESOLUTION_CONTROLLER');

      const {
        errorId,
        title,
        description,
        priority,
        assignedTo,
        estimatedEffort,
        tags,
        relatedErrors
      } = req.body;

      // Validate required fields
      if (!errorId || !title || !description) {
        res.status(400).json({
          success: false,
          message: 'errorId, title, and description are required',
          traceId
        });
        return;
      }

      // Get user from auth context (assuming it's added by auth middleware)
      const createdBy = (req as any).user?.id || 'unknown';

      const task = await errorResolutionWorkflowService.createTask(errorId, {
        title,
        description,
        priority,
        assignedTo,
        createdBy,
        estimatedEffort,
        tags,
        relatedErrors
      });

      traceIdService.completeOperation(traceId, 'CREATE_RESOLUTION_TASK', 'SUCCESS', {
        taskId: task.id,
        errorId,
        priority: task.priority,
        assignedTo: task.assignedTo
      });

      res.status(201).json({
        success: true,
        message: 'Resolution task created successfully',
        data: task,
        traceId
      });
    } catch (error) {
      logger.error('Error creating resolution task:', error, { traceId });
      traceIdService.completeOperation(traceId, 'CREATE_RESOLUTION_TASK', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to create resolution task',
        traceId
      });
    }
  }

  /**
   * Get task by ID
   */
  async getTask(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GET_RESOLUTION_TASK', 'ERROR_RESOLUTION_CONTROLLER');

      const { taskId } = req.params;

      if (!taskId) {
        res.status(400).json({
          success: false,
          message: 'taskId is required',
          traceId
        });
        return;
      }

      const task = errorResolutionWorkflowService.getTask(taskId);

      if (!task) {
        res.status(404).json({
          success: false,
          message: 'Task not found',
          traceId
        });
        return;
      }

      traceIdService.completeOperation(traceId, 'GET_RESOLUTION_TASK', 'SUCCESS', {
        taskId,
        status: task.status,
        priority: task.priority
      });

      res.json({
        success: true,
        data: task,
        traceId
      });
    } catch (error) {
      logger.error('Error getting resolution task:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GET_RESOLUTION_TASK', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to get resolution task',
        traceId
      });
    }
  }

  /**
   * Search tasks with filters
   */
  async searchTasks(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'SEARCH_RESOLUTION_TASKS', 'ERROR_RESOLUTION_CONTROLLER');

      const {
        status,
        priority,
        assignedTo,
        createdBy,
        component,
        errorType,
        tags,
        startDate,
        endDate,
        limit = 50,
        offset = 0
      } = req.query;

      const filters: any = {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string)
      };

      // Parse array filters
      if (status) filters.status = Array.isArray(status) ? status : [status];
      if (priority) filters.priority = Array.isArray(priority) ? priority : [priority];
      if (component) filters.component = Array.isArray(component) ? component : [component];
      if (errorType) filters.errorType = Array.isArray(errorType) ? errorType : [errorType];
      if (tags) filters.tags = Array.isArray(tags) ? tags : [tags];

      // Parse string filters
      if (assignedTo) filters.assignedTo = assignedTo as string;
      if (createdBy) filters.createdBy = createdBy as string;

      // Parse date range
      if (startDate && endDate) {
        filters.dateRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }

      const result = errorResolutionWorkflowService.searchTasks(filters);

      traceIdService.completeOperation(traceId, 'SEARCH_RESOLUTION_TASKS', 'SUCCESS', {
        totalTasks: result.total,
        returnedTasks: result.tasks.length
      });

      res.json({
        success: true,
        data: result,
        traceId
      });
    } catch (error) {
      logger.error('Error searching resolution tasks:', error, { traceId });
      traceIdService.completeOperation(traceId, 'SEARCH_RESOLUTION_TASKS', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to search resolution tasks',
        traceId
      });
    }
  }

  /**
   * Update task status
   */
  async updateTaskStatus(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'UPDATE_TASK_STATUS', 'ERROR_RESOLUTION_CONTROLLER');

      const { taskId } = req.params;
      const { status, resolution, resolutionType, actualEffort } = req.body;

      // Validate required fields
      if (!taskId) {
        res.status(400).json({
          success: false,
          message: 'taskId is required',
          traceId
        });
        return;
      }

      if (!status) {
        res.status(400).json({
          success: false,
          message: 'status is required',
          traceId
        });
        return;
      }

      // Get user from auth context
      const updatedBy = (req as any).user?.id || 'unknown';

      const task = await errorResolutionWorkflowService.updateTaskStatus(
        taskId,
        status,
        updatedBy,
        resolution,
        resolutionType,
        actualEffort
      );

      traceIdService.completeOperation(traceId, 'UPDATE_TASK_STATUS', 'SUCCESS', {
        taskId,
        newStatus: status,
        resolutionType,
        updatedBy
      });

      res.json({
        success: true,
        message: 'Task status updated successfully',
        data: task,
        traceId
      });
    } catch (error) {
      logger.error('Error updating task status:', error, { traceId });
      traceIdService.completeOperation(traceId, 'UPDATE_TASK_STATUS', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          traceId
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to update task status',
          traceId
        });
      }
    }
  }

  /**
   * Assign task to user
   */
  async assignTask(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'ASSIGN_TASK', 'ERROR_RESOLUTION_CONTROLLER');

      const { taskId } = req.params;
      const { assignedTo } = req.body;

      // Validate required fields
      if (!taskId) {
        res.status(400).json({
          success: false,
          message: 'taskId is required',
          traceId
        });
        return;
      }

      if (!assignedTo) {
        res.status(400).json({
          success: false,
          message: 'assignedTo is required',
          traceId
        });
        return;
      }

      // Get user from auth context
      const assignedBy = (req as any).user?.id || 'unknown';

      const task = await errorResolutionWorkflowService.assignTask(taskId, assignedTo, assignedBy);

      traceIdService.completeOperation(traceId, 'ASSIGN_TASK', 'SUCCESS', {
        taskId,
        assignedTo,
        assignedBy
      });

      res.json({
        success: true,
        message: 'Task assigned successfully',
        data: task,
        traceId
      });
    } catch (error) {
      logger.error('Error assigning task:', error, { traceId });
      traceIdService.completeOperation(traceId, 'ASSIGN_TASK', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          traceId
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to assign task',
          traceId
        });
      }
    }
  }

  /**
   * Add comment to task
   */
  async addComment(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'ADD_TASK_COMMENT', 'ERROR_RESOLUTION_CONTROLLER');

      const { taskId } = req.params;
      const { content, type } = req.body;

      // Validate required fields
      if (!taskId) {
        res.status(400).json({
          success: false,
          message: 'taskId is required',
          traceId
        });
        return;
      }

      if (!content) {
        res.status(400).json({
          success: false,
          message: 'content is required',
          traceId
        });
        return;
      }

      // Get user from auth context
      const author = (req as any).user?.id || 'unknown';

      const comment = await errorResolutionWorkflowService.addComment(taskId, {
        author,
        content,
        type: type || 'COMMENT'
      });

      traceIdService.completeOperation(traceId, 'ADD_TASK_COMMENT', 'SUCCESS', {
        taskId,
        commentId: comment.id,
        author
      });

      res.status(201).json({
        success: true,
        message: 'Comment added successfully',
        data: comment,
        traceId
      });
    } catch (error) {
      logger.error('Error adding task comment:', error, { traceId });
      traceIdService.completeOperation(traceId, 'ADD_TASK_COMMENT', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      if (error instanceof Error && error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message,
          traceId
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to add comment',
          traceId
        });
      }
    }
  }

  /**
   * Get resolution analytics
   */
  async getResolutionAnalytics(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GET_RESOLUTION_ANALYTICS', 'ERROR_RESOLUTION_CONTROLLER');

      const { startDate, endDate } = req.query;

      let timeRange: { start: Date; end: Date } | undefined;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }

      const analytics = await errorResolutionWorkflowService.getResolutionAnalytics(timeRange);

      traceIdService.completeOperation(traceId, 'GET_RESOLUTION_ANALYTICS', 'SUCCESS', {
        totalTasks: analytics.totalTasks,
        averageResolutionTime: analytics.averageResolutionTime
      });

      res.json({
        success: true,
        data: analytics,
        traceId
      });
    } catch (error) {
      logger.error('Error getting resolution analytics:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GET_RESOLUTION_ANALYTICS', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to get resolution analytics',
        traceId
      });
    }
  }

  /**
   * Get assignment rules
   */
  async getAssignmentRules(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GET_ASSIGNMENT_RULES', 'ERROR_RESOLUTION_CONTROLLER');

      const rules = errorResolutionWorkflowService.getAssignmentRules();

      traceIdService.completeOperation(traceId, 'GET_ASSIGNMENT_RULES', 'SUCCESS', {
        ruleCount: rules.length
      });

      res.json({
        success: true,
        data: rules,
        traceId
      });
    } catch (error) {
      logger.error('Error getting assignment rules:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GET_ASSIGNMENT_RULES', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to get assignment rules',
        traceId
      });
    }
  }

  /**
   * Set assignment rule
   */
  async setAssignmentRule(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'SET_ASSIGNMENT_RULE', 'ERROR_RESOLUTION_CONTROLLER');

      const rule: TaskAssignmentRule = req.body;

      // Validate required fields
      if (!rule.id || !rule.name || !rule.assignment?.assignTo) {
        res.status(400).json({
          success: false,
          message: 'id, name, and assignment.assignTo are required',
          traceId
        });
        return;
      }

      errorResolutionWorkflowService.setAssignmentRule(rule);

      traceIdService.completeOperation(traceId, 'SET_ASSIGNMENT_RULE', 'SUCCESS', {
        ruleId: rule.id,
        ruleName: rule.name,
        enabled: rule.enabled
      });

      res.json({
        success: true,
        message: 'Assignment rule configured successfully',
        data: rule,
        traceId
      });
    } catch (error) {
      logger.error('Error setting assignment rule:', error, { traceId });
      traceIdService.completeOperation(traceId, 'SET_ASSIGNMENT_RULE', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to set assignment rule',
        traceId
      });
    }
  }

  /**
   * Remove assignment rule
   */
  async removeAssignmentRule(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'REMOVE_ASSIGNMENT_RULE', 'ERROR_RESOLUTION_CONTROLLER');

      const { ruleId } = req.params;

      if (!ruleId) {
        res.status(400).json({
          success: false,
          message: 'ruleId is required',
          traceId
        });
        return;
      }

      const removed = errorResolutionWorkflowService.removeAssignmentRule(ruleId);

      if (!removed) {
        res.status(404).json({
          success: false,
          message: 'Assignment rule not found',
          traceId
        });
        return;
      }

      traceIdService.completeOperation(traceId, 'REMOVE_ASSIGNMENT_RULE', 'SUCCESS', {
        ruleId
      });

      res.json({
        success: true,
        message: 'Assignment rule removed successfully',
        data: {
          ruleId
        },
        traceId
      });
    } catch (error) {
      logger.error('Error removing assignment rule:', error, { traceId });
      traceIdService.completeOperation(traceId, 'REMOVE_ASSIGNMENT_RULE', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to remove assignment rule',
        traceId
      });
    }
  }

  /**
   * Get task dashboard data
   */
  async getDashboardData(req: Request, res: Response): Promise<void> {
    const traceId = req.headers['x-trace-id'] as string || traceIdService.generateTraceId();
    
    try {
      traceIdService.addOperation(traceId, 'GET_TASK_DASHBOARD', 'ERROR_RESOLUTION_CONTROLLER');

      const { startDate, endDate } = req.query;

      // Get analytics
      let timeRange: { start: Date; end: Date } | undefined;
      if (startDate && endDate) {
        timeRange = {
          start: new Date(startDate as string),
          end: new Date(endDate as string)
        };
      }

      const analytics = await errorResolutionWorkflowService.getResolutionAnalytics(timeRange);

      // Get recent tasks
      const recentTasks = errorResolutionWorkflowService.searchTasks({
        limit: 10,
        offset: 0
      });

      // Get user's assigned tasks (if user context available)
      const userId = (req as any).user?.id;
      const myTasks = userId ? errorResolutionWorkflowService.searchTasks({
        assignedTo: userId,
        status: ['OPEN', 'IN_PROGRESS'],
        limit: 5
      }) : { tasks: [], total: 0, hasMore: false };

      const dashboardData = {
        analytics,
        recentTasks: recentTasks.tasks,
        myTasks: myTasks.tasks,
        summary: {
          totalTasks: analytics.totalTasks,
          openTasks: analytics.tasksByStatus['OPEN'] || 0,
          inProgressTasks: analytics.tasksByStatus['IN_PROGRESS'] || 0,
          resolvedTasks: analytics.tasksByStatus['RESOLVED'] || 0,
          myTaskCount: myTasks.total,
          averageResolutionTime: analytics.averageResolutionTime
        }
      };

      traceIdService.completeOperation(traceId, 'GET_TASK_DASHBOARD', 'SUCCESS', {
        totalTasks: analytics.totalTasks,
        myTaskCount: myTasks.total
      });

      res.json({
        success: true,
        data: dashboardData,
        traceId
      });
    } catch (error) {
      logger.error('Error getting task dashboard data:', error, { traceId });
      traceIdService.completeOperation(traceId, 'GET_TASK_DASHBOARD', 'ERROR', { error: error instanceof Error ? error.message : 'Unknown error' });

      res.status(500).json({
        success: false,
        message: 'Failed to get task dashboard data',
        traceId
      });
    }
  }
}

export const errorResolutionController = new ErrorResolutionController();