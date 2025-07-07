import api from './api';

export interface ShoonyaCredentials {
  userId: string;
  password: string;
  totpKey: string;  // Changed from twoFA to totpKey
  vendorCode: string;
  apiSecret: string;
  imei: string;
}

export interface FyersCredentials {
  clientId: string;
  secretKey: string;
  redirectUri: string;
  totpKey?: string;
}

export interface BrokerConnectionResponse {
  success: boolean;
  message: string;
  data?: {
    brokerName: string;
    userId?: string;
    accountId?: string;
    userName?: string;
    email?: string;
    brokerDisplayName?: string;
    lastAccessTime?: string;
    exchanges?: string[];
    products?: string[];
    // Fyers specific fields
    authUrl?: string;
    accessToken?: string;
    requiresAuthCode?: boolean;
    requiresAuth?: boolean;
    requiresReauth?: boolean;
  };
  errors?: Array<{
    field: string;
    message: string;
  }>;
}

export interface ConnectedAccount {
  id: string;
  broker_name: string;
  account_id: string;
  user_name: string;
  email: string;
  broker_display_name: string;
  exchanges: string[];
  products: string[];
  created_at: string;
  updated_at: string;
}

export interface AccountStatusResponse {
  success: boolean;
  message: string;
  data?: {
    accountId: string;
    brokerName: string;
    isActive: boolean;
    sessionInfo?: {
      lastChecked: string;
      status: 'active' | 'expired' | 'unknown';
      message: string;
    };
  };
}

export interface PlaceOrderRequest {
  brokerName: string;
  accountId: string; // ID of the specific broker account to use
  symbol: string;
  action: 'BUY' | 'SELL';
  quantity: number;
  orderType: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
  price?: number;
  triggerPrice?: number;
  exchange?: string;
  productType?: string;
  remarks?: string;
}

export interface OrderResponse {
  success: boolean;
  message: string;
  data?: {
    orderId: string;
    brokerName: string;
    symbol: string;
    action: string;
    quantity: number;
    orderType: string;
    price?: number;
    triggerPrice?: number;
    exchange: string;
    status: string;
    timestamp: string;
  };
}

