/**
 * Express 类型扩展
 * 统一声明 Express Request 类型的扩展
 */

import { UserTier } from './user.types';

declare global {
  namespace Express {
    interface Request {
      user?: {
        userId: string;
        phone: string;
        tier: UserTier;
      };
    }
  }
}

// 导出空对象以确保文件被视为模块
export {};
