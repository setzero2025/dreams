import { API_BASE_URL } from '../../config/api';
import { fetchWithAuth } from './apiInterceptor';

export interface DreamData {
  title: string;
  content: string;
  contentType?: string;
  voiceUrl?: string;
  voiceDuration?: number;
  moodRating?: number;
  dreamDate?: string;
  tags?: string[];
}

// 后端 API 响应格式
export interface ApiResponse<T> {
  code: number;        // 业务状态码 (200=成功, 201=创建成功)
  message: string;     // 提示信息
  data: T;            // 响应数据
  timestamp: number;   // 时间戳
  requestId?: string;  // 请求追踪ID
}

// 判断响应是否成功
export const isSuccess = (code: number): boolean => code === 200 || code === 201;

/**
 * 梦境 API 服务
 * 使用 fetchWithAuth 自动处理 401 错误和 token 刷新
 */
export const dreamApi = {
  /**
   * 获取所有梦境
   */
  async getDreams(): Promise<ApiResponse<any[]>> {
    const response = await fetchWithAuth(`${API_BASE_URL}/dreams`, {
      method: 'GET',
    });
    return response.json();
  },

  /**
   * 根据ID获取梦境
   */
  async getDreamById(id: string): Promise<ApiResponse<any>> {
    const response = await fetchWithAuth(`${API_BASE_URL}/dreams/${id}`, {
      method: 'GET',
    });
    return response.json();
  },

  /**
   * 创建梦境
   */
  async createDream(dreamData: DreamData): Promise<ApiResponse<any>> {
    const response = await fetchWithAuth(`${API_BASE_URL}/dreams`, {
      method: 'POST',
      body: JSON.stringify(dreamData),
    });
    return response.json();
  },

  /**
   * 更新梦境
   */
  async updateDream(id: string, updates: Partial<DreamData>): Promise<ApiResponse<any>> {
    const response = await fetchWithAuth(`${API_BASE_URL}/dreams/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
    return response.json();
  },

  /**
   * 删除梦境
   */
  async deleteDream(id: string): Promise<ApiResponse<void>> {
    const response = await fetchWithAuth(`${API_BASE_URL}/dreams/${id}`, {
      method: 'DELETE',
    });
    return response.json();
  },
};
