/**
 * 生成任务管理服务
 * 管理异步生成任务的进度和状态
 */

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

// 内存中的任务缓存
const taskCache = new Map<string, TaskProgress>();

// 任务过期时间（1小时）
const TASK_EXPIRE_TIME = 60 * 60 * 1000;

/**
 * 创建新任务
 * @param type 任务类型
 * @returns 任务ID
 */
export function createTask(type: TaskType): string {
  const taskId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const now = Date.now();
  
  const task: TaskProgress = {
    taskId,
    type,
    status: 'pending',
    progress: 0,
    message: '等待开始...',
    createdAt: now,
    updatedAt: now,
  };
  
  taskCache.set(taskId, task);
  console.log(`[GenerationTask] 创建任务: ${taskId}, 类型: ${type}`);
  
  // 设置任务过期清理
  setTimeout(() => {
    if (taskCache.has(taskId)) {
      const task = taskCache.get(taskId);
      if (task && (task.status === 'completed' || task.status === 'failed')) {
        taskCache.delete(taskId);
        console.log(`[GenerationTask] 清理过期任务: ${taskId}`);
      }
    }
  }, TASK_EXPIRE_TIME);
  
  return taskId;
}

/**
 * 更新任务进度
 * @param taskId 任务ID
 * @param progress 进度 (0-100)
 * @param message 进度消息
 */
export function updateTaskProgress(
  taskId: string,
  progress: number,
  message: string
): void {
  const task = taskCache.get(taskId);
  if (!task) {
    console.warn(`[GenerationTask] 任务不存在: ${taskId}`);
    return;
  }
  
  task.progress = Math.min(100, Math.max(0, progress));
  task.message = message;
  task.updatedAt = Date.now();
  
  if (progress > 0 && progress < 100) {
    task.status = 'processing';
  }
  
  console.log(`[GenerationTask] 更新进度: ${taskId}, ${progress}%, ${message}`);
}

/**
 * 完成任务
 * @param taskId 任务ID
 * @param result 结果数据
 */
export function completeTask(
  taskId: string,
  result: TaskProgress['result']
): void {
  const task = taskCache.get(taskId);
  if (!task) {
    console.warn(`[GenerationTask] 任务不存在: ${taskId}`);
    return;
  }
  
  task.status = 'completed';
  task.progress = 100;
  task.message = '生成完成';
  task.result = result;
  task.updatedAt = Date.now();
  
  console.log(`[GenerationTask] 任务完成: ${taskId}`);
}

/**
 * 标记任务失败
 * @param taskId 任务ID
 * @param error 错误信息
 */
export function failTask(taskId: string, error: string): void {
  const task = taskCache.get(taskId);
  if (!task) {
    console.warn(`[GenerationTask] 任务不存在: ${taskId}`);
    return;
  }
  
  task.status = 'failed';
  task.message = '生成失败';
  task.error = error;
  task.updatedAt = Date.now();
  
  console.log(`[GenerationTask] 任务失败: ${taskId}, 错误: ${error}`);
}

/**
 * 获取任务进度
 * @param taskId 任务ID
 * @returns 任务进度信息
 */
export function getTaskProgress(taskId: string): TaskProgress | null {
  return taskCache.get(taskId) || null;
}

/**
 * 获取所有进行中的任务
 * @returns 进行中的任务列表
 */
export function getActiveTasks(): TaskProgress[] {
  return Array.from(taskCache.values()).filter(
    task => task.status === 'pending' || task.status === 'processing'
  );
}

/**
 * 清理所有已完成的任务
 */
export function cleanupCompletedTasks(): void {
  const now = Date.now();
  let count = 0;
  
  for (const [taskId, task] of taskCache.entries()) {
    if ((task.status === 'completed' || task.status === 'failed') &&
        (now - task.updatedAt > TASK_EXPIRE_TIME)) {
      taskCache.delete(taskId);
      count++;
    }
  }
  
  if (count > 0) {
    console.log(`[GenerationTask] 清理完成/失败任务: ${count}个`);
  }
}

// 定期清理任务（每30分钟）
setInterval(cleanupCompletedTasks, 30 * 60 * 1000);
