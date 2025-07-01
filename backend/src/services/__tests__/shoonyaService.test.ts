import { ShoonyaService } from '../shoonyaService';

describe('ShoonyaService', () => {
  let service: ShoonyaService;

  beforeEach(() => {
    service = new ShoonyaService();
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