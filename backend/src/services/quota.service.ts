/**
 * 用户额度服务
 * 管理用户的AI生成额度
 */

import { Pool } from 'pg';

// 用户等级
export enum UserTier {
  GUEST = 'guest',
  REGISTERED = 'registered',
  SUBSCRIBED = 'subscribed',
}

// 额度配置
interface QuotaConfig {
  image: number;
  video: number;
  story: number;
  interpretation: number;
}

// 默认额度限制
const DEFAULT_QUOTAS: Record<UserTier, QuotaConfig> = {
  [UserTier.GUEST]: {
    image: 1,
    video: 1,
    story: 0,
    interpretation: 1,
  },
  [UserTier.REGISTERED]: {
    image: 5,
    video: 2,
    story: 1,
    interpretation: -1, // 无限
  },
  [UserTier.SUBSCRIBED]: {
    image: -1, // 无限
    video: -1, // 无限
    story: -1, // 无限
    interpretation: -1, // 无限
  },
};

// 额度类型
export enum QuotaType {
  IMAGE = 'image',
  VIDEO = 'video',
  STORY = 'story',
  INTERPRETATION = 'interpretation',
}

// 额度信息
export interface QuotaInfo {
  type: QuotaType;
  used: number;
  limit: number;
  unlimited: boolean;
  canGenerate: boolean;
  remaining: number;
}

// 用户额度
export interface UserQuota {
  tier: UserTier;
  image: QuotaInfo;
  video: QuotaInfo;
  story: QuotaInfo;
  interpretation: QuotaInfo;
}

export class QuotaService {
  constructor(private db: Pool) {}

  /**
   * 获取用户额度信息
   */
  async getUserQuota(userId: string): Promise<UserQuota> {
    // 获取用户等级和额度使用情况
    const query = `
      SELECT 
        COALESCE(up.tier, 'registered') as tier,
        COALESCE(up.image_used, 0) as image_used,
        COALESCE(up.video_used, 0) as video_used,
        COALESCE(up.story_used, 0) as story_used,
        EXISTS (
          SELECT 1 FROM subscriptions s 
          WHERE s.user_id = up.user_id 
          AND s.status = 'active' 
          AND s.end_at > NOW()
        ) as is_subscribed
      FROM user_profiles up
      WHERE up.user_id = $1
    `;
    const { rows } = await this.db.query(query, [userId]);

    let tier = UserTier.REGISTERED;
    let imageUsed = 0;
    let videoUsed = 0;
    let storyUsed = 0;

    if (rows.length > 0) {
      const row = rows[0];
      tier = row.is_subscribed ? UserTier.SUBSCRIBED : row.tier;
      imageUsed = parseInt(row.image_used);
      videoUsed = parseInt(row.video_used);
      storyUsed = parseInt(row.story_used);
    }

    const limits = DEFAULT_QUOTAS[tier];

    return {
      tier,
      image: this.buildQuotaInfo(QuotaType.IMAGE, imageUsed, limits.image),
      video: this.buildQuotaInfo(QuotaType.VIDEO, videoUsed, limits.video),
      story: this.buildQuotaInfo(QuotaType.STORY, storyUsed, limits.story),
      interpretation: this.buildQuotaInfo(
        QuotaType.INTERPRETATION,
        0,
        limits.interpretation
      ),
    };
  }

  /**
   * 检查额度
   */
  async checkQuota(
    userId: string,
    type: QuotaType
  ): Promise<{ canGenerate: boolean; quota: QuotaInfo }> {
    const userQuota = await this.getUserQuota(userId);
    const quota = userQuota[type];

    return {
      canGenerate: quota.canGenerate,
      quota,
    };
  }

  /**
   * 消耗额度
   */
  async consumeQuota(userId: string, type: QuotaType): Promise<boolean> {
    const { canGenerate } = await this.checkQuota(userId, type);

    if (!canGenerate) {
      return false;
    }

    // 更新额度使用记录
    const columnMap: Record<QuotaType, string> = {
      [QuotaType.IMAGE]: 'image_used',
      [QuotaType.VIDEO]: 'video_used',
      [QuotaType.STORY]: 'story_used',
      [QuotaType.INTERPRETATION]: 'image_used', // 解读不消耗额度
    };

    const column = columnMap[type];

    // 检查用户档案是否存在
    const checkQuery = `
      SELECT 1 FROM user_profiles WHERE user_id = $1
    `;
    const checkResult = await this.db.query(checkQuery, [userId]);

    if (checkResult.rowCount === 0) {
      // 创建用户档案
      const insertQuery = `
        INSERT INTO user_profiles (user_id, ${column})
        VALUES ($1, 1)
      `;
      await this.db.query(insertQuery, [userId]);
    } else {
      // 更新额度
      const updateQuery = `
        UPDATE user_profiles
        SET ${column} = ${column} + 1, updated_at = CURRENT_TIMESTAMP
        WHERE user_id = $1
      `;
      await this.db.query(updateQuery, [userId]);
    }

    return true;
  }

  /**
   * 获取额度限制配置
   */
  getQuotaLimits(tier: UserTier): QuotaConfig {
    return DEFAULT_QUOTAS[tier];
  }

  /**
   * 构建额度信息
   */
  private buildQuotaInfo(
    type: QuotaType,
    used: number,
    limit: number
  ): QuotaInfo {
    const unlimited = limit < 0;
    const remaining = unlimited ? -1 : Math.max(0, limit - used);
    const canGenerate = unlimited || used < limit;

    return {
      type,
      used,
      limit,
      unlimited,
      canGenerate,
      remaining,
    };
  }

  /**
   * 检查用户是否为订阅用户
   */
  async isSubscribed(userId: string): Promise<boolean> {
    const query = `
      SELECT 1 FROM subscriptions 
      WHERE user_id = $1 
      AND status = 'active' 
      AND end_at > NOW()
      LIMIT 1
    `;
    const { rowCount } = await this.db.query(query, [userId]);
    return (rowCount ?? 0) > 0;
  }

  /**
   * 获取用户等级
   */
  async getUserTier(userId: string): Promise<UserTier> {
    const isSubscribed = await this.isSubscribed(userId);
    if (isSubscribed) {
      return UserTier.SUBSCRIBED;
    }

    const query = `
      SELECT tier FROM user_profiles WHERE user_id = $1
    `;
    const { rows } = await this.db.query(query, [userId]);

    if (rows.length === 0) {
      return UserTier.REGISTERED;
    }

    return rows[0].tier as UserTier;
  }
}
