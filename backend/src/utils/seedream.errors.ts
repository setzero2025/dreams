/**
 * Seedream 服务自定义错误类
 * 定义图片生成服务相关的错误类型
 */

/**
 * Seedream 基础错误类
 * 所有 Seedream 相关错误的基类
 */
export class SeedreamError extends Error {
  /**
   * HTTP 状态码
   */
  public readonly statusCode: number;
  
  /**
   * 是否为操作错误（可预期的错误）
   */
  public readonly isOperational: boolean;
  
  /**
   * 原始错误对象
   */
  public readonly cause?: Error;

  constructor(
    message: string,
    statusCode: number = 500,
    isOperational: boolean = true,
    cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.cause = cause;
    
    // 保持堆栈跟踪
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 配置错误
 * 当 Seedream 配置不完整或无效时抛出
 */
export class SeedreamConfigError extends SeedreamError {
  constructor(message: string = 'Seedream 配置错误') {
    super(message, 500, true);
  }
}

/**
 * 验证错误
 * 当请求参数验证失败时抛出
 */
export class SeedreamValidationError extends SeedreamError {
  /**
   * 验证错误详情
   */
  public readonly errors: Array<{ field: string; message: string }>;

  constructor(
    message: string = '请求参数验证失败',
    errors: Array<{ field: string; message: string }> = []
  ) {
    super(message, 400, true);
    this.errors = errors;
  }
}

/**
 * API 认证错误
 * 当 API 密钥无效或过期时抛出
 */
export class SeedreamAuthError extends SeedreamError {
  constructor(
    message: string = 'Seedream API 认证失败，请检查 API Key 配置',
    cause?: Error
  ) {
    super(message, 401, true, cause);
  }
}

/**
 * 模型未找到错误
 * 当指定的模型ID不存在时抛出
 */
export class SeedreamModelNotFoundError extends SeedreamError {
  constructor(modelId: string) {
    super(`模型未找到: ${modelId}，请检查 SEEDREAM_MODEL_ID 配置`, 404, true);
  }
}

/**
 * 限流错误
 * 当请求频率超过限制时抛出
 */
export class SeedreamRateLimitError extends SeedreamError {
  /**
   * 建议的重试时间（毫秒）
   */
  public readonly retryAfter?: number;

  constructor(
    message: string = '请求过于频繁，请稍后重试',
    retryAfter?: number
  ) {
    super(message, 429, true);
    this.retryAfter = retryAfter;
  }
}

/**
 * 图片生成错误
 * 当图片生成过程失败时抛出
 */
export class SeedreamGenerationError extends SeedreamError {
  constructor(
    message: string = '图片生成失败',
    cause?: Error
  ) {
    super(message, 503, true, cause);
  }
}

/**
 * 网络错误
 * 当与 Seedream API 的网络连接失败时抛出
 */
export class SeedreamNetworkError extends SeedreamError {
  constructor(
    message: string = '无法连接到 Seedream API 服务',
    cause?: Error
  ) {
    super(message, 503, true, cause);
  }
}

/**
 * 重试耗尽错误
 * 当所有重试次数都失败时抛出
 */
export class SeedreamRetryExhaustedError extends SeedreamError {
  /**
   * 最后一次错误
   */
  public readonly lastError: Error;
  
  /**
   * 重试次数
   */
  public readonly attempts: number;

  constructor(lastError: Error, attempts: number) {
    super(
      `请求失败，已重试 ${attempts} 次: ${lastError.message}`,
      503,
      true,
      lastError
    );
    this.lastError = lastError;
    this.attempts = attempts;
  }
}

/**
 * 根据 HTTP 状态码创建对应的错误
 * @param statusCode HTTP 状态码
 * @param message 错误消息
 * @param cause 原始错误
 * @returns 对应的 SeedreamError 实例
 */
export function createSeedreamErrorFromStatusCode(
  statusCode: number,
  message: string,
  cause?: Error
): SeedreamError {
  switch (statusCode) {
    case 401:
      return new SeedreamAuthError(message, cause);
    case 404:
      return new SeedreamModelNotFoundError(message);
    case 429:
      return new SeedreamRateLimitError(message);
    case 400:
      return new SeedreamValidationError(message);
    case 503:
    case 502:
    case 504:
      return new SeedreamNetworkError(message, cause);
    default:
      return new SeedreamGenerationError(message, cause);
  }
}
