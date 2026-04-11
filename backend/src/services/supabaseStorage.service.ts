/**
 * Supabase Storage 服务
 * 统一处理文件上传到 Supabase Storage
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// 存储桶名称配置（从环境变量读取）
const BUCKETS = {
  AI_IMAGE: process.env.STORAGE_BUCKET_AI_IMAGE || 'aiImage',
  AI_VIDEO: process.env.STORAGE_BUCKET_AI_VIDEO || 'aiVideo',
  AUDIO: process.env.STORAGE_BUCKET_AUDIO || 'audio',
};

// 文件类型配置
const FILE_TYPES = {
  IMAGE: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  VIDEO: ['video/mp4', 'video/webm', 'video/quicktime'],
  AUDIO: ['audio/mpeg', 'audio/wav', 'audio/webm', 'audio/mp4', 'audio/ogg'],
};

// 文件扩展名映射
const EXTENSIONS: { [key: string]: string } = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/webm': 'webm',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
};

class SupabaseStorageService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY || '';

    if (!supabaseUrl || !supabaseKey) {
      throw new Error('Supabase configuration is missing. Please check SUPABASE_URL and SUPABASE_SERVICE_KEY');
    }

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * 上传 AI 生成的图片
   * @param fileBuffer 文件Buffer
   * @param contentType 文件类型
   * @param userId 用户ID
   * @param dreamId 梦境ID（可选）
   * @returns 文件访问URL
   */
  async uploadAIImage(
    fileBuffer: Buffer,
    contentType: string,
    userId: string,
    dreamId?: string
  ): Promise<string> {
    return this.uploadFile(
      BUCKETS.AI_IMAGE,
      fileBuffer,
      contentType,
      userId,
      dreamId
    );
  }

  /**
   * 上传 AI 生成的视频
   * @param fileBuffer 文件Buffer
   * @param contentType 文件类型
   * @param userId 用户ID
   * @param dreamId 梦境ID（可选）
   * @returns 文件访问URL
   */
  async uploadAIVideo(
    fileBuffer: Buffer,
    contentType: string,
    userId: string,
    dreamId?: string
  ): Promise<string> {
    return this.uploadFile(
      BUCKETS.AI_VIDEO,
      fileBuffer,
      contentType,
      userId,
      dreamId
    );
  }

  /**
   * 上传音频文件（说梦功能生成）
   * @param fileBuffer 文件Buffer
   * @param contentType 文件类型
   * @param userId 用户ID
   * @param dreamId 梦境ID（可选）
   * @returns 文件访问URL
   */
  async uploadAudio(
    fileBuffer: Buffer,
    contentType: string,
    userId: string,
    dreamId?: string
  ): Promise<string> {
    return this.uploadFile(
      BUCKETS.AUDIO,
      fileBuffer,
      contentType,
      userId,
      dreamId
    );
  }

  /**
   * 通用文件上传方法
   * @param bucket 存储桶名称
   * @param fileBuffer 文件Buffer
   * @param contentType 文件类型
   * @param userId 用户ID
   * @param dreamId 梦境ID（可选）
   * @returns 文件访问URL
   */
  private async uploadFile(
    bucket: string,
    fileBuffer: Buffer,
    contentType: string,
    userId: string,
    dreamId?: string
  ): Promise<string> {
    try {
      // 确保存储桶存在
      await this.ensureBucketExists(bucket);

      // 生成文件路径：userId/dreamId/filename.ext
      const extension = EXTENSIONS[contentType] || 'bin';
      const filename = `${uuidv4()}.${extension}`;
      const filePath = dreamId
        ? `${userId}/${dreamId}/${filename}`
        : `${userId}/${filename}`;

      console.log(`【SupabaseStorage】上传文件到 ${bucket}/${filePath}`);

      // 上传文件
      const { data, error } = await this.supabase.storage
        .from(bucket)
        .upload(filePath, fileBuffer, {
          contentType,
          upsert: false,
        });

      if (error) {
        console.error('【SupabaseStorage】上传失败:', error);
        throw new Error(`上传文件失败: ${error.message}`);
      }

      // 获取公开访问URL
      const { data: publicUrlData } = this.supabase.storage
        .from(bucket)
        .getPublicUrl(filePath);

      console.log('【SupabaseStorage】上传成功，公开URL:', publicUrlData.publicUrl);

      // 验证URL格式
      if (!publicUrlData.publicUrl || !publicUrlData.publicUrl.startsWith('http')) {
        throw new Error('获取到的URL格式不正确');
      }

      // 尝试创建签名URL（用于验证访问权限）
      let signedUrl: string | null = null;
      try {
        const { data: signedUrlData, error: signedError } = await this.supabase.storage
          .from(bucket)
          .createSignedUrl(filePath, 60 * 60 * 24 * 7); // 7天有效期

        if (signedError) {
          console.warn('【SupabaseStorage】创建签名URL失败:', signedError);
        } else if (signedUrlData?.signedUrl) {
          signedUrl = signedUrlData.signedUrl;
          console.log('【SupabaseStorage】签名URL:', signedUrl);
        }
      } catch (signedUrlError) {
        console.warn('【SupabaseStorage】创建签名URL出错:', signedUrlError);
      }

      // 返回签名URL（更可靠，因为不需要额外的存储桶策略配置）
      // 如果签名URL创建失败，则回退到公开URL
      return signedUrl || publicUrlData.publicUrl;
    } catch (error) {
      console.error('【SupabaseStorage】上传文件错误:', error);
      throw error;
    }
  }

  /**
   * 从URL下载文件并上传到Storage
   * @param bucket 存储桶名称
   * @param fileUrl 文件URL
   * @param userId 用户ID
   * @param dreamId 梦境ID（可选）
   * @returns 新的文件访问URL
   */
  async uploadFromUrl(
    bucket: string,
    fileUrl: string,
    userId: string,
    dreamId?: string
  ): Promise<string> {
    try {
      console.log(`【SupabaseStorage】从URL下载文件: ${fileUrl}`);

      // 下载文件
      const response = await fetch(fileUrl);
      if (!response.ok) {
        throw new Error(`下载文件失败: ${response.status} ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type') || 'application/octet-stream';
      const arrayBuffer = await response.arrayBuffer();
      const fileBuffer = Buffer.from(arrayBuffer);

      console.log(`【SupabaseStorage】下载完成，大小: ${fileBuffer.length} bytes，类型: ${contentType}`);

      // 上传到Storage
      return this.uploadFile(bucket, fileBuffer, contentType, userId, dreamId);
    } catch (error) {
      console.error('【SupabaseStorage】从URL上传失败:', error);
      throw error;
    }
  }

  /**
   * 确保存储桶存在，不存在则创建
   * @param bucket 存储桶名称
   */
  private async ensureBucketExists(bucket: string): Promise<void> {
    try {
      // 检查存储桶是否存在
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();

      if (listError) {
        console.error('【SupabaseStorage】列出存储桶失败:', listError);
        throw listError;
      }

      const bucketExists = buckets?.some(b => b.name === bucket);

      if (!bucketExists) {
        console.log(`【SupabaseStorage】创建存储桶: ${bucket}`);

        // 创建存储桶
        const { error: createError } = await this.supabase.storage.createBucket(bucket, {
          public: true, // 公开访问
          fileSizeLimit: 100 * 1024 * 1024, // 100MB 限制
        });

        if (createError) {
          console.error('【SupabaseStorage】创建存储桶失败:', createError);
          throw createError;
        }

        console.log(`【SupabaseStorage】存储桶 ${bucket} 创建成功`);
      }

      // 确保存储桶是公开的
      await this.ensureBucketPublic(bucket);
    } catch (error) {
      console.error('【SupabaseStorage】确保存储桶存在失败:', error);
      throw error;
    }
  }

  /**
   * 确保存储桶是公开的
   * @param bucket 存储桶名称
   */
  private async ensureBucketPublic(bucket: string): Promise<void> {
    try {
      // 更新存储桶为公开
      const { error } = await this.supabase.storage.updateBucket(bucket, {
        public: true,
      });

      if (error) {
        console.error(`【SupabaseStorage】设置存储桶 ${bucket} 为公开失败:`, error);
      } else {
        console.log(`【SupabaseStorage】存储桶 ${bucket} 已设置为公开`);
      }

      // 设置存储桶的访问策略（允许公开读取）
      await this.setBucketPolicy(bucket);
    } catch (error) {
      console.error(`【SupabaseStorage】设置存储桶 ${bucket} 访问权限失败:`, error);
    }
  }

  /**
   * 设置存储桶的访问策略
   * @param bucket 存储桶名称
   */
  private async setBucketPolicy(bucket: string): Promise<void> {
    try {
      // 使用 Supabase Admin API 设置存储桶策略
      // 策略：允许任何人读取（anon 角色）
      const policy = {
        name: 'allow-public-read',
        definition: {
          statements: [
            {
              effect: 'allow',
              actions: ['object:read'],
              resources: [`${bucket}/*`],
              principals: {
                anon: ['*'],
              },
            },
          ],
        },
      };

      console.log(`【SupabaseStorage】尝试设置存储桶 ${bucket} 的访问策略`);
      // 注意：这需要 Supabase Admin API，可能需要通过 SQL 或 Dashboard 设置
    } catch (error) {
      console.error(`【SupabaseStorage】设置存储桶 ${bucket} 策略失败:`, error);
    }
  }

  /**
   * 删除文件
   * @param bucket 存储桶名称
   * @param filePath 文件路径
   */
  async deleteFile(bucket: string, filePath: string): Promise<void> {
    try {
      const { error } = await this.supabase.storage.from(bucket).remove([filePath]);

      if (error) {
        console.error('【SupabaseStorage】删除文件失败:', error);
        throw error;
      }

      console.log(`【SupabaseStorage】删除文件成功: ${bucket}/${filePath}`);
    } catch (error) {
      console.error('【SupabaseStorage】删除文件错误:', error);
      throw error;
    }
  }

  /**
   * 获取存储桶配置
   */
  getBucketConfig() {
    return {
      ...BUCKETS,
    };
  }

  /**
   * 列出所有存储桶
   */
  async listBuckets(): Promise<string[]> {
    try {
      const { data: buckets, error } = await this.supabase.storage.listBuckets();
      
      if (error) {
        console.error('【SupabaseStorage】列出存储桶失败:', error);
        throw error;
      }
      
      return buckets?.map(b => b.name) || [];
    } catch (error) {
      console.error('【SupabaseStorage】列出存储桶错误:', error);
      throw error;
    }
  }
}

// 导出单例
export const supabaseStorageService = new SupabaseStorageService();
