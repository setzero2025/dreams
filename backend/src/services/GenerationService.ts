import { query, withTransaction, TABLES } from '../config/database';
import axios from 'axios';
import { config } from '../config';

export type GenerationType = 'image' | 'video_5s' | 'video_10s' | 'video_long' | 'script';
export type GenerationStatus = 'pending' | 'processing' | 'completed' | 'failed';

export class GenerationService {
  async createGeneration(userId: string, dreamId: string, generationData: {
    generationType: GenerationType;
    prompt: string;
    style?: string;
    resolution?: string;
    duration?: number;
    metadata?: Record<string, any>;
  }) {
    try {
      // 1. 创建生成记录
      const result = await query(
        `INSERT INTO generations (user_id, dream_id, generation_type, status, prompt, style, resolution, duration, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         RETURNING *`,
        [
          userId,
          dreamId,
          generationData.generationType,
          'pending' as GenerationStatus,
          generationData.prompt,
          generationData.style || null,
          generationData.resolution || null,
          generationData.duration || null,
        ]
      );

      const generation = result.rows[0];

      // 2. 启动异步生成任务
      this.processGeneration(generation.id);

      return generation;
    } catch (error) {
      console.error('创建生成任务失败:', error);
      throw error;
    }
  }

  async getGenerationById(userId: string, generationId: string) {
    try {
      const result = await query(
        `SELECT g.*, 
                COALESCE(json_agg(gs.*) FILTER (WHERE gs.id IS NOT NULL), '[]') as scenes
         FROM generations g
         LEFT JOIN generation_scenes gs ON g.id = gs.generation_id
         WHERE g.id = $1 AND g.user_id = $2
         GROUP BY g.id`,
        [generationId, userId]
      );

      if (result.rows.length === 0) {
        throw new Error('生成内容不存在或无权访问');
      }

      const generation = result.rows[0];
      return {
        ...generation,
        scenes: generation.scenes || [],
      };
    } catch (error) {
      console.error('获取生成内容失败:', error);
      throw error;
    }
  }

  async getGenerations(userId: string, filters?: {
    dreamId?: string;
    generationType?: GenerationType;
    status?: GenerationStatus;
  }) {
    try {
      let sql = 'SELECT * FROM generations WHERE user_id = $1';
      const params: any[] = [userId];
      let paramIndex = 1;

      if (filters?.dreamId) {
        paramIndex++;
        sql += ` AND dream_id = $${paramIndex}`;
        params.push(filters.dreamId);
      }

      if (filters?.generationType) {
        paramIndex++;
        sql += ` AND generation_type = $${paramIndex}`;
        params.push(filters.generationType);
      }

      if (filters?.status) {
        paramIndex++;
        sql += ` AND status = $${paramIndex}`;
        params.push(filters.status);
      }

      sql += ' ORDER BY created_at DESC';

      const result = await query(sql, params);
      return result.rows || [];
    } catch (error) {
      console.error('获取生成列表失败:', error);
      throw error;
    }
  }

  async cancelGeneration(userId: string, generationId: string) {
    try {
      // 1. 检查生成任务是否存在
      const findResult = await query(
        'SELECT * FROM generations WHERE id = $1 AND user_id = $2',
        [generationId, userId]
      );

      if (findResult.rows.length === 0) {
        throw new Error('生成内容不存在或无权访问');
      }

      const generation = findResult.rows[0];

      // 2. 如果状态是 pending 或 processing，则取消
      if (generation.status === 'pending' || generation.status === 'processing') {
        const updateResult = await query(
          `UPDATE generations 
           SET status = 'failed', error_message = '生成已取消'
           WHERE id = $1
           RETURNING *`,
          [generationId]
        );
        return updateResult.rows[0];
      }

      return generation;
    } catch (error) {
      console.error('取消生成失败:', error);
      throw error;
    }
  }

  private async processGeneration(generationId: string) {
    try {
      // 1. 更新状态为 processing
      const updateResult = await query(
        `UPDATE generations 
         SET status = 'processing'
         WHERE id = $1
         RETURNING *`,
        [generationId]
      );

      if (updateResult.rows.length === 0) {
        console.error('Generation not found:', generationId);
        return;
      }

      const generation = updateResult.rows[0];
      console.log(`Processing generation ${generationId}...`);

      // 模拟处理时间
      await new Promise(resolve => setTimeout(resolve, 5000));

      // TODO: 集成实际的AI服务API调用
      // const aiResponse = await axios.post(
      //   `${config.ai.apiBaseUrl}/generate`,
      //   {
      //     prompt: generation.prompt,
      //     type: generation.generation_type,
      //     style: generation.style,
      //     resolution: generation.resolution,
      //     duration: generation.duration,
      //   },
      //   {
      //     headers: {
      //       'Authorization': `Bearer ${config.ai.apiKey}`,
      //       'Content-Type': 'application/json',
      //     },
      //   }
      // );

      // 模拟生成结果
      await query(
        `UPDATE generations 
         SET status = 'completed', result_url = $1, completed_at = NOW()
         WHERE id = $2`,
        [`https://example.com/generated/${generationId}.png`, generationId]
      );

    } catch (error) {
      console.error('Generation processing failed:', error);

      // 更新状态为失败
      await query(
        `UPDATE generations 
         SET status = 'failed', error_message = $1
         WHERE id = $2`,
        [error instanceof Error ? error.message : '生成失败', generationId]
      );
    }
  }
}
