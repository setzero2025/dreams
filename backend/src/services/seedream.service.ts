/**
 * Seedream 业务服务层
 * 处理图片生成的业务逻辑
 * 包括提示词构建、参数验证、结果处理
 */

import { SeedreamRepository } from '../repositories/seedream.repository';
import {
  IMAGE_GENERATION_PARAMS,
  STYLE_MAPPING,
  PROMPT_TEMPLATES,
} from '../config/seedream.config';
import {
  GenerateImageRequest,
  GenerateImageResponse,
  SeedreamApiRequest,
} from '../types/seedream.types';
import {
  SeedreamError,
  SeedreamValidationError,
  SeedreamGenerationError,
} from '../utils/seedream.errors';

/**
 * Seedream 服务类
 * 封装图片生成的业务逻辑
 */
export class SeedreamService {
  constructor(private readonly repository: SeedreamRepository) {}

  /**
   * 验证生成图片请求参数
   * @param request 请求参数
   * @throws SeedreamValidationError 当验证失败时
   */
  private validateGenerateImageRequest(request: GenerateImageRequest): void {
    const errors: Array<{ field: string; message: string }> = [];

    // 验证提示词
    if (!request.prompt || typeof request.prompt !== 'string') {
      errors.push({ field: 'prompt', message: '提示词是必填项' });
    } else if (request.prompt.trim().length === 0) {
      errors.push({ field: 'prompt', message: '提示词不能为空' });
    } else if (request.prompt.length > 2000) {
      errors.push({ field: 'prompt', message: '提示词长度不能超过2000字符' });
    }

    // 验证风格
    if (request.style && !STYLE_MAPPING[request.style]) {
      errors.push({
        field: 'style',
        message: `不支持的风格: ${request.style}。支持的风格: ${Object.keys(STYLE_MAPPING).join(', ')}`,
      });
    }

    // 验证尺寸
    if (request.size && !IMAGE_GENERATION_PARAMS.supportedSizes.includes(request.size as any)) {
      errors.push({
        field: 'size',
        message: `不支持的尺寸: ${request.size}。支持的尺寸: ${IMAGE_GENERATION_PARAMS.supportedSizes.join(', ')}`,
      });
    }

    // 验证格式
    if (request.format && !IMAGE_GENERATION_PARAMS.supportedFormats.includes(request.format)) {
      errors.push({
        field: 'format',
        message: `不支持的格式: ${request.format}。支持的格式: ${IMAGE_GENERATION_PARAMS.supportedFormats.join(', ')}`,
      });
    }

    // 验证质量
    if (request.quality && !IMAGE_GENERATION_PARAMS.supportedQuality.includes(request.quality)) {
      errors.push({
        field: 'quality',
        message: `不支持的质量: ${request.quality}。支持的质量: ${IMAGE_GENERATION_PARAMS.supportedQuality.join(', ')}`,
      });
    }

    if (errors.length > 0) {
      throw new SeedreamValidationError('请求参数验证失败', errors);
    }
  }

  /**
   * 构建完整的提示词
   * 将用户提示词与风格、模板组合
   * @param prompt 用户提示词
   * @param style 风格名称
   * @returns 完整的提示词
   */
  private buildPrompt(prompt: string, style: string): string {
    const stylePrompt = STYLE_MAPPING[style] || STYLE_MAPPING['写实'];
    const { dreamScenePrefix, dreamSceneSuffix } = PROMPT_TEMPLATES;
    
    return `${dreamScenePrefix} ${prompt}. ${stylePrompt}, ${dreamSceneSuffix}`;
  }

  /**
   * 构建 Seedream API 请求体
   * 参照官网示例: https://www.volcengine.com/docs/82379/1824121
   * @param request 业务层请求参数
   * @returns API 请求体
   */
  private buildApiRequest(request: GenerateImageRequest): SeedreamApiRequest {
    const {
      prompt,
      style = '写实',
      size = IMAGE_GENERATION_PARAMS.defaultSize,
      format = IMAGE_GENERATION_PARAMS.defaultFormat,
      quality = IMAGE_GENERATION_PARAMS.defaultQuality,
    } = request;

    // 构建完整提示词
    const fullPrompt = this.buildPrompt(prompt, style);

    // 构建 API 请求体 - 与官网示例保持一致
    const apiRequest: SeedreamApiRequest = {
      model: this.repository.getStatus().modelId,
      prompt: fullPrompt,
      size,
      response_format: IMAGE_GENERATION_PARAMS.responseFormat,
      // 顺序图像生成 - 默认禁用（与官网示例一致）
      sequential_image_generation: IMAGE_GENERATION_PARAMS.defaultSequentialImageGeneration,
      // 流式输出 - 默认关闭（与官网示例一致）
      stream: IMAGE_GENERATION_PARAMS.defaultStream,
      // 水印 - 默认添加（与官网示例一致）
      watermark: IMAGE_GENERATION_PARAMS.defaultWatermark,
    };

    // 只有非默认格式才添加 output_format
    if (format !== IMAGE_GENERATION_PARAMS.defaultFormat) {
      apiRequest.output_format = format;
    }

    // 只有高质量才添加 quality 参数
    if (quality === 'high') {
      apiRequest.quality = 'hd';
    }

    return apiRequest;
  }

