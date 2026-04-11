/**
 * 梦境控制器
 * 处理梦境相关的HTTP请求
 */

import { Request, Response, NextFunction } from 'express';
import { DreamService } from '../services/DreamService';
import { AudioService } from '../services/audio.service';
import { pool } from '../config/database';
import {
  successResponse,
  createdResponse,
  noContentResponse,
  paginatedResponse,
  errorResponse,
} from '../utils/api-response';
import { AppError } from '../utils/errors';
import { DreamQueryParams, CreateDreamDTO, UpdateDreamDTO } from '../types/dream.types';

export class DreamController {
  private dreamService: DreamService;
  private audioService: AudioService;

  constructor() {
    this.dreamService = new DreamService(pool);
    this.audioService = new AudioService(pool);
  }

  /**
   * 获取梦境列表
   * GET /api/dreams
   */
  getDreams = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json(errorResponse(401, '未授权'));
      }

      // 解析查询参数
      const params: DreamQueryParams = {
        period: req.query.period as 'today' | 'weekly' | 'all',
        search: req.query.search as string,
        page: req.query.page ? parseInt(req.query.page as string) : 1,
        pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : 20,
      };

      // 验证分页参数
      if (params.page && (isNaN(params.page) || params.page < 1)) {
        params.page = 1;
      }
      if (params.pageSize && (isNaN(params.pageSize) || params.pageSize < 1 || params.pageSize > 50)) {
        params.pageSize = 20;
      }

      const result = await this.dreamService.getDreamList(userId, params);

      return res.json(
        paginatedResponse(
          result.list,
          result.pagination.page,
          result.pagination.pageSize,
          result.pagination.total,
          '获取梦境列表成功'
        )
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * 获取梦境详情
   * GET /api/dreams/:id
   */
  getDreamById = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json(errorResponse(401, '未授权'));
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json(errorResponse(400, '梦境ID不能为空'));
      }

      const dream = await this.dreamService.getDreamDetail(userId, id);

      return res.json(successResponse(dream, '获取梦境详情成功'));
    } catch (error) {
      next(error);
    }
  };

  /**
   * 创建梦境
   * POST /api/dreams
   */
  createDream = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json(errorResponse(401, '未授权'));
      }

      const data: CreateDreamDTO = req.body;

      const dream = await this.dreamService.createDream(userId, data);

      return res.status(201).json(createdResponse(dream, '梦境创建成功'));
    } catch (error) {
      next(error);
    }
  };

  /**
   * 更新梦境
   * PUT /api/dreams/:id
   */
  updateDream = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json(errorResponse(401, '未授权'));
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json(errorResponse(400, '梦境ID不能为空'));
      }

      const data: UpdateDreamDTO = req.body;

      const dream = await this.dreamService.updateDream(userId, id, data);

      return res.json(successResponse(dream, '梦境更新成功'));
    } catch (error) {
      next(error);
    }
  };

  /**
   * 删除梦境
   * DELETE /api/dreams/:id
   */
  deleteDream = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json(errorResponse(401, '未授权'));
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json(errorResponse(400, '梦境ID不能为空'));
      }

      await this.dreamService.deleteDream(userId, id);

      return res.status(204).json(noContentResponse('梦境删除成功'));
    } catch (error) {
      next(error);
    }
  };

  /**
   * 获取梦境作品
   * GET /api/dreams/:id/works
   */
  getDreamWorks = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json(errorResponse(401, '未授权'));
      }

      const { id } = req.params;
      if (!id) {
        return res.status(400).json(errorResponse(400, '梦境ID不能为空'));
      }

      const works = await this.dreamService.getDreamWorks(userId, id);

      return res.json(successResponse(works, '获取梦境作品成功'));
    } catch (error) {
      next(error);
    }
  };

  /**
   * 搜索梦境
   * GET /api/dreams/search
   */
  searchDreams = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json(errorResponse(401, '未授权'));
      }

      const { q, page, pageSize } = req.query;
      
      if (!q || typeof q !== 'string') {
        return res.status(400).json(errorResponse(400, '搜索关键词不能为空'));
      }

      const pageNum = page ? parseInt(page as string) : 1;
      const pageSizeNum = pageSize ? parseInt(pageSize as string) : 20;

      const result = await this.dreamService.searchDreams(
        userId,
        q,
        pageNum,
        pageSizeNum
      );

      return res.json(
        paginatedResponse(
          result.list,
          result.pagination.page,
          result.pagination.pageSize,
          result.pagination.total,
          '搜索梦境成功'
        )
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * 上传梦境音频（说梦功能）
   * POST /api/dreams/:id/audio
   */
  uploadDreamAudio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json(errorResponse(401, '未授权'));
      }

      const { id: dreamId } = req.params;
      const { audioUrl, duration } = req.body;

      if (!audioUrl || typeof audioUrl !== 'string') {
        return res.status(400).json(errorResponse(400, '缺少音频URL'));
      }

      console.log(`[DreamController] 上传梦境音频，梦境: ${dreamId}, 用户: ${userId}`);

      // 从URL下载并上传音频到 Supabase Storage
      const result = await this.audioService.uploadAudioFromUrl(
        audioUrl,
        userId,
        dreamId,
        duration ? parseInt(duration, 10) : undefined
      );

      // 更新梦境的音频ID
      await this.dreamService.updateDreamAudio(dreamId, userId, result.id);

      return res.json(
        successResponse(
          {
            audioId: result.id,
            url: result.url,
            duration: result.duration,
          },
          '音频上传成功'
        )
      );
    } catch (error) {
      next(error);
    }
  };
}

// 导出单例实例
export const dreamController = new DreamController();
