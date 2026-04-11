-- ============================================
-- 清理并重新初始化数据库
-- 警告：此操作会删除所有现有数据！
-- ============================================

-- 开始事务
BEGIN;

-- ============================================
-- 1. 删除现有表（按依赖顺序倒序删除）
-- ============================================

-- 删除视图
DROP VIEW IF EXISTS v_user_usage_stats CASCADE;
DROP VIEW IF EXISTS v_dream_stats CASCADE;

-- 删除触发器
DROP TRIGGER IF EXISTS update_usage_stats_updated_at ON usage_stats;
DROP TRIGGER IF EXISTS update_chat_sessions_updated_at ON chat_sessions;
DROP TRIGGER IF EXISTS update_knowledge_base_updated_at ON knowledge_base;
DROP TRIGGER IF EXISTS update_interpretations_updated_at ON interpretations;
DROP TRIGGER IF EXISTS update_dreams_updated_at ON dreams;
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;

-- 删除函数
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- 删除表（按依赖关系倒序）
DROP TABLE IF EXISTS chat_messages CASCADE;
DROP TABLE IF EXISTS chat_sessions CASCADE;
DROP TABLE IF EXISTS user_knowledge_favorites CASCADE;
DROP TABLE IF EXISTS knowledge_base CASCADE;
DROP TABLE IF EXISTS interpretation_suggestions CASCADE;
DROP TABLE IF EXISTS emotion_analyses CASCADE;
DROP TABLE IF EXISTS symbol_interpretations CASCADE;
DROP TABLE IF EXISTS interpretations CASCADE;
DROP TABLE IF EXISTS generation_scenes CASCADE;
DROP TABLE IF EXISTS generations CASCADE;
DROP TABLE IF EXISTS dream_images CASCADE;
DROP TABLE IF EXISTS dream_tags CASCADE;
DROP TABLE IF EXISTS dreams CASCADE;
DROP TABLE IF EXISTS voice_profiles CASCADE;
DROP TABLE IF EXISTS user_settings CASCADE;
DROP TABLE IF EXISTS user_profiles CASCADE;
DROP TABLE IF EXISTS usage_stats CASCADE;

-- ============================================
-- 2. 重新创建表结构
-- ============================================

-- 启用必要的扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================
-- 用户相关表
-- ============================================

CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    phone VARCHAR(20) UNIQUE,
    nickname VARCHAR(100) NOT NULL,
    avatar_url TEXT,
    subscription_type VARCHAR(20) DEFAULT 'free' CHECK (subscription_type IN ('free', 'monthly', 'yearly')),
    subscription_expires_at TIMESTAMP WITH TIME ZONE,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_settings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    setting_key VARCHAR(50) NOT NULL,
    setting_value JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, setting_key)
);

CREATE TABLE voice_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    voice_url TEXT NOT NULL,
    is_default BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 梦境记录表
-- ============================================

CREATE TABLE dreams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    content_type VARCHAR(20) DEFAULT 'text' CHECK (content_type IN ('text', 'voice', 'mixed')),
    voice_url TEXT,
    voice_duration INTEGER,
    mood_rating INTEGER CHECK (mood_rating >= 1 AND mood_rating <= 5),
    dream_date DATE NOT NULL,
    is_lucid BOOLEAN DEFAULT FALSE,
    sleep_quality INTEGER CHECK (sleep_quality >= 1 AND sleep_quality <= 5),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE dream_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dream_id UUID NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
    tag_name VARCHAR(50) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(dream_id, tag_name)
);

CREATE TABLE dream_images (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    dream_id UUID NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- AI 创作生成表
-- ============================================

CREATE TABLE generations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dream_id UUID NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
    generation_type VARCHAR(20) NOT NULL CHECK (generation_type IN ('image', 'video_5s', 'video_10s', 'video_long', 'script')),
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    prompt TEXT NOT NULL,
    result_url TEXT,
    style VARCHAR(50),
    resolution VARCHAR(20),
    duration INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE generation_scenes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    generation_id UUID NOT NULL REFERENCES generations(id) ON DELETE CASCADE,
    scene_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    camera_angle VARCHAR(100),
    narration TEXT,
    mood VARCHAR(50),
    image_url TEXT,
    video_url TEXT,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'generating_image', 'image_complete', 'generating_video', 'video_complete', 'failed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(generation_id, scene_number)
);

-- ============================================
-- 梦境解读表
-- ============================================

