/**
 * API client wrapper that automatically includes trace context for all external API calls
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { TraceContext } from './traceContext';
import { logger } from './logger';

export class TracedApiClient {
  private client: AxiosInstance;
  private apiName: string;

  constructor(apiName: string, baseConfig?: AxiosRequestConfig) {
    this.apiName = apiName;
    this.client = axios.create(baseConfig);

    // Add request interceptor to include trace ID in headers
    this.client.interceptors.request.use(
      (config) => {
        const traceId = TraceContext.getTraceId();
        if (traceId) {
          config.headers = config.headers || {};
          config.headers['x-trace-id'] = traceId;
          config.headers['x-request-id'] = traceId;
        }
        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        TraceContext.logWithTrace('debug', `${this.apiName} API call successful`, {
          component: 'TRACED_API_CLIENT',
          operation: 'API_RESPONSE',
          apiName: this.apiName,
          method: response.config.method?.toUpperCase(),
          url: response.config.url,
          status: response.status
        });
        return response;
      },
      (error) => {
        TraceContext.logWithTrace('error', `${this.apiName} API call failed`, {
          component: 'TRACED_API_CLIENT',
          operation: 'API_ERROR',
          apiName: this.apiName,
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status: error.response?.status,
          errorMessage: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * GET request with trace context
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return TraceContext.withExternalApiTrace(
      'GET_REQUEST',
      this.apiName,
      async () => {
        return await this.client.get<T>(url, config);
      },
      {
        method: 'GET',
        url,
        hasConfig: !!config
      }
    );
  }

  /**
   * POST request with trace context
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return TraceContext.withExternalApiTrace(
      'POST_REQUEST',
      this.apiName,
      async () => {
        return await this.client.post<T>(url, data, config);
      },
      {
        method: 'POST',
        url,
        hasData: !!data,
        hasConfig: !!config
      }
    );
  }

  /**
   * PUT request with trace context
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return TraceContext.withExternalApiTrace(
      'PUT_REQUEST',
      this.apiName,
      async () => {
        return await this.client.put<T>(url, data, config);
      },
      {
        method: 'PUT',
        url,
        hasData: !!data,
        hasConfig: !!config
      }
    );
  }

  /**
   * PATCH request with trace context
   */
  async patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return TraceContext.withExternalApiTrace(
      'PATCH_REQUEST',
      this.apiName,
      async () => {
        return await this.client.patch<T>(url, data, config);
      },
      {
        method: 'PATCH',
        url,
        hasData: !!data,
        hasConfig: !!config
      }
    );
  }

  /**
   * DELETE request with trace context
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return TraceContext.withExternalApiTrace(
      'DELETE_REQUEST',
      this.apiName,
      async () => {
        return await this.client.delete<T>(url, config);
      },
      {
        method: 'DELETE',
        url,
        hasConfig: !!config
      }
    );
  }

  /**
   * HEAD request with trace context
   */
  async head<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return TraceContext.withExternalApiTrace(
      'HEAD_REQUEST',
      this.apiName,
      async () => {
        return await this.client.head<T>(url, config);
      },
      {
        method: 'HEAD',
        url,
        hasConfig: !!config
      }
    );
  }

  /**
   * OPTIONS request with trace context
   */
  async options<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return TraceContext.withExternalApiTrace(
      'OPTIONS_REQUEST',
      this.apiName,
      async () => {
        return await this.client.options<T>(url, config);
      },
      {
        method: 'OPTIONS',
        url,
        hasConfig: !!config
      }
    );
  }

  /**
   * Custom request with trace context
   */
  async request<T = any>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return TraceContext.withExternalApiTrace(
      'CUSTOM_REQUEST',
      this.apiName,
      async () => {
        return await this.client.request<T>(config);
      },
      {
        method: config.method?.toUpperCase() || 'UNKNOWN',
        url: config.url,
        hasData: !!config.data
      }
    );
  }

  /**
   * Get the underlying axios instance
   */
  getClient(): AxiosInstance {
    return this.client;
  }

  /**
   * Create a new traced API client
   */
  static create(apiName: string, baseConfig?: AxiosRequestConfig): TracedApiClient {
    return new TracedApiClient(apiName, baseConfig);
  }
}

export default TracedApiClient;