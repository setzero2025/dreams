-- ============================================================
-- 梦境空间（hasDream）数据库初始化脚本
-- 数据库：PostgreSQL 15+ (Supabase)
-- 版本：v2.0
-- 生成日期：2026-04-06
-- 说明：根据当前代码重新生成，包含完整的表结构、索引、触发器和函数
-- ============================================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================
-- 1. 用户相关表
-- ============================================================

-- 用户主表
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    phone VARCHAR(20) UNIQUE,
    password_hash VARCHAR(255),
    nickname VARCHAR(100),
    avatar_url TEXT,
    gender VARCHAR(10) CHECK (gender IN ('male', 'female', 'other')),
    age INTEGER CHECK (age >= 0 AND age <= 150),
    is_anonymous BOOLEAN DEFAULT FALSE NOT NULL,
    device_id VARCHAR(255),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE users IS '用户主表，存储用户基础信息，支持注册用户和匿名用户';
COMMENT ON COLUMN users.phone IS '手机号，注册用户必填，匿名用户可为空';
COMMENT ON COLUMN users.password_hash IS '密码哈希值，使用BCrypt加密';
COMMENT ON COLUMN users.nickname IS '用户昵称';
COMMENT ON COLUMN users.avatar_url IS '头像URL地址';
COMMENT ON COLUMN users.gender IS '性别：male男性/female女性/other其他';
COMMENT ON COLUMN users.age IS '年龄，范围0-150';
COMMENT ON COLUMN users.is_anonymous IS '是否为匿名用户，默认FALSE';
COMMENT ON COLUMN users.device_id IS '匿名用户设备标识';
COMMENT ON COLUMN users.last_login_at IS '最后登录时间';
COMMENT ON COLUMN users.created_at IS '创建时间';
COMMENT ON COLUMN users.updated_at IS '更新时间';

-- 用户档案表
CREATE TABLE IF NOT EXISTS user_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tier VARCHAR(20) DEFAULT 'guest' NOT NULL CHECK (tier IN ('guest', 'registered', 'subscribed')),
    image_used INTEGER DEFAULT 0 NOT NULL CHECK (image_used >= 0),
    video_used INTEGER DEFAULT 0 NOT NULL CHECK (video_used >= 0),
    story_used INTEGER DEFAULT 0 NOT NULL CHECK (story_used >= 0),
    eval_window INTEGER DEFAULT 7 NOT NULL CHECK (eval_window IN (7, 15, 30)),
    total_dreams INTEGER DEFAULT 0 NOT NULL,
    total_works INTEGER DEFAULT 0 NOT NULL,
    streak_days INTEGER DEFAULT 0 NOT NULL,
    last_dream_date DATE,
    theme_preference VARCHAR(20) DEFAULT 'system' NOT NULL CHECK (theme_preference IN ('light', 'dark', 'system')),
    settings JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE user_profiles IS '用户档案表，存储用户额度、统计信息和偏好设置';
COMMENT ON COLUMN user_profiles.tier IS '用户等级：guest访客/registered注册用户/subscribed订阅用户';
COMMENT ON COLUMN user_profiles.image_used IS '已使用图片生成次数';
COMMENT ON COLUMN user_profiles.video_used IS '已使用视频生成次数';
COMMENT ON COLUMN user_profiles.story_used IS '已使用故事生成次数';
COMMENT ON COLUMN user_profiles.eval_window IS '测评时间窗口（天）：7/15/30';
COMMENT ON COLUMN user_profiles.total_dreams IS '累计梦境数量';
COMMENT ON COLUMN user_profiles.total_works IS '累计作品数量';
COMMENT ON COLUMN user_profiles.streak_days IS '连续记录天数';
COMMENT ON COLUMN user_profiles.last_dream_date IS '最后记录梦境日期';
COMMENT ON COLUMN user_profiles.theme_preference IS '主题偏好：light浅色/dark深色/system跟随系统';
COMMENT ON COLUMN user_profiles.settings IS '扩展设置字段，JSON格式';

