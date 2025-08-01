/**
 * Monitoring Integration Test
 * Simple test to verify monitoring and alerting system integration
 */

describe('Monitoring Integration', () => {
  it('should import monitoring services without errors', () => {
    expect(() => {
      require('../services/symbolMonitoringService');
      require('../services/symbolAlertingService');
      require('../services/notificationService');
    }).not.toThrow();
  });

  it('should import monitoring controllers without errors', () => {
    expect(() => {
      require('../controllers/symbolHealthController');
      require('../controllers/notificationController');
    }).not.toThrow();
  });

  it('should import monitoring routes without errors', () => {
    expect(() => {
      require('../routes/symbolHealth');
      require('../routes/notifications');
    }).not.toThrow();
  });
});