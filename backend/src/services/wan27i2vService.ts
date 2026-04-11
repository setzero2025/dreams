/**
 * 阿里百炼云 wan2.7-i2v 服务
 * 基于关键帧图片生成视频
 */
import axios from 'axios';
import { supabaseStorageService } from './supabaseStorage.service';

const API_KEY = process.env.DASHSCOPE_API_KEY || '';

export interface I2VGenerationResult {
  taskId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  videoUrl?: string;
  errorMessage?: string;
}

/**
 * 提交图片转视频任务
 * @param imageUrl 关键帧图片URL
 * @param prompt 提示词
 * @returns 任务ID
 */
export async function submitI2VTask(
  imageUrl: string,
  prompt: string
): Promise<string> {
  try {
    console.log('【wan2.7-i2v】提交图片转视频任务');
    console.log('【wan2.7-i2v】图片URL:', imageUrl);
    console.log('【wan2.7-i2v】提示词:', prompt);

    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
      {
        model: 'wan2.7-i2v',
        input: {
          prompt: prompt,
          image_url: imageUrl,
        },
        parameters: {
          duration: 5,
          resolution: '720P',
          aspect_ratio: '16:9',
        },
      },
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const taskId = response.data.output?.task_id;
    if (!taskId) {
      throw new Error('未获取到任务ID');
    }

    console.log('【wan2.7-i2v】任务提交成功，任务ID:', taskId);
    return taskId;
  } catch (error) {
    console.error('【wan2.7-i2v】提交任务失败:', error);
    throw error;
  }
}

/**
 * 查询图片转视频任务状态
 * @param taskId 任务ID
 * @returns 任务结果
 */
export async function queryI2VTask(taskId: string): Promise<I2VGenerationResult> {
  try {
    console.log('【wan2.7-i2v】查询任务状态:', taskId);

    const response = await axios.get(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${API_KEY}`,
        },
      }
    );

    const taskStatus = response.data.output?.task_status;
    console.log('【wan2.7-i2v】任务状态:', taskStatus);

    if (taskStatus === 'SUCCEEDED') {
      const videoUrl = response.data.output?.video_url;
      console.log('【wan2.7-i2v】视频生成成功:', videoUrl);

      // 下载视频并上传到 Supabase Storage
      const savedVideoUrl = await supabaseStorageService.uploadFromUrl(
        videoUrl,
        'aiVideo',
        `i2v_${Date.now()}.mp4`
      );

      return {
        taskId,
        status: 'SUCCEEDED',
        videoUrl: savedVideoUrl,
      };
    } else if (taskStatus === 'FAILED') {
      const errorMessage = response.data.output?.message || '视频生成失败';
      console.error('【wan2.7-i2v】任务失败:', errorMessage);
      return {
        taskId,
        status: 'FAILED',
        errorMessage,
      };
    }

    return {
      taskId,
      status: taskStatus,
    };
  } catch (error) {
    console.error('【wan2.7-i2v】查询任务失败:', error);
    return {
      taskId,
      status: 'FAILED',
      errorMessage: error instanceof Error ? error.message : '查询任务失败',
    };
  }
}

/**
 * 等待图片转视频任务完成
 * @param taskId 任务ID
 * @param maxAttempts 最大尝试次数
 * @param interval 轮询间隔（毫秒）
 * @returns 任务结果
 */
export async function waitForI2VTask(
  taskId: string,
  maxAttempts: number = 60,
  interval: number = 5000
): Promise<I2VGenerationResult> {
  console.log('【wan2.7-i2v】等待任务完成:', taskId);

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const result = await queryI2VTask(taskId);

    if (result.status === 'SUCCEEDED') {
      return result;
    }

    if (result.status === 'FAILED') {
      throw new Error(result.errorMessage || '视频生成失败');
    }

    console.log(`【wan2.7-i2v】任务进行中，第 ${attempt + 1} 次轮询...`);
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  throw new Error('视频生成超时');
}
