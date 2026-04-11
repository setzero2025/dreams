/**
 * 音频服务
 * 处理音频文件的上传、存储和管理
 */

import { Pool } from 'pg';
import { supabaseStorageService } from './supabaseStorage.service';
import { v4 as uuidv4 } from 'uuid';

export interface AudioUploadResult {
  id: string;
  url: string;
  duration?: number;
  createdAt: Date;
}

export class AudioService {
  constructor(private db: Pool) {}

  /**
   * 上传音频文件
   * @param fileBuffer 音频文件Buffer
   * @param contentType 文件类型 (如 audio/mpeg, audio/wav)
   * @param userId 用户ID
   * @param dreamId 关联的梦境ID（可选）
   * @param duration 音频时长（秒，可选）
   * @returns 上传结果，包含音频ID和访问URL
   */
  async uploadAudio(
    fileBuffer: Buffer,
    contentType: string,
    userId: string,
    dreamId?: string,
    duration?: number
  ): Promise<AudioUploadResult> {
    try {
      console.log('[AudioService] 开始上传音频，用户:', userId, '类型:', contentType);

      // 1. 上传文件到 Supabase Storage
      const storageUrl = await supabaseStorageService.uploadAudio(
        fileBuffer,
        contentType,
        userId,
        dreamId
      );

      // 2. 生成音频记录ID
      const audioId = uuidv4();

      // 3. 保存音频记录到数据库
      const query = `
        INSERT INTO audio_profiles (
          id, user_id, dream_id, storage_path, 
          duration, is_tone_extracted, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
        RETURNING id, storage_path as url, created_at
      `;

      const { rows } = await this.db.query(query, [
        audioId,
        userId,
        dreamId || null,
        storageUrl,
        duration || null,
        false, // 默认未提取音色
      ]);

      console.log('[AudioService] 音频上传成功，ID:', audioId);

      return {
        id: rows[0].id,
        url: rows[0].url,
        duration,
        createdAt: rows[0].created_at,
      };
    } catch (error) {
      console.error('[AudioService] 上传音频失败:', error);
      throw error;
    }
  }

  /**
   * 从URL上传音频（用于第三方服务生成的音频）
   * @param audioUrl 音频文件URL
   * @param userId 用户ID
   * @param dreamId 关联的梦境ID（可选）
   * @param duration 音频时长（秒，可选）
   * @returns 上传结果
   */
  async uploadAudioFromUrl(
    audioUrl: string,
    userId: string,
    dreamId?: string,
    duration?: number
  ): Promise<AudioUploadResult> {
    try {
      console.log('[AudioService] 从URL上传音频:', audioUrl);

      // 1. 下载音频文件
      const response = await fetch(audioUrl);
      if (!response.ok) {
        throw new Error(`下载音频失败: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'audio/mpeg';
      const arrayBuffer = await response.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      console.log(`[AudioService] 下载完成，大小: ${fileBuffer.length} bytes`);

      // 2. 上传到 Supabase Storage
      return this.uploadAudio(fileBuffer, contentType, userId, dreamId, duration);
    } catch (error) {
      console.error('[AudioService] 从URL上传音频失败:', error);
      throw error;
    }
  }

  /**
   * 删除音频
   * @param audioId 音频ID
   * @param userId 用户ID
   */
  async deleteAudio(audioId: string, userId: string): Promise<void> {
    try {
      // 1. 查询音频记录
      const query = `
        SELECT storage_path FROM audio_profiles
        WHERE id = $1 AND user_id = $2
      `;
      const { rows } = await this.db.query(query, [audioId, userId]);

      if (rows.length === 0) {
        throw new Error('音频不存在或无权访问');
      }

      const storagePath = rows[0].storage_path;

      // 2. 从 Supabase Storage 删除文件
      // 从URL中提取文件路径
      const urlParts = storagePath.split('/');
      const bucket = supabaseStorageService.getBucketConfig().AUDIO;
      const filePath = urlParts.slice(urlParts.indexOf(bucket) + 1).join('/');

      await supabaseStorageService.deleteFile(bucket, filePath);

      // 3. 从数据库删除记录
      await this.db.query(
        'DELETE FROM audio_profiles WHERE id = $1 AND user_id = $2',
        [audioId, userId]
      );

      console.log('[AudioService] 音频删除成功:', audioId);
    } catch (error) {
      console.error('[AudioService] 删除音频失败:', error);
      throw error;
    }
  }

  /**
   * 获取音频信息
   * @param audioId 音频ID
   * @param userId 用户ID
   */
  async getAudioInfo(audioId: string, userId: string) {
    const query = `
      SELECT 
        id, user_id, dream_id, storage_path as url,
        duration, is_tone_extracted as "isToneExtracted",
        created_at as "createdAt"
      FROM audio_profiles
      WHERE id = $1 AND user_id = $2
    `;

    const { rows } = await this.db.query(query, [audioId, userId]);
    return rows[0] || null;
  }
}
