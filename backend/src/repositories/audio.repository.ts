/**
 * 音频数据访问层
 * 封装音频相关的数据库操作
 */

import { Pool } from 'pg';
import { AudioEntity } from '../types/media.types';
import { AudioInfo } from '../types/dream.types';

export class AudioRepository {
  constructor(private db: Pool) {}

  /**
   * 根据ID查询音频
   */
  async findById(id: string, userId: string): Promise<AudioEntity | null> {
    const query = `
      SELECT * FROM audio_profiles
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [id, userId]);
    return rows[0] || null;
  }

  /**
   * 查询梦境关联的音频
   */
  async findByDreamId(
    dreamId: string,
    userId: string
  ): Promise<AudioInfo | null> {
    const query = `
      SELECT 
        ap.id,
        ap.storage_path as url,
        ap.duration,
        ap.is_tone_extracted as "isToneExtracted"
      FROM audio_profiles ap
      INNER JOIN dream_entries de ON de.audio_id = ap.id
      WHERE de.id = $1 AND ap.user_id = $2
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [dreamId, userId]);
    return rows[0] || null;
  }

  /**
   * 查询用户的所有音频
   */
  async findAllByUserId(
    userId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ list: AudioEntity[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM audio_profiles 
      WHERE user_id = $1
    `;
    const countResult = await this.db.query(countQuery, [userId]);
    const total = parseInt(countResult.rows[0].total);

    const listQuery = `
      SELECT * FROM audio_profiles
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const listResult = await this.db.query(listQuery, [userId, pageSize, offset]);

    return {
      list: listResult.rows,
      total,
    };
  }

  /**
   * 查询包含音色特征的音频
   */
  async findWithToneByUserId(
    userId: string,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ list: AudioEntity[]; total: number }> {
    const offset = (page - 1) * pageSize;

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM audio_profiles 
      WHERE user_id = $1 AND is_tone_extracted = true
    `;
    const countResult = await this.db.query(countQuery, [userId]);
    const total = parseInt(countResult.rows[0].total);

    const listQuery = `
      SELECT * FROM audio_profiles
      WHERE user_id = $1 AND is_tone_extracted = true
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;

    const listResult = await this.db.query(listQuery, [userId, pageSize, offset]);

    return {
      list: listResult.rows,
      total,
    };
  }

  /**
   * 删除音频
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const query = `
      DELETE FROM audio_profiles
      WHERE id = $1 AND user_id = $2
    `;
    const { rowCount } = await this.db.query(query, [id, userId]);
    return (rowCount ?? 0) > 0;
  }

  /**
   * 检查音频是否存在
   */
  async exists(id: string, userId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM audio_profiles
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `;
    const { rowCount } = await this.db.query(query, [id, userId]);
    return (rowCount ?? 0) > 0;
  }
}
