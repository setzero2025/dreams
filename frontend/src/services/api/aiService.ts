import { API_BASE_URL, API_ENDPOINTS } from '../../config/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface GenerateImageOptions {
  prompt: string;
  style?: string;
}

interface GenerateVideoOptions {
  dreamContent: string;
  dreamTitle?: string;
}

interface GenerateScriptOptions {
  dreamContent: string;
  dreamTitle?: string;
}

interface GenerateLongVideoOptions {
  script: {
    title: string;
    scenes: Array<{
      scene_number: number;
      description: string;
      camera?: string;
      narration?: string;
      mood?: string;
      duration?: number;
    }>;
  };
  dreamTitle?: string;
  testMode?: boolean;
  testSceneCount?: number;
}

interface GenerateInterpretationOptions {
  dreamContent: string;
  dreamTitle?: string;
  dreamId?: string;
}

// 使用与 authApi.ts 相同的 token key
const AUTH_KEY = 'access_token';

// 辅助函数：获取认证 token
async function getAuthToken(): Promise<string | null> {
  try {
    const token = await AsyncStorage.getItem(AUTH_KEY);
    console.log('aiService - 获取 token:', token ? '存在' : '不存在');
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

// 生成图片
export async function generateImage(options: GenerateImageOptions) {
  return apiRequest<{
    success: boolean;
    data: { url: string; revised_prompt?: string };
    message?: string;
  }>(API_ENDPOINTS.AI.GENERATE_IMAGE, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

// 生成视频
export async function generateVideo(options: GenerateVideoOptions) {
  return apiRequest<{
    success: boolean;
    data: {
      taskId: string;
      status: string;
      videoUrl?: string;
      coverUrl?: string;
    };
    message?: string;
  }>(API_ENDPOINTS.AI.GENERATE_VIDEO, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

// 生成剧本
export async function generateScript(options: GenerateScriptOptions) {
  return apiRequest<{
    success: boolean;
    data: {
      title: string;
      total_duration: number;
      scenes: Array<{
        scene_number: number;
        duration: number;
        description: string;
        camera: string;
        narration: string;
        mood: string;
      }>;
    };
    message?: string;
  }>(API_ENDPOINTS.AI.GENERATE_SCRIPT, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

// 生成长视频
export async function generateLongVideo(options: GenerateLongVideoOptions) {
  return apiRequest<{
    success: boolean;
    data: {
      taskId: string;
      status: string;
      videoUrl?: string;
      coverUrl?: string;
      scenes: Array<{
        sceneNumber: number;
        description: string;
        imageUrl?: string;
        videoUrl?: string;
        status: string;
        error?: string;
      }>;
    };
    message?: string;
  }>(API_ENDPOINTS.AI.GENERATE_LONG_VIDEO, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

// 生成梦境解读
export async function generateInterpretation(options: GenerateInterpretationOptions) {
  return apiRequest<{
    success: boolean;
    data: {
      interpretation: string;
      symbols: Array<{
        symbol: string;
        meaning: string;
        context: string;
      }>;
      emotions: {
        primary: string;
        intensity: number;
        description: string;
      };
      suggestions: string[];
      references: Array<{
        id: string;
        title: string;
        source: string;
      }>;
    };
    message?: string;
  }>(API_ENDPOINTS.AI.GENERATE_INTERPRETATION, {
    method: 'POST',
    body: JSON.stringify(options),
  });
}

// 查询梦境解读
export async function getInterpretation(dreamId: string) {
  return apiRequest<{
    success: boolean;
    data: {
      interpretation: string;
      symbols: Array<{
        symbol: string;
        meaning: string;
        context: string;
      }>;
      emotions: {
        primary: string;
        intensity: number;
        description: string;
      };
      suggestions: string[];
      references: Array<{
        id: string;
        title: string;
        source: string;
      }>;
    };
    message?: string;
  }>(API_ENDPOINTS.AI.GET_INTERPRETATION(dreamId), {
    method: 'GET',
  });
}

// 查询任务进度
export async function getTaskProgress(taskId: string) {
  return apiRequest<{
    success: boolean;
    data: {
      taskId: string;
      type: 'image' | 'video' | 'script' | 'long_video';
      status: 'pending' | 'processing' | 'completed' | 'failed';
      progress: number;
      stage: string;
      result?: any;
      error?: string;
    };
    message?: string;
  }>(API_ENDPOINTS.AI.TASK_PROGRESS(taskId), {
    method: 'GET',
  });
}
