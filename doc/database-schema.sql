-- ============================================
-- 梦境工坊 (Dreams) 数据库表结构脚本
-- PostgreSQL 14+
-- 生成日期: 2026-04-06
-- ============================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";      -- UUID生成
CREATE EXTENSION IF NOT EXISTS "pg_trgm";        -- 全文搜索支持

-- ============================================
-- 1. 用户相关表
-- ============================================

-- 用户主表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE,                     -- 手机号，匿名用户可为空
    password_hash VARCHAR(255),                   -- 密码哈希，匿名用户可为空
    nickname VARCHAR(100),                        -- 昵称
    avatar_url TEXT,                              -- 头像URL
    gender VARCHAR(10),                           -- 性别: male/female/other
    age INTEGER,                                  -- 年龄
    is_anonymous BOOLEAN DEFAULT false,           -- 是否匿名用户
    device_id VARCHAR(255),                       -- 设备ID，匿名用户标识
    last_login_at TIMESTAMP WITH TIME ZONE,       -- 最后登录时间
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 用户档案表（存储用户额度、统计信息）
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(20) DEFAULT 'guest',             -- 用户等级: guest/registered/subscribed
    image_used INTEGER DEFAULT 0,                 -- 已使用图片生成次数
    video_used INTEGER DEFAULT 0,                 -- 已使用视频生成次数
    story_used INTEGER DEFAULT 0,                 -- 已使用故事生成次数
    eval_window INTEGER DEFAULT 7,                -- 测评时间窗口(天)
    total_dreams INTEGER DEFAULT 0,               -- 梦境记录总数
    total_works INTEGER DEFAULT 0,                -- 作品总数
    streak_days INTEGER DEFAULT 0,                -- 连续记录天数
    last_dream_date DATE,                         -- 最后记录梦境日期
    theme_preference VARCHAR(20) DEFAULT 'system', -- 主题偏好: light/dark/system
    settings JSONB DEFAULT '{}',                  -- 用户设置JSON
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 订阅表
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(20) NOT NULL,                    -- 订阅计划: monthly/yearly
    amount DECIMAL(10, 2) NOT NULL,               -- 金额
    currency VARCHAR(10) DEFAULT 'CNY',           -- 货币
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,   -- 开始时间
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,     -- 结束时间
    status VARCHAR(20) DEFAULT 'active',          -- 状态: active/expired/cancelled/pending
    payment_method VARCHAR(50),                   -- 支付方式
    payment_id VARCHAR(255),                      -- 支付平台订单ID
    metadata JSONB DEFAULT '{}',                  -- 附加信息
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 2. 梦境相关表
-- ============================================

-- 梦境记录表
CREATE TABLE IF NOT EXISTS dream_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,                  -- 梦境标题
    content TEXT NOT NULL,                        -- 梦境内容
    dream_date DATE NOT NULL,                     -- 梦境发生日期
    emotions TEXT[] DEFAULT '{}',                 -- 情绪标签数组
    tags TEXT[] DEFAULT '{}',                     -- 标签数组
    audio_id UUID,                                -- 关联音频ID
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 梦境标签表（标签统计）
CREATE TABLE IF NOT EXISTS dream_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag VARCHAR(50) NOT NULL,                     -- 标签名称
    count INTEGER DEFAULT 1,                      -- 使用次数
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, tag)
);

-- ============================================
-- 3. 音频相关表
-- ============================================

-- 音频记录表
CREATE TABLE IF NOT EXISTS audio_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,                   -- 存储路径
    duration INTEGER,                             -- 时长(秒)
    file_size INTEGER,                            -- 文件大小(字节)
    is_tone_extracted BOOLEAN DEFAULT false,      -- 是否已提取音色
    tone_features JSONB,                          -- 音色特征数据
    metadata JSONB DEFAULT '{}',                  -- 元数据
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 4. 媒资相关表
-- ============================================

