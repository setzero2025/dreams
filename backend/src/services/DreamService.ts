/**
 * 梦境服务层
 * 处理梦境相关的业务逻辑
 */

import { Pool } from 'pg';
import { DreamRepository } from '../repositories/dream.repository';
import { MediaRepository } from '../repositories/media.repository';
import { AudioRepository } from '../repositories/audio.repository';
import { InterpretationRepository } from '../repositories/interpretation.repository';
import {
  DreamEntity,
  DreamDetail,
  DreamListItem,
  DreamWorks,
  CreateDreamDTO,
  UpdateDreamDTO,
  DreamQueryParams,
  PaginatedResult,
} from '../types/dream.types';
import { NotFoundError, ForbiddenError, ValidationError } from '../utils/errors';
import { withTransaction } from '../config/database';

export class DreamService {
  private dreamRepository: DreamRepository;
  private mediaRepository: MediaRepository;
  private audioRepository: AudioRepository;
  private interpretationRepository: InterpretationRepository;

  constructor(private db: Pool) {
    this.dreamRepository = new DreamRepository(db);
    this.mediaRepository = new MediaRepository(db);
    this.audioRepository = new AudioRepository(db);
    this.interpretationRepository = new InterpretationRepository(db);
  }

  /**
   * 获取梦境列表
   */
  async getDreamList(
    userId: string,
    params: DreamQueryParams
  ): Promise<PaginatedResult<DreamListItem>> {
    return this.dreamRepository.findAll(userId, params);
  }

  /**
   * 获取梦境详情
   */
  async getDreamDetail(userId: string, dreamId: string): Promise<DreamDetail> {
    // 查询梦境基本信息
    const dream = await this.dreamRepository.findById(dreamId, userId);
    if (!dream) {
      throw new NotFoundError('梦境不存在');
    }

    // 并行查询关联数据
    const [audio, images, videos, stories, interpretation] = await Promise.all([
      this.audioRepository.findByDreamId(dreamId, userId),
      this.mediaRepository.findImagesByDreamId(dreamId, userId),
      this.mediaRepository.findVideosByDreamId(dreamId, userId),
      this.mediaRepository.findStoriesByDreamId(dreamId, userId),
      this.interpretationRepository.findByDreamId(dreamId, userId),
    ]);

    return {
      id: dream.id,
      title: dream.title,
      content: dream.content,
      emotions: dream.emotions || [],
      tags: dream.tags || [],
      dream_date: dream.dream_date,
      audio,
      media: {
        images,
        videos,
        stories,
      },
      interpretation,
      created_at: dream.created_at,
      updated_at: dream.updated_at,
    };
  }

  /**
   * 创建梦境
   */
  async createDream(
    userId: string,
    data: CreateDreamDTO
  ): Promise<DreamEntity> {
    // 验证必填字段
    this.validateDreamData(data);

    // 验证音频ID（如果提供）
    if (data.audioId) {
      const audioExists = await this.audioRepository.exists(
        data.audioId,
        userId
      );
      if (!audioExists) {
        throw new ValidationError('音频记录不存在');
      }
    }

    // 创建梦境
    const dream = await this.dreamRepository.create(userId, data);

    return dream;
  }

  /**
   * 更新梦境
   */
  async updateDream(
    userId: string,
    dreamId: string,
    data: UpdateDreamDTO
  ): Promise<DreamEntity> {
    // 检查梦境是否存在
    const existingDream = await this.dreamRepository.findById(dreamId, userId);
    if (!existingDream) {
      throw new NotFoundError('梦境不存在');
    }

    // 验证音频ID（如果提供）
    if (data.audioId) {
      const audioExists = await this.audioRepository.exists(
        data.audioId,
        userId
      );
      if (!audioExists) {
        throw new ValidationError('音频记录不存在');
      }
    }

    // 更新梦境
    const updatedDream = await this.dreamRepository.update(
      dreamId,
      userId,
      data
    );

    if (!updatedDream) {
      throw new NotFoundError('梦境更新失败');
    }

    return updatedDream;
  }

