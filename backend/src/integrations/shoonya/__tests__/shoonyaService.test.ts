import { ShoonyaService } from '../shoonyaService';
import { mockShoonyaLoginResponse } from '../__mocks__/shoonyaApiMock';

describe('ShoonyaService', () => {
  let service: ShoonyaService;

  beforeEach(() => {
    service = new ShoonyaService();
  });

  it('should handle successful login (mocked)', async () => {
    jest.spyOn(service, 'login').mockResolvedValue(mockShoonyaLoginResponse);
    const result = await service.login({ userId: 'mock', password: 'mock', totpKey: 'mock', vendorCode: '', apiSecret: '', imei: '' });
    expect(result.stat).toBe('Ok');
    expect(result.susertoken).toBe('mock-session-token');
  });

  it('should fail login with invalid credentials', async () => {
    await expect(service.login({ userId: 'bad', password: 'bad', totpKey: 'bad', vendorCode: '', apiSecret: '', imei: '' }))
      .rejects.toThrow();
  });

  it('should return false for isLoggedIn if not logged in', () => {
    expect(service.isLoggedIn()).toBe(false);
  });

  // Add more tests for placeOrder, getOrderBook, etc.
}); 