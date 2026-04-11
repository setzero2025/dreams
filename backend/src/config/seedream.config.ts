/**
 * Seedream 图片生成服务配置
 * 集中管理豆包 Seedream 4.5 模型的所有接口参数
 */

import dotenv from 'dotenv';

// 确保环境变量已加载
if (!process.env.SEEDREAM_API_KEY) {
  dotenv.config();
}

/**
 * Seedream API 接口核心配置参数
 * 这些参数用于连接火山引擎方舟平台的 Seedream 4.5 模型
 */
export const SEEDREAM_API_CONFIG = {
  /**
   * 模型ID - 豆包 Seedream 4.5 模型标识
   * 格式: doubao-seedream-4-5-251128
   * 获取方式: 火山方舟平台控制台
   */
  modelId: process.env.SEEDREAM_MODEL_ID || 'doubao-seedream-4-5-251128',
  
  /**
   * API 基础地址 - 火山引擎方舟平台 API 端点
   * 格式: https://ark.cn-beijing.volces.com/api/v3
   */
  baseUrl: process.env.SEEDREAM_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
  
  /**
   * API 密钥 - 用于认证请求
   * 获取方式: 火山方舟平台 -> API Key 管理
   * 安全性: 必须保存在环境变量中，禁止硬编码
   */
  apiKey: process.env.SEEDREAM_API_KEY || '',
  
  /**
   * 请求超时时间 - 图片生成可能需要较长时间
   * 单位: 毫秒
   * 默认值: 120000ms (2分钟)
   */
  timeout: parseInt(process.env.SEEDREAM_TIMEOUT || '120000'),
  
  /**
   * 最大重试次数 - 当请求失败时的重试次数
   * 默认值: 3次
   */
  maxRetries: parseInt(process.env.SEEDREAM_MAX_RETRIES || '3'),
  
  /**
   * 重试延迟 - 每次重试之间的间隔时间
   * 单位: 毫秒
   * 默认值: 1000ms (1秒)
   * 注意: 实际延迟会按指数退避策略递增
   */
  retryDelay: parseInt(process.env.SEEDREAM_RETRY_DELAY || '1000'),
};

/**
 * 图片生成参数配置
 * 定义 Seedream 4.5 模型支持的图片生成参数
 * 参照官网示例: https://www.volcengine.com/docs/82379/1824121
 */
export const IMAGE_GENERATION_PARAMS = {
  /**
   * 默认图片尺寸
   * 官网示例使用: 2K
   * 也支持具体像素: 1920x1920, 1920x1080, 1080x1920 等
   */
  defaultSize: '2K' as const,
  
  /**
   * 支持的图片尺寸列表
   * Seedream 4.5 支持: 2K, 3K
   * 也支持具体像素格式
   */
  supportedSizes: [
    '2K',         // 官方推荐尺寸
    '3K',         // 高分辨率
    '1920x1920',  // 正方形 1:1
    '1920x1080',  // 横屏 16:9
    '1080x1920',  // 竖屏 9:16
    '2048x2048',  // 高分辨率正方形
    '2048x1152',  // 高分辨率横屏
    '1152x2048',  // 高分辨率竖屏
  ] as const,
  
  /**
   * 默认输出格式
   */
  defaultFormat: 'jpeg' as const,
  
  /**
   * 支持的输出格式
   */
  supportedFormats: ['jpeg', 'png', 'webp'] as const,
  
  /**
   * 默认图片质量
   */
  defaultQuality: 'standard' as const,
  
  /**
   * 支持的图片质量选项
   * standard: 标准质量
   * high: 高质量 (hd)
   */
  supportedQuality: ['standard', 'high'] as const,
  
  /**
   * 默认生成图片数量
   * Seedream 4.5 每次请求生成1张图片
   */
  defaultN: 1,
  
  /**
   * 响应格式
   * url: 返回图片URL
   * b64_json: 返回base64编码的图片数据
   */
  responseFormat: 'url' as const,
  
  /**
   * 是否启用顺序图像生成
   * disabled: 禁用（默认，与官网示例一致）
   * enabled: 启用
   */
  defaultSequentialImageGeneration: 'disabled' as const,
  
  /**
   * 是否启用流式输出
   * false: 非流式（默认，与官网示例一致）
   * true: 流式输出
   */
  defaultStream: false,
  
  /**
   * 是否添加水印
   * true: 添加水印（默认，与官网示例一致）
   * false: 不添加水印
   */
  defaultWatermark: true,
};

/**
 * 风格映射配置
 * 将中文风格名称映射为英文提示词
 */
export const STYLE_MAPPING: Record<string, string> = {
  '写实': 'realistic, photorealistic, highly detailed, cinematic lighting',
  '油画': 'oil painting, artistic, rich colors, textured brushstrokes, classical art',
  '水彩': 'watercolor painting, soft colors, dreamy, ethereal, flowing textures',
  '赛博朋克': 'cyberpunk, neon lights, futuristic, high tech, dystopian atmosphere',
  '动漫': 'anime style, manga art, vibrant colors, clean lines, Japanese animation',
  '素描': 'pencil sketch, monochrome, detailed line work, artistic drawing',
};

/**
 * 提示词模板配置
 * 用于构建完整的图片生成提示词
 */
export const PROMPT_TEMPLATES = {
  /**
   * 梦境场景提示词前缀
   */
  dreamScenePrefix: 'Dream scene:',
  
  /**
   * 梦境场景提示词后缀
   * 增强图片质量的通用描述
   */
  dreamSceneSuffix: 'cinematic composition, high quality, detailed, dreamy atmosphere, soft lighting, ethereal visuals',
};

/**
 * 验证 Seedream 配置是否完整
 * @throws Error 当配置不完整时抛出错误
 */
export function validateSeedreamConfig(): void {
  if (!SEEDREAM_API_CONFIG.apiKey) {
    throw new Error('SEEDREAM_API_KEY 环境变量未配置，请在 .env 文件中设置');
  }
  if (!SEEDREAM_API_CONFIG.modelId) {
    throw new Error('SEEDREAM_MODEL_ID 未配置');
  }
  if (!SEEDREAM_API_CONFIG.baseUrl) {
    throw new Error('SEEDREAM_BASE_URL 未配置');
  }
}

/**
 * 获取 Seedream 服务状态
 * 用于健康检查和状态监控
 */
export function getSeedreamStatus() {
  return {
    configured: !!SEEDREAM_API_CONFIG.apiKey,
    modelId: SEEDREAM_API_CONFIG.modelId,
    baseUrl: SEEDREAM_API_CONFIG.baseUrl,
    maxRetries: SEEDREAM_API_CONFIG.maxRetries,
    timeout: SEEDREAM_API_CONFIG.timeout,
  };
}
