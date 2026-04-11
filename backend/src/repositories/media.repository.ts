/**
 * 媒资数据访问层
 * 封装媒资相关的数据库操作
 */

import { Pool } from 'pg';
import { MediaEntity, MediaType, MediaCount } from '../types/media.types';
import { MediaAsset } from '../types/dream.types';

export class MediaRepository {
  constructor(private db: Pool) {}

  /**
   * 根据ID查询媒资
   */
  async findById(id: string, userId: string): Promise<MediaEntity | null> {
    const query = `
      SELECT * FROM media_assets
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [id, userId]);
    return rows[0] || null;
  }

  /**
   * 查询梦境关联的所有媒资
   */
  async findByDreamId(dreamId: string, userId: string): Promise<MediaEntity[]> {
    const query = `
      SELECT * FROM media_assets
      WHERE dream_id = $1 AND user_id = $2
      ORDER BY created_at DESC
    `;
    const { rows } = await this.db.query(query, [dreamId, userId]);
    return rows;
  }

  /**
   * 查询梦境关联的图片
   */
  async findImagesByDreamId(
    dreamId: string,
    userId: string
  ): Promise<MediaAsset[]> {
    const query = `
      SELECT 
        ma.id,
        ma.dream_id as "dreamId",
        d.title as "dreamTitle",
        'image' as type,
        ma.storage_path as url,
        ma.thumbnail_path as "thumbnailUrl",
        ma.style,
        ma.ratio,
        ma.model_source as "modelSource",
        ma.is_favorite as "isFavorite",
        ma.download_count as "downloadCount",
        ma.created_at as "createdAt"
      FROM media_assets ma
      LEFT JOIN dream_entries d ON d.id = ma.dream_id
      WHERE ma.dream_id = $1 
        AND ma.user_id = $2 
        AND ma.type = 'image'
      ORDER BY ma.created_at DESC
    `;
    const { rows } = await this.db.query(query, [dreamId, userId]);
    return rows;
  }

  /**
   * 查询梦境关联的视频
   */
  async findVideosByDreamId(
    dreamId: string,
    userId: string
  ): Promise<MediaAsset[]> {
    const query = `
      SELECT 
        ma.id,
        ma.dream_id as "dreamId",
        d.title as "dreamTitle",
        'video' as type,
        ma.storage_path as url,
        ma.thumbnail_path as "thumbnailUrl",
        ma.duration,
        ma.ratio,
        ma.model_source as "modelSource",
        ma.is_favorite as "isFavorite",
        ma.download_count as "downloadCount",
        ma.created_at as "createdAt"
      FROM media_assets ma
      LEFT JOIN dream_entries d ON d.id = ma.dream_id
      WHERE ma.dream_id = $1 
        AND ma.user_id = $2 
        AND ma.type = 'video'
      ORDER BY ma.created_at DESC
    `;
    const { rows } = await this.db.query(query, [dreamId, userId]);
    return rows;
  }

  /**
   * 查询梦境关联的长视频
   */
  async findStoriesByDreamId(
    dreamId: string,
    userId: string
  ): Promise<MediaAsset[]> {
    const query = `
      SELECT 
        ma.id,
        ma.dream_id as "dreamId",
        d.title as "dreamTitle",
        'long_video' as type,
        ma.storage_path as url,
        ma.thumbnail_path as "thumbnailUrl",
        ma.duration,
        ma.ratio,
        ma.long_video_script_id as "scriptId",
        ma.model_source as "modelSource",
        ma.is_favorite as "isFavorite",
        ma.download_count as "downloadCount",
        ma.created_at as "createdAt"
      FROM media_assets ma
      LEFT JOIN dream_entries d ON d.id = ma.dream_id
      WHERE ma.dream_id = $1 
        AND ma.user_id = $2 
        AND ma.type = 'long_video'
      ORDER BY ma.created_at DESC
    `;
    const { rows } = await this.db.query(query, [dreamId, userId]);
    return rows;
  }

  /**
   * 统计梦境的媒资数量
   */
  async countByDreamId(
    dreamId: string,
    userId: string
  ): Promise<MediaCount> {
    const query = `
      SELECT 
        COUNT(*) FILTER (WHERE type = 'image') as image,
        COUNT(*) FILTER (WHERE type = 'video') as video,
        COUNT(*) FILTER (WHERE type = 'long_video') as story
      FROM media_assets
      WHERE dream_id = $1 AND user_id = $2
    `;
    const { rows } = await this.db.query(query, [dreamId, userId]);
    return {
      image: parseInt(rows[0].image) || 0,
      video: parseInt(rows[0].video) || 0,
      story: parseInt(rows[0].story) || 0,
    };
  }

  /**
   * 查询用户的所有媒资（分页）
   */
  async findAllByUserId(
    userId: string,
    type?: MediaType,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ list: MediaEntity[]; total: number }> {
    const offset = (page - 1) * pageSize;

    let typeCondition = '';
    const params: any[] = [userId];

    if (type) {
      typeCondition = 'AND type = $2';
      params.push(type);
    }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM media_assets 
      WHERE user_id = $1 ${typeCondition}
    `;
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const listQuery = `
      SELECT * FROM media_assets
      WHERE user_id = $1 ${typeCondition}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const listResult = await this.db.query(listQuery, [
      ...params,
      pageSize,
      offset,
    ]);

    return {
      list: listResult.rows,
      total,
    };
  }

  /**
   * 查询用户收藏的媒资
   */
  async findFavoritesByUserId(
    userId: string,
    type?: MediaType,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ list: MediaEntity[]; total: number }> {
    const offset = (page - 1) * pageSize;

    let typeCondition = '';
    const params: any[] = [userId];

    if (type) {
      typeCondition = 'AND type = $2';
      params.push(type);
    }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM media_assets 
      WHERE user_id = $1 AND is_favorite = true ${typeCondition}
    `;
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const listQuery = `
      SELECT * FROM media_assets
      WHERE user_id = $1 AND is_favorite = true ${typeCondition}
      ORDER BY created_at DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    const listResult = await this.db.query(listQuery, [
      ...params,
      pageSize,
      offset,
    ]);

    return {
      list: listResult.rows,
      total,
    };
  }

  /**
   * 更新收藏状态
   */
  async updateFavorite(
    id: string,
    userId: string,
    isFavorite: boolean
  ): Promise<boolean> {
    const query = `
      UPDATE media_assets
      SET is_favorite = $1
      WHERE id = $2 AND user_id = $3
    `;
    const { rowCount } = await this.db.query(query, [isFavorite, id, userId]);
    return (rowCount ?? 0) > 0;
  }

  /**
   * 增加下载次数
   */
  async incrementDownloadCount(id: string, userId: string): Promise<boolean> {
    const query = `
      UPDATE media_assets
      SET download_count = download_count + 1
      WHERE id = $1 AND user_id = $2
    `;
    const { rowCount } = await this.db.query(query, [id, userId]);
    return (rowCount ?? 0) > 0;
  }

  /**
   * 删除媒资
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const query = `
      DELETE FROM media_assets
      WHERE id = $1 AND user_id = $2
    `;
    const { rowCount } = await this.db.query(query, [id, userId]);
    return (rowCount ?? 0) > 0;
  }

  /**
   * 删除梦境关联的所有媒资
   */
  async deleteByDreamId(dreamId: string, userId: string): Promise<number> {
    const query = `
      DELETE FROM media_assets
      WHERE dream_id = $1 AND user_id = $2
    `;
    const { rowCount } = await this.db.query(query, [dreamId, userId]);
    return rowCount || 0;
  }

  /**
   * 统计用户媒资总数
   */
  async countByUserId(userId: string, type?: MediaType): Promise<number> {
    let query = `
      SELECT COUNT(*) as count 
      FROM media_assets 
      WHERE user_id = $1
    `;
    const params: any[] = [userId];

    if (type) {
      query += ' AND type = $2';
      params.push(type);
    }

    const { rows } = await this.db.query(query, params);
    return parseInt(rows[0].count);
  }
}
