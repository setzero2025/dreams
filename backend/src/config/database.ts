/**
 * PostgreSQL 数据库连接配置
 * 统一使用 pg 库直接连接 Supabase PostgreSQL
 * 
 * 支持两种配置方式：
 * 1. DATABASE_URL: 完整的连接字符串（推荐，优先级高）
 * 2. DB_HOST/DB_PORT/DB_NAME/DB_USER/DB_PASSWORD: 独立配置项
 */

import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

// 解析 DATABASE_URL
function parseDatabaseUrl(url: string) {
  const match = url.match(/^postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/(.+)$/);
  if (!match) {
    throw new Error('Invalid DATABASE_URL format');
  }
  const [, user, password, host, port, database] = match;
  return {
    host,
    port: parseInt(port),
    database,
    user,
    password,
  };
}

// 构建数据库配置
function buildDbConfig() {
  // 基础配置（包含UTF8编码）
  const baseConfig = {
    // 设置客户端编码为UTF8
    client_encoding: 'UTF8',
    application_name: 'dreams_app',
    max: 20,
    min: 5,  // 保持最小连接数
    idleTimeoutMillis: 300000,  // 5分钟不活动才断开
    connectionTimeoutMillis: 10000,  // 增加连接超时时间到10秒
    keepAlive: true,  // 保持连接
    keepAliveInitialDelayMillis: 10000,  // 10秒后开始发送keepalive
  };

  // 优先使用 DATABASE_URL
  if (process.env.DATABASE_URL) {
    try {
      const parsed = parseDatabaseUrl(process.env.DATABASE_URL);
      console.log('✅ 使用 DATABASE_URL 连接数据库');
      return {
        ...parsed,
        ...baseConfig,
        ssl: { rejectUnauthorized: false },
      };
    } catch (error) {
      console.warn('⚠️  DATABASE_URL 格式无效，尝试使用独立配置');
    }
  }

  // 使用独立配置
  if (process.env.DB_HOST && process.env.DB_PASSWORD) {
    console.log('✅ 使用独立配置连接数据库');
    return {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'postgres',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD,
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
      ...baseConfig,
    };
  }

  throw new Error(
    '数据库配置缺失。请在 .env 文件中配置以下其中一组：\n' +
    '1. DATABASE_URL=postgresql://user:pass@host:port/db\n' +
    '2. DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD'
  );
}

// 数据库配置
const dbConfig = buildDbConfig();

// 创建连接池
export const pool = new Pool(dbConfig);

// 连接池事件监听
pool.on('connect', (client: any) => {
  console.log('✅ 数据库连接已建立');
});

pool.on('error', (err: any) => {
  console.error('❌ 数据库连接池错误:', err);
});

pool.on('remove', () => {
  console.log('🔌 数据库连接已移除');
});

/**
 * 获取数据库连接
 */
export async function getClient(): Promise<PoolClient> {
  return pool.connect();
}

/**
 * 执行查询（自动管理连接）
 */
export async function query(text: string, params?: any[]) {
  const client = await pool.connect();
  try {
    const result = await client.query(text, params);
    return result;
  } finally {
    client.release();
  }
}

/**
 * 执行事务
 */
export async function withTransaction<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * 测试数据库连接
 */
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const result = await query('SELECT NOW() as current_time');
    console.log('✅ 数据库连接成功，当前时间:', result.rows[0].current_time);
    return true;
  } catch (error) {
    console.error('❌ 数据库连接失败:', error);
    return false;
  }
}

/**
 * 初始化数据库表结构
 */
export async function initializeDatabaseTables(): Promise<void> {
  try {
    const sqlFilePath = path.join(__dirname, 'init-database.sql');
    
    if (!fs.existsSync(sqlFilePath)) {
      console.warn('⚠️  数据库初始化脚本不存在:', sqlFilePath);
      return;
    }

    const sql = fs.readFileSync(sqlFilePath, 'utf-8');
    
    // 按分号分割 SQL 语句
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const statement of statements) {
      try {
        await query(statement);
      } catch (error: any) {
        // 忽略表已存在的错误
        if (error.code === '42P07') {
          console.log(`表已存在，跳过: ${statement.substring(0, 50)}...`);
        } else {
          console.error('执行 SQL 失败:', error.message);
          console.error('SQL:', statement.substring(0, 100));
        }
      }
    }

    console.log('✅ 数据库表初始化完成');
  } catch (error) {
    console.error('❌ 数据库表初始化失败:', error);
    throw error;
  }
}

/**
 * 初始化数据库
 * 测试连接并创建表结构
 */
export async function initializeDatabase(): Promise<void> {
  const connected = await testDatabaseConnection();
  if (!connected) {
    throw new Error('数据库初始化失败');
  }

  // 初始化表结构
  await initializeDatabaseTables();
}

/**
 * 关闭数据库连接池
 */
export async function closePool(): Promise<void> {
  await pool.end();
  console.log('🔌 数据库连接池已关闭');
}

/**
 * 获取数据库连接池实例
 * 用于需要直接操作连接池的场景
 */
export function getDbPool(): Pool {
  return pool;
}

// 数据库表名配置
export const TABLES = {
  // 用户相关
  USER_PROFILES: 'user_profiles',
  AUTH_USERS: 'auth_users',
  USER_SETTINGS: 'user_settings',
  VOICE_PROFILES: 'voice_profiles',

  // 梦境相关
  DREAMS: 'dreams',
  DREAM_TAGS: 'dream_tags',
  DREAM_IMAGES: 'dream_images',

  // AI 创作生成
  GENERATIONS: 'generations',
  GENERATION_SCENES: 'generation_scenes',
  
  // 梦境解读
  INTERPRETATIONS: 'interpretations',
  SYMBOL_INTERPRETATIONS: 'symbol_interpretations',
  EMOTION_ANALYSES: 'emotion_analyses',
  INTERPRETATION_SUGGESTIONS: 'interpretation_suggestions',
  
  // 知识库
  KNOWLEDGE_BASE: 'knowledge_base',
  USER_KNOWLEDGE_FAVORITES: 'user_knowledge_favorites',
  
  // AI 对话
  CHAT_SESSIONS: 'chat_sessions',
  CHAT_MESSAGES: 'chat_messages',
  
  // 使用统计
  USAGE_STATS: 'usage_stats',
} as const;

// 视图配置
export const VIEWS = {
  DREAM_STATS: 'v_dream_stats',
  USER_USAGE_STATS: 'v_user_usage_stats',
} as const;

// 存储桶配置
export const STORAGE_BUCKETS = {
  IMAGES: 'dream-images',
  VIDEOS: 'dream-videos',
  AVATARS: 'avatars',
} as const;

export default pool;
