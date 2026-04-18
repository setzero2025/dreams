import { API_BASE_URL } from '../../config/api';
import { fetchWithAuth } from './apiInterceptor';

// API响应格式
export interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
}

// 音频上传响应
export interface AudioUploadResponse {
  audioId: string;
  url: string;
  duration?: number;
}

// 音频转写响应
export interface AudioTranscribeResponse extends AudioUploadResponse {
  text: string;
}

// 梦境音频信息
export interface DreamAudioInfo {
  audioId: string;
  url: string;
  duration?: number;
  isToneExtracted?: boolean;
}

/**
 * 音频API服务
 * 处理音频上传、语音转文字等功能
 */
export const audioApi = {
  /**
   * 上传音频文件
   * @param audioUri 音频文件URI
   * @param duration 音频时长（秒）
   * @returns 上传结果
   */
  async uploadAudio(audioUri: string, duration?: number): Promise<ApiResponse<AudioUploadResponse>> {
    // 读取文件为blob
    const response = await fetch(audioUri);
    const blob = await response.blob();

    // 创建FormData
    const formData = new FormData();
    formData.append('audio', blob, 'recording.wav');
    if (duration) {
      formData.append('duration', duration.toString());
    }

    const apiResponse = await fetchWithAuth(`${API_BASE_URL}/audio/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        // 不设置Content-Type，让浏览器自动设置multipart/form-data
      },
    });

    return apiResponse.json();
  },

  /**
   * 上传音频并转文字
   * @param audioUri 音频文件URI
   * @param duration 音频时长（秒）
   * @param dreamId 关联的梦境ID（可选）
   * @returns 上传和转写结果
   */
  async transcribeAudio(
    audioUri: string,
    duration?: number,
    dreamId?: string
  ): Promise<ApiResponse<AudioTranscribeResponse>> {
    // 读取文件为blob
    const response = await fetch(audioUri);
    const blob = await response.blob();

    // 创建FormData
    const formData = new FormData();
    formData.append('audio', blob, 'recording.wav');
    if (duration) {
      formData.append('duration', duration.toString());
    }
    if (dreamId) {
      formData.append('dreamId', dreamId);
    }

    const apiResponse = await fetchWithAuth(`${API_BASE_URL}/audio/transcribe`, {
      method: 'POST',
      body: formData,
      headers: {
        // 不设置Content-Type，让浏览器自动设置multipart/form-data
      },
    });

    return apiResponse.json();
  },

  /**
   * 上传梦境关联的音频并转文字
   * @param dreamId 梦境ID
   * @param audioUri 音频文件URI
   * @param duration 音频时长（秒）
   * @returns 上传和转写结果
   */
  async uploadDreamAudio(
    dreamId: string,
    audioUri: string,
    duration?: number
  ): Promise<ApiResponse<AudioTranscribeResponse>> {
    // 读取文件为blob
    const response = await fetch(audioUri);
    const blob = await response.blob();

    // 创建FormData
    const formData = new FormData();
    formData.append('audio', blob, 'recording.wav');
    if (duration) {
      formData.append('duration', duration.toString());
    }

    const apiResponse = await fetchWithAuth(`${API_BASE_URL}/audio/dream/${dreamId}/upload`, {
      method: 'POST',
      body: formData,
      headers: {
        // 不设置Content-Type，让浏览器自动设置multipart/form-data
      },
    });

    return apiResponse.json();
  },

  /**
   * 获取梦境关联的音频
   * @param dreamId 梦境ID
   * @returns 音频信息
   */
  async getDreamAudio(dreamId: string): Promise<ApiResponse<DreamAudioInfo>> {
    const response = await fetchWithAuth(`${API_BASE_URL}/audio/dream/${dreamId}`, {
      method: 'GET',
    });

    return response.json();
  },
};