-- 订阅表
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    plan VARCHAR(20) NOT NULL CHECK (plan IN ('monthly', 'yearly')),
    amount DECIMAL(10, 2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'CNY' NOT NULL,
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'expired', 'cancelled', 'pending')),
    payment_method VARCHAR(50),
    payment_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE subscriptions IS '订阅表，存储用户订阅信息';
COMMENT ON COLUMN subscriptions.plan IS '订阅计划：monthly月订/yearly年订';
COMMENT ON COLUMN subscriptions.amount IS '订阅金额';
COMMENT ON COLUMN subscriptions.currency IS '货币类型，默认CNY人民币';
COMMENT ON COLUMN subscriptions.start_at IS '订阅开始时间';
COMMENT ON COLUMN subscriptions.end_at IS '订阅结束时间';
COMMENT ON COLUMN subscriptions.status IS '订阅状态：active有效/expired过期/cancelled取消/pending待支付';
COMMENT ON COLUMN subscriptions.payment_method IS '支付方式';
COMMENT ON COLUMN subscriptions.payment_id IS '支付平台订单号';

-- ============================================================
-- 2. 梦境相关表
-- ============================================================

-- 音频记录表
CREATE TABLE IF NOT EXISTS audio_profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    storage_path TEXT NOT NULL,
    duration INTEGER CHECK (duration > 0),
    file_size BIGINT CHECK (file_size > 0),
    mime_type VARCHAR(50) DEFAULT 'audio/wav',
    is_tone_extracted BOOLEAN DEFAULT FALSE NOT NULL,
    tone_features JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE audio_profiles IS '音频记录表，存储语音录音和音色特征';
COMMENT ON COLUMN audio_profiles.storage_path IS 'Supabase Storage中的存储路径';
COMMENT ON COLUMN audio_profiles.duration IS '音频时长（秒）';
COMMENT ON COLUMN audio_profiles.file_size IS '文件大小（字节）';
COMMENT ON COLUMN audio_profiles.mime_type IS '音频MIME类型';
COMMENT ON COLUMN audio_profiles.is_tone_extracted IS '是否已提取音色特征';
COMMENT ON COLUMN audio_profiles.tone_features IS '音色特征数据，JSON格式';

-- 梦境记录表
CREATE TABLE IF NOT EXISTS dream_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    dream_date DATE NOT NULL,
    emotions TEXT[] DEFAULT '{}'::text[],
    tags TEXT[] DEFAULT '{}'::text[],
    audio_id UUID REFERENCES audio_profiles(id) ON DELETE SET NULL,
    is_synced BOOLEAN DEFAULT FALSE NOT NULL,
    local_id VARCHAR(50),
    search_vector TSVECTOR,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE dream_entries IS '梦境记录表，存储用户记录的梦境内容';
COMMENT ON COLUMN dream_entries.title IS '梦境标题';
COMMENT ON COLUMN dream_entries.content IS '梦境内容描述';
COMMENT ON COLUMN dream_entries.dream_date IS '梦境发生的日期';
COMMENT ON COLUMN dream_entries.emotions IS '情绪标签数组';
COMMENT ON COLUMN dream_entries.tags IS '自定义标签数组';
COMMENT ON COLUMN dream_entries.audio_id IS '关联音频记录ID';
COMMENT ON COLUMN dream_entries.is_synced IS '是否已同步到云端';
COMMENT ON COLUMN dream_entries.local_id IS '客户端本地ID';
COMMENT ON COLUMN dream_entries.search_vector IS '全文搜索向量';

-- 梦境标签表
CREATE TABLE IF NOT EXISTS dream_tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    tag VARCHAR(50) NOT NULL,
    count INTEGER DEFAULT 1 NOT NULL,
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    UNIQUE(user_id, tag)
);

