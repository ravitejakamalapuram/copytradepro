import { 
  isSessionExpiredError, 
  isAuthFailureStatus, 
  shouldLogoutOnError 
} from '../sessionUtils';

describe('sessionUtils', () => {
  describe('isSessionExpiredError', () => {
    it('should detect token expired errors', () => {
      expect(isSessionExpiredError('Token expired')).toBe(true);
      expect(isSessionExpiredError('Invalid token')).toBe(true);
      expect(isSessionExpiredError('Invalid or expired token')).toBe(true);
      expect(isSessionExpiredError('session expired')).toBe(true);
      expect(isSessionExpiredError('jwt expired')).toBe(true);
    });

    it('should detect errors from error objects', () => {
      expect(isSessionExpiredError({ message: 'Token expired' })).toBe(true);
      expect(isSessionExpiredError({ 
        response: { data: { message: 'Invalid token' } } 
      })).toBe(true);
    });

    it('should not detect non-session errors', () => {
      expect(isSessionExpiredError('Network error')).toBe(false);
      expect(isSessionExpiredError('Server error')).toBe(false);
      expect(isSessionExpiredError('Validation failed')).toBe(false);
      expect(isSessionExpiredError('Broker connection failed')).toBe(false);
    });

    it('should handle null/undefined errors', () => {
      expect(isSessionExpiredError(null)).toBe(false);
      expect(isSessionExpiredError(undefined)).toBe(false);
      expect(isSessionExpiredError('')).toBe(false);
    });
  });

  describe('isAuthFailureStatus', () => {
    it('should detect auth failure status codes', () => {
      expect(isAuthFailureStatus(401)).toBe(true);
      expect(isAuthFailureStatus(403)).toBe(true);
    });

    it('should not detect non-auth status codes', () => {
      expect(isAuthFailureStatus(200)).toBe(false);
      expect(isAuthFailureStatus(400)).toBe(false);
      expect(isAuthFailureStatus(404)).toBe(false);
      expect(isAuthFailureStatus(500)).toBe(false);
    });
  });

  describe('shouldLogoutOnError', () => {
    const sessionExpiredError = {
      message: 'Token expired',
      response: { status: 401 }
    };

    const networkError = {
      message: 'Network error',
      response: { status: 500 }
    };

    const brokerError = {
      message: 'Broker connection failed',
      response: { status: 401 }
    };

    it('should not logout in development mode', () => {
      expect(shouldLogoutOnError(sessionExpiredError, '/api/profile', true)).toBe(false);
    });

    it('should logout for session expired errors in production', () => {
      expect(shouldLogoutOnError(sessionExpiredError, '/api/profile', false)).toBe(true);
    });

    it('should not logout for non-session errors', () => {
      expect(shouldLogoutOnError(networkError, '/api/profile', false)).toBe(false);
      expect(shouldLogoutOnError(brokerError, '/api/broker/orders', false)).toBe(false);
    });

    it('should not logout for non-auth status codes', () => {
      const error = {
        message: 'Token expired',
        response: { status: 500 }
      };
      expect(shouldLogoutOnError(error, '/api/profile', false)).toBe(false);
    });
  });
});