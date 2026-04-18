// API 配置文件
// 前端通过后端 API 访问数据库，不直接连接 Supabase

// 后端 API 基础地址
// 在 Web 环境下 __DEV__ 可能未定义，使用默认值
const isDev = typeof __DEV__ !== 'undefined' ? __DEV__ : true;
export const API_BASE_URL = isDev
  ? 'http://192.168.1.7:3002/api/v1'  // 开发环境 - 后端端口3002
  : 'http://101.201.246.158:3002/api/v1';  // 生产环境

// API 端点配置
export const API_ENDPOINTS = {
  // 认证相关
  AUTH: {
    LOGIN: '/auth/login',
    REGISTER: '/auth/register',
    ANONYMOUS: '/auth/anonymous',
    REFRESH: '/auth/refresh',
    LOGOUT: '/auth/logout',
    CHECK_PHONE: '/auth/check-phone',
  },
  
  // 梦境相关
  DREAMS: {
    LIST: '/dreams',
    DETAIL: (id: string) => `/dreams/${id}`,
    CREATE: '/dreams',
    UPDATE: (id: string) => `/dreams/${id}`,
    DELETE: (id: string) => `/dreams/${id}`,
  },
  
  // 创作相关
  CREATIONS: {
    LIST: '/creations',
    BY_DREAM: (dreamId: string) => `/creations/dream/${dreamId}`,
    BY_TYPE: (type: string) => `/creations/type/${type}`,
    CREATE: '/creations',
    DELETE: (id: string) => `/creations/${id}`,
    CLEAR: '/creations',
  },
  
  // AI 生成相关
  AI: {
    GENERATE_IMAGE: '/ai/generate-image',
    GENERATE_VIDEO: '/ai/generate-video',
    GENERATE_SCRIPT: '/ai/generate-script',
    GENERATE_LONG_VIDEO: '/ai/generate-long-video',
    GENERATE_INTERPRETATION: '/ai/generate-interpretation',
    GET_INTERPRETATION: (dreamId: string) => `/ai/interpretation/${dreamId}`,
    TASK_PROGRESS: (taskId: string) => `/ai/task-progress/${taskId}`,
  },
  
  // 异步生成任务相关（新）
  GENERATIONS: {
    IMAGE: '/generations/image',
    VIDEO: '/generations/video',
    LONG_VIDEO: '/generations/longvideo',
    PROGRESS: (taskId: string) => `/generations/progress/${taskId}`,
  },
  
  // 用户相关
  USER: {
    PROFILE: '/users/profile',
    UPDATE_PROFILE: '/users/profile',
    STATS: '/users/quota',
  },
  
  // 订阅相关
  SUBSCRIPTION: {
    PLANS: '/subscriptions/plans',
    CURRENT: '/subscriptions/current',
    CREATE: '/subscriptions',
    CANCEL: '/subscriptions',
  },

  // 音频相关
  AUDIO: {
    UPLOAD: '/audio/upload',
    TRANSCRIBE: '/audio/transcribe',
    DREAM_UPLOAD: (dreamId: string) => `/audio/dream/${dreamId}/upload`,
    DREAM_AUDIO: (dreamId: string) => `/audio/dream/${dreamId}`,
  },
};

// 请求超时配置（毫秒）
export const API_TIMEOUT = {
  DEFAULT: 30000,      // 默认 30 秒
  UPLOAD: 120000,      // 上传 2 分钟
  GENERATION: 300000,  // AI 生成 5 分钟
};

// 重试配置
export const API_RETRY = {
  MAX_RETRIES: 3,
  RETRY_DELAY: 1000,  // 重试间隔 1 秒
};