COMMENT ON TABLE dream_tags IS '梦境标签表，统计用户标签使用情况';
COMMENT ON COLUMN dream_tags.tag IS '标签名称';
COMMENT ON COLUMN dream_tags.count IS '使用次数';
COMMENT ON COLUMN dream_tags.last_used_at IS '最后使用时间';

-- ============================================================
-- 3. 媒资相关表
-- ============================================================

-- 长视频脚本表
CREATE TABLE IF NOT EXISTS long_video_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    dream_id UUID NOT NULL REFERENCES dream_entries(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    scenes JSONB DEFAULT '[]'::jsonb NOT NULL,
    status VARCHAR(20) DEFAULT 'pending' NOT NULL 
        CHECK (status IN ('pending', 'script_generated', 'keyframes_generated', 'videos_generated', 'completed', 'failed')),
    progress INTEGER DEFAULT 0 NOT NULL CHECK (progress >= 0 AND progress <= 100),
    current_step VARCHAR(100),
    error_message TEXT,
    model_source VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE long_video_scripts IS '长视频脚本表，存储梦境剧情长视频的剧本和生成状态';
COMMENT ON COLUMN long_video_scripts.dream_id IS '关联梦境ID';
COMMENT ON COLUMN long_video_scripts.title IS '脚本标题';
COMMENT ON COLUMN long_video_scripts.content IS '脚本内容';
COMMENT ON COLUMN long_video_scripts.scenes IS '场景数组，存储每个场景的生成状态';
COMMENT ON COLUMN long_video_scripts.status IS '生成状态';
COMMENT ON COLUMN long_video_scripts.progress IS '生成进度百分比';
COMMENT ON COLUMN long_video_scripts.current_step IS '当前步骤描述';
COMMENT ON COLUMN long_video_scripts.error_message IS '错误信息';
COMMENT ON COLUMN long_video_scripts.model_source IS 'AI模型来源';

-- 媒资资源表
CREATE TABLE IF NOT EXISTS media_assets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dream_id UUID REFERENCES dream_entries(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('image', 'video', 'long_video')),
    storage_path TEXT NOT NULL,
    thumbnail_path TEXT,
    model_source VARCHAR(50),
    style VARCHAR(50),
    ratio VARCHAR(10) CHECK (ratio IN ('9:16', '16:9', '1:1')),
    duration INTEGER CHECK (duration > 0),
    file_size BIGINT NOT NULL CHECK (file_size > 0),
    long_video_script_id UUID REFERENCES long_video_scripts(id) ON DELETE SET NULL,
    is_favorite BOOLEAN DEFAULT FALSE NOT NULL,
    download_count INTEGER DEFAULT 0 NOT NULL,
    share_count INTEGER DEFAULT 0 NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE media_assets IS '媒资资源表，存储生成的图片、视频等媒体资源';
COMMENT ON COLUMN media_assets.type IS '媒资类型：image图片/video视频/long_video长视频';
COMMENT ON COLUMN media_assets.storage_path IS 'Supabase Storage中的存储路径';
COMMENT ON COLUMN media_assets.thumbnail_path IS '缩略图/封面图路径';
COMMENT ON COLUMN media_assets.model_source IS '生成模型来源';
COMMENT ON COLUMN media_assets.style IS '图片风格';
COMMENT ON COLUMN media_assets.ratio IS '宽高比';
COMMENT ON COLUMN media_assets.duration IS '视频时长（秒）';
COMMENT ON COLUMN media_assets.file_size IS '文件大小（字节）';
COMMENT ON COLUMN media_assets.long_video_script_id IS '关联长视频脚本ID';
COMMENT ON COLUMN media_assets.is_favorite IS '是否收藏';
COMMENT ON COLUMN media_assets.download_count IS '下载次数';
COMMENT ON COLUMN media_assets.share_count IS '分享次数';

-- ============================================================
-- 4. AI生成任务表
-- ============================================================

CREATE TABLE IF NOT EXISTS ai_generation_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dream_id UUID REFERENCES dream_entries(id) ON DELETE SET NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('image', 'video', 'story', 'interpretation')),
    status VARCHAR(20) DEFAULT 'queued' NOT NULL 
        CHECK (status IN ('queued', 'processing', 'partial', 'completed', 'failed', 'cancelled')),
    progress INTEGER DEFAULT 0 NOT NULL CHECK (progress >= 0 AND progress <= 100),
    current_step VARCHAR(100),
    model_source VARCHAR(50),
    params JSONB DEFAULT '{}'::jsonb,
    result JSONB,
    error JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE ai_generation_tasks IS 'AI生成任务表，跟踪AI生成任务的状态和进度';
