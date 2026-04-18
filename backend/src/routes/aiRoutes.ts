import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { generateVideo } from '../services/wan26t2vService';
import { expandScript } from '../services/kimiService';
import { generateLongVideo } from '../services/longVideoService';
import { InterpretationService } from '../services/interpretationService';
import { taskProgressService } from '../services/taskProgressService';
import { supabaseStorageService } from '../services/supabaseStorage.service';
import { AIServiceError } from '../utils/errors';
import { getDbPool } from '../config/database';
// 导入重构后的 Seedream 路由
import seedreamRoutes from './seedream.routes';

const router = Router();

// 初始化梦境解读服务
const dbPool = getDbPool();
const interpretationService = new InterpretationService(dbPool);

/**
 * 统一错误处理包装器
 */
const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<any>) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * 统一响应格式
 */
const successResponse = (data: any, message?: string) => ({
  success: true,
  data,
  ...(message && { message }),
});

const errorResponse = (message: string, error?: string) => ({
  success: false,
  message,
  ...(error && { error }),
});

// 使用重构后的 Seedream 路由（包含图片生成和状态检查）
router.use(seedreamRoutes);

// 生成视频
router.post('/generate-video', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { dreamContent, dreamTitle, dreamId } = req.body;
  const userId = req.user?.userId;

  // 参数验证
  if (!dreamContent || typeof dreamContent !== 'string' || dreamContent.trim().length === 0) {
    res.status(400).json(errorResponse('缺少 dreamContent 参数或参数无效'));
    return;
  }

  if (!userId) {
    res.status(401).json(errorResponse('用户未认证'));
    return;
  }

  console.log(`[AI Routes] 生成视频请求 - 用户: ${userId}, 梦境: ${dreamTitle || '未命名'}`);

  // 创建任务
  const task = taskProgressService.createTask('video');

  // 更新进度：开始生成
  taskProgressService.updateProgress(task.taskId, 10, '正在生成视频...');

  // 异步执行生成任务
  generateVideo({
    dreamContent: dreamContent.trim(),
    dreamTitle: dreamTitle?.trim(),
  }).then(async (result) => {
    taskProgressService.updateProgress(task.taskId, 80, '视频生成完成，正在上传到存储...');

    // 将生成的视频上传到 Supabase Storage
    try {
      console.log('[AI Routes] 开始上传视频到 Supabase Storage');
      const storageUrl = await supabaseStorageService.uploadFromUrl(
        supabaseStorageService.getBucketConfig().AI_VIDEO,
        result.videoUrl!,
        userId,
        dreamId
      );
      console.log('[AI Routes] 视频已上传到 Storage:', storageUrl);

      // 生成封面图并上传
      // 使用视频第一帧作为封面（t_0表示第0毫秒，即第一帧）
      let coverStorageUrl = result.coverUrl;
      const videoCoverUrl = `${result.videoUrl}?x-oss-process=video/snapshot,t_0,f_jpg,w_720,h_405,m_fast`;
      
      try {
        console.log('[AI Routes] 开始下载并上传封面图:', videoCoverUrl);
        coverStorageUrl = await supabaseStorageService.uploadFromUrl(
          supabaseStorageService.getBucketConfig().AI_IMAGE,
          videoCoverUrl,
          userId,
          dreamId
        );
        console.log('[AI Routes] 封面已上传到 Storage:', coverStorageUrl);
      } catch (coverError) {
        console.error('[AI Routes] 封面上传失败，使用OSS截图URL:', coverError);
        // 上传失败时，使用OSS截图URL作为备选
        coverStorageUrl = videoCoverUrl;
      }

      taskProgressService.updateProgress(task.taskId, 95, '上传完成，正在保存...');
      taskProgressService.completeTask(task.taskId, {
        ...result,
        videoUrl: storageUrl,
        coverUrl: coverStorageUrl,
        originalVideoUrl: result.videoUrl,
        originalCoverUrl: result.coverUrl,
      });
    } catch (storageError) {
      console.error('[AI Routes] 上传到 Storage 失败，使用原始URL:', storageError);
      // 上传失败时仍然返回原始URL，但确保有封面URL
      const fallbackCoverUrl = result.coverUrl || `${result.videoUrl}?x-oss-process=video/snapshot,t_0,f_jpg,w_720,h_405,m_fast`;
      taskProgressService.updateProgress(task.taskId, 95, '上传失败，使用原始链接...');
      taskProgressService.completeTask(task.taskId, {
        ...result,
        coverUrl: fallbackCoverUrl,
      });
    }
  }).catch(error => {
    taskProgressService.failTask(task.taskId, error.message);
  });

  // 立即返回任务ID
  res.json(successResponse({
    taskId: task.taskId,
    status: 'processing',
    message: '视频生成任务已启动'
  }, '视频生成任务已启动'));
}));

