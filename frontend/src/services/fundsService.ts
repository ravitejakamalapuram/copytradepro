// import { authService } from './authService';

export interface FundTransaction {
  id: string;
  type: 'CREDIT' | 'DEBIT';
  amount: number;
  description: string;
  date: string;
  status: 'SUCCESS' | 'PENDING' | 'FAILED';
  reference?: string;
  method?: string;
}

export interface FundsBalance {
  availableFunds: number;
  usedMargin: number;
  totalBalance: number;
  withdrawableBalance: number;
  marginUtilized: number;
  marginAvailable: number;
}

export interface AddFundsRequest {
  amount: number;
  method: 'UPI' | 'NETBANKING' | 'BANK_TRANSFER';
  reference?: string;
}

export interface WithdrawFundsRequest {
  amount: number;
  bankAccount: string;
  reference?: string;
}

class FundsService {
  // private baseURL = 'http://localhost:3001/api';

  /*
  // Will be used when connecting to real funds API
  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const token = authService.getToken();

    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
    }

    return response.json();
  }
  */

  /**
   * Get funds balance and margin information
   */
  async getFundsBalance(): Promise<FundsBalance> {
    // For now, return mock data since we don't have a funds API yet
    return {
      availableFunds: 125000,
      usedMargin: 75000,
      totalBalance: 200000,
      withdrawableBalance: 125000,
      marginUtilized: 75000,
      marginAvailable: 125000
    };
  }

  /**
   * Get fund transactions history
   */
  async getTransactions(_limit: number = 50): Promise<FundTransaction[]> {
    // For now, return mock data since we don't have a funds API yet
    return [
      {
        id: 'TXN001',
        type: 'CREDIT',
        amount: 50000,
        description: 'Bank Transfer - HDFC Bank',
        date: '2024-01-15T09:30:00Z',
        status: 'SUCCESS',
        method: 'BANK_TRANSFER',
        reference: 'REF123456'
      },
      {
        id: 'TXN002',
        type: 'DEBIT',
        amount: 25000,
        description: 'Withdrawal to Bank',
        date: '2024-01-14T14:20:00Z',
        status: 'SUCCESS',
        method: 'BANK_TRANSFER',
        reference: 'WTH789012'
      },
      {
        id: 'TXN003',
        type: 'CREDIT',
        amount: 100000,
        description: 'Initial Deposit - UPI',
        date: '2024-01-10T10:15:00Z',
        status: 'SUCCESS',
        method: 'UPI',
        reference: 'UPI345678'
      },
      {
        id: 'TXN004',
        type: 'DEBIT',
        amount: 15000,
        description: 'Trading Settlement',
        date: '2024-01-09T16:45:00Z',
        status: 'SUCCESS',
        method: 'INTERNAL',
        reference: 'TRD901234'
      },
      {
        id: 'TXN005',
        type: 'CREDIT',
        amount: 30000,
        description: 'UPI Transfer',
        date: '2024-01-08T11:30:00Z',
        status: 'PENDING',
        method: 'UPI',
        reference: 'UPI567890'
      }
    ];
  }

  /**
   * Add funds to account
   */
  async addFunds(request: AddFundsRequest): Promise<{ success: boolean; transactionId: string; message: string }> {
    // For now, simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      transactionId: `TXN${Date.now()}`,
      message: `₹${request.amount.toLocaleString()} added successfully via ${request.method}`
    };
  }

  /**
   * Withdraw funds from account
   */
  async withdrawFunds(request: WithdrawFundsRequest): Promise<{ success: boolean; transactionId: string; message: string }> {
    // For now, simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    return {
      success: true,
      transactionId: `WTH${Date.now()}`,
      message: `₹${request.amount.toLocaleString()} withdrawal initiated to ${request.bankAccount}`
    };
  }

  /**
   * Get margin requirements for a symbol
   */
  async getMarginRequirement(_symbol: string, quantity: number, price: number): Promise<{
    required: number;
    available: number;
    shortfall: number;
  }> {
    // For now, simulate margin calculation
    const required = quantity * price * 0.2; // 20% margin requirement
    const available = 125000; // Available margin
    const shortfall = Math.max(0, required - available);
    
    return {
      required,
      available,
      shortfall
    };
  }
}

export const fundsService = new FundsService();
