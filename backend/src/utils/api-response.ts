/**
 * API 统一响应格式
 * 根据接口说明文档规范实现
 */

// 统一响应结构
export interface ApiResponse<T = any> {
  code: number;        // 业务状态码
  message: string;     // 提示信息
  data: T;            // 响应数据
  timestamp: number;   // 时间戳
  requestId?: string;  // 请求追踪ID
  errors?: Array<{ field: string; message: string }>; // 详细错误信息
}

// 分页响应结构
export interface PaginatedResponse<T = any> {
  code: number;
  message: string;
  data: {
    list: T[];
    pagination: {
      page: number;
      pageSize: number;
      total: number;
      totalPages: number;
    };
  };
  timestamp: number;
  requestId?: string;
}

/**
 * 生成请求ID
 */
function generateRequestId(): string {
  return `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * 成功响应
 */
export function successResponse<T>(data: T, message: string = 'success'): ApiResponse<T> {
  return {
    code: 200,
    message,
    data,
    timestamp: Date.now(),
    requestId: generateRequestId(),
  };
}

/**
 * 创建成功响应
 */
export function createdResponse<T>(data: T, message: string = '创建成功'): ApiResponse<T> {
  return {
    code: 201,
    message,
    data,
    timestamp: Date.now(),
    requestId: generateRequestId(),
  };
}

/**
 * 删除成功响应（无内容）
 */
export function noContentResponse(message: string = '删除成功'): ApiResponse<null> {
  return {
    code: 204,
    message,
    data: null,
    timestamp: Date.now(),
    requestId: generateRequestId(),
  };
}

/**
 * 错误响应
 */
export function errorResponse(
  code: number,
  message: string,
  errors?: Array<{ field: string; message: string }>
): ApiResponse<null> {
  return {
    code,
    message,
    data: null,
    timestamp: Date.now(),
    requestId: generateRequestId(),
    ...(errors && { errors }),
  };
}

/**
 * 分页响应
 */
export function paginatedResponse<T>(
  list: T[],
  page: number,
  pageSize: number,
  total: number,
  message: string = 'success'
): PaginatedResponse<T> {
  const totalPages = Math.ceil(total / pageSize);
  return {
    code: 200,
    message,
    data: {
      list,
      pagination: {
        page,
        pageSize,
        total,
        totalPages,
      },
    },
    timestamp: Date.now(),
    requestId: generateRequestId(),
  };
}

/**
 * HTTP状态码与业务码映射
 */
export const HTTP_STATUS_MAP = {
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
} as const;

/**
 * 业务错误码
 */
export const BUSINESS_CODES = {
  // 成功
  SUCCESS: 200,
  CREATED: 201,
  
  // 客户端错误
  BAD_REQUEST: 400,
  VALIDATION_ERROR: 40001,
  INVALID_PHONE: 40002,
  INVALID_PASSWORD: 40003,
  PASSWORD_MISMATCH: 40004,
  
  // 认证错误
  UNAUTHORIZED: 401,
  TOKEN_EXPIRED: 40101,
  TOKEN_INVALID: 40102,
  
  // 权限错误
  FORBIDDEN: 403,
  NO_PERMISSION: 40301,
  
  // 资源错误
  NOT_FOUND: 404,
  DREAM_NOT_FOUND: 40401,
  MEDIA_NOT_FOUND: 40402,
  
  // 配额错误
  QUOTA_EXCEEDED: 429,
  IMAGE_QUOTA_EXCEEDED: 42901,
  VIDEO_QUOTA_EXCEEDED: 42902,
  STORY_QUOTA_EXCEEDED: 42903,
  RATE_LIMIT: 42904,
  
  // 服务端错误
  INTERNAL_ERROR: 500,
  AI_SERVICE_ERROR: 50301,
  VOICE_SERVICE_ERROR: 50302,
  VIDEO_SERVICE_ERROR: 50303,
} as const;
