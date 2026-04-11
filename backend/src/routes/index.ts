/**
 * 路由索引
 * 统一注册所有 API 路由
 */

import { Router } from 'express';
import userRoutes from './user.routes';
import dreamRoutes from './dreamRoutes';
import generationRoutes from './generationRoutes';
import aiRoutes from './aiRoutes';
import creationRoutes from './creationRoutes';

const router = Router();

// API版本前缀 v1
const API_PREFIX = '/api/v1';

// 用户认证、用户管理、订阅路由
router.use(API_PREFIX, userRoutes);

// 梦境相关路由
router.use(`${API_PREFIX}/dreams`, dreamRoutes);

// 生成任务相关路由
router.use(`${API_PREFIX}/generations`, generationRoutes);

// AI服务相关路由
router.use(`${API_PREFIX}/ai`, aiRoutes);

// 创作相关路由
router.use(`${API_PREFIX}/creations`, creationRoutes);

// 健康检查
router.get('/health', (req, res) => {
  res.json({
    code: 200,
    message: 'OK',
    data: {
      status: 'healthy',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    },
    timestamp: Date.now(),
  });
});

// API 信息
router.get('/', (req, res) => {
  res.json({
    code: 200,
    message: '梦境空间 API 服务',
    data: {
      name: 'hasDream API',
      version: '1.0.0',
      documentation: '/api/docs',
    },
    timestamp: Date.now(),
  });
});

export default router;