COMMENT ON COLUMN ai_generation_tasks.type IS '任务类型';
COMMENT ON COLUMN ai_generation_tasks.status IS '任务状态';
COMMENT ON COLUMN ai_generation_tasks.progress IS '任务进度百分比';
COMMENT ON COLUMN ai_generation_tasks.current_step IS '当前步骤描述';
COMMENT ON COLUMN ai_generation_tasks.model_source IS '使用的AI模型来源';
COMMENT ON COLUMN ai_generation_tasks.params IS '任务参数';
COMMENT ON COLUMN ai_generation_tasks.result IS '任务结果';
COMMENT ON COLUMN ai_generation_tasks.error IS '错误信息';

-- ============================================================
-- 5. 解梦与知识库表
-- ============================================================

-- 解梦结果表
CREATE TABLE IF NOT EXISTS interpretations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    dream_id UUID REFERENCES dream_entries(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('interpretation', 'evaluation')),
    content TEXT NOT NULL,
    symbols JSONB DEFAULT '[]'::jsonb,
    emotions_analysis JSONB,
    suggestions TEXT[] DEFAULT '{}'::text[],
    reference_ids UUID[] DEFAULT '{}'::uuid[],
    model_source VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE interpretations IS '解梦结果表，存储梦境解读和心理测评结果';
COMMENT ON COLUMN interpretations.type IS '类型：interpretation解梦/evaluation心理测评';
COMMENT ON COLUMN interpretations.content IS '解读内容';
COMMENT ON COLUMN interpretations.symbols IS '梦境符号解析数组';
COMMENT ON COLUMN interpretations.emotions_analysis IS '情绪分析结果';
COMMENT ON COLUMN interpretations.suggestions IS '建议数组';
COMMENT ON COLUMN interpretations.reference_ids IS '引用的知识库条目ID数组';
COMMENT ON COLUMN interpretations.model_source IS '使用的AI模型来源';

-- 知识库表
CREATE TABLE IF NOT EXISTS knowledge_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    source VARCHAR(200) NOT NULL,
    category VARCHAR(50),
    tags TEXT[] DEFAULT '{}'::text[],
    status VARCHAR(20) DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'inactive')),
    view_count INTEGER DEFAULT 0 NOT NULL,
    search_vector TSVECTOR,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE knowledge_items IS '知识库表，存储解梦知识库内容';
COMMENT ON COLUMN knowledge_items.title IS '知识条目标题';
COMMENT ON COLUMN knowledge_items.content IS '知识条目内容';
COMMENT ON COLUMN knowledge_items.source IS '知识来源，如周公解梦/心理学';
COMMENT ON COLUMN knowledge_items.category IS '分类';
COMMENT ON COLUMN knowledge_items.tags IS '标签数组';
COMMENT ON COLUMN knowledge_items.status IS '状态：active有效/inactive无效';
COMMENT ON COLUMN knowledge_items.view_count IS '查看次数';
COMMENT ON COLUMN knowledge_items.search_vector IS '全文搜索向量';

-- ============================================================
-- 6. 创建索引
-- ============================================================

-- users表索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone) WHERE phone IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id) WHERE is_anonymous = TRUE;
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);

-- user_profiles表索引
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON user_profiles(tier);

-- subscriptions表索引
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_at ON subscriptions(end_at);

