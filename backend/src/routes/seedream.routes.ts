/**
 * Seedream 路由配置
 * 定义图片生成相关的 API 路由
 */

import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import { SeedreamController } from '../controllers/seedream.controller';
import { SeedreamService } from '../services/seedream.service';
import { SeedreamRepository } from '../repositories/seedream.repository';
import { seedreamErrorHandler } from '../controllers/seedream.controller';

/**
 * 创建 Seedream 路由
 * 使用依赖注入模式创建 Controller 和 Service
 */
export function createSeedreamRoutes(): Router {
  const router = Router();

  // 创建依赖实例
  const repository = new SeedreamRepository();
  const service = new SeedreamService(repository);
  const controller = new SeedreamController(service);

  /**
   * @route   POST /api/v1/ai/generate-image
   * @desc    生成图片
   * @access  Private
   * @body    { prompt: string, style?: string, size?: string, format?: string, quality?: string }
   * @response { success: boolean, data: { url: string, revisedPrompt?: string, generationTime?: number }, message?: string }
   */
  router.post('/generate-image', authenticate, controller.generateImage);

  /**
   * @route   GET /api/v1/ai/seedream/status
   * @desc    获取 Seedream 服务状态
   * @access  Private
   * @response { success: boolean, data: { configured: boolean, modelId: string, baseURL: string, maxRetries: number, timeout: number } }
   */
  router.get('/seedream/status', authenticate, controller.getStatus);

  // 错误处理中间件
  router.use(seedreamErrorHandler);

  return router;
}

/**
 * 导出默认路由实例
 */
export default createSeedreamRoutes();
