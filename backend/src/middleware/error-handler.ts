/**
 * 全局错误处理中间件
 * 统一处理应用中的错误并返回标准格式的响应
 */

import { Request, Response, NextFunction } from 'express';
import { AppError, ValidationError } from '../utils/errors';
import { errorResponse, BUSINESS_CODES } from '../utils/api-response';
import { logger } from '../utils/logger';
import { config } from '../config';

/**
 * 全局错误处理中间件
 */
export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // 记录错误日志
  logger.error({
    msg: '请求处理错误',
    error: err.message,
    stack: err.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    query: req.query,
    params: req.params,
    userId: req.user?.userId,
  });

  // 处理已知错误类型
  if (err instanceof AppError) {
    const statusCode = err.statusCode;
    let code: number = BUSINESS_CODES.INTERNAL_ERROR;

    // 根据状态码映射业务码
    switch (statusCode) {
      case 400:
        code = BUSINESS_CODES.BAD_REQUEST;
        break;
      case 401:
        code = BUSINESS_CODES.UNAUTHORIZED;
        break;
      case 403:
        code = BUSINESS_CODES.FORBIDDEN;
        break;
      case 404:
        code = BUSINESS_CODES.NOT_FOUND;
        break;
      case 409:
        code = BUSINESS_CODES.BAD_REQUEST;
        break;
      case 429:
        code = BUSINESS_CODES.QUOTA_EXCEEDED;
        break;
    }

    return res.status(statusCode).json(
      errorResponse(
        code,
        err.message,
        err instanceof ValidationError ? err.errors : undefined
      )
    );
  }

  // 处理数据库错误
  const pgError = err as any;
  if (pgError.code && typeof pgError.code === 'string') {
    // PostgreSQL 错误码处理
    if (pgError.code.startsWith('23')) {
      // 完整性约束违反
      return res.status(409).json(
        errorResponse(BUSINESS_CODES.BAD_REQUEST, '数据冲突：' + (err.message || '数据已存在'))
      );
    }

    if (pgError.code === '42P01') {
      // 表不存在
      return res.status(500).json(
        errorResponse(BUSINESS_CODES.INTERNAL_ERROR, '数据库表不存在，请联系管理员')
      );
    }

    if (pgError.code === '28P01' || pgError.code === '08006') {
      // 数据库连接错误
      return res.status(500).json(
        errorResponse(BUSINESS_CODES.INTERNAL_ERROR, '数据库连接失败，请联系管理员')
      );
    }

    if (pgError.code === '23505') {
      // 唯一约束违反
      return res.status(409).json(
        errorResponse(BUSINESS_CODES.BAD_REQUEST, '数据已存在')
      );
    }
  }

  // 处理 JWT 错误
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json(
      errorResponse(BUSINESS_CODES.TOKEN_INVALID, '无效的认证令牌')
    );
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json(
      errorResponse(BUSINESS_CODES.TOKEN_EXPIRED, '认证令牌已过期')
    );
  }

  // 开发环境返回详细错误
  if (config.server.env === 'development') {
    return res.status(500).json({
      code: BUSINESS_CODES.INTERNAL_ERROR,
      message: err.message || '服务器内部错误',
      data: null,
      timestamp: Date.now(),
      stack: err.stack,
      error: err,
    });
  }

  // 生产环境返回通用错误
  res.status(500).json(
    errorResponse(BUSINESS_CODES.INTERNAL_ERROR, '服务器内部错误，请稍后重试')
  );
};

/**
 * 异步错误包装器
 * 用于包装异步路由处理函数，自动捕获错误
 */
export const asyncHandler = (
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default errorHandler;
