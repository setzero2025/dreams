import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CreationItem {
  id: string;
  // 创作类型：图片、剧本、视频、长视频、梦境解读
  type: 'image' | 'script' | 'video' | 'video_long' | 'interpretation';
  title: string;
  dreamTitle: string;
  dreamId: string;
  // AI生成时使用的提示词，用于存储发送给AI模型的原始提示
  prompt?: string;
  thumbnail?: string;
  imageUrl?: string;
  videoUrl?: string;
  coverUrl?: string;
  script?: {
    title: string;
    scenes: Array<{
      id: string;
      title: string;
      description: string;
      duration: number;
      visual: string;
      narration: string;
      mood: string;
    }>;
  };
  // 梦境解读相关字段
  interpretation?: string;
  symbols?: Array<{ symbol: string; meaning: string; context: string }>;
  emotions?: { primary: string; intensity: number; description: string } | Array<{ primary: string; intensity: number; description: string }>;
  suggestions?: string[];
  status?: string;
  style?: string;
  createdAt: string;
  boundScriptId?: string;
  boundVideoId?: string;
  // 用户ID，用于本地数据隔离
  userId?: string;
}

// 存储键名
const CREATIONS_KEY_PREFIX = '@creations';
const ANONYMOUS_CREATIONS_KEY = '@creations_anonymous';
// Token 存储键名 - 必须与 authApi.ts 中保持一致
const AUTH_KEY = 'access_token';
const USER_KEY = 'user_info';

// 判断是否为本地梦境（未登录用户创建的梦境）
// 本地梦境ID格式：dream_时间戳 或 local_前缀
// 云端梦境ID格式：标准UUID格式
function isLocalDream(dreamId: string): boolean {
  // 如果是dream_或local_开头，肯定是本地梦境
  if (dreamId.startsWith('dream_') || dreamId.startsWith('local_')) {
    return true;
  }
  
  // 标准UUID格式：8-4-4-4-12 的十六进制字符串
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  // 如果是标准UUID格式，认为是云端梦境
  // 这样可以确保云端梦境的作品能正确保存到后端
  if (uuidRegex.test(dreamId)) {
    return false;
  }
  
  // 其他格式视为本地梦境
  return true;
}

// 辅助函数：获取认证 token
async function getAuthToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(AUTH_KEY);
    return token;
  } catch (error) {
    console.warn('获取认证 token 失败:', error);
    return null;
  }
}

// 辅助函数：获取当前用户ID
async function getCurrentUserId(): Promise<string | null> {
  try {
    const userInfo = await AsyncStorage.getItem(USER_KEY);
    if (userInfo) {
      const user = JSON.parse(userInfo);
      return user.id || null;
    }
    return null;
  } catch (error) {
    console.warn('获取用户ID失败:', error);
    return null;
  }
}

// 辅助函数：判断是否已登录
async function isLoggedIn(): Promise<boolean> {
  const token = await getAuthToken();
  return !!token;
}

// 基础请求函数
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();
  const url = `${API_BASE_URL}${endpoint}`;

  console.log('【CreationStorageService】API请求:', url, 'Token存在:', !!token);

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    console.log('【CreationStorageService】API响应状态:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('【CreationStorageService】API请求失败:', response.status, errorText);
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    console.log('【CreationStorageService】API响应数据:', JSON.stringify(data, null, 2));
    return data;
  } catch (error) {
    console.error('【CreationStorageService】API请求异常:', error);
    throw error;
  }
}

