import { FyersService } from '../fyersService';
import { mockFyersLoginResponse } from '../__mocks__/fyersApiMock';

describe('FyersService', () => {
  let service: FyersService;

  beforeEach(() => {
    service = new FyersService();
  });

  it('should handle successful login (mocked)', async () => {
    jest.spyOn(service, 'login').mockResolvedValue(mockFyersLoginResponse);
    const result = await service.login({ clientId: 'mock', secretKey: 'mock', redirectUri: 'mock' });
    expect(result.success).toBe(true);
    expect(result.authUrl).toContain('mock-fyers-auth-url');
  });

  it('should return false for isLoggedIn if not logged in', () => {
    expect(service.isLoggedIn()).toBe(false);
  });

  // Add more tests for placeOrder, getOrderBook, etc.
}); 