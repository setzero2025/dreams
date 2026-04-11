/**
 * 用户数据访问层（Repository）
 * 处理用户、用户档案、订阅相关的数据库操作
 */

import { query, withTransaction } from '../config/database';
import {
  UserEntity,
  UserProfileEntity,
  SubscriptionEntity,
  UserTier,
  SubscriptionPlan,
  SubscriptionStatus,
  ThemePreference,
} from '../types/user.types';
import { logger } from '../utils/logger';

export class UserRepository {
  /**
   * 根据ID查找用户
   */
  async findById(id: string): Promise<UserEntity | null> {
    const result = await query(
      'SELECT * FROM users WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * 根据手机号查找用户
   */
  async findByPhone(phone: string): Promise<UserEntity | null> {
    const result = await query(
      'SELECT * FROM users WHERE phone = $1',
      [phone]
    );
    return result.rows[0] || null;
  }

  /**
   * 根据设备ID查找匿名用户
   */
  async findByDeviceId(deviceId: string): Promise<UserEntity | null> {
    const result = await query(
      'SELECT * FROM users WHERE device_id = $1 AND is_anonymous = true',
      [deviceId]
    );
    return result.rows[0] || null;
  }

  /**
   * 检查手机号是否已存在
   */
  async phoneExists(phone: string): Promise<boolean> {
    const result = await query(
      'SELECT 1 FROM users WHERE phone = $1 LIMIT 1',
      [phone]
    );
    return result.rows.length > 0;
  }

  /**
   * 创建用户
   */
  async create(userData: {
    id: string;
    phone?: string | null;
    passwordHash?: string | null;
    nickname?: string | null;
    deviceId?: string | null;
    isAnonymous?: boolean;
  }): Promise<UserEntity> {
    const result = await query(
      `INSERT INTO users (id, phone, password_hash, nickname, device_id, is_anonymous, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
       RETURNING *`,
      [
        userData.id,
        userData.phone || null,
        userData.passwordHash || null,
        userData.nickname || null,
        userData.deviceId || null,
        userData.isAnonymous || false,
      ]
    );
    return result.rows[0];
  }

  /**
   * 更新用户信息
   */
  async update(id: string, updates: Partial<UserEntity>): Promise<UserEntity | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 0;

    if (updates.nickname !== undefined) {
      paramIndex++;
      fields.push(`nickname = $${paramIndex}`);
      values.push(updates.nickname);
    }

    if (updates.avatar_url !== undefined) {
      paramIndex++;
      fields.push(`avatar_url = $${paramIndex}`);
      values.push(updates.avatar_url);
    }

    if (updates.gender !== undefined) {
      paramIndex++;
      fields.push(`gender = $${paramIndex}`);
      values.push(updates.gender);
    }

    if (updates.age !== undefined) {
      paramIndex++;
      fields.push(`age = $${paramIndex}`);
      values.push(updates.age);
    }

    if (updates.password_hash !== undefined) {
      paramIndex++;
      fields.push(`password_hash = $${paramIndex}`);
      values.push(updates.password_hash);
    }

    if (updates.phone !== undefined) {
      paramIndex++;
      fields.push(`phone = $${paramIndex}`);
      values.push(updates.phone);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    paramIndex++;
    fields.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      [...values, id]
    );

    return result.rows[0] || null;
  }

  /**
   * 更新最后登录时间
   */
  async updateLastLogin(id: string): Promise<void> {
    await query(
      'UPDATE users SET last_login_at = NOW(), updated_at = NOW() WHERE id = $1',
      [id]
    );
  }

  /**
   * 删除用户
   */
  async delete(id: string): Promise<boolean> {
    const result = await query(
      'DELETE FROM users WHERE id = $1',
      [id]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== 用户档案相关 ====================

  /**
   * 根据用户ID查找档案
   */
  async findProfileByUserId(userId: string): Promise<UserProfileEntity | null> {
    const result = await query(
      'SELECT * FROM user_profiles WHERE user_id = $1',
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * 创建用户档案
   */
  async createProfile(userId: string, tier: UserTier = 'guest'): Promise<UserProfileEntity> {
    const result = await query(
      `INSERT INTO user_profiles (id, user_id, tier, image_used, video_used, story_used, 
        eval_window, total_dreams, total_works, streak_days, theme_preference, settings, updated_at)
       VALUES (gen_random_uuid(), $1, $2, 0, 0, 0, 7, 0, 0, 0, 'system', '{}', NOW())
       RETURNING *`,
      [userId, tier]
    );
    return result.rows[0];
  }

  /**
   * 更新用户档案
   */
  async updateProfile(userId: string, updates: Partial<UserProfileEntity>): Promise<UserProfileEntity | null> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 0;

    if (updates.tier !== undefined) {
      paramIndex++;
      fields.push(`tier = $${paramIndex}`);
      values.push(updates.tier);
    }

    if (updates.image_used !== undefined) {
      paramIndex++;
      fields.push(`image_used = $${paramIndex}`);
      values.push(updates.image_used);
    }

    if (updates.video_used !== undefined) {
      paramIndex++;
      fields.push(`video_used = $${paramIndex}`);
      values.push(updates.video_used);
    }

    if (updates.story_used !== undefined) {
      paramIndex++;
      fields.push(`story_used = $${paramIndex}`);
      values.push(updates.story_used);
    }

    if (updates.eval_window !== undefined) {
      paramIndex++;
      fields.push(`eval_window = $${paramIndex}`);
      values.push(updates.eval_window);
    }

    if (updates.total_dreams !== undefined) {
      paramIndex++;
      fields.push(`total_dreams = $${paramIndex}`);
      values.push(updates.total_dreams);
    }

    if (updates.total_works !== undefined) {
      paramIndex++;
      fields.push(`total_works = $${paramIndex}`);
      values.push(updates.total_works);
    }

    if (updates.streak_days !== undefined) {
      paramIndex++;
      fields.push(`streak_days = $${paramIndex}`);
      values.push(updates.streak_days);
    }

    if (updates.last_dream_date !== undefined) {
      paramIndex++;
      fields.push(`last_dream_date = $${paramIndex}`);
      values.push(updates.last_dream_date);
    }

    if (updates.theme_preference !== undefined) {
      paramIndex++;
      fields.push(`theme_preference = $${paramIndex}`);
      values.push(updates.theme_preference);
    }

    if (updates.settings !== undefined) {
      paramIndex++;
      fields.push(`settings = $${paramIndex}`);
      values.push(JSON.stringify(updates.settings));
    }

    if (fields.length === 0) {
      return this.findProfileByUserId(userId);
    }

    paramIndex++;
    fields.push(`updated_at = NOW()`);

    const result = await query(
      `UPDATE user_profiles SET ${fields.join(', ')} WHERE user_id = $${paramIndex} RETURNING *`,
      [...values, userId]
    );

    return result.rows[0] || null;
  }

  /**
   * 增加额度使用量
   */
  async incrementQuota(userId: string, quotaType: 'image' | 'video' | 'story'): Promise<boolean> {
    const column = `${quotaType}_used`;
    const result = await query(
      `UPDATE user_profiles SET ${column} = ${column} + 1, updated_at = NOW() WHERE user_id = $1`,
      [userId]
    );
    return (result.rowCount ?? 0) > 0;
  }

  // ==================== 订阅相关 ====================

  /**
   * 根据ID查找订阅
   */
  async findSubscriptionById(id: string): Promise<SubscriptionEntity | null> {
    const result = await query(
      'SELECT * FROM subscriptions WHERE id = $1',
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * 查找用户当前有效的订阅
   */
  async findActiveSubscriptionByUserId(userId: string): Promise<SubscriptionEntity | null> {
    const result = await query(
      `SELECT * FROM subscriptions 
       WHERE user_id = $1 AND status = 'active' AND end_at > NOW()
       ORDER BY end_at DESC LIMIT 1`,
      [userId]
    );
    return result.rows[0] || null;
  }

  /**
   * 查找用户的所有订阅
   */
  async findSubscriptionsByUserId(userId: string): Promise<SubscriptionEntity[]> {
    const result = await query(
      `SELECT * FROM subscriptions 
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [userId]
    );
    return result.rows;
  }

  /**
   * 创建订阅
   */
  async createSubscription(subscriptionData: {
    id: string;
    userId: string;
    plan: SubscriptionPlan;
    amount: number;
    currency: string;
    startAt: Date;
    endAt: Date;
    status?: SubscriptionStatus;
    paymentMethod?: string;
    paymentId?: string;
    metadata?: Record<string, any>;
  }): Promise<SubscriptionEntity> {
    const result = await query(
      `INSERT INTO subscriptions (id, user_id, plan, amount, currency, start_at, end_at, 
        status, payment_method, payment_id, metadata, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW())
       RETURNING *`,
      [
        subscriptionData.id,
        subscriptionData.userId,
        subscriptionData.plan,
        subscriptionData.amount,
        subscriptionData.currency,
        subscriptionData.startAt,
        subscriptionData.endAt,
        subscriptionData.status || 'active',
        subscriptionData.paymentMethod || null,
        subscriptionData.paymentId || null,
        JSON.stringify(subscriptionData.metadata || {}),
      ]
    );
    return result.rows[0];
  }

  /**
   * 更新订阅状态
   */
  async updateSubscriptionStatus(
    id: string, 
    status: SubscriptionStatus
  ): Promise<SubscriptionEntity | null> {
    const result = await query(
      `UPDATE subscriptions 
       SET status = $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING *`,
      [status, id]
    );
    return result.rows[0] || null;
  }

  /**
   * 取消订阅
   */
  async cancelSubscription(id: string): Promise<SubscriptionEntity | null> {
    const result = await query(
      `UPDATE subscriptions 
       SET status = 'cancelled', updated_at = NOW() 
       WHERE id = $1 
       RETURNING *`,
      [id]
    );
    return result.rows[0] || null;
  }

  /**
   * 将匿名用户转换为注册用户
   */
  async convertAnonymousToRegistered(
    userId: string,
    phone: string,
    passwordHash: string,
    nickname?: string
  ): Promise<UserEntity | null> {
    return withTransaction(async (client) => {
      // 更新用户信息
      const userResult = await client.query(
        `UPDATE users 
         SET phone = $1, password_hash = $2, nickname = COALESCE($3, nickname), 
             is_anonymous = false, updated_at = NOW()
         WHERE id = $4 
         RETURNING *`,
        [phone, passwordHash, nickname, userId]
      );

      if (userResult.rows.length === 0) {
        return null;
      }

      // 更新用户档案等级
      await client.query(
        `UPDATE user_profiles 
         SET tier = 'registered', updated_at = NOW()
         WHERE user_id = $1`,
        [userId]
      );

      return userResult.rows[0];
    });
  }
}

// 导出单例
export const userRepository = new UserRepository();
