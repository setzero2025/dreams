import { API_BASE_URL, API_ENDPOINTS } from '../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface CreationItem {
  id: string;
  type: 'image' | 'script' | 'video' | 'video_long';
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
  status?: string;
  style?: string;
  createdAt: string;
  boundScriptId?: string;
  boundVideoId?: string;
}

const CREATIONS_KEY = '@creations';
// Token 存储键名 - 必须与 authApi.ts 中保持一致
const AUTH_KEY = 'access_token';

// 判断是否为本地梦境（未登录用户创建的梦境）
// 本地梦境ID格式：dream_时间戳 或 local_前缀
// 注意：即使是UUID格式，如果梦境是本地创建的（未同步到云端），也视为本地梦境
function isLocalDream(dreamId: string): boolean {
  // 如果是dream_或local_开头，肯定是本地梦境
  if (dreamId.startsWith('dream_') || dreamId.startsWith('local_')) {
    return true;
  }
  
  // 对于其他格式（包括UUID），需要检查是否真的是云端梦境
  // 这里我们假设：如果ID不是标准UUID格式，就是本地梦境
  // 标准UUID格式：8-4-4-4-12 的十六进制字符串
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  
  // 如果不是标准UUID格式，认为是本地梦境
  if (!uuidRegex.test(dreamId)) {
    return true;
  }
  
  // 即使是UUID格式，我们也保守地认为是本地梦境
  // 因为无法确定这个UUID是否真的存在于后端数据库
  // 只有当明确知道是云端梦境时，才返回false
  // 这里我们可以通过其他方式判断，比如检查梦境对象是否有userId等字段
  
  // 暂时保守处理：所有梦境都视为本地梦境，只保存到本地
  // 这样可以避免外键约束错误
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

// 基础请求函数
async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const token = await getAuthToken();

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: '请求失败' }));
    throw new Error(error.message || `HTTP ${response.status}`);
  }

  return response.json();
}

// 本地存储操作
const localStorage = {
  async getAll(): Promise<CreationItem[]> {
    try {
      const data = await AsyncStorage.getItem(CREATIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('读取本地创作失败:', error);
      return [];
    }
  },

  async save(creation: CreationItem): Promise<void> {
    try {
      const creations = await this.getAll();
      const index = creations.findIndex(c => c.id === creation.id);
      if (index >= 0) {
        creations[index] = creation;
      } else {
        creations.push(creation);
      }
      await AsyncStorage.setItem(CREATIONS_KEY, JSON.stringify(creations));
    } catch (error) {
      console.error('保存本地创作失败:', error);
      throw error;
    }
  },

  async delete(id: string): Promise<void> {
    try {
      const creations = await this.getAll();
      const filtered = creations.filter(c => c.id !== id);
      await AsyncStorage.setItem(CREATIONS_KEY, JSON.stringify(filtered));
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
      await AsyncStorage.removeItem(CREATIONS_KEY);
    } catch (error) {
      console.error('清空本地创作失败:', error);
      throw error;
    }
  },
};

class CreationStorageService {
  // 获取所有创作
  async getAllCreations(): Promise<CreationItem[]> {
    try {
      const token = await getAuthToken();
      
      // 从本地获取数据
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
      // 出错时回退到本地存储
      return await localStorage.getAll();
    }
  }

  // 保存创作
  async saveCreation(creation: CreationItem): Promise<void> {
    try {
      // 如果是本地梦境，保存到本地
      if (isLocalDream(creation.dreamId)) {
        await localStorage.save(creation);
        return;
      }

      const token = await getAuthToken();
      
      // 如果有 token，保存到云端
      if (token) {
        await apiRequest<{
          success: boolean;
          message?: string;
          data: any;
        }>(API_ENDPOINTS.CREATIONS.CREATE, {
          method: 'POST',
          body: JSON.stringify(creation),
        });
      } else {
        // 否则保存到本地
        await localStorage.save(creation);
      }
    } catch (error) {
      console.error('保存创作失败:', error);
      // 出错时保存到本地
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
    // 如果是本地梦境，直接从本地获取
    if (isLocalDream(dreamId)) {
      return await localStorage.getByDreamId(dreamId);
    }

    try {
      const token = await getAuthToken();
      
      // 如果有 token，从云端获取
      if (token) {
        const response = await apiRequest<{
          success: boolean;
          data: CreationItem[];
          message?: string;
        }>(API_ENDPOINTS.CREATIONS.BY_DREAM(dreamId));

        if (response.success) {
          return response.data;
        }
      }
      
      // 否则从本地获取
      return await localStorage.getByDreamId(dreamId);
    } catch (error) {
      console.error('获取梦境创作失败:', error);
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
}

export const creationStorageService = new CreationStorageService();