// 本地存储操作 - 支持用户隔离
const localStorage = {
  // 获取存储键名（根据用户ID隔离）
  async getStorageKey(): Promise<string> {
    const userId = await getCurrentUserId();
    if (userId) {
      return `${CREATIONS_KEY_PREFIX}_${userId}`;
    }
    return ANONYMOUS_CREATIONS_KEY;
  },

  async getAll(): Promise<CreationItem[]> {
    try {
      const key = await this.getStorageKey();
      const data = await AsyncStorage.getItem(key);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('读取本地创作失败:', error);
      return [];
    }
  },

  async save(creation: CreationItem): Promise<void> {
    try {
      // 添加用户ID到创作数据
      const userId = await getCurrentUserId();
      const creationWithUser = { ...creation, userId: userId || 'anonymous' };

      const key = await this.getStorageKey();
      const creations = await this.getAll();
      const index = creations.findIndex(c => c.id === creation.id);
      if (index >= 0) {
        creations[index] = creationWithUser;
      } else {
        creations.push(creationWithUser);
      }
      await AsyncStorage.setItem(key, JSON.stringify(creations));
    } catch (error) {
      console.error('保存本地创作失败:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const key = await this.getStorageKey();
      const creations = await this.getAll();
      const filtered = creations.filter(c => c.id !== id);
      await AsyncStorage.setItem(key, JSON.stringify(filtered));
    } catch (error) {
      console.error('删除本地创作失败:', error);
      throw error;
    }
  },

  async getByDreamId(dreamId: string): Promise<CreationItem[]> {
    try {
      const creations = await this.getAll();
      return creations.filter(c => c.dreamId === dreamId);
    } catch (error) {
      console.error('获取本地梦境创作失败:', error);
      return [];
    }
  },

  async getByType(type: CreationItem['type']): Promise<CreationItem[]> {
    try {
      const creations = await this.getAll();
      return creations.filter(c => c.type === type);
    } catch (error) {
      console.error('获取本地类型创作失败:', error);
      return [];
    }
  },

  async clearAll(): Promise<void> {
    try {
      const key = await this.getStorageKey();
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.error('清空本地创作失败:', error);
      throw error;
    }
  },

  // 清理匿名用户数据（登录后调用）
  async migrateAnonymousData(userId: string): Promise<CreationItem[]> {
    try {
      const anonymousData = await AsyncStorage.getItem(ANONYMOUS_CREATIONS_KEY);
      if (!anonymousData) return [];

      const creations: CreationItem[] = JSON.parse(anonymousData);
      const userKey = `${CREATIONS_KEY_PREFIX}_${userId}`;
      
      // 将匿名数据迁移到用户名下
      const creationsWithUser = creations.map(c => ({ ...c, userId }));
      await AsyncStorage.setItem(userKey, JSON.stringify(creationsWithUser));
      
      // 清空匿名数据
      await AsyncStorage.removeItem(ANONYMOUS_CREATIONS_KEY);
      
      console.log('【CreationStorage】匿名数据已迁移到用户:', userId, '数量:', creations.length);
      return creationsWithUser;
    } catch (error) {
      console.error('迁移匿名数据失败:', error);
      return [];
    }
  },
};

class CreationStorageService {
  // 获取所有创作
  async getAllCreations(): Promise<CreationItem[]> {
    try {
      const loggedIn = await isLoggedIn();
      
      // 未登录时返回空数组（不显示任何创作）
      if (!loggedIn) {
        console.log('【CreationStorage】未登录，返回空创作列表');
        return [];
      }
      
      const token = await getAuthToken();
      
      // 从本地获取数据（已按用户隔离）
      const localCreations = await localStorage.getAll();
      console.log('【CreationStorage】本地创作数量:', localCreations.length);
      
      // 如果有 token，也从云端获取并合并
      if (token) {
        try {
          const response = await apiRequest<{
            success: boolean;
            data: CreationItem[];
            message?: string;
          }>(API_ENDPOINTS.CREATIONS.LIST);

          if (response.success && response.data) {
            console.log('【CreationStorage】云端创作数量:', response.data.length);
            // 合并云端和本地数据，以云端数据为主，本地数据补充
            const cloudIds = new Set(response.data.map(c => c.id));
            const uniqueLocalCreations = localCreations.filter(c => !cloudIds.has(c.id));
            const mergedCreations = [...response.data, ...uniqueLocalCreations];
            console.log('【CreationStorage】合并后创作数量:', mergedCreations.length);
            return mergedCreations;
          }
        } catch (cloudError) {
          console.error('【CreationStorage】从云端获取失败:', cloudError);
          // 云端获取失败时，返回本地数据
        }
      }
      
      // 返回本地数据
      return localCreations;
    } catch (error) {
      console.error('获取创作列表失败:', error);
      // 出错时返回空数组（更安全）
      return [];
    }
  }

  // 保存创作
  async saveCreation(creation: CreationItem): Promise<void> {
    try {
      // 如果是本地梦境，保存到本地
      if (isLocalDream(creation.dreamId)) {
        console.log('【CreationStorage】本地梦境，保存到本地:', creation.dreamId);
        await localStorage.save(creation);
        return;
      }

      const token = await getAuthToken();
      
      // 如果有 token，尝试保存到云端
      if (token) {
        try {
          await apiRequest<{
            success: boolean;
            message?: string;
            data: any;
          }>(API_ENDPOINTS.CREATIONS.CREATE, {
            method: 'POST',
            body: JSON.stringify(creation),
          });
          console.log('【CreationStorage】云端保存成功:', creation.id);
        } catch (apiError: any) {
          // 如果后端返回梦境不存在，降级保存到本地
          if (apiError.message?.includes('梦境不存在') || apiError.message?.includes('Dream not found')) {
            console.warn('【CreationStorage】梦境不存在于云端，降级保存到本地:', creation.dreamId);
            await localStorage.save(creation);
          } else {
            // 其他错误，继续抛出
            throw apiError;
          }
        }
      } else {
        // 没有 token，保存到本地（匿名用户）
        console.log('【CreationStorage】未登录，保存到本地:', creation.dreamId);
        await localStorage.save(creation);
      }
    } catch (error) {
      console.error('保存创作失败，降级保存到本地:', error);
      // 出错时降级保存到本地
      await localStorage.save(creation);
    }
  }

  // 删除创作
  async deleteCreation(id: string): Promise<void> {
    try {
      // 先尝试从本地删除
      const localCreations = await localStorage.getAll();
      const localCreation = localCreations.find(c => c.id === id);
      
      if (localCreation) {
        await localStorage.delete(id);
        return;
      }

      const token = await getAuthToken();
      
      // 如果有 token，从云端删除
      if (token) {
        await apiRequest<{
          success: boolean;
          message?: string;
        }>(API_ENDPOINTS.CREATIONS.DELETE(id), {
          method: 'DELETE',
        });
      }
    } catch (error) {
      console.error('删除创作失败:', error);
      throw error;
    }
  }

  // 根据梦境ID获取创作
  async getCreationsByDreamId(dreamId: string): Promise<CreationItem[]> {
    console.log('【CreationStorageService】获取梦境创作, dreamId:', dreamId, '是否本地:', isLocalDream(dreamId));
    
    // 如果是本地梦境，直接从本地获取
    if (isLocalDream(dreamId)) {
      console.log('【CreationStorageService】本地梦境，从本地存储获取');
      return await localStorage.getByDreamId(dreamId);
    }

    try {
      const token = await getAuthToken();
      console.log('【CreationStorageService】Token存在:', !!token);
      
      // 如果有 token，从云端获取
      if (token) {
        const endpoint = API_ENDPOINTS.CREATIONS.BY_DREAM(dreamId);
        console.log('【CreationStorageService】请求云端API:', endpoint);
        
        const response = await apiRequest<{
          success: boolean;
          data: CreationItem[];
          message?: string;
        }>(endpoint);

        console.log('【CreationStorageService】云端API返回:', JSON.stringify(response, null, 2));

        if (response.success) {
          console.log('【CreationStorageService】返回数据数量:', response.data?.length || 0);
          return response.data || [];
        } else {
          console.warn('【CreationStorageService】API返回失败:', response.message);
        }
      } else {
        console.log('【CreationStorageService】无Token，跳过云端请求');
      }
      
      // 否则从本地获取
      return await localStorage.getByDreamId(dreamId);
    } catch (error) {
      console.error('【CreationStorageService】获取梦境创作失败:', error);
      // 出错时回退到本地存储
      return await localStorage.getByDreamId(dreamId);
    }
  }

  // 根据类型获取创作
  async getCreationsByType(type: CreationItem['type']): Promise<CreationItem[]> {
    try {
      const token = await getAuthToken();
      
      // 如果有 token，从云端获取
      if (token) {
        const response = await apiRequest<{
          success: boolean;
          data: CreationItem[];
          message?: string;
        }>(API_ENDPOINTS.CREATIONS.BY_TYPE(type));

        if (response.success) {
          return response.data;
        }
      }
      
      // 否则从本地获取
      return await localStorage.getByType(type);
    } catch (error) {
      console.error('获取类型创作失败:', error);
      // 出错时回退到本地存储
      return await localStorage.getByType(type);
    }
  }

  // 清空所有创作
  async clearAllCreations(): Promise<void> {
    try {
      // 先清空本地
      await localStorage.clearAll();

      const token = await getAuthToken();
      
      // 如果有 token，也清空云端
      if (token) {
        await apiRequest<{
          success: boolean;
          message?: string;
        }>(API_ENDPOINTS.CREATIONS.CLEAR, {
          method: 'DELETE',
        });
      }
    } catch (error) {
      console.error('清空创作失败:', error);
      throw error;
    }
  }

  // 迁移匿名数据（登录后调用）
  async migrateAnonymousData(userId: string): Promise<CreationItem[]> {
    return await localStorage.migrateAnonymousData(userId);
  }

  // 获取登录状态
  async checkLoginStatus(): Promise<boolean> {
    return await isLoggedIn();
  }
}

export const creationStorageService = new CreationStorageService();
