/**
 * Seedream 图片生成服务类型定义
 * 定义数据模型、DTO、接口类型
 */

/**
 * 生成图片请求 DTO
 * 客户端请求生成图片时传递的参数
 */
export interface GenerateImageRequest {
  /** 提示词 - 描述要生成的图片内容 */
  prompt: string;
  
  /** 风格 - 可选，默认为'写实' */
  style?: string;
  
  /** 图片尺寸 - 可选，默认为'1920x1920' */
  size?: string;
  
  /** 输出格式 - 可选，默认为'jpeg' */
  format?: 'jpeg' | 'png' | 'webp';
  
  /** 图片质量 - 可选，默认为'standard' */
  quality?: 'standard' | 'high';
  
  /** 用户ID - 用于日志追踪 */
  userId?: string;
}

/**
 * 生成图片响应 DTO
 * 服务返回给客户端的图片生成结果
 */
export interface GenerateImageResponse {
  /** 生成的图片URL */
  url: string;
  
  /** 优化后的提示词 - 模型可能优化了原始提示词 */
  revisedPrompt?: string;
  
  /** 生成耗时（毫秒） */
  generationTime?: number;
}

/**
 * Seedream API 请求体
 * 发送给 Seedream API 的请求格式
 * 参照官网示例: https://www.volcengine.com/docs/82379/1824121
 */
export interface SeedreamApiRequest {
  /** 模型ID */
  model: string;
  
  /** 提示词 */
  prompt: string;
  
  /** 
   * 图片尺寸 
   * 支持: 2K, 3K (Seedream 4.5)
   * 或具体像素: 1920x1920, 1920x1080, 1080x1920 等
   */
  size: string;
  
  /** 
   * 生成数量 
   * Seedream 4.5 默认生成1张
   */
  n?: number;
  
  /** 响应格式 */
  response_format: 'url' | 'b64_json';
  
  /** 
   * 输出格式 - 可选
   * 注意: 仅当 format 不为 jpeg 时才需要传递
   */
  output_format?: 'jpeg' | 'png' | 'webp';
  
  /** 
   * 图片质量 - 可选
   * hd: 高质量
   */
  quality?: 'hd';
  
  /**
   * 是否启用顺序图像生成
   * disabled: 禁用（默认）
   * enabled: 启用
   */
  sequential_image_generation?: 'disabled' | 'enabled';
  
  /**
   * 是否启用流式输出
   * false: 非流式（默认）
   * true: 流式输出
   */
  stream?: boolean;
  
  /**
   * 是否添加水印
   * true: 添加水印（默认）
   * false: 不添加水印
   */
  watermark?: boolean;
}

/**
 * Seedream API 响应体
 * Seedream API 返回的响应格式
 */
export interface SeedreamApiResponse {
  /** 生成的图片数据数组 */
  data?: Array<{
    /** 图片URL */
    url?: string;
    /** Base64编码的图片数据 */
    b64_json?: string;
    /** 优化后的提示词 */
    revised_prompt?: string;
  }>;
  
  /** 错误信息 */
  error?: {
    message: string;
    code?: string;
    type?: string;
  };
}

/**
 * HTTP 客户端配置选项
 */
export interface HttpClientConfig {
  /** 基础URL */
  baseURL: string;
  
  /** 超时时间（毫秒） */
  timeout: number;
  
  /** 请求头 */
  headers?: Record<string, string>;
}

/**
 * 重试配置选项
 */
export interface RetryConfig {
  /** 最大重试次数 */
  maxRetries: number;
  
  /** 初始重试延迟（毫秒） */
  retryDelay: number;
}

/**
 * Seedream 服务配置
 */
export interface SeedreamServiceConfig extends HttpClientConfig, RetryConfig {
  /** 模型ID */
  modelId: string;
  
  /** API密钥 */
  apiKey: string;
}

/**
 * API 统一响应格式
 */
export interface ApiResponse<T = any> {
  /** 是否成功 */
  success: boolean;
  
  /** 响应数据 */
  data?: T;
  
  /** 响应消息 */
  message?: string;
  
  /** 错误详情 */
  error?: string;
}
