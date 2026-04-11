import { Dream, DreamInput } from '../../types';
import { dreamApi } from '../api/dreamApi';

/**
 * 云端梦境存储服务（调用后端 API）
 * 适用于已登录用户，数据存储在 Supabase PostgreSQL
 */
export class CloudDreamStorage {
  /**
   * 获取所有梦境
   */
  async getDreams(): Promise<Dream[]> {
    try {
      console.log('【CloudDreamStorage】开始获取梦境列表');
      const response = await dreamApi.getDreams();
      console.log('【CloudDreamStorage】API响应:', response.code, response.message);
      console.log('【CloudDreamStorage】API响应data:', response.data);
      
      // 后端返回 code 200 表示成功
      if ((response.code === 200 || response.code === 201) && response.data) {
        const list = response.data.list || response.data;
        console.log('【CloudDreamStorage】获取到梦境数量:', list?.length, 'list:', list);
        if (!list || !Array.isArray(list)) {
          console.error('【CloudDreamStorage】list不是数组:', list);
          return [];
        }
        const mappedDreams = list.map((item, index) => {
          console.log(`【CloudDreamStorage】映射第${index}个梦境:`, item);
          return this.mapApiDreamToDream(item);
        });
        console.log('【CloudDreamStorage】映射后的梦境:', mappedDreams);
        return mappedDreams;
      }
      console.log('【CloudDreamStorage】响应不成功或没有数据');
      return [];
    } catch (error) {
      console.error('【CloudDreamStorage】获取云端梦境失败:', error);
      return [];
    }
  }

  /**
   * 根据ID获取梦境
   */
  async getDreamById(id: string): Promise<Dream | null> {
    try {
      const response = await dreamApi.getDreamById(id);
      // 后端返回 code 200 表示成功
      if ((response.code === 200 || response.code === 201) && response.data) {
        return this.mapApiDreamToDream(response.data);
      }
      return null;
    } catch (error) {
      console.error('获取云端梦境详情失败:', error);
      return null;
    }
  }

  /**
   * 保存梦境
   */
  async saveDream(dreamInput: DreamInput): Promise<Dream> {
    try {
      const dreamData = {
        title: dreamInput.title,
        content: dreamInput.content,
        contentType: dreamInput.contentType || 'text',
        voiceUrl: dreamInput.voiceUrl,
        voiceDuration: dreamInput.voiceDuration,
        moodRating: dreamInput.moodRating,
        dreamDate: dreamInput.dreamDate,
        tags: dreamInput.tags || [],
      };

      const response = await dreamApi.createDream(dreamData);
      // 后端返回 code 201 表示创建成功
      if ((response.code === 200 || response.code === 201) && response.data) {
        return this.mapApiDreamToDream(response.data);
      }
      throw new Error(response.message || '保存云端梦境失败');
    } catch (error) {
      console.error('保存云端梦境失败:', error);
      throw error;
    }
  }

  /**
   * 更新梦境
   */
  async updateDream(id: string, updates: Partial<DreamInput>): Promise<Dream | null> {
    try {
      const response = await dreamApi.updateDream(id, updates);
      // 后端返回 code 200 表示成功
      if ((response.code === 200 || response.code === 201) && response.data) {
        return this.mapApiDreamToDream(response.data);
      }
      return null;
    } catch (error) {
      console.error('更新云端梦境失败:', error);
      throw error;
    }
  }

  /**
   * 删除梦境
   */
  async deleteDream(id: string): Promise<boolean> {
    try {
      const response = await dreamApi.deleteDream(id);
      // 后端返回 code 200 或 204 表示成功
      return response.code === 200 || response.code === 204;
    } catch (error) {
      console.error('删除云端梦境失败:', error);
      throw error;
    }
  }

  /**
   * 清空所有梦境
   */
  async clearAllDreams(): Promise<boolean> {
    try {
      // 获取所有梦境并逐个删除
      const dreams = await this.getDreams();
      for (const dream of dreams) {
        await this.deleteDream(dream.id);
      }
      return true;
    } catch (error) {
      console.error('清空云端梦境失败:', error);
      throw error;
    }
  }

  /**
   * 搜索梦境
   */
  async searchDreams(query: string): Promise<Dream[]> {
    try {
      // 获取所有梦境后在本地搜索
      const dreams = await this.getDreams();
      const lowerQuery = query.toLowerCase();
      
      return dreams.filter(dream => 
        dream.title.toLowerCase().includes(lowerQuery) ||
        dream.content.toLowerCase().includes(lowerQuery) ||
        dream.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    } catch (error) {
      console.error('搜索云端梦境失败:', error);
      return [];
    }
  }

  /**
   * 按标签筛选梦境
   */
  async filterByTag(tag: string): Promise<Dream[]> {
    try {
      // 获取所有梦境后在本地筛选
      const dreams = await this.getDreams();
      return dreams.filter(dream => 
        dream.tags?.includes(tag)
      );
    } catch (error) {
      console.error('筛选云端梦境失败:', error);
      return [];
    }
  }

  /**
   * 将 API 返回的梦境数据转换为前端 Dream 类型
   * 后端可能返回驼峰或下划线命名，需要兼容处理
   */
  private mapApiDreamToDream(apiDream: any): Dream {
    // 调试日志
    console.log('【CloudDreamStorage】映射梦境数据:', apiDream);

    const dream: Dream = {
      id: apiDream.id,
      title: apiDream.title,
      content: apiDream.content,
      contentType: apiDream.contentType || apiDream.content_type || 'text',
      voiceUrl: apiDream.voiceUrl || apiDream.voice_url,
      voiceDuration: apiDream.voiceDuration || apiDream.voice_duration,
      moodRating: apiDream.moodRating || apiDream.mood_rating || 3,
      emotions: apiDream.emotions || [],
      tags: apiDream.tags || [],
      dreamDate: apiDream.dreamDate || apiDream.dream_date || apiDream.createdAt || apiDream.created_at,
      createdAt: apiDream.createdAt || apiDream.created_at,
    };

    console.log('【CloudDreamStorage】映射结果:', dream);
    return dream;
  }
}

// 导出单例
export const cloudDreamStorage = new CloudDreamStorage();
