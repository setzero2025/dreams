/**
 * 用户控制器（Controller）
 * 处理用户认证、用户管理、订阅等 HTTP 请求
 */

import { Request, Response, NextFunction } from 'express';
import { userService } from '../services/user.service';
import {
  RegisterRequest,
  LoginRequest,
  AnonymousLoginRequest,
  RefreshTokenRequest,
  UpdateProfileRequest,
  UpdateThemeRequest,
  CreateSubscriptionRequest,
} from '../types/user.types';
import { UnauthorizedError } from '../utils/errors';
import {
  successResponse,
  createdResponse,
  noContentResponse,
  errorResponse,
} from '../utils/api-response';

export class UserController {
  // ==================== 认证相关 ====================

  /**
   * 检查手机号是否已注册
   */
  async checkPhoneExists(req: Request, res: Response, next: NextFunction) {
    try {
      const { phone } = req.query;
      if (!phone || typeof phone !== 'string') {
        return res.status(400).json(errorResponse(400, '手机号不能为空'));
      }

      const exists = await userService.checkPhoneExists(phone);
      res.json(successResponse({ exists }, exists ? '该手机号已被注册' : '该手机号可用'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 用户注册
   */
  async register(req: Request, res: Response, next: NextFunction) {
    try {
      const data: RegisterRequest = req.body;
      const result = await userService.register(data);
      res.status(201).json(createdResponse(result, '注册成功'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 用户登录
   */
  async login(req: Request, res: Response, next: NextFunction) {
    try {
      const data: LoginRequest = req.body;
      const result = await userService.login(data);
      res.json(successResponse(result, '登录成功'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 匿名登录
   */
  async anonymousLogin(req: Request, res: Response, next: NextFunction) {
    try {
      const data: AnonymousLoginRequest = req.body;
      const result = await userService.anonymousLogin(data);
      res.json(successResponse(result, '登录成功'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 刷新 Token
   */
  async refreshToken(req: Request, res: Response, next: NextFunction) {
    try {
      const data: RefreshTokenRequest = req.body;
      const result = await userService.refreshToken(data);
      res.json(successResponse(result, '刷新成功'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 退出登录
   */
  async logout(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('未登录');
      }

      await userService.logout(userId);
      res.json(successResponse(null, '退出成功'));
    } catch (error) {
      next(error);
    }
  }

  // ==================== 用户资料相关 ====================

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('未登录');
      }

      const user = await userService.getUserById(userId);
      res.json(successResponse(user));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取完整用户资料
   */
  async getUserProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('未登录');
      }

      const profile = await userService.getUserProfile(userId);
      res.json(successResponse(profile));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新用户资料
   */
  async updateProfile(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('未登录');
      }

      const data: UpdateProfileRequest = req.body;
      const result = await userService.updateProfile(userId, data);
      res.json(successResponse(result, '更新成功'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 更新主题设置
   */
  async updateTheme(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('未登录');
      }

      const data: UpdateThemeRequest = req.body;
      const result = await userService.updateTheme(userId, data);
      res.json(successResponse(result, '设置成功'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取用户额度
   */
  async getUserQuota(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('未登录');
      }

      const quota = await userService.getUserQuota(userId);
      res.json(successResponse(quota));
    } catch (error) {
      next(error);
    }
  }

  // ==================== 订阅相关 ====================

  /**
   * 获取订阅方案
   */
  async getSubscriptionPlans(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      const plans = await userService.getSubscriptionPlans();
      
      // 如果用户已登录，获取当前订阅
      if (userId) {
        const currentSubscription = await userService.getCurrentSubscription(userId);
        plans.currentPlan = currentSubscription?.planId || null;
      }
      
      res.json(successResponse(plans));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 创建订阅
   */
  async createSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('未登录');
      }

      const data: CreateSubscriptionRequest = req.body;
      const result = await userService.createSubscription(userId, data);
      res.json(successResponse(result, '订阅创建成功'));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 获取当前订阅
   */
  async getCurrentSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('未登录');
      }

      const subscription = await userService.getCurrentSubscription(userId);
      res.json(successResponse(subscription));
    } catch (error) {
      next(error);
    }
  }

  /**
   * 取消订阅
   */
  async cancelSubscription(req: Request, res: Response, next: NextFunction) {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        throw new UnauthorizedError('未登录');
      }

      const result = await userService.cancelSubscription(userId);
      res.json(successResponse(result, '订阅已取消'));
    } catch (error) {
      next(error);
    }
  }
}

// 导出单例
export const userController = new UserController();