// 生成剧本
router.post('/generate-script', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { dreamContent, dreamTitle } = req.body;
  const userId = req.user?.userId;

  // 参数验证
  if (!dreamContent || typeof dreamContent !== 'string' || dreamContent.trim().length === 0) {
    res.status(400).json(errorResponse('缺少 dreamContent 参数或参数无效'));
    return;
  }

  console.log(`[AI Routes] 生成剧本请求 - 用户: ${userId}, 梦境: ${dreamTitle || '未命名'}`);

  // 创建任务
  const task = taskProgressService.createTask('script');
  
  // 更新进度：开始生成
  taskProgressService.updateProgress(task.taskId, 10, '正在分析梦境内容...');

  // 异步执行生成任务
  expandScript({
    dreamContent: dreamContent.trim(),
    dreamTitle: dreamTitle?.trim(),
  }).then(result => {
    taskProgressService.updateProgress(task.taskId, 90, '剧本生成完成，正在保存...');
    taskProgressService.completeTask(task.taskId, result);
  }).catch(error => {
    taskProgressService.failTask(task.taskId, error.message);
  });

  // 立即返回任务ID
  res.json(successResponse({ 
    taskId: task.taskId,
    status: 'processing',
    message: '剧本生成任务已启动'
  }, '剧本生成任务已启动'));
}));

// 生成长视频
router.post('/generate-long-video', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { script, dreamTitle, testMode, testSceneCount } = req.body;
  const userId = req.user?.userId;

  // 参数验证
  if (!script || !script.scenes || !Array.isArray(script.scenes)) {
    res.status(400).json(errorResponse('缺少 script 参数或 scenes 格式无效'));
    return;
  }

  console.log(`[AI Routes] 生成长视频请求 - 用户: ${userId}, 梦境: ${dreamTitle || '未命名'}`);

  // 创建任务
  const task = taskProgressService.createTask('long_video');

  // 异步执行生成任务
  generateLongVideo({
    script,
    dreamTitle: dreamTitle?.trim(),
    testMode: testMode !== false, // 默认为测试模式
    testSceneCount: testSceneCount || 4,
  }).then(result => {
    taskProgressService.completeTask(task.taskId, result);
  }).catch(error => {
    taskProgressService.failTask(task.taskId, error.message);
  });

  // 立即返回任务ID
  res.json(successResponse({ 
    taskId: task.taskId,
    status: 'processing',
    message: '长视频生成任务已启动'
  }, '长视频生成任务已启动'));
}));

// 查询任务进度
router.get('/task-progress/:taskId', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { taskId } = req.params;
  
  if (!taskId) {
    res.status(400).json(errorResponse('缺少 taskId 参数'));
    return;
  }

  const task = taskProgressService.getTask(taskId);
  
  if (!task) {
    res.status(404).json(errorResponse('任务不存在或已过期'));
    return;
  }

  res.json(successResponse({
    taskId: task.taskId,
    type: task.type,
    status: task.status,
    progress: task.progress,
    stage: task.stage,
    result: task.result,
    error: task.error,
  }, '查询任务进度成功'));
}));

// 生成梦境解读
router.post('/generate-interpretation', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { dreamContent, dreamTitle, dreamId } = req.body;
  const userId = req.user?.userId;

  // 参数验证
  if (!dreamContent || typeof dreamContent !== 'string' || dreamContent.trim().length === 0) {
    res.status(400).json(errorResponse('缺少 dreamContent 参数或参数无效'));
    return;
  }

  console.log(`[AI Routes] 梦境解读请求 - 用户: ${userId}, 梦境: ${dreamTitle || '未命名'}`);

  const result = await interpretationService.generateInterpretation({
    dreamContent: dreamContent.trim(),
    dreamTitle: dreamTitle?.trim(),
    dreamId,
    userId,
  });

  res.json(successResponse(result, '梦境解读生成成功'));
}));

// 查询梦境解读
router.get('/interpretation/:dreamId', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { dreamId } = req.params;
  const userId = req.user?.userId;

  if (!dreamId) {
    res.status(400).json(errorResponse('缺少 dreamId 参数'));
    return;
  }

  console.log(`[AI Routes] 查询梦境解读 - 用户: ${userId}, 梦境: ${dreamId}`);

  const result = await interpretationService.getInterpretationByDreamId(dreamId, userId!);

  if (!result) {
    res.status(404).json(errorResponse('该梦境暂无解读'));
    return;
  }

  res.json(successResponse(result, '查询梦境解读成功'));
}));

// 诊断接口：检查 Supabase Storage 状态
router.get('/storage-status', authenticate, asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const bucketConfig = supabaseStorageService.getBucketConfig();
    
    // 尝试列出存储桶
    const buckets = await supabaseStorageService.listBuckets?.() || [];
    
    res.json(successResponse({
      buckets: bucketConfig,
      availableBuckets: buckets,
      message: 'Storage 服务正常',
    }, 'Storage 状态检查成功'));
  } catch (error) {
    console.error('[AI Routes] Storage 状态检查失败:', error);
    res.status(500).json(errorResponse(
      'Storage 状态检查失败',
      error instanceof Error ? error.message : 'Unknown error'
    ));
  }
}));

// 错误处理中间件
router.use((error: Error, req: Request, res: Response, next: NextFunction): void => {
  console.error('[AI Routes] Error:', error);

  // 处理 AI 服务错误
  if (error instanceof AIServiceError) {
    const statusCode = error.statusCode || 503;
    res.status(statusCode).json(errorResponse(
      error.message,
      process.env.NODE_ENV === 'development' ? error.stack : undefined
    ));
    return;
  }

  // 其他错误
  res.status(500).json(errorResponse(
    '服务器内部错误',
    process.env.NODE_ENV === 'development' ? error.message : undefined
  ));
});

export default router;
