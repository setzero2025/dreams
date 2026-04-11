/**
 * 梦境解读相关类型定义
 */

// 解读类型
export enum InterpretationType {
  INTERPRETATION = 'interpretation',
  EVALUATION = 'evaluation',
}

// 解读实体（数据库表结构）
export interface InterpretationEntity {
  id: string;
  user_id: string;
  dream_id: string | null;
  type: InterpretationType;
  content: string;
  symbols: SymbolInterpretation[];
  emotions_analysis: EmotionsAnalysis | null;
  suggestions: string[];
  reference_ids: string[];
  model_source: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

// 梦境符号解读
export interface SymbolInterpretation {
  name: string;
  meaning: string;
  description: string;
}

// 情绪分析
export interface EmotionsAnalysis {
  detected: string[];
  suggestions: string;
}

// 知识库引用
export interface KnowledgeReference {
  id: string;
  title: string;
  source: string;
}

// 创建解读DTO
export interface CreateInterpretationDTO {
  dreamId: string;
  type: InterpretationType;
  content: string;
  symbols?: SymbolInterpretation[];
  emotionsAnalysis?: EmotionsAnalysis;
  suggestions?: string[];
  referenceIds?: string[];
  modelSource?: string;
}

// 解读查询参数
export interface InterpretationQueryParams {
  dreamId?: string;
  type?: InterpretationType;
  page?: number;
  pageSize?: number;
}

// 知识库条目实体
export interface KnowledgeItemEntity {
  id: string;
  title: string;
  content: string;
  source: string;
  category: string | null;
  tags: string[];
  status: 'active' | 'inactive';
  view_count: number;
  search_vector: string | null;
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// 知识库查询参数
export interface KnowledgeQueryParams {
  query?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}

// 测评结果
export interface EvaluationResult {
  id: string;
  windowDays: number;
  dreamCount: number;
  analysisPeriod: {
    startDate: string;
    endDate: string;
  };
  emotionsSummary: {
    dominant: string[];
    chart: {
      emotion: string;
      count: number;
      percentage: number;
    }[];
  };
  symbolsSummary: {
    frequent: {
      symbol: string;
      count: number;
    }[];
  };
  patternsDetected: {
    pattern: string;
    description: string;
  }[];
  psychologyInsights: {
    stressLevel: string;
    emotionalState: string;
    mainConcerns: string[];
    positiveSigns: string[];
  };
  suggestions: string[];
  modelSource: string;
  createdAt: string;
}

// 创建测评DTO
export interface CreateEvaluationDTO {
  windowDays: number;
}
