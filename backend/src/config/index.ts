import dotenv from 'dotenv';

dotenv.config();

export const config = {
  server: {
    port: process.env.PORT ? parseInt(process.env.PORT) : 3001,
    env: process.env.NODE_ENV || 'development',
  },
  database: {
    url: process.env.DATABASE_URL || '',
  },
  jwt: {
    secret: process.env.JWT_SECRET || '',
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  },
  cors: {
    allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
  upload: {
    maxSize: process.env.UPLOAD_MAX_SIZE ? parseInt(process.env.UPLOAD_MAX_SIZE) : 10485760,
    path: process.env.UPLOAD_PATH || './uploads',
  },
  wechat: {
    appId: process.env.WECHAT_APP_ID || '',
    appSecret: process.env.WECHAT_APP_SECRET || '',
  },
  ai: {
    apiKey: process.env.AI_API_KEY || '',
    apiBaseUrl: process.env.AI_API_BASE_URL || '',
  },
};

export default config;
