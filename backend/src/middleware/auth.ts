/**
 * JWT 认证中间件
 * 验证请求中的 Bearer Token
 */

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { JWTPayload, UserTier } from '../types/user.types';

/**
 * JWT 认证中间件
 * 验证请求头中的 Authorization Bearer Token
 * 支持滑动过期时间：每次请求时刷新token过期时间
 */
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  // 如果没有认证头，返回未授权错误
  if (!authHeader) {
    return res.status(401).json({
      code: 401,
      message: '未提供认证令牌',
      data: null,
      timestamp: Date.now(),
    });
  }

  const parts = authHeader.split(' ');

  // 检查格式是否为 "Bearer token"
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({
      code: 401,
      message: '认证令牌格式错误，应为 Bearer token',
      data: null,
      timestamp: Date.now(),
    });
  }

  const token = parts[1];

  // 开发环境下支持模拟令牌
  if (config.server.env === 'development' && token === 'mock-token-for-development') {
    req.user = {
      userId: '00000000-0000-0000-0000-000000000001',
      phone: '13800138000',
      tier: 'subscribed',
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;

    // 验证必要字段
    if (!decoded.userId) {
      return res.status(401).json({
        code: 401,
        message: '无效的认证令牌：缺少用户ID',
        data: null,
        timestamp: Date.now(),
      });
    }

    // 将用户信息附加到请求对象
    req.user = {
      userId: decoded.userId,
      phone: decoded.phone || '',
      tier: decoded.tier || 'guest',
    };

    // 滑动过期时间：重新签发token，在响应头中返回
    const newToken = jwt.sign(
      {
        userId: decoded.userId,
        phone: decoded.phone || '',
        tier: decoded.tier || 'guest',
      },
      config.jwt.secret,
      { expiresIn: '15m' } // 15分钟滑动过期时间
    );
    res.setHeader('X-Access-Token', newToken);

    next();
  } catch (error) {
    // Token 验证失败
    let message = '无效的认证令牌';

    if (error instanceof jwt.TokenExpiredError) {
      message = '认证令牌已过期';
    } else if (error instanceof jwt.JsonWebTokenError) {
      message = '认证令牌格式错误';
    }

    return res.status(401).json({
      code: 401,
      message,
      data: null,
      timestamp: Date.now(),
    });
  }
};

/**
 * 可选认证中间件
 * 验证 Token 如果存在，但不强制要求
 */
export const optionalAuth = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return next();
  }

  const parts = authHeader.split(' ');
  
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return next();
  }

  const token = parts[1];

  // 开发环境下支持模拟令牌
  if (config.server.env === 'development' && token === 'mock-token-for-development') {
    req.user = {
      userId: '00000000-0000-0000-0000-000000000001',
      phone: '13800138000',
      tier: 'subscribed',
    };
    return next();
  }

  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JWTPayload;
    
    if (decoded.userId) {
      req.user = {
        userId: decoded.userId,
        phone: decoded.phone || '',
        tier: decoded.tier || 'guest',
      };
    }
  } catch (error) {
    // 可选认证，Token 错误不阻止请求
  }
  
  next();
};

/**
 * 角色授权中间件
 * 检查用户是否具有指定角色
 */
export const authorize = (...allowedTiers: UserTier[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        code: 401,
        message: '未登录',
        data: null,
        timestamp: Date.now(),
      });
    }

    if (!allowedTiers.includes(req.user.tier)) {
      return res.status(403).json({
        code: 403,
        message: '权限不足',
        data: null,
        timestamp: Date.now(),
      });
    }

    next();
  };
};

/**
 * 订阅用户授权中间件
 * 只允许订阅用户访问
 */
export const requireSubscription = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      code: 401,
      message: '未登录',
      data: null,
      timestamp: Date.now(),
    });
  }

  if (req.user.tier !== 'subscribed') {
    return res.status(403).json({
      code: 403,
      message: '此功能需要订阅',
      data: {
        upgradeUrl: '/subscriptions/plans',
      },
      timestamp: Date.now(),
    });
  }

  next();
};

export default authenticate;
