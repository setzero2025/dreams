/**
 * AI 服务配置
 * 集中管理所有 AI 服务的配置
 */

import dotenv from 'dotenv';

// 确保环境变量已加载
if (!process.env.SEEDREAM_API_KEY) {
  dotenv.config();
}

// Seedream 图片生成配置
export const seedreamConfig = {
  modelId: process.env.SEEDREAM_MODEL_ID || 'doubao-seedream-4-5-251128',
  baseUrl: process.env.SEEDREAM_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
  apiKey: process.env.SEEDREAM_API_KEY || '',
  timeout: parseInt(process.env.SEEDREAM_TIMEOUT || '120000'),
  maxRetries: parseInt(process.env.SEEDREAM_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.SEEDREAM_RETRY_DELAY || '1000'),
};

// 验证 Seedream 配置
export function validateSeedreamConfig(): void {
  if (!seedreamConfig.apiKey) {
    throw new Error('SEEDREAM_API_KEY environment variable is not configured');
  }
  if (!seedreamConfig.modelId) {
    throw new Error('SEEDREAM_MODEL_ID is not configured');
  }
  if (!seedreamConfig.baseUrl) {
    throw new Error('SEEDREAM_BASE_URL is not configured');
  }
}

// 风格映射配置
export const STYLE_MAPPING: Record<string, string> = {
  '写实': 'realistic, photorealistic, highly detailed, cinematic lighting',
  '油画': 'oil painting, artistic, rich colors, textured brushstrokes, classical art',
  '水彩': 'watercolor painting, soft colors, dreamy, ethereal, flowing textures',
  '赛博朋克': 'cyberpunk, neon lights, futuristic, high tech, dystopian atmosphere',
  '动漫': 'anime style, manga art, vibrant colors, clean lines, Japanese animation',
  '素描': 'pencil sketch, monochrome, detailed line work, artistic drawing',
};

// 图片生成参数配置
// 注意：Seedream 4.5 要求最小 3686400 像素（约 1920x1920）
export const IMAGE_GENERATION_CONFIG = {
  defaultSize: '1920x1920' as const,
  supportedSizes: ['1920x1920', '1920x1080', '1080x1920', '2048x2048', '2048x1152', '1152x2048'] as const,
  defaultFormat: 'jpeg' as const,
  supportedFormats: ['jpeg', 'png', 'webp'] as const,
  defaultQuality: 'standard' as const,
  supportedQuality: ['standard', 'high'] as const,
};

// 其他 AI 服务配置可以在这里添加
export const kimiConfig = {
  apiKey: process.env.KIMI_API_KEY || '',
  baseUrl: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
};

export const wan26t2vConfig = {
  apiKey: process.env.WAN26T2V_API_KEY || '',
  baseUrl: process.env.WAN26T2V_BASE_URL || '',
};
