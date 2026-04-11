/**
 * 异步生成服务
 * 在后台线程中执行图片/视频/长视频生成任务
 */
import { Worker, isMainThread, parentPort, workerData } from 'worker_threads';
import path from 'path';
import {
  createTask,
  updateTaskProgress,
  completeTask,
  failTask,
  TaskType,
} from './generationTask.service';
import { seedreamService } from './seedream.service';
import { submitT2VTask, waitForT2VTask } from './wan26t2vService';
import { generateLongVideo } from './longVideoService';
import { supabaseStorageService } from './supabaseStorage.service';

// 生成参数接口
interface GenerationParams {
  type: TaskType;
  prompt?: string;
  style?: string;
  dreamId: string;
  dreamTitle: string;
  userId: string;
  script?: any; // 长视频需要剧本
}

/**
 * 启动异步生成任务
 * @param params 生成参数
 * @returns 任务ID
 */
export async function startGenerationTask(params: GenerationParams): Promise<string> {
  const { type, dreamId, dreamTitle, userId } = params;
  
  // 创建任务
  const taskId = createTask(type);
  
  console.log(`[AsyncGeneration] 启动${type}生成任务: ${taskId}`);
  
  // 在后台执行生成（使用 Promise 模拟异步，不阻塞主线程）
  setImmediate(async () => {
    try {
      await executeGeneration(taskId, params);
    } catch (error) {
      console.error(`[AsyncGeneration] 任务执行失败: ${taskId}`, error);
      failTask(taskId, error instanceof Error ? error.message : '未知错误');
    }
  });
  
  return taskId;
}

/**
 * 执行生成任务
 * @param taskId 任务ID
 * @param params 生成参数
 */
async function executeGeneration(
  taskId: string,
  params: GenerationParams
): Promise<void> {
  const { type, prompt, style, dreamId, dreamTitle, userId, script } = params;
  
  console.log(`[AsyncGeneration] 开始执行任务: ${taskId}, 类型: ${type}`);
  
  try {
    switch (type) {
      case 'image':
        await generateImageTask(taskId, prompt, style, userId, dreamId);
        break;
      case 'video':
        await generateVideoTask(taskId, prompt, dreamTitle, userId, dreamId);
        break;
      case 'longvideo':
        await generateLongVideoTask(taskId, script, dreamTitle, userId, dreamId);
        break;
      default:
        throw new Error(`未知的生成类型: ${type}`);
    }
  } catch (error) {
    console.error(`[AsyncGeneration] 生成失败: ${taskId}`, error);
    failTask(taskId, error instanceof Error ? error.message : '生成失败');
    throw error;
  }
}

/**
 * 图片生成任务
 */
async function generateImageTask(
  taskId: string,
  prompt: string | undefined,
  style: string | undefined,
  userId: string,
  dreamId: string
): Promise<void> {
  updateTaskProgress(taskId, 5, '正在准备生成...');

  updateTaskProgress(taskId, 10, '正在调用AI生成图片...');

  const result = await seedreamService.generateImage({
    prompt: prompt || '',
    style,
    userId,
  });

  updateTaskProgress(taskId, 60, '图片生成成功，正在处理...');

  // 上传到 Storage
  let storageUrl = result.url;
  try {
    updateTaskProgress(taskId, 70, '正在上传到存储...');
    storageUrl = await supabaseStorageService.uploadFromUrl(
      supabaseStorageService.getBucketConfig().AI_IMAGE,
      result.url,
      userId,
      dreamId
    );
    updateTaskProgress(taskId, 95, '上传完成，正在保存...');
  } catch (error) {
    console.error('[AsyncGeneration] 上传图片失败:', error);
    updateTaskProgress(taskId, 95, '使用原始链接...');
  }

  updateTaskProgress(taskId, 100, '图片生成完成');

  completeTask(taskId, {
    url: storageUrl,
    thumbnail: storageUrl,
  });
}

/**
 * 视频生成任务
 */
async function generateVideoTask(
  taskId: string,
  prompt: string | undefined,
  dreamTitle: string,
  userId: string,
  dreamId: string
): Promise<void> {
  updateTaskProgress(taskId, 10, '正在提交视频生成任务...');
  
  const videoPrompt = prompt || `梦境视频：${dreamTitle}`;
  
  // 提交任务
  const taskResult = await submitT2VTask(videoPrompt);
  
  updateTaskProgress(taskId, 30, '视频生成中，请稍候...');
  
  // 等待完成
  const result = await waitForT2VTask(taskResult.taskId);
  
  if (result.status !== 'SUCCEEDED' || !result.videoUrl) {
    throw new Error(result.errorMessage || '视频生成失败');
  }
  
  updateTaskProgress(taskId, 80, '正在上传视频...');
  
  // 上传到 Storage
  let storageUrl = result.videoUrl;
  try {
    storageUrl = await supabaseStorageService.uploadFromUrl(
      result.videoUrl,
      'aiVideo',
      `video_${Date.now()}.mp4`
    );
  } catch (error) {
    console.error('[AsyncGeneration] 上传视频失败:', error);
  }
  
  updateTaskProgress(taskId, 100, '视频生成完成');
  
  completeTask(taskId, {
    url: storageUrl,
    thumbnail: result.coverUrl,
    coverUrl: result.coverUrl,
  });
}

/**
 * 长视频生成任务
 */
async function generateLongVideoTask(
  taskId: string,
  script: any,
  dreamTitle: string | undefined,
  userId: string,
  dreamId: string
): Promise<void> {
  updateTaskProgress(taskId, 5, '正在准备长视频生成...');
  
  if (!script) {
    throw new Error('长视频生成需要剧本参数');
  }
  
  // 生成长视频
  const result = await generateLongVideo({
    script,
    dreamTitle,
    testMode: true,
    testSceneCount: 4,
  });
  
  if (result.status !== 'SUCCEEDED' || !result.videoUrl) {
    throw new Error(result.errorMessage || '长视频生成失败');
  }
  
  updateTaskProgress(taskId, 100, '长视频生成完成');
  
  completeTask(taskId, {
    url: result.videoUrl,
    thumbnail: result.coverUrl,
    coverUrl: result.coverUrl,
    scenes: result.scenes,
  });
}
