/**
 * 梦境相关类型定义
 * 根据接口说明文档和数据库设计文档定义
 */

// 梦境实体（数据库表结构）
export interface DreamEntity {
  id: string;
  user_id: string;
  title: string;
  content: string;
  emotions: string[];
  tags: string[];
  audio_id: string | null;
  dream_date: string;
  created_at: string;
  updated_at: string;
}

// 音频信息
export interface AudioInfo {
  id: string;
  url: string;
  duration: number;
  isToneExtracted: boolean;
}

// 梦境详情（完整信息）
export interface DreamDetail {
  id: string;
  title: string;
  content: string;
  emotions: string[];
  tags: string[];
  dream_date: string;
  audio: AudioInfo | null;
  media: {
    images: MediaAsset[];
    videos: MediaAsset[];
    stories: MediaAsset[];
  };
  interpretation: Interpretation | null;
  created_at: string;
  updated_at: string;
}

// 媒资资源
export interface MediaAsset {
  id: string;
  dreamId: string;
  dreamTitle: string;
  type: 'image' | 'video' | 'long_video';
  url: string;
  thumbnailUrl: string;
  style?: string;
  ratio?: string;
  duration?: number;
  scriptId?: string;
  modelSource: string;
  isFavorite: boolean;
  downloadCount: number;
  createdAt: string;
}

// 梦境解读（数据库返回的原始结构）
export interface Interpretation {
  id: string;
  dreamId: string;
  dreamTitle: string;
  type: 'interpretation' | 'evaluation';
  content: string;
  symbols: SymbolInterpretation[];
  emotionsAnalysis?: {
    detected: string[];
    suggestions: string;
  };
  suggestions: string | null;
  metadata?: {
    references?: KnowledgeReference[];
  };
  modelSource: string;
  createdAt: string;
}

// 梦境符号解读
export interface SymbolInterpretation {
  name: string;
  meaning: string;
  description: string;
}

// 知识库引用
export interface KnowledgeReference {
  id: string;
  title: string;
  source: string;
}

// 梦境列表项（列表展示用）
export interface DreamListItem {
  id: string;
  title: string;
  content: string;
  emotions: string[];
  tags: string[];
  dreamDate: string;
  audioId: string | null;
  hasAudio: boolean;
  hasMedia: boolean;
  mediaCount: {
    image: number;
    video: number;
    story: number;
  };
  hasInterpretation: boolean;
  createdAt: string;
}

// 创建梦境DTO
export interface CreateDreamDTO {
  title: string;
  content: string;
  dreamDate: string;
  emotions?: string[];
  tags?: string[];
  audioId?: string;
}

// 更新梦境DTO
export interface UpdateDreamDTO {
  title?: string;
  content?: string;
  dreamDate?: string;
  emotions?: string[];
  tags?: string[];
  audioId?: string;
}

// 梦境查询参数
export interface DreamQueryParams {
  period?: 'today' | 'weekly' | 'all';
  search?: string;
  page?: number;
  pageSize?: number;
}

// 梦境作品（用于详情页展示）
export interface DreamWorks {
  images: MediaAsset[];
  videos: MediaAsset[];
  stories: MediaAsset[];
  interpretation: Interpretation | null;
}

// 分页结果
export interface PaginatedResult<T> {
  list: T[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}
