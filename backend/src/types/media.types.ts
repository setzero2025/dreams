/**
 * 媒资相关类型定义
 */

// 媒资类型枚举
export enum MediaType {
  IMAGE = 'image',
  VIDEO = 'video',
  LONG_VIDEO = 'long_video',
  AUDIO = 'audio',
}

// 媒资实体（数据库表结构）
export interface MediaEntity {
  id: string;
  user_id: string;
  dream_id: string;
  type: MediaType;
  storage_path: string;
  thumbnail_path: string | null;
  model_source: string;
  style: string | null;
  ratio: string | null;
  duration: number | null;
  file_size: number;
  long_video_script_id: string | null;
  is_favorite: boolean;
  download_count: number;
  share_count: number;
  metadata: Record<string, any>;
  created_at: string;
}

// 创建媒资DTO
export interface CreateMediaDTO {
  dreamId: string;
  type: MediaType;
  storagePath: string;
  thumbnailPath?: string;
  modelSource: string;
  style?: string;
  ratio?: string;
  duration?: number;
  fileSize: number;
  longVideoScriptId?: string;
  metadata?: Record<string, any>;
}

// 媒资查询参数
export interface MediaQueryParams {
  dreamId?: string;
  type?: MediaType;
  isFavorite?: boolean;
  page?: number;
  pageSize?: number;
}

// 媒资统计
export interface MediaCount {
  image: number;
  video: number;
  story: number;
}

// 音频实体
export interface AudioEntity {
  id: string;
  user_id: string;
  dream_id: string | null;
  storage_path: string;
  tone_vector: Record<string, any> | null;
  duration: number;
  file_size: number;
  mime_type: string;
  is_tone_extracted: boolean;
  metadata: Record<string, any>;
  created_at: string;
}

// 创建音频DTO
export interface CreateAudioDTO {
  dreamId?: string;
  storagePath: string;
  duration: number;
  fileSize: number;
  mimeType: string;
  extractTone?: boolean;
}

// 长视频剧本实体
export interface LongVideoScriptEntity {
  id: string;
  dream_id: string;
  user_id: string;
  script_json: Record<string, any>;
  scenes: SceneInfo[];
  status: ScriptStatus;
  progress: number;
  current_step: string | null;
  error_message: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// 剧本状态
export enum ScriptStatus {
  PENDING = 'pending',
  SCRIPT_GENERATED = 'script_generated',
  KEYFRAMES_GENERATED = 'keyframes_generated',
  VIDEOS_GENERATED = 'videos_generated',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

// 场景信息
export interface SceneInfo {
  index: number;
  description: string;
  keyframeUrl?: string;
  videoUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

// 图片风格
export enum ImageStyle {
  GUOCHAO = 'guochao',
  CYBERPUNK = 'cyberpunk',
  OILPAINTING = 'oilpainting',
  ANIME = 'anime',
  SCIFI = 'sci-fi',
}

// 图片风格配置
export const IMAGE_STYLE_CONFIG: Record<ImageStyle, { id: string; name: string }> = {
  [ImageStyle.GUOCHAO]: { id: 'guochao', name: '国潮' },
  [ImageStyle.CYBERPUNK]: { id: 'cyberpunk', name: '赛博' },
  [ImageStyle.OILPAINTING]: { id: 'oilpainting', name: '油画' },
  [ImageStyle.ANIME]: { id: 'anime', name: '动漫' },
  [ImageStyle.SCIFI]: { id: 'sci-fi', name: '科幻' },
};