CREATE TABLE interpretations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dream_id UUID NOT NULL REFERENCES dreams(id) ON DELETE CASCADE,
    overall_meaning TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE symbol_interpretations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interpretation_id UUID NOT NULL REFERENCES interpretations(id) ON DELETE CASCADE,
    symbol VARCHAR(100) NOT NULL,
    meaning TEXT NOT NULL,
    cultural_context TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE emotion_analyses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interpretation_id UUID NOT NULL REFERENCES interpretations(id) ON DELETE CASCADE,
    emotion_type VARCHAR(50) NOT NULL,
    intensity INTEGER CHECK (intensity >= 1 AND intensity <= 10),
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE interpretation_suggestions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    interpretation_id UUID NOT NULL REFERENCES interpretations(id) ON DELETE CASCADE,
    category VARCHAR(50) NOT NULL,
    suggestion TEXT NOT NULL,
    priority INTEGER DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 知识库表
-- ============================================

CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(50) NOT NULL,
    tags TEXT[] DEFAULT '{}',
    view_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE user_knowledge_favorites (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    knowledge_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, knowledge_id)
);

-- ============================================
-- AI 对话表
-- ============================================

CREATE TABLE chat_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE chat_messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user', 'assistant')),
    content TEXT NOT NULL,
    emotion_analysis JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- 使用统计表
-- ============================================

CREATE TABLE usage_stats (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    stat_date DATE NOT NULL,
    dream_count INTEGER DEFAULT 0,
    generation_count INTEGER DEFAULT 0,
    chat_count INTEGER DEFAULT 0,
    voice_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id, stat_date)
);

-- ============================================
-- 3. 创建索引
-- ============================================

-- Dreams 表索引
CREATE INDEX idx_dreams_user_id ON dreams(user_id);
CREATE INDEX idx_dreams_user_date ON dreams(user_id, dream_date DESC);
CREATE INDEX idx_dreams_dream_date ON dreams(dream_date);
CREATE INDEX idx_dreams_mood ON dreams(mood_rating);
CREATE INDEX idx_dreams_content_type ON dreams(content_type);

-- Dream tags 索引
CREATE INDEX idx_dream_tags_dream_id ON dream_tags(dream_id);
CREATE INDEX idx_dream_tags_name ON dream_tags(tag_name);

-- Generations 索引
CREATE INDEX idx_generations_user_id ON generations(user_id);
CREATE INDEX idx_generations_dream_id ON generations(dream_id);
CREATE INDEX idx_generations_status ON generations(status);
CREATE INDEX idx_generations_type ON generations(generation_type);
CREATE INDEX idx_generations_created_at ON generations(created_at DESC);

-- Interpretations 索引
CREATE INDEX idx_interpretations_dream_id ON interpretations(dream_id);
CREATE INDEX idx_interpretations_user_id ON interpretations(user_id);

-- Chat 索引
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);

-- Knowledge base 全文搜索索引（使用 simple 配置，支持中文）
CREATE INDEX idx_knowledge_search ON knowledge_base USING gin(to_tsvector('simple', title || ' ' || content));

-- ============================================
-- 4. 启用 RLS 并创建策略
-- ============================================

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE voice_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE dreams ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE dream_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE generations ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE interpretations ENABLE ROW LEVEL SECURITY;
ALTER TABLE symbol_interpretations ENABLE ROW LEVEL SECURITY;
ALTER TABLE emotion_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE interpretation_suggestions ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_knowledge_favorites ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;

-- RLS 策略
CREATE POLICY "Users can access own profile" ON user_profiles FOR ALL USING (auth.uid() = id);
CREATE POLICY "Users can access own settings" ON user_settings FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own voice profiles" ON voice_profiles FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own dreams" ON dreams FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own dream tags" ON dream_tags FOR ALL USING (auth.uid() = (SELECT user_id FROM dreams WHERE id = dream_id));
CREATE POLICY "Users can access own dream images" ON dream_images FOR ALL USING (auth.uid() = (SELECT user_id FROM dreams WHERE id = dream_id));
CREATE POLICY "Users can access own generations" ON generations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own generation scenes" ON generation_scenes FOR ALL USING (auth.uid() = (SELECT user_id FROM generations WHERE id = generation_id));
CREATE POLICY "Users can access own interpretations" ON interpretations FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own symbol interpretations" ON symbol_interpretations FOR ALL USING (auth.uid() = (SELECT user_id FROM interpretations WHERE id = interpretation_id));
CREATE POLICY "Users can access own emotion analyses" ON emotion_analyses FOR ALL USING (auth.uid() = (SELECT user_id FROM interpretations WHERE id = interpretation_id));
CREATE POLICY "Users can access own suggestions" ON interpretation_suggestions FOR ALL USING (auth.uid() = (SELECT user_id FROM interpretations WHERE id = interpretation_id));
CREATE POLICY "Users can access own favorites" ON user_knowledge_favorites FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own chat sessions" ON chat_sessions FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own chat messages" ON chat_messages FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Users can access own usage stats" ON usage_stats FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Knowledge base is public readable" ON knowledge_base FOR SELECT USING (true);

