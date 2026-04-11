"use strict";
/**
 * 自定义错误类
 * 用于统一错误处理和响应
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.RetryExhaustedError = exports.ExternalAPIError = exports.AIServiceError = exports.ConflictError = exports.ForbiddenError = exports.UnauthorizedError = exports.NotFoundError = exports.ValidationError = exports.AppError = void 0;
class AppError extends Error {
    constructor(message, statusCode = 500, isOperational = true) {
        super(message);
        this.message = message;
        this.statusCode = statusCode;
        this.isOperational = isOperational;
        Object.setPrototypeOf(this, AppError.prototype);
        Error.captureStackTrace(this, this.constructor);
    }
}
exports.AppError = AppError;
class ValidationError extends AppError {
    constructor(message, errors) {
        super(message, 400);
        this.errors = errors;
    }
}
exports.ValidationError = ValidationError;
class NotFoundError extends AppError {
    constructor(message = 'Resource not found') {
        super(message, 404);
    }
}
exports.NotFoundError = NotFoundError;
class UnauthorizedError extends AppError {
    constructor(message = 'Unauthorized') {
        super(message, 401);
    }
}
exports.UnauthorizedError = UnauthorizedError;
class ForbiddenError extends AppError {
    constructor(message = 'Forbidden') {
        super(message, 403);
    }
}
exports.ForbiddenError = ForbiddenError;
class ConflictError extends AppError {
    constructor(message) {
        super(message, 409);
    }
}
exports.ConflictError = ConflictError;
/**
 * AI 服务相关错误
 */
class AIServiceError extends AppError {
    constructor(message, provider, originalError) {
        super(message, 503);
        this.provider = provider;
        this.originalError = originalError;
    }
}
exports.AIServiceError = AIServiceError;
/**
 * 外部 API 调用错误
 */
class ExternalAPIError extends AppError {
    constructor(message, statusCode, responseData) {
        super(message, statusCode);
        this.statusCode = statusCode;
        this.responseData = responseData;
    }
}
exports.ExternalAPIError = ExternalAPIError;
/**
 * 重试耗尽错误
 */
class RetryExhaustedError extends AppError {
    constructor(message, attempts, lastError) {
        super(message, 503);
        this.attempts = attempts;
        this.lastError = lastError;
    }
}
exports.RetryExhaustedError = RetryExhaustedError;
