import AsyncStorage from '@react-native-async-storage/async-storage';
import { Dream, DreamInput } from '../../types';

const DREAMS_KEY = '@dreams';

// 内存存储作为降级方案
let memoryStorage: { [key: string]: string } = {};

/**
 * 安全的存储操作，失败时回退到内存存储
 */
const safeStorage = {
  async getItem(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(key);
    } catch (error) {
      console.warn('AsyncStorage 读取失败，使用内存存储:', error);
      return memoryStorage[key] || null;
    }
  },

  async setItem(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(key, value);
    } catch (error) {
      console.warn('AsyncStorage 写入失败，使用内存存储:', error);
      memoryStorage[key] = value;
    }
  },

  async removeItem(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(key);
    } catch (error) {
      console.warn('AsyncStorage 删除失败，使用内存存储:', error);
      delete memoryStorage[key];
    }
  },
};

/**
 * 本地梦境存储服务（使用 AsyncStorage）
 * 适用于未登录用户，数据存储在本地
 */
export class LocalDreamStorage {
  /**
   * 获取所有梦境
   */
  async getDreams(): Promise<Dream[]> {
    try {
      const dreamsJson = await safeStorage.getItem(DREAMS_KEY);
      if (!dreamsJson) return [];

      const dreams: Dream[] = JSON.parse(dreamsJson);
      // 按日期降序排列
      return dreams.sort((a, b) =>
        new Date(b.dreamDate).getTime() - new Date(a.dreamDate).getTime()
      );
    } catch (error) {
      console.error('获取本地梦境失败:', error);
      return [];
    }
  }

  /**
   * 根据ID获取梦境
   */
  async getDreamById(id: string): Promise<Dream | null> {
    try {
      const dreams = await this.getDreams();
      return dreams.find(d => d.id === id) || null;
    } catch (error) {
      console.error('获取本地梦境详情失败:', error);
      return null;
    }
  }

  /**
   * 保存梦境
   */
  async saveDream(dreamInput: DreamInput): Promise<Dream> {
    try {
      const dreams = await this.getDreams();
      
      const newDream: Dream = {
        ...dreamInput,
        id: dreamInput.id || `local_${Date.now()}`,
        createdAt: dreamInput.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // 检查是否已存在（更新）
      const existingIndex = dreams.findIndex(d => d.id === newDream.id);
      if (existingIndex >= 0) {
        dreams[existingIndex] = newDream;
      } else {
        dreams.unshift(newDream);
      }

      await safeStorage.setItem(DREAMS_KEY, JSON.stringify(dreams));
      return newDream;
    } catch (error) {
      console.error('保存本地梦境失败:', error);
      throw error;
    }
  }

  /**
   * 更新梦境
   */
  async updateDream(id: string, updates: Partial<DreamInput>): Promise<Dream | null> {
    try {
      const dreams = await this.getDreams();
      const index = dreams.findIndex(d => d.id === id);

      if (index === -1) return null;

      dreams[index] = {
        ...dreams[index],
        ...updates,
        updatedAt: new Date().toISOString(),
      };

      await safeStorage.setItem(DREAMS_KEY, JSON.stringify(dreams));
      return dreams[index];
    } catch (error) {
      console.error('更新本地梦境失败:', error);
      throw error;
    }
  }

  /**
   * 删除梦境
   */
  async deleteDream(id: string): Promise<boolean> {
    try {
      const dreams = await this.getDreams();
      const filteredDreams = dreams.filter(d => d.id !== id);

      await safeStorage.setItem(DREAMS_KEY, JSON.stringify(filteredDreams));
      return true;
    } catch (error) {
      console.error('删除本地梦境失败:', error);
      throw error;
    }
  }

  /**
   * 清空所有梦境
   */
  async clearAllDreams(): Promise<boolean> {
    try {
      await safeStorage.removeItem(DREAMS_KEY);
      return true;
    } catch (error) {
      console.error('清空本地梦境失败:', error);
      throw error;
    }
  }

  /**
   * 搜索梦境
   */
  async searchDreams(query: string): Promise<Dream[]> {
    try {
      const dreams = await this.getDreams();
      const lowerQuery = query.toLowerCase();
      
      return dreams.filter(dream => 
        dream.title.toLowerCase().includes(lowerQuery) ||
        dream.content.toLowerCase().includes(lowerQuery) ||
        dream.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    } catch (error) {
      console.error('搜索本地梦境失败:', error);
      return [];
    }
  }

  /**
   * 按标签筛选梦境
   */
  async filterByTag(tag: string): Promise<Dream[]> {
    try {
      const dreams = await this.getDreams();
      return dreams.filter(dream => 
        dream.tags?.includes(tag)
      );
    } catch (error) {
      console.error('筛选本地梦境失败:', error);
      return [];
    }
  }
}

// 导出单例
export const localDreamStorage = new LocalDreamStorage();
