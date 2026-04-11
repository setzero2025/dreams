import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL, API_ENDPOINTS } from '../../config/api';

// Token 存储键名
const TOKEN_KEYS = {
  ACCESS_TOKEN: 'access_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_INFO: 'user_info',
  DEVICE_ID: 'device_id',
};

// 生成设备ID
const generateDeviceId = (): string => {
  return 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// 获取或创建设备ID
const getOrCreateDeviceId = async (): Promise<string> => {
  let deviceId = await AsyncStorage.getItem(TOKEN_KEYS.DEVICE_ID);
  if (!deviceId) {
    deviceId = generateDeviceId();
    await AsyncStorage.setItem(TOKEN_KEYS.DEVICE_ID, deviceId);
  }
  return deviceId;
};

// 用户统计信息
export interface UserStats {
  totalDreams: number;
  totalWorks: number;
  streakDays: number;
}

// 用户额度信息
export interface UserQuota {
  tier: string;
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

// 用户设置
export interface UserSettings {
  theme: 'light' | 'dark' | 'system';
  evalWindow: number;
}

// 用户类型定义
export interface User {
  id: string;
  nickname: string;
  phone: string;
  avatarUrl?: string;
  subscriptionType: 'free' | 'monthly' | 'yearly';
  authType: string;
  // 扩展字段（从完整资料接口获取）
  stats?: UserStats;
  quota?: UserQuota;
  settings?: UserSettings;
  tier?: 'guest' | 'registered' | 'subscribed';
}

// 登录请求参数（后端使用手机号）
export interface LoginRequest {
  phone: string;
  password: string;
}

// 注册请求参数（后端使用手机号）
export interface RegisterRequest {
  phone: string;
  password: string;
  confirmPassword: string;
}

// 认证响应（适配后端返回格式）
export interface AuthResponse {
  success: boolean;
  message?: string;
  data?: {
    user: User;
    token: string;
    refreshToken: string;
  };
}

// 后端原始响应格式
interface BackendAuthData {
  user: User;
  accessToken: string;
  refreshToken: string;
}

// API 响应通用格式（适配后端格式）
export interface ApiResponse<T> {
  code: number;
  message?: string;
  data?: T;
  timestamp?: number;
  requestId?: string;
}

// 判断响应是否成功
const isSuccess = (code: number): boolean => code === 200 || code === 201;

/**
 * 认证服务
 */
export const authApi = {
  /**
   * 检查手机号是否已注册
   */
  async checkPhoneExists(phone: string): Promise<{ exists: boolean; message?: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.CHECK_PHONE}?phone=${encodeURIComponent(phone)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const result: ApiResponse<{ exists: boolean }> = await response.json();
      return {
        exists: result.data?.exists ?? false,
        message: result.message,
      };
    } catch (error) {
      console.error('检查手机号失败:', error);
      return { exists: false };
    }
  },

  /**
   * 用户注册
   */
  async register(data: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.REGISTER}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result: ApiResponse<BackendAuthData> = await response.json();

      if (isSuccess(result.code) && result.data) {
        // 保存 token 和用户信息（后端返回 accessToken）
        await this.saveTokens(result.data.accessToken, result.data.refreshToken);
        await this.saveUserInfo(result.data.user);
        return {
          success: true,
          message: result.message,
          data: {
            user: result.data.user,
            token: result.data.accessToken,
            refreshToken: result.data.refreshToken,
          },
        };
      }

      return {
        success: false,
        message: result.message || '注册失败',
      };
    } catch (error) {
      console.error('注册失败:', error);
      return {
        success: false,
        message: '网络错误，请稍后重试',
      };
    }
  },

  /**
   * 用户登录
   */
  async login(data: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      const result: ApiResponse<BackendAuthData> = await response.json();
      
      console.log('login - 后端返回:', result);
      
      if (isSuccess(result.code) && result.data) {
        console.log('login - accessToken:', result.data.accessToken ? '存在' : '不存在');
        // 保存 token 和用户信息（后端返回 accessToken，前端使用 token）
        await this.saveTokens(result.data.accessToken, result.data.refreshToken);
        await this.saveUserInfo(result.data.user);
        console.log('login - token已保存');
        return {
          success: true,
          message: result.message,
          data: {
            user: result.data.user,
            token: result.data.accessToken,
            refreshToken: result.data.refreshToken,
          },
        };
      }

      return {
        success: false,
        message: result.message || '登录失败',
      };
    } catch (error) {
      console.error('登录失败:', error);
      return {
        success: false,
        message: '网络错误，请稍后重试',
      };
    }
  },

  /**
   * 匿名登录
   */
  async anonymousLogin(): Promise<AuthResponse> {
    try {
      const deviceId = await getOrCreateDeviceId();
      console.log('anonymousLogin - deviceId:', deviceId);
      
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.ANONYMOUS}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ deviceId }),
      });

      const result: ApiResponse<BackendAuthData> = await response.json();

      console.log('anonymousLogin - 后端返回:', result);

      if (isSuccess(result.code) && result.data) {
        console.log('anonymousLogin - accessToken:', result.data.accessToken ? '存在' : '不存在');
        // 保存 token 和用户信息（后端返回 accessToken）
        await this.saveTokens(result.data.accessToken, result.data.refreshToken);
        await this.saveUserInfo(result.data.user);
        console.log('anonymousLogin - token已保存');
        return {
          success: true,
          message: result.message,
          data: {
            user: result.data.user,
            token: result.data.accessToken,
            refreshToken: result.data.refreshToken,
          },
        };
      }

      return {
        success: false,
        message: result.message || '匿名登录失败',
      };
    } catch (error) {
      console.error('匿名登录失败:', error);
      return {
        success: false,
        message: '网络错误，请稍后重试',
      };
    }
  },

  /**
   * 用户退出登录
   */
  async logout(): Promise<ApiResponse<void>> {
    try {
      const accessToken = await this.getAccessToken();
      console.log('logout - accessToken:', accessToken ? '存在' : '不存在');

      // 调用后端退出接口（即使失败也继续）
      try {
        const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.LOGOUT}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
        });
        console.log('logout - 后端响应状态:', response.status);
      } catch (apiError) {
        // 忽略后端错误（如 401 token 过期）
        console.log('后端退出接口调用失败（可能 token 已过期），继续清除本地数据');
      }

      // 清除本地存储
      await this.clearAuthData();

      return {
        success: true,
        message: '已退出登录',
      };
    } catch (error) {
      console.error('退出登录失败:', error);
      // 清除本地存储
      await this.clearAuthData();
      return {
        success: true,
        message: '已退出登录',
      };
    }
  },

  /**
   * 获取当前用户信息
   */
  async getCurrentUser(): Promise<ApiResponse<User>> {
    try {
      const accessToken = await this.getAccessToken();

      if (!accessToken) {
        return {
          success: false,
          message: '未登录',
        };
      }

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.USER.PROFILE}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const result: ApiResponse<User> = await response.json();

      if (isSuccess(result.code) && result.data) {
        await this.saveUserInfo(result.data);
        return {
          success: true,
          data: result.data,
        };
      }

      return {
        success: false,
        message: result.message || '获取用户信息失败',
      };
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return {
        success: false,
        message: '网络错误，请稍后重试',
      };
    }
  },

  /**
   * 刷新 token
   */
  async refreshToken(): Promise<AuthResponse> {
    try {
      const refreshToken = await this.getRefreshToken();

      if (!refreshToken) {
        return {
          success: false,
          message: '未登录',
        };
      }

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.AUTH.REFRESH}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      const result: ApiResponse<BackendAuthData> = await response.json();

      if (isSuccess(result.code) && result.data) {
        await this.saveTokens(result.data.accessToken, result.data.refreshToken);
        await this.saveUserInfo(result.data.user);
        return {
          success: true,
          message: result.message,
          data: {
            user: result.data.user,
            token: result.data.accessToken,
            refreshToken: result.data.refreshToken,
          },
        };
      }

      return {
        success: false,
        message: result.message || '刷新 token 失败',
      };
    } catch (error) {
      console.error('刷新 token 失败:', error);
      return {
        success: false,
        message: '网络错误，请稍后重试',
      };
    }
  },

  /**
   * 保存 tokens
   */
  async saveTokens(accessToken: string, refreshToken: string): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEYS.ACCESS_TOKEN, accessToken);
    await AsyncStorage.setItem(TOKEN_KEYS.REFRESH_TOKEN, refreshToken);
  },

  /**
   * 保存用户信息
   */
  async saveUserInfo(user: User): Promise<void> {
    await AsyncStorage.setItem(TOKEN_KEYS.USER_INFO, JSON.stringify(user));
  },

  /**
   * 获取 access token
   */
  async getAccessToken(): Promise<string | null> {
    return await AsyncStorage.getItem(TOKEN_KEYS.ACCESS_TOKEN);
  },

  /**
   * 获取 refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    return await AsyncStorage.getItem(TOKEN_KEYS.REFRESH_TOKEN);
  },

  /**
   * 获取用户信息
   */
  async getUserInfo(): Promise<User | null> {
    try {
      const userInfo = await AsyncStorage.getItem(TOKEN_KEYS.USER_INFO);
      if (!userInfo) {
        return null;
      }
      return JSON.parse(userInfo);
    } catch (error) {
      console.error('获取用户信息失败:', error);
      return null;
    }
  },

  /**
   * 清除认证数据
   */
  async clearAuthData(): Promise<void> {
    await AsyncStorage.removeItem(TOKEN_KEYS.ACCESS_TOKEN);
    await AsyncStorage.removeItem(TOKEN_KEYS.REFRESH_TOKEN);
    await AsyncStorage.removeItem(TOKEN_KEYS.USER_INFO);
  },

  /**
   * 检查是否已登录
   */
  async isAuthenticated(): Promise<boolean> {
    const accessToken = await this.getAccessToken();
    return !!accessToken;
  },

  /**
   * 获取订阅状态
   */
  async getSubscriptionStatus(): Promise<ApiResponse<{
    type: 'none' | 'monthly' | 'yearly';
    expiresAt?: string;
    isActive: boolean;
  }>> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.SUBSCRIPTION.CURRENT}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return await response.json();
    } catch (error) {
      console.error('获取订阅状态失败:', error);
      return {
        success: false,
        message: '网络错误，请稍后重试',
      };
    }
  },

  /**
   * 创建订阅订单
   */
  async createSubscriptionOrder(data: {
    planType: 'monthly' | 'yearly';
  }): Promise<ApiResponse<{
    orderId: string;
    amount: number;
    planType: string;
  }>> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${API_BASE_URL}/subscription/create`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      });

      return await response.json();
    } catch (error) {
      console.error('创建订阅订单失败:', error);
      return {
        success: false,
        message: '网络错误，请稍后重试',
      };
    }
  },

  /**
   * 验证订阅支付
   */
  async verifySubscriptionPayment(data: {
    orderId: string;
    paymentProof?: string;
  }): Promise<ApiResponse<{
    success: boolean;
    subscriptionType: string;
    expiresAt: string;
  }>> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${API_BASE_URL}/subscription/verify`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(data),
      });

      return await response.json();
    } catch (error) {
      console.error('验证订阅支付失败:', error);
      return {
        success: false,
        message: '网络错误，请稍后重试',
      };
    }
  },

  /**
   * 获取用户月度额度
   */
  async getUserQuota(): Promise<ApiResponse<{
    image: { used: number; limit: number };
    video: { used: number; limit: number };
    longVideo: { used: number; limit: number };
    resetAt: string;
  }>> {
    try {
      const accessToken = await this.getAccessToken();

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.USER.STATS}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      return await response.json();
    } catch (error) {
      console.error('获取用户额度失败:', error);
      return {
        success: false,
        message: '网络错误，请稍后重试',
      };
    }
  },

  /**
   * 更新用户资料
   * @param profileData 用户资料数据
   */
  async updateProfile(profileData: {
    nickname?: string;
    gender?: 'male' | 'female' | 'other';
    age?: number;
    avatarUrl?: string;
  }): Promise<ApiResponse<User>> {
    try {
      const accessToken = await this.getAccessToken();

      if (!accessToken) {
        return {
          success: false,
          message: '未登录',
        };
      }

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.USER.PROFILE}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(profileData),
      });

      const result: ApiResponse<User> = await response.json();

      if (isSuccess(result.code) && result.data) {
        // 更新本地存储的用户信息
        await this.saveUserInfo(result.data);
        return {
          success: true,
          data: result.data,
          message: result.message || '资料更新成功',
        };
      }

      return {
        success: false,
        message: result.message || '更新资料失败',
      };
    } catch (error) {
      console.error('更新用户资料失败:', error);
      return {
        success: false,
        message: '网络错误，请稍后重试',
      };
    }
  },
};