-- dream_entries表索引
CREATE INDEX IF NOT EXISTS idx_dreams_user_id ON dream_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_dreams_dream_date ON dream_entries(dream_date);
CREATE INDEX IF NOT EXISTS idx_dreams_created_at ON dream_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dreams_user_date ON dream_entries(user_id, dream_date DESC);
CREATE INDEX IF NOT EXISTS idx_dreams_search ON dream_entries USING GIN(search_vector);

-- audio_profiles表索引
CREATE INDEX IF NOT EXISTS idx_audio_user_id ON audio_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_created_at ON audio_profiles(created_at DESC);

-- media_assets表索引
CREATE INDEX IF NOT EXISTS idx_media_user_id ON media_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_media_dream_id ON media_assets(dream_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON media_assets(type);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_favorite ON media_assets(user_id, is_favorite) WHERE is_favorite = TRUE;

-- long_video_scripts表索引
CREATE INDEX IF NOT EXISTS idx_scripts_dream_id ON long_video_scripts(dream_id);
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON long_video_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_status ON long_video_scripts(status);

-- ai_generation_tasks表索引
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON ai_generation_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dream_id ON ai_generation_tasks(dream_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON ai_generation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type_status ON ai_generation_tasks(type, status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON ai_generation_tasks(created_at DESC);

-- interpretations表索引
CREATE INDEX IF NOT EXISTS idx_interpretations_user_id ON interpretations(user_id);
CREATE INDEX IF NOT EXISTS idx_interpretations_dream_id ON interpretations(dream_id);
CREATE INDEX IF NOT EXISTS idx_interpretations_type ON interpretations(type);
CREATE INDEX IF NOT EXISTS idx_interpretations_created_at ON interpretations(created_at DESC);

-- knowledge_items表索引
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_items(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_items(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_search ON knowledge_items USING GIN(search_vector);

-- ============================================================
-- 7. 创建触发器函数
-- ============================================================

-- 更新梦境搜索向量
CREATE OR REPLACE FUNCTION update_dream_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 更新知识库搜索向量
CREATE OR REPLACE FUNCTION update_knowledge_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 更新用户统计信息
CREATE OR REPLACE FUNCTION update_user_stats()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE user_profiles
        SET 
            total_dreams = total_dreams + 1,
            last_dream_date = NEW.dream_date,
            streak_days = CASE 
                WHEN last_dream_date = CURRENT_DATE - 1 THEN streak_days + 1
                WHEN last_dream_date = CURRENT_DATE THEN streak_days
                ELSE 1
            END,
            updated_at = NOW()
        WHERE user_id = NEW.user_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE user_profiles
        SET 
            total_dreams = GREATEST(total_dreams - 1, 0),
            updated_at = NOW()
        WHERE user_id = OLD.user_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 更新作品数量统计
CREATE OR REPLACE FUNCTION update_works_count()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE user_profiles
        SET 
            total_works = total_works + 1,
            updated_at = NOW()
        WHERE user_id = NEW.user_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE user_profiles
        SET 
            total_works = GREATEST(total_works - 1, 0),
            updated_at = NOW()
        WHERE user_id = OLD.user_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 自动更新updated_at字段
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 8. 创建触发器
-- ============================================================

-- 梦境搜索向量触发器
DROP TRIGGER IF EXISTS trigger_dream_search_vector ON dream_entries;
CREATE TRIGGER trigger_dream_search_vector
    BEFORE INSERT OR UPDATE ON dream_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_dream_search_vector();

-- 知识库搜索向量触发器
DROP TRIGGER IF EXISTS trigger_knowledge_search_vector ON knowledge_items;
CREATE TRIGGER trigger_knowledge_search_vector
    BEFORE INSERT OR UPDATE ON knowledge_items
    FOR EACH ROW
    EXECUTE FUNCTION update_knowledge_search_vector();

-- 用户统计触发器
DROP TRIGGER IF EXISTS trigger_user_stats ON dream_entries;
CREATE TRIGGER trigger_user_stats
    AFTER INSERT OR DELETE ON dream_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_user_stats();

-- 作品数量触发器
DROP TRIGGER IF EXISTS trigger_works_count ON media_assets;
CREATE TRIGGER trigger_works_count
    AFTER INSERT OR DELETE ON media_assets
    FOR EACH ROW
    EXECUTE FUNCTION update_works_count();

-- 自动更新updated_at触发器
DROP TRIGGER IF EXISTS trigger_users_updated_at ON users;
CREATE TRIGGER trigger_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER trigger_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trigger_subscriptions_updated_at
    BEFORE UPDATE ON subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_dream_entries_updated_at ON dream_entries;
CREATE TRIGGER trigger_dream_entries_updated_at
    BEFORE UPDATE ON dream_entries
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_long_video_scripts_updated_at ON long_video_scripts;
CREATE TRIGGER trigger_long_video_scripts_updated_at
    BEFORE UPDATE ON long_video_scripts
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trigger_knowledge_items_updated_at ON knowledge_items;
CREATE TRIGGER trigger_knowledge_items_updated_at
    BEFORE UPDATE ON knowledge_items
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- 9. 创建存储过程函数
-- ============================================================

-- 检查并消耗额度
CREATE OR REPLACE FUNCTION consume_quota(
    p_user_id UUID,
    p_quota_type VARCHAR
) RETURNS BOOLEAN AS $$
DECLARE
    v_tier VARCHAR(20);
    v_limit INTEGER;
    v_used INTEGER;
    v_quota_column VARCHAR;
BEGIN
    SELECT tier INTO v_tier
    FROM user_profiles
    WHERE user_id = p_user_id;
    
    IF v_tier = 'subscribed' THEN
        RETURN TRUE;
    END IF;
    
    v_quota_column := CASE p_quota_type
        WHEN 'image' THEN 'image_used'
        WHEN 'video' THEN 'video_used'
        WHEN 'story' THEN 'story_used'
        ELSE NULL
    END;
    
    IF v_quota_column IS NULL THEN
        RETURN FALSE;
    END IF;
    
    EXECUTE format('SELECT %I FROM user_profiles WHERE user_id = $1', v_quota_column)
    INTO v_used
    USING p_user_id;
    
    SELECT CASE 
        WHEN v_tier = 'guest' THEN CASE p_quota_type
            WHEN 'image' THEN 1
            WHEN 'video' THEN 1
            WHEN 'story' THEN 0
            ELSE 0
        END
        WHEN v_tier = 'registered' THEN CASE p_quota_type
            WHEN 'image' THEN 5
            WHEN 'video' THEN 2
            WHEN 'story' THEN 1
            ELSE 0
        END
        ELSE 0
    END INTO v_limit;
    
    IF v_used >= v_limit THEN
        RETURN FALSE;
    END IF;
    
    EXECUTE format('UPDATE user_profiles SET %I = %I + 1, updated_at = NOW() WHERE user_id = $1', v_quota_column, v_quota_column)
    USING p_user_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- 搜索梦境
CREATE OR REPLACE FUNCTION search_dreams(
    p_user_id UUID,
    p_query TEXT
) RETURNS TABLE (
    id UUID,
    title TEXT,
    content TEXT,
    dream_date DATE,
    rank REAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        d.id,
        d.title,
        d.content,
        d.dream_date,
        ts_rank(d.search_vector, plainto_tsquery('simple', p_query)) AS rank
    FROM dream_entries d
    WHERE d.user_id = p_user_id
        AND d.search_vector @@ plainto_tsquery('simple', p_query)
    ORDER BY rank DESC, d.created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- 10. 启用Row Level Security (RLS)
-- ============================================================

-- 启用RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE media_assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE long_video_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_generation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE interpretations ENABLE ROW LEVEL SECURITY;

-- 创建RLS策略

-- users表策略
DROP POLICY IF EXISTS users_policy ON users;
CREATE POLICY users_policy ON users
    FOR ALL
    USING (id = auth.uid());

-- user_profiles表策略
DROP POLICY IF EXISTS user_profiles_policy ON user_profiles;
CREATE POLICY user_profiles_policy ON user_profiles
    FOR ALL
    USING (user_id = auth.uid());

-- subscriptions表策略
DROP POLICY IF EXISTS subscriptions_policy ON subscriptions;
CREATE POLICY subscriptions_policy ON subscriptions
    FOR ALL
    USING (user_id = auth.uid());

-- dream_entries表策略
DROP POLICY IF EXISTS dream_entries_policy ON dream_entries;
CREATE POLICY dream_entries_policy ON dream_entries
    FOR ALL
    USING (user_id = auth.uid());

-- audio_profiles表策略
DROP POLICY IF EXISTS audio_profiles_policy ON audio_profiles;
CREATE POLICY audio_profiles_policy ON audio_profiles
    FOR ALL
    USING (user_id = auth.uid());

-- dream_tags表策略
DROP POLICY IF EXISTS dream_tags_policy ON dream_tags;
CREATE POLICY dream_tags_policy ON dream_tags
    FOR ALL
    USING (user_id = auth.uid());

-- media_assets表策略
DROP POLICY IF EXISTS media_assets_policy ON media_assets;
CREATE POLICY media_assets_policy ON media_assets
    FOR ALL
    USING (user_id = auth.uid());

-- long_video_scripts表策略
DROP POLICY IF EXISTS long_video_scripts_policy ON long_video_scripts;
CREATE POLICY long_video_scripts_policy ON long_video_scripts
    FOR ALL
    USING (user_id = auth.uid());

-- ai_generation_tasks表策略
DROP POLICY IF EXISTS ai_generation_tasks_policy ON ai_generation_tasks;
CREATE POLICY ai_generation_tasks_policy ON ai_generation_tasks
    FOR ALL
    USING (user_id = auth.uid());

-- interpretations表策略
DROP POLICY IF EXISTS interpretations_policy ON interpretations;
CREATE POLICY interpretations_policy ON interpretations
    FOR ALL
    USING (user_id = auth.uid());

-- knowledge_items表策略（只读，所有用户可查看有效的）
DROP POLICY IF EXISTS knowledge_items_policy ON knowledge_items;
CREATE POLICY knowledge_items_policy ON knowledge_items
    FOR SELECT
    USING (status = 'active');

-- ============================================================
-- 11. 插入初始数据
-- ============================================================

-- 插入示例知识库数据
INSERT INTO knowledge_items (title, content, source, category, tags, status) VALUES
('梦见飞翔', '梦见飞翔通常象征着自由、解放和超越现实限制的渴望。这种梦境往往出现在你渴望突破现状、追求更高目标的时候。', '周公解梦', '常见梦境', ARRAY['飞翔', '自由', '突破'], 'active'),
('梦见水', '水在梦中通常代表情绪和潜意识。清澈的水象征平静和清晰，浑浊的水可能表示情绪困扰。', '心理学', '常见梦境', ARRAY['水', '情绪', '潜意识'], 'active'),
('梦见坠落', '梦见坠落通常反映了对失去控制或失败的恐惧。这种梦境常见于面临重大决策或压力时期。', '周公解梦', '常见梦境', ARRAY['坠落', '恐惧', '失控'], 'active'),
('梦见被追赶', '被追赶的梦境通常表示你在现实生活中正在逃避某些问题或责任。', '心理学', '常见梦境', ARRAY['追赶', '逃避', '压力'], 'active'),
('梦见考试', '梦见考试通常反映了对自我能力的怀疑或对评判的恐惧，常见于面临挑战或评估时。', '心理学', '常见梦境', ARRAY['考试', '压力', '评估'], 'active')
ON CONFLICT DO NOTHING;

-- ============================================================
-- 初始化完成
-- ============================================================

COMMENT ON DATABASE postgres IS 'hasDream梦境空间数据库 - 初始化完成 v2.0';
