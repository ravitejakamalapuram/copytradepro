import { errorResolutionWorkflowService } from '../services/errorResolutionWorkflowService';
import { ErrorLog } from '../models/errorLogModels';

// Mock the ErrorLog model
jest.mock('../models/errorLogModels', () => ({
  ErrorLog: {
    findOne: jest.fn(),
    updateOne: jest.fn()
  }
}));

const mockErrorLog = ErrorLog as jest.Mocked<typeof ErrorLog>;

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('ErrorResolutionWorkflowService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a new error resolution task', async () => {
      // Mock error data
      const mockError = {
        errorId: 'error-123',
        traceId: 'trace-456',
        component: 'BROKER_CONTROLLER',
        errorType: 'BROKER_API_ERROR',
        level: 'ERROR',
        message: 'Failed to place order',
        metadata: {
          environment: 'production'
        }
      };

      mockLean.mockResolvedValue(mockError);

      const taskData = {
        title: 'Fix broker API error',
        description: 'Investigate and fix the broker API connection issue',
        priority: 'HIGH' as const,
        createdBy: 'user-123',
        estimatedEffort: 4,
        tags: ['broker', 'api'],
        relatedErrors: []
      };

      const task = await errorResolutionWorkflowService.createTask('error-123', taskData);

      expect(task).toBeDefined();
      expect(task.id).toBeDefined();
      expect(task.errorId).toBe('error-123');
      expect(task.title).toBe(taskData.title);
      expect(task.description).toBe(taskData.description);
      expect(task.priority).toBe('HIGH');
      expect(task.status).toBe('OPEN');
      expect(task.createdBy).toBe('user-123');
      expect(task.metadata.component).toBe('BROKER_CONTROLLER');
      expect(task.metadata.errorType).toBe('BROKER_API_ERROR');
      expect(task.metadata.businessImpact).toBe('HIGH'); // Should be HIGH for broker errors
    });

    it('should auto-assign task based on assignment rules', async () => {
      const mockError = {
        errorId: 'error-456',
        traceId: 'trace-789',
        component: 'BROKER_CONTROLLER',
        errorType: 'BROKER_API_ERROR',
        level: 'ERROR',
        message: 'Critical broker failure',
        metadata: {
          environment: 'production'
        }
      };

      mockLean.mockResolvedValue(mockError);

      const taskData = {
        title: 'Critical broker issue',
        description: 'Urgent broker failure needs immediate attention',
        priority: 'CRITICAL' as const,
        createdBy: 'user-123'
      };

      const task = await errorResolutionWorkflowService.createTask('error-456', taskData);

      expect(task.assignedTo).toBe('senior-dev-team'); // Should be auto-assigned based on default rules
      expect(task.assignedBy).toBe('SYSTEM');
      expect(task.assignedAt).toBeDefined();
    });

    it('should throw error if error not found', async () => {
      mockLean.mockResolvedValue(null);

      const taskData = {
        title: 'Test task',
        description: 'Test description',
        createdBy: 'user-123'
      };

      await expect(
        errorResolutionWorkflowService.createTask('nonexistent-error', taskData)
      ).rejects.toThrow('Error nonexistent-error not found');
    });
  });

  describe('updateTaskStatus', () => {
    it('should update task status to resolved', async () => {
      // First create a task
      const mockError = {
        errorId: 'error-123',
        traceId: 'trace-456',
        component: 'TEST_COMPONENT',
        errorType: 'TEST_ERROR',
        level: 'ERROR',
        message: 'Test error',
        metadata: { environment: 'test' }
      };

      mockLean.mockResolvedValue(mockError);
      mockUpdateOne.mockResolvedValue({ acknowledged: true });

      const task = await errorResolutionWorkflowService.createTask('error-123', {
        title: 'Test task',
        description: 'Test description',
        createdBy: 'user-123'
      });

      // Update status to resolved
      const updatedTask = await errorResolutionWorkflowService.updateTaskStatus(
        task.id,
        'RESOLVED',
        'user-456',
        'Fixed the issue by updating configuration',
        'FIXED',
        3
      );

      expect(updatedTask.status).toBe('RESOLVED');
      expect(updatedTask.resolvedBy).toBe('user-456');
      expect(updatedTask.resolution).toBe('Fixed the issue by updating configuration');
      expect(updatedTask.resolutionType).toBe('FIXED');
      expect(updatedTask.actualEffort).toBe(3);
      expect(updatedTask.resolvedAt).toBeDefined();

      // Should have updated the error log as well
      expect(ErrorLog.updateOne).toHaveBeenCalledWith(
        { errorId: 'error-123' },
        expect.objectContaining({
          resolved: true,
          resolvedBy: 'user-456'
        })
      );
    });

    it('should throw error if task not found', async () => {
      await expect(
        errorResolutionWorkflowService.updateTaskStatus(
          'nonexistent-task',
          'RESOLVED',
          'user-123'
        )
      ).rejects.toThrow('Task nonexistent-task not found');
    });
  });

  describe('assignTask', () => {
    it('should assign task to user', async () => {
      // Create a task first
      const mockError = {
        errorId: 'error-123',
        traceId: 'trace-456',
        component: 'TEST_COMPONENT',
        errorType: 'TEST_ERROR',
        level: 'ERROR',
        message: 'Test error',
        metadata: { environment: 'test' }
      };

      mockLean.mockResolvedValue(mockError);

      const task = await errorResolutionWorkflowService.createTask('error-123', {
        title: 'Test task',
        description: 'Test description',
        createdBy: 'user-123'
      });

      // Assign task
      const assignedTask = await errorResolutionWorkflowService.assignTask(
        task.id,
        'user-456',
        'user-789'
      );

      expect(assignedTask.assignedTo).toBe('user-456');
      expect(assignedTask.assignedBy).toBe('user-789');
      expect(assignedTask.assignedAt).toBeDefined();
    });
  });

  describe('searchTasks', () => {
    it('should search tasks with filters', async () => {
      // Create multiple tasks for testing
      const mockError1 = {
        errorId: 'error-1',
        traceId: 'trace-1',
        component: 'BROKER_CONTROLLER',
        errorType: 'BROKER_API_ERROR',
        level: 'ERROR',
        message: 'Broker error 1',
        metadata: { environment: 'production' }
      };

      const mockError2 = {
        errorId: 'error-2',
        traceId: 'trace-2',
        component: 'AUTH_CONTROLLER',
        errorType: 'AUTH_ERROR',
        level: 'WARN',
        message: 'Auth error 2',
        metadata: { environment: 'production' }
      };

      mockLean
        .mockResolvedValueOnce(mockError1)
        .mockResolvedValueOnce(mockError2);

      const task1 = await errorResolutionWorkflowService.createTask('error-1', {
        title: 'Broker task',
        description: 'Fix broker issue',
        priority: 'HIGH',
        createdBy: 'user-123'
      });

      const task2 = await errorResolutionWorkflowService.createTask('error-2', {
        title: 'Auth task',
        description: 'Fix auth issue',
        priority: 'MEDIUM',
        createdBy: 'user-456'
      });

      // Search by priority
      const highPriorityTasks = errorResolutionWorkflowService.searchTasks({
        priority: ['HIGH']
      });

      expect(highPriorityTasks.tasks).toHaveLength(1);
      expect(highPriorityTasks.tasks[0]?.priority).toBe('HIGH');
      expect(highPriorityTasks.total).toBe(1);

      // Search by component
      const brokerTasks = errorResolutionWorkflowService.searchTasks({
        component: ['BROKER_CONTROLLER']
      });

      expect(brokerTasks.tasks).toHaveLength(1);
      expect(brokerTasks.tasks[0]?.metadata.component).toBe('BROKER_CONTROLLER');

      // Search all tasks
      const allTasks = errorResolutionWorkflowService.searchTasks({});
      expect(allTasks.tasks).toHaveLength(2);
      expect(allTasks.total).toBe(2);
    });
  });

  describe('getResolutionAnalytics', () => {
    it('should return analytics for resolution tasks', async () => {
      // Create some test tasks
      const mockError = {
        errorId: 'error-analytics',
        traceId: 'trace-analytics',
        component: 'TEST_COMPONENT',
        errorType: 'TEST_ERROR',
        level: 'ERROR',
        message: 'Analytics test error',
        metadata: { environment: 'test' }
      };

      mockLean.mockResolvedValue(mockError);
      mockUpdateOne.mockResolvedValue({ acknowledged: true });

      // Create and resolve a task
      const task = await errorResolutionWorkflowService.createTask('error-analytics', {
        title: 'Analytics test task',
        description: 'Test task for analytics',
        priority: 'MEDIUM',
        createdBy: 'user-123'
      });

      await errorResolutionWorkflowService.updateTaskStatus(
        task.id,
        'RESOLVED',
        'user-456',
        'Fixed for analytics test',
        'FIXED',
        2
      );

      const analytics = await errorResolutionWorkflowService.getResolutionAnalytics();

      expect(analytics).toBeDefined();
      expect(analytics.totalTasks).toBeGreaterThan(0);
      expect(analytics.tasksByStatus).toBeDefined();
      expect(analytics.tasksByPriority).toBeDefined();
      expect(analytics.averageResolutionTime).toBeGreaterThanOrEqual(0);
      expect(analytics.resolutionEffectiveness).toBeDefined();
      expect(analytics.resolutionEffectiveness.fixRate).toBeGreaterThan(0);
      expect(analytics.topComponents).toBeDefined();
      expect(analytics.trends).toBeDefined();
    });
  });

  describe('assignment rules', () => {
    it('should manage assignment rules', () => {
      const rule = {
        id: 'test-rule',
        name: 'Test Rule',
        description: 'Test assignment rule',
        enabled: true,
        conditions: {
          component: ['TEST_COMPONENT'],
          priority: ['HIGH' as const]
        },
        assignment: {
          assignTo: 'test-user',
          autoAssign: true,
          notifyAssignee: true
        },
        order: 1
      };

      // Set rule
      errorResolutionWorkflowService.setAssignmentRule(rule);

      // Get rules
      const rules = errorResolutionWorkflowService.getAssignmentRules();
      const testRule = rules.find(r => r.id === 'test-rule');
      expect(testRule).toBeDefined();
      expect(testRule?.name).toBe('Test Rule');

      // Remove rule
      const removed = errorResolutionWorkflowService.removeAssignmentRule('test-rule');
      expect(removed).toBe(true);

      // Verify removal
      const rulesAfterRemoval = errorResolutionWorkflowService.getAssignmentRules();
      const removedRule = rulesAfterRemoval.find(r => r.id === 'test-rule');
      expect(removedRule).toBeUndefined();
    });
  });
});