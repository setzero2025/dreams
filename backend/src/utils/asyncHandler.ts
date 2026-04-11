/**
 * 异步处理包装器
 * 用于包装 Express 路由处理函数，自动捕获异步错误
 */

import { Request, Response, NextFunction } from 'express';

/**
 * 异步请求处理函数类型
 */
type AsyncRequestHandler = (req: Request, res: Response, next: NextFunction) => Promise<void>;

/**
 * 包装异步路由处理函数，自动捕获错误并传递给 next()
 * @param fn 异步处理函数
 * @returns 包装后的处理函数
 */
export const asyncHandler = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};
