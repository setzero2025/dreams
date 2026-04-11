/**
 * 梦境数据访问层
 * 封装梦境相关的数据库操作
 */

import { Pool } from 'pg';
import {
  DreamEntity,
  DreamListItem,
  CreateDreamDTO,
  UpdateDreamDTO,
  DreamQueryParams,
  PaginatedResult,
} from '../types/dream.types';

export class DreamRepository {
  constructor(private db: Pool) {}

  /**
   * 根据ID查询梦境
   */
  async findById(id: string, userId: string): Promise<DreamEntity | null> {
    const query = `
      SELECT * FROM dream_entries
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [id, userId]);
    return rows[0] || null;
  }

  /**
   * 查询用户所有梦境（分页）
   */
  async findAll(
    userId: string,
    params: DreamQueryParams
  ): Promise<PaginatedResult<DreamListItem>> {
    const { period = 'all', search, page = 1, pageSize = 20 } = params;
    const offset = (page - 1) * pageSize;

    // 构建时间范围条件
    let timeCondition = '';
    if (period === 'today') {
      timeCondition = `AND dream_date = CURRENT_DATE`;
    } else if (period === 'weekly') {
      timeCondition = `AND dream_date >= CURRENT_DATE - INTERVAL '7 days'`;
    }

    // 构建搜索条件
    let searchCondition = '';
    let searchParams: any[] = [userId];
    if (search) {
      searchCondition = `AND (
        title ILIKE $2 OR 
        content ILIKE $2 OR 
        $2 = ANY(tags)
      )`;
      searchParams.push(`%${search}%`);
    }

    // 查询总数
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM dream_entries 
      WHERE user_id = $1 ${timeCondition} ${searchCondition}
    `;
    const countResult = await this.db.query(countQuery, searchParams);
    const total = parseInt(countResult.rows[0].total);

    // 查询列表数据
    const listQuery = `
      SELECT 
        de.id,
        de.title,
        de.content,
        de.emotions,
        de.tags,
        de.dream_date as "dreamDate",
        de.audio_id as "audioId",
        de.audio_id IS NOT NULL as "hasAudio",
        EXISTS (
          SELECT 1 FROM media_assets ma 
          WHERE ma.dream_id = de.id
        ) as "hasMedia",
        COALESCE((
          SELECT jsonb_build_object(
            'image', COUNT(*) FILTER (WHERE type = 'image'),
            'video', COUNT(*) FILTER (WHERE type = 'video'),
            'story', COUNT(*) FILTER (WHERE type = 'long_video')
          )
          FROM media_assets ma 
          WHERE ma.dream_id = de.id
        ), '{"image":0,"video":0,"story":0}'::jsonb) as "mediaCount",
        EXISTS (
          SELECT 1 FROM interpretations i 
          WHERE i.dream_id = de.id AND i.type = 'interpretation'
        ) as "hasInterpretation",
        de.created_at as "createdAt"
      FROM dream_entries de
      WHERE de.user_id = $1 ${timeCondition} ${searchCondition}
      ORDER BY de.created_at DESC
      LIMIT $${searchParams.length + 1} OFFSET $${searchParams.length + 2}
    `;

    const listResult = await this.db.query(listQuery, [
      ...searchParams,
      pageSize,
      offset,
    ]);

    return {
      list: listResult.rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 根据用户ID查询所有梦境ID
   */
  async findIdsByUserId(userId: string): Promise<string[]> {
    const query = `
      SELECT id FROM dream_entries
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const { rows } = await this.db.query(query, [userId]);
    return rows.map((row) => row.id);
  }

  /**
   * 创建梦境
   */
  async create(userId: string, data: CreateDreamDTO): Promise<DreamEntity> {
    const query = `
      INSERT INTO dream_entries (
        user_id, title, content, dream_date, 
        emotions, tags, audio_id
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;
    const { rows } = await this.db.query(query, [
      userId,
      data.title,
      data.content,
      data.dreamDate,
      data.emotions || [],
      data.tags || [],
      data.audioId || null,
    ]);
    return rows[0];
  }

  /**
   * 更新梦境
   */
  async update(
    id: string,
    userId: string,
    data: UpdateDreamDTO
  ): Promise<DreamEntity | null> {
    const updates: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (data.title !== undefined) {
      updates.push(`title = $${paramIndex++}`);
      values.push(data.title);
    }
    if (data.content !== undefined) {
      updates.push(`content = $${paramIndex++}`);
      values.push(data.content);
    }
    if (data.dreamDate !== undefined) {
      updates.push(`dream_date = $${paramIndex++}`);
      values.push(data.dreamDate);
    }
    if (data.emotions !== undefined) {
      updates.push(`emotions = $${paramIndex++}`);
      values.push(data.emotions);
    }
    if (data.tags !== undefined) {
      updates.push(`tags = $${paramIndex++}`);
      values.push(data.tags);
    }
    if (data.audioId !== undefined) {
      updates.push(`audio_id = $${paramIndex++}`);
      values.push(data.audioId);
    }

    if (updates.length === 0) {
      return this.findById(id, userId);
    }

    const query = `
      UPDATE dream_entries
      SET ${updates.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $${paramIndex} AND user_id = $${paramIndex + 1}
      RETURNING *
    `;

    const { rows } = await this.db.query(query, [...values, id, userId]);
    return rows[0] || null;
  }

  /**
   * 删除梦境
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const query = `
      DELETE FROM dream_entries
      WHERE id = $1 AND user_id = $2
    `;
    const { rowCount } = await this.db.query(query, [id, userId]);
    return (rowCount ?? 0) > 0;
  }

  /**
   * 全文搜索梦境
   */
  async search(
    userId: string,
    keyword: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<PaginatedResult<DreamListItem>> {
    const offset = (page - 1) * pageSize;

    // 使用全文搜索
    const countQuery = `
      SELECT COUNT(*) as total 
      FROM dream_entries 
      WHERE user_id = $1 
      AND (
        title ILIKE $2 OR 
        content ILIKE $2 OR 
        $2 = ANY(tags)
      )
    `;
    const countResult = await this.db.query(countQuery, [userId, `%${keyword}%`]);
    const total = parseInt(countResult.rows[0].total);

    const listQuery = `
      SELECT 
        de.id,
        de.title,
        de.content,
        de.emotions,
        de.tags,
        de.dream_date as "dreamDate",
        de.audio_id as "audioId",
        de.audio_id IS NOT NULL as "hasAudio",
        EXISTS (
          SELECT 1 FROM media_assets ma 
          WHERE ma.dream_id = de.id
        ) as "hasMedia",
        COALESCE((
          SELECT jsonb_build_object(
            'image', COUNT(*) FILTER (WHERE type = 'image'),
            'video', COUNT(*) FILTER (WHERE type = 'video'),
            'story', COUNT(*) FILTER (WHERE type = 'long_video')
          )
          FROM media_assets ma 
          WHERE ma.dream_id = de.id
        ), '{"image":0,"video":0,"story":0}'::jsonb) as "mediaCount",
        EXISTS (
          SELECT 1 FROM interpretations i 
          WHERE i.dream_id = de.id AND i.type = 'interpretation'
        ) as "hasInterpretation",
        de.created_at as "createdAt"
      FROM dream_entries de
      WHERE de.user_id = $1 
      AND (
        de.title ILIKE $2 OR 
        de.content ILIKE $2 OR 
        $2 = ANY(de.tags)
      )
      ORDER BY de.created_at DESC
      LIMIT $3 OFFSET $4
    `;

    const listResult = await this.db.query(listQuery, [
      userId,
      `%${keyword}%`,
      pageSize,
      offset,
    ]);

    return {
      list: listResult.rows,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 统计用户梦境数量
   */
  async countByUserId(userId: string): Promise<number> {
    const query = `
      SELECT COUNT(*) as count 
      FROM dream_entries 
      WHERE user_id = $1
    `;
    const { rows } = await this.db.query(query, [userId]);
    return parseInt(rows[0].count);
  }

  /**
   * 检查梦境是否存在
   */
  async exists(id: string, userId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM dream_entries
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `;
    const { rowCount } = await this.db.query(query, [id, userId]);
    return (rowCount ?? 0) > 0;
  }

  /**
   * 更新梦境的音频ID
   * @param dreamId 梦境ID
   * @param audioId 音频ID
   */
  async updateAudioId(dreamId: string, audioId: string): Promise<void> {
    const query = `
      UPDATE dream_entries
      SET audio_id = $1, updated_at = NOW()
      WHERE id = $2
    `;
    await this.db.query(query, [audioId, dreamId]);
  }
}
