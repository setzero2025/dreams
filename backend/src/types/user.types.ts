/**
 * 用户模块类型定义
 * 根据数据库设计说明文档和需求规格说明文档定义
 */

// 用户等级类型
export type UserTier = 'guest' | 'registered' | 'subscribed';

// 性别类型
export type Gender = 'male' | 'female' | 'other';

// 主题偏好
export type ThemePreference = 'light' | 'dark' | 'system';

// 订阅计划类型
export type SubscriptionPlan = 'monthly' | 'yearly';

// 订阅状态
export type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';

/**
 * 用户实体（数据库）
 */
export interface UserEntity {
  id: string;
  phone: string | null;
  password_hash: string | null;
  nickname: string | null;
  avatar_url: string | null;
  gender: Gender | null;
  age: number | null;
  is_anonymous: boolean;
  device_id: string | null;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

/**
 * 用户档案实体（数据库）
 */
export interface UserProfileEntity {
  id: string;
  user_id: string;
  tier: UserTier;
  image_used: number;
  video_used: number;
  story_used: number;
  eval_window: number;
  total_dreams: number;
  total_works: number;
  streak_days: number;
  last_dream_date: Date | null;
  theme_preference: ThemePreference;
  settings: Record<string, any>;
  updated_at: Date;
}

/**
 * 订阅实体（数据库）
 */
export interface SubscriptionEntity {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  amount: number;
  currency: string;
  start_at: Date;
  end_at: Date;
  status: SubscriptionStatus;
  payment_method: string | null;
  payment_id: string | null;
  metadata: Record<string, any>;
  created_at: Date;
  updated_at: Date;
}

/**
 * 用户注册请求
 */
export interface RegisterRequest {
  phone: string;
  password: string;
  confirmPassword: string;
  nickname?: string;
}

/**
 * 用户登录请求
 */
export interface LoginRequest {
  phone: string;
  password: string;
}

/**
 * 匿名登录请求
 */
export interface AnonymousLoginRequest {
  deviceId: string;
}

/**
 * 刷新Token请求
 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/**
 * 更新用户资料请求
 */
export interface UpdateProfileRequest {
  nickname?: string;
  gender?: Gender;
  age?: number;
}

/**
 * 更新主题设置请求
 */
export interface UpdateThemeRequest {
  theme: ThemePreference;
}

/**
 * 用户响应（脱敏）
 */
export interface UserResponse {
  id: string;
  phone: string;
  nickname: string;
  avatarUrl: string | null;
  gender: Gender | null;
  age: number | null;
  tier: UserTier;
  isAnonymous: boolean;
  createdAt: Date;
}

/**
 * 用户统计信息
 */
export interface UserStats {
  totalDreams: number;
  totalWorks: number;
  streakDays: number;
}

/**
 * 用户额度信息
 */
export interface UserQuota {
  tier: UserTier;
  image: {
    used: number;
    limit: number;
    unlimited: boolean;
    canGenerate: boolean;
  };
  video: {
    used: number;
    limit: number;
    unlimited: boolean;
    canGenerate: boolean;
  };
  story: {
    used: number;
    limit: number;
    unlimited: boolean;
    canGenerate: boolean;
  };
  interpretation: {
    unlimited: boolean;
  };
}

/**
 * 用户设置
 */
export interface UserSettings {
  theme: ThemePreference;
  evalWindow: number;
}

/**
 * 完整用户资料响应
 */
export interface UserProfileResponse {
  id: string;
  phone: string;
  nickname: string;
  avatarUrl: string | null;
  gender: Gender | null;
  age: number | null;
  tier: UserTier;
  stats: UserStats;
  quota: UserQuota;
  settings: UserSettings;
  lastLoginAt: Date | null;
}

/**
 * 认证响应
 */
export interface AuthResponse {
  userId: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  isAnonymous?: boolean;
  tier?: UserTier;
  user?: UserResponse;
}

/**
 * Token刷新响应
 */
export interface RefreshTokenResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/**
 * JWT Payload
 */
export interface JWTPayload {
  userId: string;
  phone: string;
  tier: UserTier;
  iat: number;
  exp: number;
}

/**
 * 订阅方案
 */
export interface SubscriptionPlanInfo {
  id: string;
  name: string;
  description: string;
  price: number;
  currency: string;
  interval: 'month' | 'year';
  originalPrice?: number;
  features: string[];
}

/**
 * 订阅响应
 */
export interface SubscriptionResponse {
  id: string;
  planId: string;
  planName: string;
  status: SubscriptionStatus;
  startAt: Date;
  endAt: Date;
  remainingDays?: number;
  autoRenew?: boolean;
}

/**
 * 创建订阅请求
 */
export interface CreateSubscriptionRequest {
  planId: string;
}

/**
 * 额度配置
 */
export interface QuotaConfig {
  guest: {
    image: number;
    video: number;
    story: number;
  };
  registered: {
    image: number;
    video: number;
    story: number;
  };
}