  /**
   * 删除梦境
   */
  async deleteDream(userId: string, dreamId: string): Promise<void> {
    // 检查梦境是否存在
    const dream = await this.dreamRepository.findById(dreamId, userId);
    if (!dream) {
      throw new NotFoundError('梦境不存在');
    }

    // 使用事务级联删除关联数据
    await withTransaction(async (client) => {
      // 创建临时repository实例使用事务客户端
      const dreamRepo = new DreamRepository(client as unknown as Pool);
      const mediaRepo = new MediaRepository(client as unknown as Pool);
      const interpretationRepo = new InterpretationRepository(client as unknown as Pool);

      // 删除关联的解读
      await interpretationRepo.deleteByDreamId(dreamId, userId);

      // 删除关联的媒资
      await mediaRepo.deleteByDreamId(dreamId, userId);

      // 删除梦境
      await dreamRepo.delete(dreamId, userId);
    });
  }

  /**
   * 搜索梦境
   */
  async searchDreams(
    userId: string,
    keyword: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResult<DreamListItem>> {
    if (!keyword || keyword.trim().length === 0) {
      throw new ValidationError('搜索关键词不能为空');
    }

    return this.dreamRepository.search(userId, keyword, page, pageSize);
  }

  /**
   * 获取梦境作品
   */
  async getDreamWorks(userId: string, dreamId: string): Promise<DreamWorks> {
    // 检查梦境是否存在
    const dream = await this.dreamRepository.findById(dreamId, userId);
    if (!dream) {
      throw new NotFoundError('梦境不存在');
    }

    // 并行查询作品数据
    const [images, videos, stories, interpretation] = await Promise.all([
      this.mediaRepository.findImagesByDreamId(dreamId, userId),
      this.mediaRepository.findVideosByDreamId(dreamId, userId),
      this.mediaRepository.findStoriesByDreamId(dreamId, userId),
      this.interpretationRepository.findByDreamId(dreamId, userId),
    ]);

    return {
      images,
      videos,
      stories,
      interpretation,
    };
  }

  /**
   * 检查梦境是否存在
   */
  async checkDreamExists(userId: string, dreamId: string): Promise<boolean> {
    return this.dreamRepository.exists(dreamId, userId);
  }

  /**
   * 更新梦境的音频ID
   * @param dreamId 梦境ID
   * @param userId 用户ID
   * @param audioId 音频ID
   */
  async updateDreamAudio(dreamId: string, userId: string, audioId: string): Promise<void> {
    // 验证梦境是否存在且属于当前用户
    const dream = await this.dreamRepository.findById(dreamId, userId);
    if (!dream) {
      throw new NotFoundError('梦境不存在');
    }

    // 更新梦境的音频ID
    await this.dreamRepository.updateAudioId(dreamId, audioId);
  }

  /**
   * 验证梦境数据
   */
  private validateDreamData(data: CreateDreamDTO): void {
    const errors: Array<{ field: string; message: string }> = [];

    if (!data.title || data.title.trim().length === 0) {
      errors.push({ field: 'title', message: '梦境标题不能为空' });
    } else if (data.title.length > 200) {
      errors.push({ field: 'title', message: '梦境标题不能超过200字符' });
    }

    if (!data.content || data.content.trim().length === 0) {
      errors.push({ field: 'content', message: '梦境内容不能为空' });
    }

    if (!data.dreamDate) {
      errors.push({ field: 'dreamDate', message: '梦境日期不能为空' });
    } else {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(data.dreamDate)) {
        errors.push({ field: 'dreamDate', message: '梦境日期格式不正确，应为YYYY-MM-DD' });
      }
    }

    if (data.emotions && data.emotions.length > 5) {
      errors.push({ field: 'emotions', message: '情绪标签最多5个' });
    }

    if (data.tags && data.tags.length > 10) {
      errors.push({ field: 'tags', message: '自定义标签最多10个' });
    }

    if (errors.length > 0) {
      throw new ValidationError('梦境数据验证失败', errors);
    }
  }
}