-- 媒资资源表（图片/视频/长视频）
CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dream_id UUID REFERENCES dream_entries(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL,                    -- 类型: image/video/long_video
    storage_path TEXT NOT NULL,                   -- 存储路径
    thumbnail_path TEXT,                          -- 缩略图路径
    model_source VARCHAR(50),                     -- AI模型来源
    style VARCHAR(50),                            -- 风格
    ratio VARCHAR(20),                            -- 比例
    duration INTEGER,                             -- 时长(视频类)
    file_size INTEGER DEFAULT 0,                  -- 文件大小
    long_video_script_id UUID,                    -- 关联长视频脚本ID
    is_favorite BOOLEAN DEFAULT false,            -- 是否收藏
    download_count INTEGER DEFAULT 0,             -- 下载次数
    share_count INTEGER DEFAULT 0,                -- 分享次数
    metadata JSONB DEFAULT '{}',                  -- 元数据
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 长视频脚本表
CREATE TABLE IF NOT EXISTS long_video_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dream_id UUID REFERENCES dream_entries(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,                  -- 脚本标题
    content TEXT NOT NULL,                        -- 脚本内容
    scenes JSONB DEFAULT '[]',                    -- 场景列表
    status VARCHAR(20) DEFAULT 'draft',           -- 状态: draft/generating/completed/failed
    model_source VARCHAR(50),                     -- AI模型来源
    metadata JSONB DEFAULT '{}',                  -- 元数据
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 5. 解读相关表
-- ============================================

-- 梦境解读表
CREATE TABLE IF NOT EXISTS interpretations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dream_id UUID REFERENCES dream_entries(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,                    -- 类型: interpretation/evaluation
    content TEXT NOT NULL,                        -- 解读内容
    symbols JSONB DEFAULT '[]',                   -- 符号解读数组
    emotions_analysis JSONB,                      -- 情绪分析
    suggestions TEXT[] DEFAULT '{}',              -- 建议列表
    reference_ids UUID[] DEFAULT '{}',            -- 引用知识库ID数组
    model_source VARCHAR(50),                     -- AI模型来源
    metadata JSONB DEFAULT '{}',                  -- 元数据
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 知识库表
CREATE TABLE IF NOT EXISTS knowledge_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,                  -- 标题
    content TEXT NOT NULL,                        -- 内容
    source VARCHAR(100),                          -- 来源
    category VARCHAR(50),                         -- 分类
    tags TEXT[] DEFAULT '{}',                     -- 标签
    status VARCHAR(20) DEFAULT 'active',          -- 状态: active/inactive
    view_count INTEGER DEFAULT 0,                 -- 浏览次数
    search_vector TSVECTOR,                       -- 全文搜索向量
    metadata JSONB DEFAULT '{}',                  -- 元数据
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 6. 索引创建
-- ============================================

-- 用户表索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_device_id ON users(device_id) WHERE is_anonymous = true;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at);

-- 用户档案索引
CREATE INDEX IF NOT EXISTS idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(tier);

-- 订阅表索引
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_at ON subscriptions(end_at);

-- 梦境表索引
CREATE INDEX IF NOT EXISTS idx_dream_entries_user_id ON dream_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_dream_entries_dream_date ON dream_entries(dream_date);
CREATE INDEX IF NOT EXISTS idx_dream_entries_created_at ON dream_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dream_entries_audio_id ON dream_entries(audio_id);

-- 梦境标签索引
CREATE INDEX IF NOT EXISTS idx_dream_tags_user_id ON dream_tags(user_id);
CREATE INDEX IF NOT EXISTS idx_dream_tags_count ON dream_tags(count DESC);

-- 音频表索引
CREATE INDEX IF NOT EXISTS idx_audio_profiles_user_id ON audio_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_profiles_tone ON audio_profiles(is_tone_extracted) WHERE is_tone_extracted = true;

-- 媒资表索引
CREATE INDEX IF NOT EXISTS idx_media_assets_user_id ON media_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_dream_id ON media_assets(dream_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_type ON media_assets(type);
CREATE INDEX IF NOT EXISTS idx_media_assets_favorite ON media_assets(user_id, is_favorite) WHERE is_favorite = true;
CREATE INDEX IF NOT EXISTS idx_media_assets_created_at ON media_assets(created_at DESC);

-- 长视频脚本索引
CREATE INDEX IF NOT EXISTS idx_long_video_scripts_user_id ON long_video_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_long_video_scripts_dream_id ON long_video_scripts(dream_id);
CREATE INDEX IF NOT EXISTS idx_long_video_scripts_status ON long_video_scripts(status);

-- 解读表索引
CREATE INDEX IF NOT EXISTS idx_interpretations_user_id ON interpretations(user_id);
CREATE INDEX IF NOT EXISTS idx_interpretations_dream_id ON interpretations(dream_id);
CREATE INDEX IF NOT EXISTS idx_interpretations_type ON interpretations(type);
CREATE INDEX IF NOT EXISTS idx_interpretations_created_at ON interpretations(created_at DESC);

-- 知识库索引
CREATE INDEX IF NOT EXISTS idx_knowledge_items_status ON knowledge_items(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_category ON knowledge_items(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_items_search ON knowledge_items USING GIN(search_vector);

-- ============================================
-- 7. 触发器函数
-- ============================================

-- 自动更新 updated_at 字段的函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 为用户表创建触发器
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为用户档案表创建触发器
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为订阅表创建触发器
CREATE TRIGGER update_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为梦境表创建触发器
CREATE TRIGGER update_dream_entries_updated_at
    BEFORE UPDATE ON dream_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为长视频脚本表创建触发器
CREATE TRIGGER update_long_video_scripts_updated_at
    BEFORE UPDATE ON long_video_scripts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 为知识库表创建触发器
CREATE TRIGGER update_knowledge_items_updated_at
    BEFORE UPDATE ON knowledge_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 8. 知识库全文搜索触发器
-- ============================================

-- 自动更新搜索向量的函数
CREATE OR REPLACE FUNCTION update_knowledge_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('chinese', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('chinese', COALESCE(NEW.content, '')), 'B') ||
        setweight(to_tsvector('chinese', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器
CREATE TRIGGER update_knowledge_search_vector_trigger
    BEFORE INSERT OR UPDATE ON knowledge_items
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_search_vector();

-- ============================================
-- 9. 注释说明
-- ============================================

COMMENT ON TABLE users IS '用户主表，存储用户基本信息';
COMMENT ON TABLE user_profiles IS '用户档案表，存储用户额度、统计信息';
COMMENT ON TABLE subscriptions IS '订阅表，存储用户订阅信息';
COMMENT ON TABLE dream_entries IS '梦境记录表，存储用户记录的梦境';
COMMENT ON TABLE dream_tags IS '梦境标签表，存储用户标签使用统计';
COMMENT ON TABLE audio_profiles IS '音频记录表，存储用户录音和音色';
COMMENT ON TABLE media_assets IS '媒资资源表，存储图片/视频/长视频';
COMMENT ON TABLE long_video_scripts IS '长视频脚本表，存储故事脚本';
COMMENT ON TABLE interpretations IS '梦境解读表，存储AI解读结果';
COMMENT ON TABLE knowledge_items IS '知识库表，存储梦境解读知识';
