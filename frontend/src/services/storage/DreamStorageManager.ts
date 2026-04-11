import { Dream, DreamInput } from '../../types';
import { localDreamStorage } from './DreamStorageService';
import { cloudDreamStorage } from './CloudDreamStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Token 存储键名 - 必须与 authApi.ts 中保持一致
const AUTH_KEY = 'access_token';
const USER_KEY = 'user_info';

/**
 * 梦境存储管理器
 * 根据用户登录状态自动切换本地存储和云端存储
 * 
 * 未登录用户：使用 AsyncStorage（本地存储）
 * 已登录用户：使用 Supabase PostgreSQL（云端存储）
 */
class DreamStorageManager {
  /**
   * 检查用户是否已登录
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      const token = await AsyncStorage.getItem(AUTH_KEY);
      console.log('【DreamStorageManager】读取到的token:', token);
      // 只要有token就认为已登录（包括开发环境的mock token）
      const isLoggedIn = !!token;
      console.log('【DreamStorageManager】isLoggedIn结果:', isLoggedIn);
      return isLoggedIn;
    } catch (error) {
      console.error('【DreamStorageManager】读取token失败:', error);
      return false;
    }
  }

  /**
   * 获取当前使用的存储服务
   */
  private getStorage() {
    // 同步检查，实际使用时应该先调用 isLoggedIn()
    return localDreamStorage;
  }

  /**
   * 获取所有梦境
   * 根据登录状态自动选择存储方式
   */
  async getDreams(): Promise<Dream[]> {
    const isUserLoggedIn = await this.isLoggedIn();
    console.log('【DreamStorageManager】isUserLoggedIn:', isUserLoggedIn);
    
    if (isUserLoggedIn) {
      console.log('【存储模式】云端存储 - 获取梦境列表');
      const dreams = await cloudDreamStorage.getDreams();
      console.log('【DreamStorageManager】云端返回梦境数量:', dreams.length);
      return dreams;
    } else {
      console.log('【存储模式】本地存储 - 获取梦境列表');
      const dreams = await localDreamStorage.getDreams();
      console.log('【DreamStorageManager】本地返回梦境数量:', dreams.length);
      return dreams;
    }
  }

  /**
   * 根据ID获取梦境
   */
  async getDreamById(id: string): Promise<Dream | null> {
    const isUserLoggedIn = await this.isLoggedIn();
    
    if (isUserLoggedIn) {
      return cloudDreamStorage.getDreamById(id);
    } else {
      return localDreamStorage.getDreamById(id);
    }
  }

  /**
   * 保存梦境
   */
  async saveDream(dreamInput: DreamInput): Promise<Dream> {
    const isUserLoggedIn = await this.isLoggedIn();
    
    if (isUserLoggedIn) {
      console.log('【存储模式】云端存储 - 保存梦境');
      return cloudDreamStorage.saveDream(dreamInput);
    } else {
      console.log('【存储模式】本地存储 - 保存梦境');
      return localDreamStorage.saveDream(dreamInput);
    }
  }

  /**
   * 更新梦境
   */
  async updateDream(id: string, updates: Partial<DreamInput>): Promise<Dream | null> {
    const isUserLoggedIn = await this.isLoggedIn();
    
    if (isUserLoggedIn) {
      return cloudDreamStorage.updateDream(id, updates);
    } else {
      return localDreamStorage.updateDream(id, updates);
    }
  }

  /**
   * 删除梦境
   */
  async deleteDream(id: string): Promise<boolean> {
    const isUserLoggedIn = await this.isLoggedIn();
    
    if (isUserLoggedIn) {
      return cloudDreamStorage.deleteDream(id);
    } else {
      return localDreamStorage.deleteDream(id);
    }
  }

  /**
   * 清空所有梦境
   */
  async clearAllDreams(): Promise<boolean> {
    const isUserLoggedIn = await this.isLoggedIn();
    
    if (isUserLoggedIn) {
      return cloudDreamStorage.clearAllDreams();
    } else {
      return localDreamStorage.clearAllDreams();
    }
  }

  /**
   * 搜索梦境
   */
  async searchDreams(query: string): Promise<Dream[]> {
    const isUserLoggedIn = await this.isLoggedIn();
    
    if (isUserLoggedIn) {
      return cloudDreamStorage.searchDreams(query);
    } else {
      return localDreamStorage.searchDreams(query);
    }
  }

  /**
   * 按标签筛选梦境
   */
  async filterByTag(tag: string): Promise<Dream[]> {
    const isUserLoggedIn = await this.isLoggedIn();
    
    if (isUserLoggedIn) {
      return cloudDreamStorage.filterByTag(tag);
    } else {
      return localDreamStorage.filterByTag(tag);
    }
  }

  /**
   * 用户登录后，将本地数据同步到云端
   * 这是一个可选功能，可以在用户首次登录时调用
   */
  async syncLocalToCloud(): Promise<{ synced: number; failed: number }> {
    try {
      const localDreams = await localDreamStorage.getDreams();
      let synced = 0;
      let failed = 0;

      for (const dream of localDreams) {
        try {
          // 将本地梦境保存到云端
          await cloudDreamStorage.saveDream({
            title: dream.title,
            content: dream.content,
            contentType: dream.contentType,
            voiceUrl: dream.voiceUrl,
            voiceDuration: dream.voiceDuration,
            moodRating: dream.moodRating,
            dreamDate: dream.dreamDate,
            tags: dream.tags,
          });
          synced++;
        } catch (error) {
          console.error('同步梦境到云端失败:', dream.id, error);
          failed++;
        }
      }

      console.log(`【数据同步】成功: ${synced}, 失败: ${failed}`);
      
      // 同步完成后，清空本地数据（可选）
      // await localDreamStorage.clearAllDreams();
      
      return { synced, failed };
    } catch (error) {
      console.error('同步本地数据到云端失败:', error);
      return { synced: 0, failed: 0 };
    }
  }

  /**
   * 获取存储模式信息
   */
  async getStorageMode(): Promise<{ mode: 'local' | 'cloud'; isLoggedIn: boolean }> {
    const loggedIn = await this.isLoggedIn();
    return {
      mode: loggedIn ? 'cloud' : 'local',
      isLoggedIn: loggedIn,
    };
  }
}

// 导出单例
export const dreamStorageManager = new DreamStorageManager();
