/**
 * 异步生成路由
 * 处理图片/视频/长视频的异步生成请求和进度查询
 */
import { Router, Request, Response } from 'express';
import { authenticate, optionalAuth } from '../middleware/auth';
import { asyncHandler } from '../utils/asyncHandler';
import { successResponse, errorResponse } from '../utils/api-response';
import { startGenerationTask } from '../services/asyncGeneration.service';
import { getTaskProgress, TaskType } from '../services/generationTask.service';

const router = Router();

/**
 * 认证请求扩展接口
 */
interface AuthRequest extends Request {
  user?: {
    userId: string;
    phone: string;
    tier: 'guest' | 'registered' | 'subscribed';
  };
}

/**
 * 启动图片生成任务
 * POST /api/v1/generations/image
 */
router.post('/image', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { prompt, style, dreamId, dreamTitle } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json(errorResponse(401, '用户未认证'));
    return;
  }

  if (!dreamId) {
    res.status(400).json(errorResponse(400, '缺少梦境ID'));
    return;
  }

  console.log(`[GenerationRoutes] 启动图片生成任务 - 用户: ${userId}, 梦境: ${dreamTitle}`);

  // 启动异步生成任务
  const taskId = await startGenerationTask({
    type: 'image',
    prompt,
    style,
    dreamId,
    dreamTitle: dreamTitle || '未命名梦境',
    userId,
  });

  res.json(successResponse({
    taskId,
    message: '图片生成任务已启动',
  }));
}));

/**
 * 启动视频生成任务
 * POST /api/v1/generations/video
 */
router.post('/video', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { prompt, dreamId, dreamTitle } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json(errorResponse(401, '用户未认证'));
    return;
  }

  if (!dreamId) {
    res.status(400).json(errorResponse(400, '缺少梦境ID'));
    return;
  }

  console.log(`[GenerationRoutes] 启动视频生成任务 - 用户: ${userId}, 梦境: ${dreamTitle}`);

  // 启动异步生成任务
  const taskId = await startGenerationTask({
    type: 'video',
    prompt,
    dreamId,
    dreamTitle: dreamTitle || '未命名梦境',
    userId,
  });

  res.json(successResponse({
    taskId,
    message: '视频生成任务已启动',
  }));
}));

/**
 * 启动长视频生成任务
 * POST /api/v1/generations/longvideo
 */
router.post('/longvideo', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { script, dreamId, dreamTitle } = req.body;
  const userId = req.user?.userId;

  if (!userId) {
    res.status(401).json(errorResponse(401, '用户未认证'));
    return;
  }

  if (!dreamId) {
    res.status(400).json(errorResponse(400, '缺少梦境ID'));
    return;
  }

  if (!script) {
    res.status(400).json(errorResponse(400, '缺少剧本参数'));
    return;
  }

  console.log(`[GenerationRoutes] 启动长视频生成任务 - 用户: ${userId}, 梦境: ${dreamTitle}`);

  // 启动异步生成任务
  const taskId = await startGenerationTask({
    type: 'longvideo',
    script,
    dreamId,
    dreamTitle: dreamTitle || '未命名梦境',
    userId,
  });

  res.json(successResponse({
    taskId,
    message: '长视频生成任务已启动',
  }));
}));

/**
 * 查询任务进度
 * GET /api/v1/generations/progress/:taskId
 * 使用强制认证，支持滑动过期时间
 */
router.get('/progress/:taskId', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { taskId } = req.params;

  if (!taskId) {
    res.status(400).json(errorResponse(400, '缺少任务ID'));
    return;
  }

  const progress = getTaskProgress(taskId);

  if (!progress) {
    res.status(404).json(errorResponse(404, '任务不存在或已过期'));
    return;
  }

  res.json(successResponse(progress));
}));

/**
 * 批量查询任务进度
 * POST /api/v1/generations/progress/batch
 * 使用强制认证，支持滑动过期时间
 */
router.post('/progress/batch', authenticate, asyncHandler(async (req: AuthRequest, res: Response): Promise<void> => {
  const { taskIds } = req.body;

  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    res.status(400).json(errorResponse(400, '缺少任务ID列表'));
    return;
  }

  const progresses = taskIds.map(taskId => getTaskProgress(taskId)).filter(Boolean);

  res.json(successResponse(progresses));
}));

export default router;
