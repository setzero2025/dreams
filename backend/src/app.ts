/**
 * Express 应用主入口
 * 配置中间件和路由
 */

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'path';
import routes from './routes';
import { config } from './config';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/error-handler';

const app = express();

// 禁用 ETag，避免 304 缓存问题
app.set('etag', false);

// ==================== 安全中间件 ====================

// Helmet 安全头（禁用缓存相关头）
app.use(helmet({
  noSniff: true,
  xssFilter: true,
  hidePoweredBy: true,
}));

// CORS 配置 - 允许所有来源
app.use(cors({
  origin: '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-ID', 'X-Device-ID'],
}));

// ==================== 日志中间件 ====================

// HTTP 请求日志
app.use(morgan('combined', {
  stream: {
    write: (message: string) => logger.info(message.trim()),
  },
}));

// ==================== 禁用缓存中间件 ====================
// 为所有 API 响应添加禁用缓存的头，避免 304 问题
app.use((req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  next();
});

// ==================== 解析中间件 ====================

// JSON 解析
app.use(express.json({ limit: '10mb' }));

// URL 编码解析
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ==================== 静态文件服务 ====================

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ==================== 路由 ====================

app.use(routes);

// ==================== 404 处理 ====================

app.use('*', (req, res) => {
  res.status(404).json({
    code: 404,
    message: 'API路径不存在',
    data: null,
    timestamp: Date.now(),
  });
});

// ==================== 错误处理 ====================

// 全局错误处理中间件（必须放在最后）
app.use(errorHandler);

export default app;