export const brokerService = {
  // Automated OAuth flow for Fyers
  async connectFyersWithOAuth(credentials: FyersCredentials): Promise<BrokerConnectionResponse> {
    try {
      console.log('🚀 Starting automated Fyers OAuth flow...');

      // First, get the auth URL
      const authResponse = await this.connectBroker('fyers', credentials);

      if (!authResponse.success || !authResponse.data?.authUrl) {
        throw new Error(authResponse.message || 'Failed to get authentication URL');
      }

      console.log('🔗 Opening Fyers authentication popup...');

      // Open popup and wait for auth code (with manual fallback for cross-domain)
      const authCode = await this.openOAuthPopupWithManualFallback(authResponse.data.authUrl);

      console.log('✅ Auth code received, completing authentication...');

      // Complete authentication with the received auth code
      return await this.validateFyersAuthCode(authCode, credentials);

    } catch (error: any) {
      console.error('🚨 Automated OAuth flow error:', error);

      return {
        success: false,
        message: error.message || 'OAuth authentication failed',
      };
    }
  },

  // Open OAuth popup and wait for auth code
  async openOAuthPopup(authUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Calculate popup position (centered)
      const width = 500;
      const height = 600;
      const left = (window.screen.width / 2) - (width / 2);
      const top = (window.screen.height / 2) - (height / 2);

      // Open popup window
      const popup = window.open(
        authUrl,
        'fyersAuth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site and try again.'));
        return;
      }

      let authCodeFound = false;

      // Listen for messages from the callback page
      const messageListener = (event: MessageEvent) => {
        // Verify origin for security
        if (event.origin !== window.location.origin) {
          return;
        }

        if (event.data.type === 'FYERS_AUTH_CALLBACK') {
          authCodeFound = true;
          window.removeEventListener('message', messageListener);

          if (event.data.success) {
            resolve(event.data.authCode);
          } else {
            reject(new Error(event.data.error || 'Authentication failed'));
          }

          // Close popup
          if (popup && !popup.closed) {
            popup.close();
          }
        }
      };

      window.addEventListener('message', messageListener);

      // Enhanced popup monitoring for cross-domain scenarios
      const monitorPopup = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(monitorPopup);
            if (!authCodeFound) {
              window.removeEventListener('message', messageListener);
              reject(new Error('Authentication cancelled by user. If you completed authentication, please manually copy the auth_code from the URL and try again.'));
            }
            return;
          }

          // Try to access popup URL (will fail due to CORS if on different domain)
          try {
            const popupUrl = popup.location.href;
            console.log('Popup URL accessible:', popupUrl);

            // Check if URL contains auth_code parameter
            if (popupUrl && popupUrl.includes('auth_code=')) {
              const urlParams = new URLSearchParams(new URL(popupUrl).search);
              const authCode = urlParams.get('auth_code');

              if (authCode && !authCodeFound) {
                authCodeFound = true;
                clearInterval(monitorPopup);
                window.removeEventListener('message', messageListener);
                popup.close();
                resolve(authCode);
              }
            }
          } catch (corsError) {
            // CORS error - popup is on different domain
            // Try alternative methods to detect completion

            // Method 1: Check if popup title changed (sometimes accessible)
            try {
              const title = popup.document.title;
              if (title && title.toLowerCase().includes('success')) {
                console.log('Detected potential success via title change');
              }
            } catch (titleError) {
              // Title also blocked by CORS
            }

            // Method 2: Monitor popup location changes indirectly
            // If popup is still open but we can't access location,
            // it might be on the redirect URL with auth code
            console.log('Popup is on different domain - waiting for user action');
          }
        } catch (error) {
          console.error('Popup monitoring error:', error);
        }
      }, 1000);

      // Timeout after 5 minutes with manual fallback option
      setTimeout(() => {
        clearInterval(monitorPopup);
        window.removeEventListener('message', messageListener);

        if (!authCodeFound) {
          // Offer manual auth code input as fallback
          const manualAuthCode = prompt(
            'Authentication timeout. If you completed authentication in the popup, please copy the "auth_code" parameter from the URL and paste it here:\n\n' +
            'Look for: auth_code=XXXXXX in the popup URL'
          );

          if (manualAuthCode && manualAuthCode.trim()) {
            authCodeFound = true;
            if (popup && !popup.closed) {
              popup.close();
            }
            resolve(manualAuthCode.trim());
          } else {
            if (popup && !popup.closed) {
              popup.close();
            }
            reject(new Error('Authentication timeout. Please try again.'));
          }
        }
      }, 300000); // 5 minutes
    });
  },

  // Enhanced popup method with manual fallback for cross-domain scenarios
  async openOAuthPopupWithManualFallback(authUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Calculate popup position (centered)
      const width = 600;
      const height = 700;
      const left = (window.screen.width / 2) - (width / 2);
      const top = (window.screen.height / 2) - (height / 2);

      // Open popup window
      const popup = window.open(
        authUrl,
        'fyersAuth',
        `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
      );

      if (!popup) {
        reject(new Error('Popup blocked. Please allow popups for this site and try again.'));
        return;
      }

      let authCodeFound = false;
      let crossDomainDetected = false;

      // Monitor popup for cross-domain detection
      const monitorPopup = setInterval(() => {
        try {
          if (popup.closed) {
            clearInterval(monitorPopup);
            if (!authCodeFound) {
              reject(new Error('Authentication cancelled by user'));
            }
            return;
          }

          // Try to access popup URL
          try {
            const popupUrl = popup.location.href;
            console.log('✅ Popup URL accessible:', popupUrl);

            // If we can access the URL and it contains auth_code, extract it
            if (popupUrl && popupUrl.includes('auth_code=')) {
              const urlParams = new URLSearchParams(new URL(popupUrl).search);
              const authCode = urlParams.get('auth_code');

              if (authCode && !authCodeFound) {
                console.log('✅ Auth code extracted automatically:', authCode);
                authCodeFound = true;
                clearInterval(monitorPopup);
                popup.close();
                resolve(authCode);
              }
            }
          } catch (corsError) {
            // CORS error detected - popup is on different domain
            if (!crossDomainDetected) {
              crossDomainDetected = true;
              console.log('🌐 Cross-domain redirect detected - will offer manual extraction');

              // Show manual extraction dialog after a short delay
              setTimeout(() => {
                if (!authCodeFound && !popup.closed) {
                  console.log('📝 Showing manual auth code dialog');
                  this.showManualAuthCodeDialog(popup, resolve, reject, () => {
                    authCodeFound = true;
                    clearInterval(monitorPopup);
                  });
                }
              }, 5000); // Wait 5 seconds for user to complete auth
            }
          }
        } catch (error) {
          console.error('Popup monitoring error:', error);
        }
      }, 1000);

      // Timeout after 10 minutes
      setTimeout(() => {
        clearInterval(monitorPopup);
        if (popup && !popup.closed) {
          popup.close();
        }
        if (!authCodeFound) {
          reject(new Error('Authentication timeout. Please try again.'));
        }
      }, 600000); // 10 minutes
    });
  },

  // Show manual auth code extraction dialog
  showManualAuthCodeDialog(popup: Window, resolve: Function, reject: Function, onSuccess: Function) {
    const dialog = document.createElement('div');
    dialog.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.8);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 10000;
      font-family: Arial, sans-serif;
    `;

    dialog.innerHTML = `
      <div style="
        background: white;
        padding: 30px;
        border-radius: 10px;
        max-width: 500px;
        width: 90%;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
      ">
        <h3 style="margin-top: 0; color: #333;">🔐 Manual Auth Code Extraction</h3>
        <p style="color: #666; line-height: 1.5;">
          The authentication popup redirected to a different domain. Please:
        </p>
        <ol style="color: #666; line-height: 1.8; padding-left: 20px;">
          <li>Complete authentication in the popup window</li>
          <li>Look for <strong style="color: #007bff;">auth_code=</strong> in the popup URL</li>
          <li>Copy the auth code value and paste it below</li>
        </ol>
        <div style="margin: 20px 0;">
          <label style="display: block; margin-bottom: 5px; font-weight: bold; color: #333;">Auth Code:</label>
          <input type="text" id="manual-auth-code" placeholder="Paste auth code here..." style="
            width: 100%;
            padding: 12px;
            border: 2px solid #ddd;
            border-radius: 6px;
            font-size: 14px;
            box-sizing: border-box;
            font-family: monospace;
          ">
          <small style="color: #666; font-size: 12px;">Example: ABC123XYZ789</small>
        </div>
        <div style="text-align: right; margin-top: 25px;">
          <button id="cancel-manual" style="
            padding: 12px 24px;
            margin-right: 10px;
            background: #6c757d;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
          ">Cancel</button>
          <button id="submit-manual" style="
            padding: 12px 24px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: bold;
          ">Submit Auth Code</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    const authCodeInput = dialog.querySelector('#manual-auth-code') as HTMLInputElement;
    const submitBtn = dialog.querySelector('#submit-manual') as HTMLButtonElement;
    const cancelBtn = dialog.querySelector('#cancel-manual') as HTMLButtonElement;

    // Focus on input
    setTimeout(() => authCodeInput.focus(), 100);

    // Handle submit
    const handleSubmit = () => {
      const authCode = authCodeInput.value.trim();
      if (authCode) {
        console.log('✅ Manual auth code submitted:', authCode);
        document.body.removeChild(dialog);
        if (popup && !popup.closed) {
          popup.close();
        }
        onSuccess();
        resolve(authCode);
      } else {
        alert('Please enter the auth code');
        authCodeInput.focus();
      }
    };

    // Handle cancel
    const handleCancel = () => {
      console.log('❌ Manual auth code extraction cancelled');
      document.body.removeChild(dialog);
      if (popup && !popup.closed) {
        popup.close();
      }
      reject(new Error('Manual auth code extraction cancelled'));
    };

    // Event listeners
    submitBtn.addEventListener('click', handleSubmit);
    cancelBtn.addEventListener('click', handleCancel);
    authCodeInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleSubmit();
      }
    });

    // Close on escape
    const escapeHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        document.removeEventListener('keydown', escapeHandler);
        handleCancel();
      }
    };
    document.addEventListener('keydown', escapeHandler);
  },

  // Fyers-specific authentication methods
  async validateFyersAuthCode(authCode: string, credentials: FyersCredentials): Promise<BrokerConnectionResponse> {
    try {
      console.log('🔐 Validating Fyers auth code...');
      const response = await api.post<BrokerConnectionResponse>('/broker/validate-fyers-auth', {
        authCode,
        credentials,
      });
      return response.data;
    } catch (error: any) {
      console.error('🚨 Validate Fyers auth code error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async connectBroker(brokerName: string, credentials: ShoonyaCredentials | FyersCredentials): Promise<BrokerConnectionResponse> {
    try {
      console.log(`🔗 Connecting to ${brokerName} broker...`);
      const response = await api.post<BrokerConnectionResponse>('/broker/connect', {
        brokerName,
        credentials,
      });
      return response.data;
    } catch (error: any) {
      console.error('🚨 Connect broker error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  // Account management methods
  async getConnectedAccounts(): Promise<{ success: boolean; data?: ConnectedAccount[]; message?: string }> {
    try {
      const response = await api.get('/broker/accounts');
      return response.data;
    } catch (error: any) {
      console.error('🚨 Get connected accounts error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async checkAccountStatus(accountId: string): Promise<AccountStatusResponse> {
    try {
      const response = await api.get(`/broker/accounts/${accountId}/status`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Check account status error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async activateAccount(accountId: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log(`🔄 Activating account ${accountId}...`);
      const response = await api.post(`/broker/accounts/${accountId}/activate`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Activate account error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async deactivateAccount(accountId: string): Promise<{ success: boolean; message: string; data?: any }> {
    try {
      console.log(`🔄 Deactivating account ${accountId}...`);
      const response = await api.post(`/broker/accounts/${accountId}/deactivate`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Deactivate account error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async removeAccount(accountId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🗑️ Removing account ${accountId}...`);
      const response = await api.delete(`/broker/accounts/${accountId}`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Remove account error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async disconnectBroker(brokerName: string, accountId: string): Promise<{ success: boolean; message: string }> {
    try {
      console.log(`🔌 Disconnecting from ${brokerName} account ${accountId}...`);
      const response = await api.post('/broker/disconnect', {
        brokerName,
        accountId,
      });
      return response.data;
    } catch (error: any) {
      console.error('🚨 Disconnect broker error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  // Trading methods

  async placeOrder(orderData: PlaceOrderRequest): Promise<OrderResponse> {
    try {
      console.log(`📝 Placing ${orderData.action} order for ${orderData.symbol} via ${orderData.brokerName}...`);
      const response = await api.post<OrderResponse>('/broker/place-order', orderData);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Place order error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async getOrderBook(brokerName: string, accountId?: string): Promise<any> {
    try {
      console.log(`📊 Fetching order book for ${brokerName}${accountId ? ` account ${accountId}` : ''}...`);
      const url = accountId ? `/broker/orders/${brokerName}?accountId=${accountId}` : `/broker/orders/${brokerName}`;
      const response = await api.get(url);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Get order book error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async checkOrderStatus(orderId: string): Promise<any> {
    try {
      const response = await api.post('/broker/check-order-status', {
        orderId
      });
      return response.data;
    } catch (error: any) {
      console.error('🚨 Check order status error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async getPositions(brokerName: string, accountId?: string): Promise<any> {
    try {
      console.log(`📊 Fetching positions for ${brokerName}${accountId ? ` account ${accountId}` : ''}...`);
      const url = accountId ? `/broker/positions/${brokerName}?accountId=${accountId}` : `/broker/positions/${brokerName}`;
      const response = await api.get(url);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Get positions error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  // Symbol search method
  async searchSymbol(brokerName: string, exchange: string, symbol: string): Promise<any> {
    try {
      console.log(`🔍 Searching for ${symbol} on ${exchange} via ${brokerName}...`);
      const response = await api.get(`/broker/search/${brokerName}/${exchange}/${symbol}`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Search symbol error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },



  async getQuotes(brokerName: string, exchange: string, token: string): Promise<any> {
    try {
      const response = await api.get(`/broker/quotes/${brokerName}/${exchange}/${token}`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Get quotes error:', error);

      if (error.response?.data) {
        return error.response.data;
      }

      return {
        success: false,
        message: 'Network error. Please check your connection and try again.',
      };
    }
  },

  async getOrderHistory(
    limit: number = 50,
    offset: number = 0,
    filters?: {
      status?: string;
      symbol?: string;
      brokerName?: string;
      startDate?: string;
      endDate?: string;
      action?: 'BUY' | 'SELL';
      search?: string;
    }
  ): Promise<{
    success: boolean;
    data?: {
      orders: Array<{
        id: number;
        broker_name: string;
        broker_order_id: string;
        symbol: string;
        action: 'BUY' | 'SELL';
        quantity: number;
        price: number;
        order_type: 'MARKET' | 'LIMIT' | 'SL-LIMIT' | 'SL-MARKET';
        status: string;
        exchange: string;
        executed_at: string;
        created_at: string;
      }>;
      totalCount: number;
      limit: number;
      offset: number;
      filters?: any;
    };
    message?: string;
  }> {
    try {
      // Build query parameters
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      // Add filters if provided
      if (filters) {
        if (filters.status) params.append('status', filters.status);
        if (filters.symbol) params.append('symbol', filters.symbol);
        if (filters.brokerName) params.append('brokerName', filters.brokerName);
        if (filters.startDate) params.append('startDate', filters.startDate);
        if (filters.endDate) params.append('endDate', filters.endDate);
        if (filters.action) params.append('action', filters.action);
        if (filters.search) params.append('search', filters.search);
      }

      const response = await api.get(`/broker/order-history?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Get order history error:', error);
      return {
        success: false,
        message: 'Failed to fetch order history. Please try again.',
      };
    }
  },

  async getOrderSearchSuggestions(searchTerm: string, limit: number = 10): Promise<{
    success: boolean;
    data?: {
      suggestions: Array<{
        value: string;
        type: 'symbol' | 'order_id' | 'broker_order_id';
      }>;
      searchTerm: string;
    };
    message?: string;
  }> {
    try {
      const params = new URLSearchParams({
        q: searchTerm,
        limit: limit.toString(),
      });

      const response = await api.get(`/broker/order-search-suggestions?${params.toString()}`);
      return response.data;
    } catch (error: any) {
      console.error('🚨 Get search suggestions error:', error);
      return {
        success: false,
        message: 'Failed to fetch search suggestions. Please try again.',
      };
    }
  },
};
