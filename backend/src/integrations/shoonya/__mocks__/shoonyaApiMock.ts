// Example mock for Shoonya API responses

export const mockShoonyaLoginResponse = {
  stat: 'Ok',
  susertoken: 'mock-session-token',
  uname: 'Mock User',
  actid: 'MOCK123',
  email: 'mock@example.com',
  brkname: 'Shoonya',
  exarr: ['NSE', 'BSE'],
  prarr: ['CNC', 'MIS'],
  lastaccesstime: new Date().toISOString(),
};

export const mockShoonyaOrderResponse = {
  stat: 'Ok',
  norenordno: 'ORDER123',
  status: 'OPEN',
  tsym: 'RELIANCE-EQ',
  qty: 10,
  prc: 2500,
  fillshares: 0,
  avgprc: 0,
  rejreason: '',
  norentm: new Date().toISOString(),
  exch_tm: new Date().toISOString(),
}; 