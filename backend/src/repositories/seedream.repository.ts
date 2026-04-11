/**
 * Seedream API 仓库层
 * 负责与 Seedream API 的直接通信
 * 封装 HTTP 请求、重试机制、错误处理
 */

import axios, { AxiosInstance, AxiosError, AxiosRequestConfig } from 'axios';
import {
  SEEDREAM_API_CONFIG,
  validateSeedreamConfig,
} from '../config/seedream.config';
import {
  SeedreamApiRequest,
  SeedreamApiResponse,
  SeedreamServiceConfig,
} from '../types/seedream.types';
import {
  SeedreamError,
  SeedreamNetworkError,
  SeedreamRetryExhaustedError,
  createSeedreamErrorFromStatusCode,
} from '../utils/seedream.errors';

/**
 * Seedream 仓库类
 * 封装对 Seedream API 的所有 HTTP 调用
 */
export class SeedreamRepository {
  private readonly client: AxiosInstance;
  private readonly config: SeedreamServiceConfig;

  constructor() {
    // 验证配置
    validateSeedreamConfig();

    this.config = {
      modelId: SEEDREAM_API_CONFIG.modelId,
      apiKey: SEEDREAM_API_CONFIG.apiKey,
      baseURL: SEEDREAM_API_CONFIG.baseUrl,
      timeout: SEEDREAM_API_CONFIG.timeout,
      maxRetries: SEEDREAM_API_CONFIG.maxRetries,
      retryDelay: SEEDREAM_API_CONFIG.retryDelay,
    };

    this.client = this.createHttpClient();
  }

  /**
   * 创建 HTTP 客户端
   * 配置 Axios 实例，包括拦截器
   */
  private createHttpClient(): AxiosInstance {
    const client = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.apiKey}`,
      },
    });

    // 请求拦截器 - 记录请求日志
    client.interceptors.request.use(
      (config) => {
        console.log(`[Seedream API] Request: ${config.method?.toUpperCase()} ${config.url}`);
        return config;
      },
      (error) => {
        console.error('[Seedream API] Request Error:', error.message);
        return Promise.reject(error);
      }
    );

    // 响应拦截器 - 记录响应日志
    client.interceptors.response.use(
      (response) => {
        console.log(
          `[Seedream API] Response: ${response.status} ${response.statusText}`
        );
        return response;
      },
      (error: AxiosError) => {
        if (error.response) {
          console.error('[Seedream API] Response Error:', {
            status: error.response.status,
            statusText: error.response.statusText,
            data: error.response.data,
          });
        } else if (error.request) {
          console.error('[Seedream API] No Response:', error.message);
        } else {
          console.error('[Seedream API] Request Setup Error:', error.message);
        }
        return Promise.reject(error);
      }
    );

    return client;
  }

  /**
   * 延迟函数 - 用于重试间隔
   * @param ms 延迟毫秒数
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * 计算指数退避延迟时间
   * @param attempt 当前尝试次数
   * @returns 延迟毫秒数
   */
  private calculateBackoffDelay(attempt: number): number {
    // 指数退避: delay * 2^(attempt-1)
    return this.config.retryDelay * Math.pow(2, attempt - 1);
  }

  /**
   * 判断错误是否可重试
   * 4xx 客户端错误不重试（除了 429 限流）
   * 5xx 服务器错误和 network 错误可以重试
   * @param error Axios 错误对象
   * @returns 是否可重试
   */
  private isRetryableError(error: AxiosError): boolean {
    if (!error.response) {
      // 网络错误（无响应）可以重试
      return true;
    }

    const status = error.response.status;

    // 429 限流错误可以重试
    if (status === 429) {
      return true;
    }

    // 5xx 服务器错误可以重试
    if (status >= 500) {
      return true;
    }

    // 4xx 客户端错误不重试
    return false;
  }

  /**
   * 带重试机制的 HTTP 请求
   * @param config Axios 请求配置
   * @param attempt 当前尝试次数
   * @returns 响应数据
   * @throws SeedreamError 当请求失败且重试耗尽时
   */
  private async requestWithRetry<T>(
    config: AxiosRequestConfig,
    attempt: number = 1
  ): Promise<T> {
    try {
      const response = await this.client.request<T>(config);
      return response.data;
    } catch (error) {
      // 检查是否是 Axios 错误
      if (!axios.isAxiosError(error)) {
        throw error;
      }

      const axiosError = error as AxiosError;

      // 判断是否可以重试
      if (this.isRetryableError(axiosError) && attempt < this.config.maxRetries) {
        const delayMs = this.calculateBackoffDelay(attempt);
        console.log(
          `[Seedream API] Retrying (${attempt}/${this.config.maxRetries}) after ${delayMs}ms...`
        );
        await this.delay(delayMs);
        return this.requestWithRetry(config, attempt + 1);
      }

      // 重试耗尽，抛出错误
      if (attempt >= this.config.maxRetries) {
        throw new SeedreamRetryExhaustedError(
          axiosError,
          this.config.maxRetries
        );
      }

      // 不可重试的错误，直接抛出
      throw this.handleAxiosError(axiosError);
    }
  }

  /**
   * 处理 Axios 错误，转换为 SeedreamError
   * @param error Axios 错误对象
   * @returns SeedreamError 实例
   */
  private handleAxiosError(error: AxiosError): SeedreamError {
    if (error.response) {
      // 服务器返回了错误响应
      const status = error.response.status;
      const data = error.response.data as any;
      const message = data?.error?.message || error.message;

      return createSeedreamErrorFromStatusCode(status, message, error);
    } else if (error.request) {
      // 请求已发送但没有收到响应
      return new SeedreamNetworkError(
        '无法连接到 Seedream API 服务，请检查网络连接',
        error
      );
    } else {
      // 请求配置错误
      return new SeedreamError(
        `请求配置错误: ${error.message}`,
        500,
        true,
        error
      );
    }
  }

  /**
   * 生成图片
   * 调用 Seedream API 生成图片
   * @param request 图片生成请求参数
   * @returns API 响应数据
   * @throws SeedreamError 当请求失败时
   */
  public async generateImage(
    request: SeedreamApiRequest
  ): Promise<SeedreamApiResponse> {
    const config: AxiosRequestConfig = {
      method: 'POST',
      url: '/images/generations',
      data: request,
    };

    return this.requestWithRetry<SeedreamApiResponse>(config);
  }

  /**
   * 获取仓库配置状态
   * @returns 配置状态信息
   */
  public getStatus(): {
    configured: boolean;
    modelId: string;
    baseURL: string;
    maxRetries: number;
    timeout: number;
  } {
    return {
      configured: !!this.config.apiKey,
      modelId: this.config.modelId,
      baseURL: this.config.baseURL,
      maxRetries: this.config.maxRetries,
      timeout: this.config.timeout,
    };
  }
}

/**
 * 导出单例实例
 */
export const seedreamRepository = new SeedreamRepository();
