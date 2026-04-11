/**
 * Seedream 控制器层
 * 处理 HTTP 请求和响应
 * 负责参数解析、调用 Service、格式化响应
 */

import { Request, Response, NextFunction } from 'express';
import { SeedreamService } from '../services/seedream.service';
import { GenerateImageRequest, ApiResponse } from '../types/seedream.types';
import { SeedreamError, SeedreamValidationError } from '../utils/seedream.errors';
import { supabaseStorageService } from '../services/supabaseStorage.service';

/**
 * 认证请求扩展接口
 * 包含用户信息
 */
interface AuthRequest extends Request {
  user?: {
    userId: string;
    phone: string;
    tier: 'guest' | 'registered' | 'subscribed';
  };
}

// 定义队列任务类型
interface QueueTask {
  id: string;
  prompt: string;
  style: string;
  userId: string;
  dreamId: string;
  dreamTitle: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: any;
  error?: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * 内存任务队列
 * 用于存储待处理和正在处理的任务
 */
const taskQueue: QueueTask[] = [];

/**
 * Seedream 控制器类
 * 处理图片生成相关的 HTTP 请求
 */
export class SeedreamController {
  constructor(private readonly seedreamService: SeedreamService) {}

  /**
   * 构建成功响应
   * @param data 响应数据
   * @param message 响应消息
   * @returns 统一响应格式
   */
  private successResponse<T>(data: T, message?: string): ApiResponse<T> {
    return {
      success: true,
      data,
      ...(message && { message }),
    };
  }

  /**
   * 构建错误响应
   * @param message 错误消息
   * @param error 错误详情
   * @returns 统一响应格式
   */
  private errorResponse(message: string, error?: string): ApiResponse {
    return {
      success: false,
      message,
      ...(error && { error }),
    };
  }

  /**
   * 生成图片
   * 处理 POST /ai/generate-image 请求
   * 生成图片后自动上传到 Supabase Storage
   * @param req 请求对象
   * @param res 响应对象
   * @param next 下一个中间件
   */
  public generateImage = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      // 从请求体中提取参数
      const { prompt, style, size, format, quality, dreamId } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json(this.errorResponse('用户未认证'));
        return;
      }

      // 记录请求日志
      console.log(`[Seedream Controller] 生成图片请求 - 用户: ${userId}, 风格: ${style || '默认'}`);

      // 构建请求对象
      const request: GenerateImageRequest = {
        prompt: prompt?.trim(),
        style,
        size,
        format,
        quality,
        userId,
      };

      // 调用 Service 层生成图片
      const result = await this.seedreamService.generateImage(request);

      // 将生成的图片上传到 Supabase Storage
      let storageUrl = result.url;
      try {
        console.log('[Seedream Controller] 开始上传图片到 Supabase Storage');
        storageUrl = await supabaseStorageService.uploadFromUrl(
          supabaseStorageService.getBucketConfig().AI_IMAGE,
          result.url,
          userId,
          dreamId
        );
        console.log('[Seedream Controller] 图片已上传到 Storage:', storageUrl);
      } catch (storageError) {
        console.error('[Seedream Controller] 上传到 Storage 失败，使用原始URL:', storageError);
        // 上传失败时仍然返回原始URL，不影响用户体验
      }

      // 返回成功响应
      res.json(this.successResponse({
        ...result,
        url: storageUrl,
        originalUrl: result.url,
      }, '图片生成成功'));
    } catch (error) {
      // 将错误传递给错误处理中间件
      next(error);
    }
  };

  /**
   * 获取服务状态
   * 处理 GET /ai/seedream/status 请求
   * @param req 请求对象
   * @param res 响应对象
   * @param next 下一个中间件
   */
  public getStatus = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const status = this.seedreamService.getStatus();
      res.json(this.successResponse(status));
    } catch (error) {
      next(error);
    }
  };
}

/**
 * 全局错误处理中间件
 * 处理 Seedream 相关的所有错误
 */
export function seedreamErrorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // 记录错误日志
  console.error('[Seedream Error Handler]', error);

  // 处理 Seedream 错误
  if (error instanceof SeedreamError) {
    const response: ApiResponse = {
      success: false,
      message: error.message,
    };

    // 开发环境添加错误详情
    if (process.env.NODE_ENV === 'development') {
      response.error = error.stack;
    }

    // 验证错误添加详细错误信息
    if (error instanceof SeedreamValidationError && error.errors.length > 0) {
      (response as any).errors = error.errors;
    }

    res.status(error.statusCode).json(response);
    return;
  }

  // 其他错误传递给下一个错误处理中间件
  next(error);
}