  /**
   * 处理 API 响应，提取图片数据
   * @param response API 响应
   * @param format 图片格式
   * @returns 图片生成结果
   * @throws SeedreamGenerationError 当响应数据无效时
   */
  private processApiResponse(
    response: any,
    format: string
  ): GenerateImageResponse {
    // 检查 API 错误
    if (response.error) {
      throw new SeedreamGenerationError(
        `Seedream API 错误: ${response.error.message}`
      );
    }

    // 检查图片数据
    const imageData = response.data?.[0];
    if (!imageData) {
      throw new SeedreamGenerationError('API 响应中没有图片数据');
    }

    // 提取图片 URL
    let imageUrl: string;
    if (imageData.url) {
      imageUrl = imageData.url;
    } else if (imageData.b64_json) {
      imageUrl = `data:image/${format};base64,${imageData.b64_json}`;
    } else {
      throw new SeedreamGenerationError('API 响应中既没有 URL 也没有 base64 数据');
    }

    return {
      url: imageUrl,
      revisedPrompt: imageData.revised_prompt,
    };
  }

  /**
   * 生成图片
   * 主要的业务方法，处理完整的图片生成流程
   * @param request 图片生成请求
   * @returns 图片生成结果，包含生成的图片 URL
   * @throws SeedreamError 当生成失败时
   */
  public async generateImage(
    request: GenerateImageRequest
  ): Promise<GenerateImageResponse> {
    const startTime = Date.now();

    // 记录请求日志
    console.log('[Seedream Service] 开始图片生成:', {
      userId: request.userId,
      style: request.style || '写实',
      size: request.size || IMAGE_GENERATION_PARAMS.defaultSize,
      format: request.format || IMAGE_GENERATION_PARAMS.defaultFormat,
      quality: request.quality || IMAGE_GENERATION_PARAMS.defaultQuality,
    });

    try {
      // 1. 验证请求参数
      this.validateGenerateImageRequest(request);

      // 2. 构建 API 请求
      const apiRequest = this.buildApiRequest(request);

      // 3. 调用 Repository 层发送请求
      const apiResponse = await this.repository.generateImage(apiRequest);

      // 4. 处理响应数据
      const result = this.processApiResponse(
        apiResponse,
        request.format || IMAGE_GENERATION_PARAMS.defaultFormat
      );

      // 5. 计算生成耗时
      const generationTime = Date.now() - startTime;

      // 6. 记录成功日志
      console.log('[Seedream Service] 图片生成成功:', {
        userId: request.userId,
        generationTime: `${generationTime}ms`,
        hasUrl: !!result.url,
        hasRevisedPrompt: !!result.revisedPrompt,
      });

      return {
        ...result,
        generationTime,
      };
    } catch (error) {
      // 如果是 SeedreamError，直接抛出
      if (error instanceof SeedreamError) {
        throw error;
      }

      // 其他错误包装为生成错误
      console.error('[Seedream Service] 图片生成失败:', error);
      throw new SeedreamGenerationError(
        `图片生成失败: ${error instanceof Error ? error.message : '未知错误'}`,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * 批量生成图片
   * 依次生成多张图片，失败时继续处理下一张
   * @param requests 图片生成请求数组
   * @returns 图片生成结果数组
   */
  public async generateImages(
    requests: GenerateImageRequest[]
  ): Promise<GenerateImageResponse[]> {
    const results: GenerateImageResponse[] = [];

    for (const request of requests) {
      try {
        const result = await this.generateImage(request);
        results.push(result);
      } catch (error) {
        console.error('[Seedream Service] 批量生成中某张图片失败:', error);
        // 继续处理下一张
      }
    }

    return results;
  }

  /**
   * 获取服务状态
   * @returns 服务状态信息
   */
  public getStatus() {
    return this.repository.getStatus();
  }
}

/**
 * 导出服务实例
 * 使用默认的 Repository 实例
 */
export const seedreamService = new SeedreamService(
  new SeedreamRepository()
);
