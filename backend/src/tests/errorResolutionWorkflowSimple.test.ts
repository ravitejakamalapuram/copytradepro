import { errorResolutionWorkflowService } from '../services/errorResolutionWorkflowService';

// Mock the ErrorLog model
jest.mock('../models/errorLogModels', () => ({
  ErrorLog: {
    findOne: jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue({
        errorId: 'test-error',
        traceId: 'test-trace',
        component: 'TEST_COMPONENT',
        errorType: 'TEST_ERROR',
        level: 'ERROR',
        message: 'Test error message',
        metadata: { environment: 'test' }
      })
    }),
    updateOne: jest.fn().mockResolvedValue({ acknowledged: true })
  }
}));

// Mock the logger
jest.mock('../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }
}));

describe('ErrorResolutionWorkflowService - Basic Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new error resolution task', async () => {
    const taskData = {
      title: 'Test task',
      description: 'Test description',
      createdBy: 'test-user'
    };

    const task = await errorResolutionWorkflowService.createTask('test-error', taskData);

    expect(task).toBeDefined();
    expect(task.id).toBeDefined();
    expect(task.errorId).toBe('test-error');
    expect(task.title).toBe('Test task');
    expect(task.description).toBe('Test description');
    expect(task.status).toBe('OPEN');
    expect(task.createdBy).toBe('test-user');
  });

  it('should search tasks', () => {
    const result = errorResolutionWorkflowService.searchTasks({});
    
    expect(result).toBeDefined();
    expect(result.tasks).toBeDefined();
    expect(result.total).toBeDefined();
    expect(result.hasMore).toBeDefined();
  });

  it('should get resolution analytics', async () => {
    const analytics = await errorResolutionWorkflowService.getResolutionAnalytics();
    
    expect(analytics).toBeDefined();
    expect(analytics.totalTasks).toBeDefined();
    expect(analytics.tasksByStatus).toBeDefined();
    expect(analytics.tasksByPriority).toBeDefined();
    expect(analytics.averageResolutionTime).toBeDefined();
  });

  it('should manage assignment rules', () => {
    const rule = {
      id: 'test-rule',
      name: 'Test Rule',
      description: 'Test assignment rule',
      enabled: true,
      conditions: {
        component: ['TEST_COMPONENT']
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
  });
});