-- ============================================
-- 5. 创建触发器函数和触发器
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_dreams_updated_at BEFORE UPDATE ON dreams 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_interpretations_updated_at BEFORE UPDATE ON interpretations 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_usage_stats_updated_at BEFORE UPDATE ON usage_stats 
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 6. 创建视图
-- ============================================

CREATE OR REPLACE VIEW v_dream_stats AS
SELECT 
    d.id,
    d.user_id,
    d.title,
    d.mood_rating,
    d.dream_date,
    d.created_at,
    COUNT(DISTINCT g.id) as generation_count,
    COUNT(DISTINCT CASE WHEN g.generation_type = 'image' THEN g.id END) as image_count,
    COUNT(DISTINCT CASE WHEN g.generation_type LIKE 'video%' THEN g.id END) as video_count,
    COUNT(DISTINCT CASE WHEN g.generation_type = 'script' THEN g.id END) as script_count,
    COUNT(DISTINCT i.id) as interpretation_count,
    ARRAY_AGG(DISTINCT dt.tag_name) FILTER (WHERE dt.tag_name IS NOT NULL) as tags
FROM dreams d
LEFT JOIN generations g ON d.id = g.dream_id
LEFT JOIN interpretations i ON d.id = i.dream_id
LEFT JOIN dream_tags dt ON d.id = dt.dream_id
GROUP BY d.id, d.user_id, d.title, d.mood_rating, d.dream_date, d.created_at;

CREATE OR REPLACE VIEW v_user_usage_stats AS
SELECT 
    user_id,
    stat_date,
    dream_count,
    generation_count,
    chat_count,
    voice_minutes,
    dream_count + generation_count * 5 + chat_count as total_score
FROM usage_stats;

-- ============================================
-- 7. 添加表注释
-- ============================================

COMMENT ON TABLE user_profiles IS '用户基础信息表，扩展 Supabase auth.users';
COMMENT ON TABLE dreams IS '梦境记录主表';
COMMENT ON TABLE dream_tags IS '梦境标签，支持多标签';
COMMENT ON TABLE generations IS 'AI 创作生成任务';
COMMENT ON TABLE generation_scenes IS '长视频场景详情';
COMMENT ON TABLE interpretations IS '梦境解读';
COMMENT ON TABLE knowledge_base IS '梦境知识库';
COMMENT ON TABLE chat_sessions IS 'AI 对话会话';
COMMENT ON TABLE usage_stats IS '用户使用统计';

-- ============================================
-- 8. 初始化数据
-- ============================================

INSERT INTO knowledge_base (title, content, category, tags) VALUES
('梦见飞翔的含义', '梦见飞翔通常代表自由和解放，象征着摆脱现实束缚的渴望。在心理学上，这可能反映了你对现状的不满或对更高目标的追求。', '梦境解析', ARRAY['飞翔', '自由', '心理']),
('清醒梦技巧', '清醒梦是指在梦中意识到自己在做梦的状态。通过 reality check（现实检查）、梦境日记等方法可以训练自己进入清醒梦。', '技巧指南', ARRAY['清醒梦', '技巧', '控制']),
('常见梦境符号', '水通常代表情绪和潜意识，房子代表自我和内心世界，飞行代表自由，坠落代表失控感。', '符号词典', ARRAY['符号', '水', '房子', '飞行']),
('梦境与心理健康', '梦境可以反映我们的心理状态。频繁的噩梦可能与压力、焦虑有关，而愉快的梦境则表明心理健康良好。', '心理健康', ARRAY['心理健康', '压力', '焦虑']),
('如何记住梦境', '在醒来后立即记录梦境是提高记忆力的关键。保持规律的睡眠时间、避免酒精和安眠药也有助于梦境回忆。', '技巧指南', ARRAY['记忆', '记录', '睡眠'])
ON CONFLICT DO NOTHING;

-- 提交事务
COMMIT;

-- 验证创建结果
SELECT 'Database initialized successfully!' as status;
