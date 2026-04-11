"use strict";
/**
 * Seedream 图片生成服务
 * 使用 Node.js 后端最佳实践实现
 * 支持重试机制、完善的错误处理和日志记录
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.seedreamService = exports.SeedreamService = void 0;
exports.generateImage = generateImage;
exports.generateImages = generateImages;
const axios_1 = __importDefault(require("axios"));
const ai_1 = require("../config/ai");
const errors_1 = require("../utils/errors");
/**
 * Seedream 服务类
 * 单例模式实现
 */
class SeedreamService {
    constructor() {
        this.config = ai_1.seedreamConfig;
        this.client = this.createClient();
    }
    /**
     * 获取服务实例（单例模式）
     */
    static getInstance() {
        if (!SeedreamService.instance) {
            SeedreamService.instance = new SeedreamService();
        }
        return SeedreamService.instance;
    }
    /**
     * 创建 Axios 客户端
     */
    createClient() {
        const client = axios_1.default.create({
            baseURL: this.config.baseUrl,
            timeout: this.config.timeout,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.config.apiKey}`,
            },
        });
        // 请求拦截器
        client.interceptors.request.use((config) => {
            console.log(`[Seedream] Request: ${config.method?.toUpperCase()} ${config.url}`);
            return config;
        }, (error) => {
            console.error('[Seedream] Request Error:', error.message);
            return Promise.reject(error);
        });
        // 响应拦截器
        client.interceptors.response.use((response) => {
            console.log(`[Seedream] Response: ${response.status} ${response.statusText}`);
            return response;
        }, (error) => {
            if (error.response) {
                console.error('[Seedream] Response Error:', {
                    status: error.response.status,
                    statusText: error.response.statusText,
                    data: error.response.data,
                });
            }
            else if (error.request) {
                console.error('[Seedream] No Response:', error.message);
            }
            else {
                console.error('[Seedream] Request Setup Error:', error.message);
            }
            return Promise.reject(error);
        });
        return client;
    }
    /**
     * 构建完整的提示词
     */
    buildPrompt(prompt, style) {
        const stylePrompt = ai_1.STYLE_MAPPING[style] || ai_1.STYLE_MAPPING['写实'];
        return `Dream scene: ${prompt}. ${stylePrompt}, cinematic composition, high quality, detailed, dreamy atmosphere, soft lighting, ethereal visuals.`;
    }
    /**
     * 延迟函数（用于重试）
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    /**
     * 带重试机制的 HTTP 请求
     */
    async requestWithRetry(config, attempt = 1) {
        try {
            const response = await this.client.request(config);
            return response.data;
        }
        catch (error) {
            // 如果是 Axios 错误
            if (axios_1.default.isAxiosError(error)) {
                const axiosError = error;
                // 不需要重试的错误（4xx 客户端错误，除了 429 限流）
                const status = axiosError.response?.status;
                if (status && status >= 400 && status < 500 && status !== 429) {
                    throw error;
                }
                // 检查是否还有重试次数
                if (attempt < this.config.maxRetries) {
                    const delayMs = this.config.retryDelay * Math.pow(2, attempt - 1); // 指数退避
                    console.log(`[Seedream] Retrying (${attempt}/${this.config.maxRetries}) after ${delayMs}ms...`);
                    await this.delay(delayMs);
                    return this.requestWithRetry(config, attempt + 1);
                }
            }
            throw error;
        }
    }
    /**
     * 生成图片
     *
     * @param options - 图片生成选项
     * @returns 生成的图片结果
     * @throws AIServiceError 当生成失败时抛出
     */
    async generateImage(options) {
        const startTime = Date.now();
        // 验证配置
        (0, ai_1.validateSeedreamConfig)();
        const { prompt, style = '写实', size = ai_1.IMAGE_GENERATION_CONFIG.defaultSize, format = ai_1.IMAGE_GENERATION_CONFIG.defaultFormat, quality = ai_1.IMAGE_GENERATION_CONFIG.defaultQuality, userId, } = options;
        // 验证输入
        if (!prompt || prompt.trim().length === 0) {
            throw new errors_1.AIServiceError('Prompt is required', 'Seedream');
        }
        const fullPrompt = this.buildPrompt(prompt, style);
        console.log('[Seedream] Starting image generation:', {
            userId,
            style,
            size,
            format,
            quality,
            promptLength: fullPrompt.length,
        });
        try {
            // 构建请求配置
            const requestConfig = {
                method: 'POST',
                url: '/images/generations',
                data: {
                    model: this.config.modelId,
                    prompt: fullPrompt,
                    size,
                    n: 1,
                    response_format: 'url',
                    ...(format !== 'jpeg' && { output_format: format }),
                    ...(quality === 'high' && { quality: 'hd' }),
                },
            };
            // 发送请求（带重试）
            const response = await this.requestWithRetry(requestConfig);
            // 检查响应错误
            if (response.error) {
                throw new errors_1.AIServiceError(`Seedream API error: ${response.error.message}`, 'Seedream');
            }
            // 提取图片数据
            const imageData = response.data?.[0];
            if (!imageData) {
                throw new errors_1.AIServiceError('No image data in response', 'Seedream');
            }
            // 构建图片 URL
            let imageUrl;
            if (imageData.url) {
                imageUrl = imageData.url;
            }
            else if (imageData.b64_json) {
                imageUrl = `data:image/${format};base64,${imageData.b64_json}`;
            }
            else {
                throw new errors_1.AIServiceError('No image URL or base64 data in response', 'Seedream');
            }
            const generationTime = Date.now() - startTime;
            console.log('[Seedream] Image generated successfully:', {
                userId,
                generationTime: `${generationTime}ms`,
                hasUrl: !!imageData.url,
                hasBase64: !!imageData.b64_json,
            });
            return {
                url: imageUrl,
                revisedPrompt: imageData.revised_prompt || fullPrompt,
                generationTime,
            };
        }
        catch (error) {
            // 处理 Axios 错误
            if (axios_1.default.isAxiosError(error)) {
                const axiosError = error;
                const status = axiosError.response?.status;
                const errorData = axiosError.response?.data;
                // 根据状态码提供更有意义的错误信息
                if (status === 401) {
                    throw new errors_1.AIServiceError('Invalid API key. Please check your SEEDREAM_API_KEY configuration.', 'Seedream', error);
                }
                if (status === 404) {
                    throw new errors_1.AIServiceError(`Model not found. Please verify the model ID: ${this.config.modelId}`, 'Seedream', error);
                }
                if (status === 429) {
                    throw new errors_1.AIServiceError('Rate limit exceeded. Please try again later.', 'Seedream', error);
                }
                // 其他 API 错误
                const apiErrorMessage = errorData?.error?.message || axiosError.message;
                throw new errors_1.AIServiceError(`Image generation failed: ${apiErrorMessage}`, 'Seedream', error);
            }
            // 如果是已经包装过的错误，直接抛出
            if (error instanceof errors_1.AIServiceError) {
                throw error;
            }
            // 其他未知错误
            console.error('[Seedream] Unexpected error:', error);
            throw new errors_1.AIServiceError(`Unexpected error: ${error instanceof Error ? error.message : 'Unknown error'}`, 'Seedream', error instanceof Error ? error : undefined);
        }
    }
    /**
     * 批量生成图片
     *
     * @param prompts - 提示词数组
     * @param options - 其他选项
     * @returns 生成的图片结果数组
     */
    async generateImages(prompts, options = {}) {
        const results = [];
        for (const prompt of prompts) {
            try {
                const result = await this.generateImage({ ...options, prompt });
                results.push(result);
            }
            catch (error) {
                console.error('[Seedream] Failed to generate image for prompt:', prompt, error);
                // 继续处理下一个
            }
        }
        return results;
    }
    /**
     * 获取服务状态
     */
    getStatus() {
        return {
            configured: !!this.config.apiKey,
            modelId: this.config.modelId,
            baseUrl: this.config.baseUrl,
            maxRetries: this.config.maxRetries,
            timeout: this.config.timeout,
        };
    }
}
exports.SeedreamService = SeedreamService;
// 导出单例实例
exports.seedreamService = SeedreamService.getInstance();
// 兼容旧版导出
async function generateImage(options) {
    return exports.seedreamService.generateImage(options);
}
async function generateImages(prompts, options) {
    return exports.seedreamService.generateImages(prompts, options);
}
