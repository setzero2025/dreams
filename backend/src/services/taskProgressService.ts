/**
 * 任务进度管理服务
 * 用于跟踪AI生成任务的实时进度
 */

import { EventEmitter } from 'events';

export interface TaskProgress {
  taskId: string;
  type: 'image' | 'video' | 'script' | 'long_video';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number; // 0-100
  stage: string; // 当前阶段描述
  result?: any; // 任务结果
  error?: string; // 错误信息
  createdAt: Date;
  updatedAt: Date;
}

class TaskProgressService extends EventEmitter {
  private tasks: Map<string, TaskProgress> = new Map();
  private readonly TASK_TIMEOUT = 10 * 60 * 1000; // 10分钟超时

  constructor() {
    super();
    // 定期清理过期任务
    setInterval(() => this.cleanupExpiredTasks(), 60 * 1000);
  }

  /**
   * 创建新任务
   */
  createTask(type: TaskProgress['type']): TaskProgress {
    const taskId = `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const task: TaskProgress = {
      taskId,
      type,
      status: 'pending',
      progress: 0,
      stage: '准备中',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.tasks.set(taskId, task);
    this.emit('taskCreated', task);
    return task;
  }

  /**
   * 更新任务进度
   */
  updateProgress(taskId: string, progress: number, stage: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.progress = Math.min(100, Math.max(0, progress));
    task.stage = stage;
    task.status = 'processing';
    task.updatedAt = new Date();
    
    this.emit('progressUpdated', task);
  }

  /**
   * 标记任务完成
   */
  completeTask(taskId: string, result: any): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'completed';
    task.progress = 100;
    task.stage = '完成';
    task.result = result;
    task.updatedAt = new Date();
    
    this.emit('taskCompleted', task);
  }

  /**
   * 标记任务失败
   */
  failTask(taskId: string, error: string): void {
    const task = this.tasks.get(taskId);
    if (!task) return;

    task.status = 'failed';
    task.stage = '失败';
    task.error = error;
    task.updatedAt = new Date();
    
    this.emit('taskFailed', task);
  }

  /**
   * 获取任务进度
   */
  getTask(taskId: string): TaskProgress | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * 清理过期任务
   */
  private cleanupExpiredTasks(): void {
    const now = Date.now();
    for (const [taskId, task] of this.tasks.entries()) {
      if (now - task.createdAt.getTime() > this.TASK_TIMEOUT) {
        this.tasks.delete(taskId);
      }
    }
  }
}

// 导出单例
export const taskProgressService = new TaskProgressService();
