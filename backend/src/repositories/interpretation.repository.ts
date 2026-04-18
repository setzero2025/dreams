/**
 * 梦境解读数据访问层
 * 封装解读相关的数据库操作
 */

import { Pool } from 'pg';
import {
  InterpretationEntity,
  InterpretationType,
} from '../types/interpretation.types';
import { Interpretation } from '../types/dream.types';

export class InterpretationRepository {
  constructor(private db: Pool) {}

  /**
   * 根据ID查询解读
   */
  async findById(
    id: string,
    userId: string
  ): Promise<InterpretationEntity | null> {
    const query = `
      SELECT * FROM interpretations
      WHERE id = $1 AND user_id = $2
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [id, userId]);
    return rows[0] || null;
  }

  /**
   * 查询梦境关联的解读
   */
  async findByDreamId(
    dreamId: string,
    userId: string
  ): Promise<Interpretation | null> {
    const query = `
      SELECT 
        i.id,
        i.dream_id as "dreamId",
        d.title as "dreamTitle",
        i.type,
        i.content,
        i.symbols,
        i.emotions_analysis as "emotionsAnalysis",
        i.suggestions,
        i.metadata,
        i.model_source as "modelSource",
        i.created_at as "createdAt"
      FROM interpretations i
      LEFT JOIN dream_entries d ON d.id = i.dream_id
      WHERE i.dream_id = $1 
        AND i.user_id = $2 
        AND i.type = 'interpretation'
      LIMIT 1
    `;
    const { rows } = await this.db.query(query, [dreamId, userId]);
    return rows[0] || null;
  }

  /**
   * 查询用户的所有解读
   */
  async findAllByUserId(
    userId: string,
    type?: InterpretationType,
    page: number = 1,
    pageSize: number = 20
  ): Promise<{ list: InterpretationEntity[]; total: number }> {
    const offset = (page - 1) * pageSize;

    let typeCondition = '';
    const params: any[] = [userId];

    if (type) {
      typeCondition = 'AND type = $2';
      params.push(type);
    }

    const countQuery = `
      SELECT COUNT(*) as total 
      FROM interpretations 
      WHERE user_id = $1 ${typeCondition}
    `;
    const countResult = await this.db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    const listQuery = `
      SELECT * FROM interpretations
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
   * 检查梦境是否存在解读
   */
  async existsByDreamId(
    dreamId: string,
    userId: string,
    type: InterpretationType = InterpretationType.INTERPRETATION
  ): Promise<boolean> {
    const query = `
      SELECT 1 FROM interpretations
      WHERE dream_id = $1 AND user_id = $2 AND type = $3
      LIMIT 1
    `;
    const { rowCount } = await this.db.query(query, [dreamId, userId, type]);
    return (rowCount ?? 0) > 0;
  }

  /**
   * 创建解读
   */
  async create(
    userId: string,
    data: {
      dreamId: string;
      type: InterpretationType;
      content: string;
      symbols?: any[];
      emotionsAnalysis?: any;
      suggestions?: string[];
      references?: any[];
      modelSource?: string;
    }
  ): Promise<InterpretationEntity> {
    console.log('[InterpretationRepository.create] 开始插入:', { userId, dreamId: data.dreamId, type: data.type, modelSource: data.modelSource });
    
    // 将 suggestions 数组拼接为文本
    const suggestionsText = data.suggestions && data.suggestions.length > 0 
      ? data.suggestions.join('\n') 
      : null;
    
    // 将引用信息存储到 metadata 字段
    const metadata = data.references && data.references.length > 0
      ? JSON.stringify({ references: data.references })
      : null;
    
    const query = `
      INSERT INTO interpretations (
        user_id, dream_id, type, content, 
        symbols, emotions_analysis, suggestions, 
        metadata, model_source
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::jsonb, $9)
      RETURNING *
    `;
    
    const params = [
      userId,
      data.dreamId,
      data.type,
      data.content,
      data.symbols ? JSON.stringify(data.symbols) : '[]',
      data.emotionsAnalysis ? JSON.stringify(data.emotionsAnalysis) : null,
      suggestionsText,
      metadata,
      data.modelSource || null,
    ];
    console.log('[InterpretationRepository.create] SQL参数:', params.map((p, i) => i >= 4 && i <= 7 ? `[JSON${i}]` : p));
    const { rows } = await this.db.query(query, params);
    console.log('[InterpretationRepository.create] 插入成功, 返回行数:', rows?.length);
    return rows[0];
  }

  /**
   * 删除解读
   */
  async delete(id: string, userId: string): Promise<boolean> {
    const query = `
      DELETE FROM interpretations
      WHERE id = $1 AND user_id = $2
    `;
    const { rowCount } = await this.db.query(query, [id, userId]);
    return (rowCount ?? 0) > 0;
  }

  /**
   * 删除梦境关联的所有解读
   */
  async deleteByDreamId(dreamId: string, userId: string): Promise<number> {
    const query = `
      DELETE FROM interpretations
      WHERE dream_id = $1 AND user_id = $2
    `;
    const { rowCount } = await this.db.query(query, [dreamId, userId]);
    return rowCount || 0;
  }

  /**
   * 查询知识库条目
   */
  async findKnowledgeItems(ids: string[]): Promise<
    {
      id: string;
      title: string;
      source: string;
    }[]
  > {
    if (ids.length === 0) return [];

    const query = `
      SELECT id, title, source
      FROM knowledge_items
      WHERE id = ANY($1) AND status = 'active'
    `;
    const { rows } = await this.db.query(query, [ids]);
    return rows;
  }
}
