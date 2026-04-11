"use strict";
/**
 * AI 服务配置
 * 集中管理所有 AI 服务的配置
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.wan26t2vConfig = exports.kimiConfig = exports.IMAGE_GENERATION_CONFIG = exports.STYLE_MAPPING = exports.seedreamConfig = void 0;
exports.validateSeedreamConfig = validateSeedreamConfig;
// Seedream 图片生成配置
exports.seedreamConfig = {
    modelId: process.env.SEEDREAM_MODEL_ID || 'doubao-seedream-4-5-251128',
    baseUrl: process.env.SEEDREAM_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
    apiKey: process.env.SEEDREAM_API_KEY || '',
    timeout: parseInt(process.env.SEEDREAM_TIMEOUT || '120000'),
    maxRetries: parseInt(process.env.SEEDREAM_MAX_RETRIES || '3'),
    retryDelay: parseInt(process.env.SEEDREAM_RETRY_DELAY || '1000'),
};
// 验证 Seedream 配置
function validateSeedreamConfig() {
    if (!exports.seedreamConfig.apiKey) {
        throw new Error('SEEDREAM_API_KEY environment variable is not configured');
    }
    if (!exports.seedreamConfig.modelId) {
        throw new Error('SEEDREAM_MODEL_ID is not configured');
    }
    if (!exports.seedreamConfig.baseUrl) {
        throw new Error('SEEDREAM_BASE_URL is not configured');
    }
}
// 风格映射配置
exports.STYLE_MAPPING = {
    '写实': 'realistic, photorealistic, highly detailed, cinematic lighting',
    '油画': 'oil painting, artistic, rich colors, textured brushstrokes, classical art',
    '水彩': 'watercolor painting, soft colors, dreamy, ethereal, flowing textures',
    '赛博朋克': 'cyberpunk, neon lights, futuristic, high tech, dystopian atmosphere',
    '动漫': 'anime style, manga art, vibrant colors, clean lines, Japanese animation',
    '素描': 'pencil sketch, monochrome, detailed line work, artistic drawing',
};
// 图片生成参数配置
// 注意：Seedream 4.5 要求最小 3686400 像素（约 1920x1920）
exports.IMAGE_GENERATION_CONFIG = {
    defaultSize: '1920x1920',
    supportedSizes: ['1920x1920', '1920x1080', '1080x1920', '2048x2048', '2048x1152', '1152x2048'],
    defaultFormat: 'jpeg',
    supportedFormats: ['jpeg', 'png', 'webp'],
    defaultQuality: 'standard',
    supportedQuality: ['standard', 'high'],
};
// 其他 AI 服务配置可以在这里添加
exports.kimiConfig = {
    apiKey: process.env.KIMI_API_KEY || '',
    baseUrl: process.env.KIMI_BASE_URL || 'https://api.moonshot.cn/v1',
};
exports.wan26t2vConfig = {
    apiKey: process.env.WAN26T2V_API_KEY || '',
    baseUrl: process.env.WAN26T2V_BASE_URL || '',
};
