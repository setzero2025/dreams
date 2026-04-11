/**
 * 用户服务层（Service）
 * 处理用户认证、用户管理、订阅等业务逻辑
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { userRepository } from '../repositories/user.repository';
import {
  RegisterRequest,
  LoginRequest,
  AnonymousLoginRequest,
  RefreshTokenRequest,
  UpdateProfileRequest,
  UpdateThemeRequest,
  CreateSubscriptionRequest,
  AuthResponse,
  RefreshTokenResponse,
  UserResponse,
  UserProfileResponse,
  UserQuota,
  SubscriptionResponse,
  SubscriptionPlanInfo,
  JWTPayload,
  UserTier,
  UserStats,
  QuotaConfig,
} from '../types/user.types';
import { ValidationError, ConflictError, UnauthorizedError, NotFoundError, ForbiddenError } from '../utils/errors';
import { config } from '../config';
import { logger } from '../utils/logger';

// Token 配置
const ACCESS_TOKEN_EXPIRES_IN = '15m'; // 15分钟
const REFRESH_TOKEN_EXPIRES_IN = '7d';  // 7天

// 额度配置
const QUOTA_CONFIG: QuotaConfig = {
  guest: {
    image: 1,
    video: 1,
    story: 0,
  },
  registered: {
    image: 5,
    video: 2,
    story: 1,
  },
};

// 订阅方案配置
const SUBSCRIPTION_PLANS: SubscriptionPlanInfo[] = [
  {
    id: 'plan-monthly',
    name: '月度订阅',
    description: '一个月内无限使用所有功能',
    price: 19.9,
    currency: 'CNY',
    interval: 'month',
    features: [
      '无限生成图片',
      '无限生成视频',
      '无限生成剧情',
      '无限解梦',
      '自定义测评时间窗口',
      '跨设备同步',
      'AI心理小伴互通',
    ],
  },
  {
    id: 'plan-yearly',
    name: '年度订阅',
    description: '一年畅享特权，限时优惠',
    price: 99.9,
    currency: 'CNY',
    interval: 'year',
    originalPrice: 238.8,
    features: [
      '所有月度订阅功能',
      '专属年度勋章',
      '优先客服支持',
    ],
  },
];

export class UserService {
  /**
   * 检查手机号是否已注册
   */
  async checkPhoneExists(phone: string): Promise<boolean> {
    logger.info({ msg: '检查手机号是否存在', phone });
    return await userRepository.phoneExists(phone);
  }

  /**
   * 用户注册
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    logger.info({ msg: '开始用户注册', phone: data.phone });

    try {
      // 1. 验证输入
      this.validateRegisterData(data);

      // 2. 检查手机号是否已存在
      const phoneExists = await userRepository.phoneExists(data.phone);
      if (phoneExists) {
        logger.warn({ msg: '注册失败：手机号已存在', phone: data.phone });
        throw new ConflictError('该手机号已被注册');
      }

      // 3. 密码哈希
      const passwordHash = await bcrypt.hash(data.password, 12);

      // 4. 创建用户
      const user = await userRepository.create({
        id: uuidv4(),
        phone: data.phone,
        passwordHash,
        nickname: data.nickname || this.generateNickname(),
        isAnonymous: false,
      });

      // 5. 创建用户档案
      await userRepository.createProfile(user.id, 'registered');

      // 6. 生成 Token
      const { accessToken, refreshToken, expiresIn } = this.generateTokens(user.id, user.phone!, 'registered');

      // 7. 更新最后登录时间
      await userRepository.updateLastLogin(user.id);

      logger.info({ msg: '用户注册成功', userId: user.id, phone: user.phone });

      return {
        userId: user.id,
        accessToken,
        refreshToken,
        expiresIn,
        tier: 'registered',
        user: this.mapToUserResponse(user, 'registered'),
      };
    } catch (error) {
      logger.error({
        msg: '用户注册失败',
        phone: data.phone,
        error: error instanceof Error ? error.message : '未知错误',
      });
      throw error;
    }
  }

  /**
   * 用户登录
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    logger.info({ msg: '开始用户登录', phone: data.phone });

    // 1. 验证输入
    if (!data.phone || !data.password) {
      throw new ValidationError('手机号和密码不能为空');
    }

    // 2. 查找用户
    const user = await userRepository.findByPhone(data.phone);
    if (!user || !user.password_hash) {
      throw new UnauthorizedError('手机号或密码错误');
    }

    // 3. 验证密码
    const isValidPassword = await bcrypt.compare(data.password, user.password_hash);
    if (!isValidPassword) {
      throw new UnauthorizedError('手机号或密码错误');
    }

    // 4. 获取用户档案
    let profile = await userRepository.findProfileByUserId(user.id);
    if (!profile) {
      profile = await userRepository.createProfile(user.id, 'registered');
    }

    // 5. 检查是否有有效订阅
    const subscription = await userRepository.findActiveSubscriptionByUserId(user.id);
    const tier: UserTier = subscription ? 'subscribed' : profile.tier;

    // 6. 生成 Token
    const { accessToken, refreshToken, expiresIn } = this.generateTokens(user.id, user.phone!, tier);

    // 7. 更新最后登录时间
    await userRepository.updateLastLogin(user.id);

    // 8. 如果用户有订阅但档案等级不是subscribed，更新档案
    if (subscription && profile.tier !== 'subscribed') {
      await userRepository.updateProfile(user.id, { tier: 'subscribed' });
    }

    logger.info({ msg: '用户登录成功', userId: user.id, phone: user.phone, tier });

    return {
      userId: user.id,
      accessToken,
      refreshToken,
      expiresIn,
      tier,
      user: this.mapToUserResponse(user, tier),
    };
  }

  /**
   * 匿名登录
   */
  async anonymousLogin(data: AnonymousLoginRequest): Promise<AuthResponse> {
    logger.info({ msg: '开始匿名登录', deviceId: data.deviceId });

    if (!data.deviceId) {
      throw new ValidationError('设备ID不能为空');
    }

    // 1. 查找是否已存在该设备的匿名用户
    let user = await userRepository.findByDeviceId(data.deviceId);

    if (!user) {
      // 2. 创建新的匿名用户
      user = await userRepository.create({
        id: uuidv4(),
        deviceId: data.deviceId,
        nickname: this.generateNickname(),
        isAnonymous: true,
      });

      // 3. 创建用户档案
      await userRepository.createProfile(user.id, 'guest');

      logger.info({ msg: '创建新匿名用户', userId: user.id, deviceId: data.deviceId });
    } else {
      logger.info({ msg: '匿名用户已存在', userId: user.id, deviceId: data.deviceId });
    }

    // 4. 生成 Token
    const { accessToken, refreshToken, expiresIn } = this.generateTokens(user.id, '', 'guest');

    // 5. 更新最后登录时间
    await userRepository.updateLastLogin(user.id);

    return {
      userId: user.id,
      accessToken,
      refreshToken,
      expiresIn,
      isAnonymous: true,
      tier: 'guest',
    };
  }

  /**
   * 刷新 Token
   */
  async refreshToken(data: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    try {
      const decoded = jwt.verify(data.refreshToken, config.jwt.secret) as JWTPayload;

      // 检查用户是否存在
      const user = await userRepository.findById(decoded.userId);
      if (!user) {
        throw new UnauthorizedError('用户不存在');
      }

      // 获取用户档案以确定等级
      const profile = await userRepository.findProfileByUserId(user.id);
      const tier = profile?.tier || 'guest';

      // 生成新的 Token
      const { accessToken, refreshToken, expiresIn } = this.generateTokens(
        user.id,
        user.phone || '',
        tier
      );

      return {
        accessToken,
        refreshToken,
        expiresIn,
      };
    } catch (error) {
      throw new UnauthorizedError('无效的刷新令牌');
    }
  }

  /**
   * 退出登录
   */
  async logout(userId: string): Promise<void> {
    logger.info({ msg: '用户退出登录', userId });
    // 这里可以实现 Token 黑名单逻辑
    // 例如将 Token 存入 Redis 或数据库的黑名单
  }

  /**
   * 获取用户信息
   */
  async getUserById(userId: string): Promise<UserResponse> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const profile = await userRepository.findProfileByUserId(userId);
    const tier = profile?.tier || 'guest';

    return this.mapToUserResponse(user, tier);
  }

  /**
   * 获取完整用户资料
   */
  async getUserProfile(userId: string): Promise<UserProfileResponse> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    const profile = await userRepository.findProfileByUserId(userId);
    if (!profile) {
      throw new NotFoundError('用户档案不存在');
    }

    // 检查是否有有效订阅
    const subscription = await userRepository.findActiveSubscriptionByUserId(userId);
    const tier: UserTier = subscription ? 'subscribed' : profile.tier;

    // 更新档案等级（如果需要）
    if (subscription && profile.tier !== 'subscribed') {
      await userRepository.updateProfile(userId, { tier: 'subscribed' });
    }

    const stats: UserStats = {
      totalDreams: profile.total_dreams,
      totalWorks: profile.total_works,
      streakDays: profile.streak_days,
    };

    const quota = this.calculateQuota(tier, profile);

    const settings = {
      theme: profile.theme_preference,
      evalWindow: profile.eval_window,
    };

    return {
      id: user.id,
      phone: this.maskPhone(user.phone),
      nickname: user.nickname || '',
      avatarUrl: user.avatar_url,
      gender: user.gender,
      age: user.age,
      tier,
      stats,
      quota,
      settings,
      lastLoginAt: user.last_login_at,
    };
  }

  /**
   * 更新用户资料
   */
  async updateProfile(userId: string, data: UpdateProfileRequest): Promise<UserResponse> {
    const user = await userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('用户不存在');
    }

    // 验证输入
    if (data.nickname !== undefined && data.nickname.length > 50) {
      throw new ValidationError('昵称不能超过50个字符');
    }

    if (data.age !== undefined && (data.age < 0 || data.age > 150)) {
      throw new ValidationError('年龄必须在0-150之间');
    }

    if (data.gender !== undefined && !['male', 'female', 'other'].includes(data.gender)) {
      throw new ValidationError('性别格式不正确');
    }

    // 更新用户
    const updatedUser = await userRepository.update(userId, {
      nickname: data.nickname,
      gender: data.gender,
      age: data.age,
    });

    if (!updatedUser) {
      throw new NotFoundError('用户更新失败');
    }

    const profile = await userRepository.findProfileByUserId(userId);
    const tier = profile?.tier || 'guest';

    return this.mapToUserResponse(updatedUser, tier);
  }

  /**
   * 更新主题设置
   */
  async updateTheme(userId: string, data: UpdateThemeRequest): Promise<{ theme: string }> {
    const profile = await userRepository.findProfileByUserId(userId);
    if (!profile) {
      throw new NotFoundError('用户档案不存在');
    }

    if (!['light', 'dark', 'system'].includes(data.theme)) {
      throw new ValidationError('主题格式不正确');
    }

    await userRepository.updateProfile(userId, {
      theme_preference: data.theme,
    });

    return { theme: data.theme };
  }

  /**
   * 获取用户额度
   */
  async getUserQuota(userId: string): Promise<UserQuota> {
    const profile = await userRepository.findProfileByUserId(userId);
    if (!profile) {
      throw new NotFoundError('用户档案不存在');
    }

    // 检查是否有有效订阅
    const subscription = await userRepository.findActiveSubscriptionByUserId(userId);
    const tier: UserTier = subscription ? 'subscribed' : profile.tier;

    return this.calculateQuota(tier, profile);
  }

  /**
   * 检查并扣除额度
   */
  async consumeQuota(userId: string, quotaType: 'image' | 'video' | 'story'): Promise<boolean> {
    const profile = await userRepository.findProfileByUserId(userId);
    if (!profile) {
      throw new NotFoundError('用户档案不存在');
    }

    // 检查是否有有效订阅
    const subscription = await userRepository.findActiveSubscriptionByUserId(userId);
    if (subscription) {
      // 订阅用户无限额度
      return true;
    }

    const quota = this.calculateQuota(profile.tier, profile);

    // 检查额度
    if (!quota[quotaType].canGenerate) {
      return false;
    }

    // 扣除额度
    await userRepository.incrementQuota(userId, quotaType);
    return true;
  }

  // ==================== 订阅相关 ====================

  /**
   * 获取订阅方案
   */
  async getSubscriptionPlans(): Promise<{ plans: SubscriptionPlanInfo[]; currentPlan: string | null }> {
    return {
      plans: SUBSCRIPTION_PLANS,
      currentPlan: null,
    };
  }

  /**
   * 创建订阅
   */
  async createSubscription(userId: string, data: CreateSubscriptionRequest): Promise<SubscriptionResponse> {
    // 查找方案
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === data.planId);
    if (!plan) {
      throw new ValidationError('订阅方案不存在');
    }

    // 计算订阅时间
    const startAt = new Date();
    const endAt = new Date();
    if (plan.interval === 'month') {
      endAt.setMonth(endAt.getMonth() + 1);
    } else {
      endAt.setFullYear(endAt.getFullYear() + 1);
    }

    // 创建订阅（模拟支付，实际应接入支付SDK）
    const subscription = await userRepository.createSubscription({
      id: uuidv4(),
      userId,
      plan: plan.interval === 'month' ? 'monthly' : 'yearly',
      amount: plan.price,
      currency: plan.currency,
      startAt,
      endAt,
      status: 'active',
      paymentMethod: 'alipay',
      paymentId: `pay-${uuidv4()}`,
      metadata: { planId: plan.id },
    });

    // 更新用户档案为订阅用户
    await userRepository.updateProfile(userId, { tier: 'subscribed' });

    const remainingDays = Math.ceil((endAt.getTime() - startAt.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: subscription.id,
      planId: plan.id,
      planName: plan.name,
      status: subscription.status,
      startAt: subscription.start_at,
      endAt: subscription.end_at,
      remainingDays,
      autoRenew: false,
    };
  }

  /**
   * 获取当前订阅
   */
  async getCurrentSubscription(userId: string): Promise<SubscriptionResponse | null> {
    const subscription = await userRepository.findActiveSubscriptionByUserId(userId);
    if (!subscription) {
      return null;
    }

    const plan = SUBSCRIPTION_PLANS.find(p => 
      (subscription.plan === 'monthly' && p.interval === 'month') ||
      (subscription.plan === 'yearly' && p.interval === 'year')
    );

    const now = new Date();
    const endAt = new Date(subscription.end_at);
    const remainingDays = Math.ceil((endAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    return {
      id: subscription.id,
      planId: plan?.id || `plan-${subscription.plan}`,
      planName: plan?.name || subscription.plan,
      status: subscription.status,
      startAt: subscription.start_at,
      endAt: subscription.end_at,
      remainingDays: Math.max(0, remainingDays),
      autoRenew: false,
    };
  }

  /**
   * 取消订阅
   */
  async cancelSubscription(userId: string): Promise<SubscriptionResponse> {
    const subscription = await userRepository.findActiveSubscriptionByUserId(userId);
    if (!subscription) {
      throw new NotFoundError('没有有效的订阅');
    }

    const cancelled = await userRepository.cancelSubscription(subscription.id);
    if (!cancelled) {
      throw new Error('取消订阅失败');
    }

    const plan = SUBSCRIPTION_PLANS.find(p => 
      (subscription.plan === 'monthly' && p.interval === 'month') ||
      (subscription.plan === 'yearly' && p.interval === 'year')
    );

    return {
      id: subscription.id,
      planId: plan?.id || `plan-${subscription.plan}`,
      planName: plan?.name || subscription.plan,
      status: 'cancelled',
      startAt: subscription.start_at,
      endAt: subscription.end_at,
      remainingDays: 0,
      autoRenew: false,
    };
  }

  // ==================== 私有方法 ====================

  /**
   * 验证注册数据
   */
  private validateRegisterData(data: RegisterRequest): void {
    const errors: Array<{ field: string; message: string }> = [];

    // 验证手机号
    if (!data.phone) {
      errors.push({ field: 'phone', message: '手机号不能为空' });
    } else if (!this.isValidPhone(data.phone)) {
      errors.push({ field: 'phone', message: '手机号格式不正确，请输入11位手机号' });
    }

    // 验证密码
    if (!data.password) {
      errors.push({ field: 'password', message: '密码不能为空' });
    } else if (data.password.length < 6) {
      errors.push({ field: 'password', message: '密码长度至少6位' });
    } else if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(data.password)) {
      errors.push({ field: 'password', message: '密码必须包含字母和数字' });
    }

    // 验证确认密码
    if (data.password !== data.confirmPassword) {
      errors.push({ field: 'confirmPassword', message: '两次输入的密码不一致' });
    }

    if (errors.length > 0) {
      throw new ValidationError('参数验证失败', errors);
    }
  }

  /**
   * 验证手机号格式
   */
  private isValidPhone(phone: string): boolean {
    const phoneRegex = /^1[3-9]\d{9}$/;
    return phoneRegex.test(phone);
  }

  /**
   * 生成 Token
   */
  private generateTokens(userId: string, phone: string, tier: UserTier) {
    const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
      userId,
      phone,
      tier,
    };

    const accessToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: ACCESS_TOKEN_EXPIRES_IN,
    });

    const refreshToken = jwt.sign(payload, config.jwt.secret, {
      expiresIn: REFRESH_TOKEN_EXPIRES_IN,
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 15 * 60, // 15分钟（秒）
    };
  }

  /**
   * 生成随机昵称
   */
  private generateNickname(): string {
    return '用户' + Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  /**
   * 手机号脱敏
   */
  private maskPhone(phone: string | null): string {
    if (!phone) return '';
    return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
  }

  /**
   * 映射为用户响应
   */
  private mapToUserResponse(user: any, tier: UserTier): UserResponse {
    return {
      id: user.id,
      phone: this.maskPhone(user.phone),
      nickname: user.nickname || '',
      avatarUrl: user.avatar_url,
      gender: user.gender,
      age: user.age,
      tier,
      isAnonymous: user.is_anonymous || false,
      createdAt: user.created_at,
    };
  }

  /**
   * 计算额度
   */
  private calculateQuota(tier: UserTier, profile: any): UserQuota {
    const isSubscribed = tier === 'subscribed';
    const quotaLimit = QUOTA_CONFIG[profile.tier === 'guest' ? 'guest' : 'registered'];

    return {
      tier,
      image: {
        used: profile.image_used,
        limit: quotaLimit.image,
        unlimited: isSubscribed,
        canGenerate: isSubscribed || profile.image_used < quotaLimit.image,
      },
      video: {
        used: profile.video_used,
        limit: quotaLimit.video,
        unlimited: isSubscribed,
        canGenerate: isSubscribed || profile.video_used < quotaLimit.video,
      },
      story: {
        used: profile.story_used,
        limit: quotaLimit.story,
        unlimited: isSubscribed,
        canGenerate: isSubscribed || profile.story_used < quotaLimit.story,
      },
      interpretation: {
        unlimited: true,
      },
    };
  }
}

// 导出单例
export const userService = new UserService();
