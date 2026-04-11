/**
 * 生成任务服务
 * 处理异步生成任务的进度轮询和状态管理
 */

import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 辅助函数：获取认证 token
async function getAuthToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem('access_token');
    return token;
  } catch (error) {
    console.warn('获取认证 token 失败:', error);
    return null;
  }
}

// 基础请求函数
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  // 检查响应头中是否有新的token（滑动过期时间机制）
  const newToken = response.headers.get('X-Access-Token');
  if (newToken) {
    console.log('[GenerationTask] 收到新的token，更新本地存储');
    await AsyncStorage.setItem('access_token', newToken);
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '请求失败' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// 任务状态类型
export type TaskStatus = 'pending' | 'processing' | 'completed' | 'failed';

// 任务类型
export type TaskType = 'image' | 'video' | 'longvideo';

// 任务进度信息
export interface TaskProgress {
  taskId: string;
  type: TaskType;
  status: TaskStatus;
  progress: number; // 0-100
  message: string;
  result?: {
    url?: string;
    thumbnail?: string;
    coverUrl?: string;
    scenes?: any[];
  };
  error?: string;
  createdAt: number;
  updatedAt: number;
}

// 进度回调函数类型
export type ProgressCallback = (progress: TaskProgress) => void;

// 轮询间隔（毫秒）
const POLL_INTERVAL = 1000;

// 存储正在轮询的任务
const pollingTasks = new Map<string, {
  intervalId: NodeJS.Timeout;
  callbacks: Set<ProgressCallback>;
}>();

/**
 * 启动图片生成任务
 * @param params 生成参数
 * @returns 任务ID
 */
export async function startImageGeneration(params: {
  prompt?: string;
  style?: string;
  dreamId: string;
  dreamTitle: string;
}): Promise<string> {
  const response = await apiRequest<{
    code: number;
    data: { taskId: string; message: string };
    message?: string;
  }>(API_ENDPOINTS.GENERATIONS.IMAGE, {
    method: 'POST',
    body: JSON.stringify(params),
  });

  // 后端返回 code 200/201 表示成功
  if (response.code !== 200 && response.code !== 201) {
    throw new Error(response.message || '启动图片生成失败');
  }

  return response.data.taskId;
}

/**
 * 启动视频生成任务
 * @param params 生成参数
 * @returns 任务ID
 */
export async function startVideoGeneration(params: {
  prompt?: string;
  dreamId: string;
  dreamTitle: string;
}): Promise<string> {
  const response = await apiRequest<{
    code: number;
    data: { taskId: string; message: string };
    message?: string;
  }>(API_ENDPOINTS.GENERATIONS.VIDEO, {
    method: 'POST',
    body: JSON.stringify(params),
  });

  // 后端返回 code 200/201 表示成功
  if (response.code !== 200 && response.code !== 201) {
    throw new Error(response.message || '启动视频生成失败');
  }

  return response.data.taskId;
}

/**
 * 启动长视频生成任务
 * @param params 生成参数
 * @returns 任务ID
 */
export async function startLongVideoGeneration(params: {
  script: any;
  dreamId: string;
  dreamTitle: string;
}): Promise<string> {
  const response = await apiRequest<{
    code: number;
    data: { taskId: string; message: string };
    message?: string;
  }>(API_ENDPOINTS.GENERATIONS.LONG_VIDEO, {
    method: 'POST',
    body: JSON.stringify(params),
  });

  // 后端返回 code 200/201 表示成功
  if (response.code !== 200 && response.code !== 201) {
    throw new Error(response.message || '启动长视频生成失败');
  }

  return response.data.taskId;
}

/**
 * 查询任务进度
 * @param taskId 任务ID
 * @returns 任务进度信息
 */
export async function getTaskProgress(taskId: string): Promise<TaskProgress | null> {
  try {
    const response = await apiRequest<{
      code: number;
      data: TaskProgress;
      message?: string;
    }>(API_ENDPOINTS.GENERATIONS.PROGRESS(taskId), {
      method: 'GET',
    });

    // 后端返回 code 200 表示成功
    if (response.code !== 200 && response.code !== 201) {
      console.error('获取任务进度失败:', response.message);
      return null;
    }

    return response.data;
  } catch (error) {
    console.error('获取任务进度出错:', error);
    return null;
  }
}

/**
 * 开始轮询任务进度
 * @param taskId 任务ID
 * @param onProgress 进度回调
 * @returns 停止轮询的函数
 */
export function startPollingProgress(
  taskId: string,
  onProgress: ProgressCallback
): () => void {
  // 如果任务已经在轮询，添加回调到集合
  if (pollingTasks.has(taskId)) {
    const task = pollingTasks.get(taskId)!;
    task.callbacks.add(onProgress);
    
    // 返回停止函数
    return () => {
      const task = pollingTasks.get(taskId);
      if (task) {
        task.callbacks.delete(onProgress);
        // 如果没有回调了，停止轮询
        if (task.callbacks.size === 0) {
          clearInterval(task.intervalId);
          pollingTasks.delete(taskId);
        }
      }
    };
  }

  // 创建新的轮询任务
  const callbacks = new Set<ProgressCallback>([onProgress]);
  
  const intervalId = setInterval(async () => {
    const progress = await getTaskProgress(taskId);
    
    if (!progress) {
      console.warn('获取进度失败，继续轮询...');
      return;
    }

    // 通知所有回调
    const task = pollingTasks.get(taskId);
    if (task) {
      task.callbacks.forEach(callback => {
        try {
          callback(progress);
        } catch (error) {
          console.error('进度回调执行失败:', error);
        }
      });
    }

    // 如果任务完成或失败，停止轮询
    if (progress.status === 'completed' || progress.status === 'failed') {
      const task = pollingTasks.get(taskId);
      if (task) {
        clearInterval(task.intervalId);
        pollingTasks.delete(taskId);
        console.log(`[GenerationTask] 任务 ${taskId} 结束，停止轮询`);
      }
    }
  }, POLL_INTERVAL);

  pollingTasks.set(taskId, { intervalId, callbacks });

  // 立即获取一次进度
  getTaskProgress(taskId).then(progress => {
    if (progress) {
      onProgress(progress);
    }
  });

  // 返回停止函数
  return () => {
    const task = pollingTasks.get(taskId);
    if (task) {
      task.callbacks.delete(onProgress);
      if (task.callbacks.size === 0) {
        clearInterval(task.intervalId);
        pollingTasks.delete(taskId);
      }
    }
  };
}

/**
 * 停止所有轮询
 */
export function stopAllPolling(): void {
  pollingTasks.forEach((task, taskId) => {
    clearInterval(task.intervalId);
    console.log(`[GenerationTask] 停止轮询任务: ${taskId}`);
  });
  pollingTasks.clear();
}
