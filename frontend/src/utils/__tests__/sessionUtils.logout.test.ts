import { 
  analyzeAuthError, 
  shouldLogoutOnError, 
  LogoutReason 
} from '../sessionUtils';

describe('sessionUtils - Enhanced Logout Logic', () => {
  describe('analyzeAuthError', () => {
    it('should detect JWT expiration', () => {
      const errors = [
        { message: 'Token expired' },
        { response: { data: { message: 'JWT expired' } } },
        { message: 'TokenExpiredError: jwt expired' }
      ];

      errors.forEach(error => {
        expect(analyzeAuthError(error)).toBe(LogoutReason.JWT_EXPIRED);
      });
    });

    it('should detect invalid tokens', () => {
      const errors = [
        { message: 'Invalid token' },
        { response: { data: { message: 'JsonWebTokenError: invalid signature' } } },
        { message: 'Malformed token' }
      ];

      errors.forEach(error => {
        expect(analyzeAuthError(error)).toBe(LogoutReason.INVALID_TOKEN);
      });
    });

    it('should not logout for network/server errors', () => {
      const errors = [
        { message: 'Network Error' },
        { message: 'Connection refused' },
        { message: 'Server error' },
        { response: { data: { message: 'Internal server error' } } },
        { message: 'Request timeout' }
      ];

      errors.forEach(error => {
        expect(analyzeAuthError(error)).toBe(LogoutReason.NO_LOGOUT_NEEDED);
      });
    });

    it('should detect auth revocation', () => {
      const errors = [
        { message: 'Authentication revoked' },
        { response: { data: { message: 'Access revoked' } } },
        { message: 'Token revoked' }
      ];

      errors.forEach(error => {
        expect(analyzeAuthError(error)).toBe(LogoutReason.AUTH_REVOKED);
      });
    });
  });

  describe('shouldLogoutOnError', () => {
    it('should logout for JWT expiration in both dev and prod', () => {
      const jwtError = { 
        response: { status: 401, data: { message: 'Token expired' } } 
      };

      // Development
      expect(shouldLogoutOnError(jwtError, '/api/test', true)).toBe(true);
      
      // Production
      expect(shouldLogoutOnError(jwtError, '/api/test', false)).toBe(true);
    });

    it('should NOT logout for network errors in both dev and prod', () => {
      const networkError = { 
        response: { status: 401, data: { message: 'Network Error' } } 
      };

      // Development
      expect(shouldLogoutOnError(networkError, '/api/test', true)).toBe(false);
      
      // Production
      expect(shouldLogoutOnError(networkError, '/api/test', false)).toBe(false);
    });

    it('should NOT logout for non-auth errors', () => {
      const serverError = { 
        response: { status: 500, data: { message: 'Internal server error' } } 
      };

      // Development
      expect(shouldLogoutOnError(serverError, '/api/test', true)).toBe(false);
      
      // Production
      expect(shouldLogoutOnError(serverError, '/api/test', false)).toBe(false);
    });

    it('should logout for invalid tokens in both environments', () => {
      const invalidTokenError = { 
        response: { status: 401, data: { message: 'Invalid token signature' } } 
      };

      // Development
      expect(shouldLogoutOnError(invalidTokenError, '/api/test', true)).toBe(true);
      
      // Production
      expect(shouldLogoutOnError(invalidTokenError, '/api/test', false)).toBe(true);
    });
  });

  describe('LogoutReason enum', () => {
    it('should have all expected values', () => {
      expect(LogoutReason.JWT_EXPIRED).toBe('JWT_EXPIRED');
      expect(LogoutReason.INVALID_TOKEN).toBe('INVALID_TOKEN');
      expect(LogoutReason.TOKEN_MALFORMED).toBe('TOKEN_MALFORMED');
      expect(LogoutReason.AUTH_REVOKED).toBe('AUTH_REVOKED');
      expect(LogoutReason.NO_LOGOUT_NEEDED).toBe('NO_LOGOUT_NEEDED');
    });
  });
});
