/**
 * Shoonya Broker Types
 * Type definitions specific to Shoonya broker
 */

export interface ShoonyaCredentials {
  userId: string;
  password: string;
  vendorCode: string;
  apiKey: string;
  apiSecret: string;
  imei: string;
  totpKey: string;
}

export interface ShoonyaLoginResponse {
  stat: string;
  actid?: string;
  uname?: string;
  email?: string;
  brkname?: string;
  lastaccesstime?: string;
  exarr?: string[];
  prarr?: string[];
  emsg?: string;
}

export interface ShoonyaOrderRequest {
  uid: string;
  actid: string;
  exch: string;
  tsym: string;
  qty: string;
  prc: string;
  prd: string;
  trantype: string;
  prctyp: string;
  ret: string;
  ordersource?: string;
  remarks?: string;
}

export interface ShoonyaOrderResponse {
  stat: string;
  norenordno?: string;
  emsg?: string;
}

export interface ShoonyaQuoteResponse {
  stat: string;
  c?: string;
  lp?: string;
  h?: string;
  l?: string;
  v?: string;
  emsg?: string;
}

export interface ShoonyaPositionResponse {
  stat: string;
  exch?: string;
  tsym?: string;
  netqty?: string;
  netavgprc?: string;
  pnl?: string;
  emsg?: string;
}

// Note: Core types are exported from @copytrade/unified-broker
