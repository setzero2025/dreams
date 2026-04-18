-- 数据库初始化脚本
-- 根据实际数据库结构生成


-- ============================================
-- 表: ai_generation_tasks
-- ============================================
CREATE TABLE IF NOT EXISTS ai_generation_tasks (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    dream_id uuid,
    type VARCHAR(20) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'queued'::character varying,
    progress INTEGER NOT NULL DEFAULT 0,
    current_step VARCHAR(100),
    model_source VARCHAR(50),
    params JSONB DEFAULT '{}'::jsonb,
    result JSONB,
    error JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    FOREIGN KEY (dream_id) REFERENCES dream_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON ai_generation_tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_dream_id ON ai_generation_tasks(dream_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON ai_generation_tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_type_status ON ai_generation_tasks(type, status);
CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON ai_generation_tasks(created_at DESC);

-- ============================================
-- 表: audio_profiles
-- ============================================
CREATE TABLE IF NOT EXISTS audio_profiles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    storage_path TEXT NOT NULL,
    duration INTEGER,
    file_size BIGINT,
    mime_type VARCHAR(50) DEFAULT 'audio/wav'::character varying,
    is_tone_extracted BOOLEAN NOT NULL DEFAULT FALSE,
    tone_features JSONB,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_audio_user_id ON audio_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_audio_created_at ON audio_profiles(created_at DESC);

-- ============================================
-- 表: auth_users
-- ============================================
CREATE TABLE IF NOT EXISTS auth_users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    phone VARCHAR(20) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (id),
    UNIQUE (phone)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_auth_users_phone ON auth_users(phone);

-- ============================================
-- 表: dream_entries
-- ============================================
CREATE TABLE IF NOT EXISTS dream_entries (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    dream_date DATE NOT NULL,
    emotions TEXT[] DEFAULT '{}'::text[],
    tags TEXT[] DEFAULT '{}'::text[],
    audio_id uuid,
    is_synced BOOLEAN NOT NULL DEFAULT FALSE,
    local_id VARCHAR(50),
    search_vector tsvector,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    FOREIGN KEY (audio_id) REFERENCES audio_profiles(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_dreams_user_id ON dream_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_dreams_dream_date ON dream_entries(dream_date);
CREATE INDEX IF NOT EXISTS idx_dreams_created_at ON dream_entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dreams_user_date ON dream_entries(user_id, dream_date DESC);
CREATE INDEX IF NOT EXISTS idx_dreams_search ON dream_entries(search_vector);

-- ============================================
-- 表: dream_images
-- ============================================
CREATE TABLE IF NOT EXISTS dream_images (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    dream_id uuid NOT NULL,
    image_url TEXT NOT NULL,
    is_primary BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id),
    FOREIGN KEY (dream_id) REFERENCES dream_entries(id) ON DELETE CASCADE
);

-- ============================================
-- 表: dream_tags
-- ============================================
CREATE TABLE IF NOT EXISTS dream_tags (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    tag VARCHAR(50) NOT NULL,
    count INTEGER NOT NULL DEFAULT 1,
    last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (tag, user_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_dream_tags_user_id ON dream_tags(user_id);

-- ============================================
-- 表: generation_scenes
-- ============================================
CREATE TABLE IF NOT EXISTS generation_scenes (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    generation_id uuid NOT NULL,
    scene_number INTEGER NOT NULL,
    description TEXT NOT NULL,
    camera_angle VARCHAR(100),
    narration TEXT,
    mood VARCHAR(50),
    image_url TEXT,
    video_url TEXT,
    status VARCHAR(20) DEFAULT 'pending'::character varying,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    PRIMARY KEY (id),
    FOREIGN KEY (generation_id) REFERENCES generations(id) ON DELETE CASCADE,
    UNIQUE (scene_number, generation_id)
);

-- ============================================
-- 表: generations
-- ============================================
CREATE TABLE IF NOT EXISTS generations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    dream_id uuid NOT NULL,
    generation_type VARCHAR(20) NOT NULL,
    status VARCHAR(20) DEFAULT 'pending'::character varying,
    prompt TEXT NOT NULL,
    result_url TEXT,
    style VARCHAR(50),
    resolution VARCHAR(20),
    duration INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completed_at TIMESTAMP WITH TIME ZONE,
    title VARCHAR(200),
    thumbnail TEXT,
    image_url TEXT,
    video_url TEXT,
    cover_url TEXT,
    script_data JSONB,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_generations_user_id ON generations(user_id);
CREATE INDEX IF NOT EXISTS idx_generations_dream_id ON generations(dream_id);
CREATE INDEX IF NOT EXISTS idx_generations_status ON generations(status);
CREATE INDEX IF NOT EXISTS idx_generations_type ON generations(generation_type);

-- ============================================
-- 表: interpretations
-- ============================================
CREATE TABLE IF NOT EXISTS interpretations (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    dream_id uuid,
    type VARCHAR(20) NOT NULL DEFAULT 'interpretation'::character varying,
    content TEXT NOT NULL,
    symbols JSONB DEFAULT '[]'::jsonb,
    emotions_analysis JSONB,
    suggestions TEXT,
    reference_ids uuid,
    model_source VARCHAR(50),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_interpretations_user_id ON interpretations(user_id);
CREATE INDEX IF NOT EXISTS idx_interpretations_dream_id ON interpretations(dream_id);
CREATE INDEX IF NOT EXISTS idx_interpretations_type ON interpretations(type);

-- ============================================
-- 表: knowledge_items
-- ============================================
CREATE TABLE IF NOT EXISTS knowledge_items (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    source VARCHAR(200) NOT NULL,
    category VARCHAR(50),
    tags TEXT[] DEFAULT '{}'::text[],
    status VARCHAR(20) NOT NULL DEFAULT 'active'::character varying,
    view_count INTEGER NOT NULL DEFAULT 0,
    search_vector tsvector,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_knowledge_status ON knowledge_items(status);
CREATE INDEX IF NOT EXISTS idx_knowledge_category ON knowledge_items(category);
CREATE INDEX IF NOT EXISTS idx_knowledge_search ON knowledge_items(search_vector);

-- ============================================
-- 表: long_video_scripts
-- ============================================
CREATE TABLE IF NOT EXISTS long_video_scripts (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    dream_id uuid NOT NULL,
    user_id uuid NOT NULL,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    scenes JSONB NOT NULL DEFAULT '[]'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'pending'::character varying,
    progress INTEGER NOT NULL DEFAULT 0,
    current_step VARCHAR(100),
    error_message TEXT,
    model_source VARCHAR(50),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    FOREIGN KEY (dream_id) REFERENCES dream_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_scripts_dream_id ON long_video_scripts(dream_id);
CREATE INDEX IF NOT EXISTS idx_scripts_user_id ON long_video_scripts(user_id);
CREATE INDEX IF NOT EXISTS idx_scripts_status ON long_video_scripts(status);

-- ============================================
-- 表: media_assets
-- ============================================
CREATE TABLE IF NOT EXISTS media_assets (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    dream_id uuid,
    type VARCHAR(20) NOT NULL,
    storage_path TEXT NOT NULL,
    thumbnail_path TEXT,
    model_source VARCHAR(50),
    style VARCHAR(50),
    ratio VARCHAR(10),
    duration INTEGER,
    file_size BIGINT NOT NULL,
    long_video_script_id uuid,
    is_favorite BOOLEAN NOT NULL DEFAULT FALSE,
    download_count INTEGER NOT NULL DEFAULT 0,
    share_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    FOREIGN KEY (dream_id) REFERENCES dream_entries(id) ON DELETE CASCADE,
    FOREIGN KEY (long_video_script_id) REFERENCES long_video_scripts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_media_user_id ON media_assets(user_id);
CREATE INDEX IF NOT EXISTS idx_media_dream_id ON media_assets(dream_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON media_assets(type);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON media_assets(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_media_favorite ON media_assets(user_id, is_favorite);

-- ============================================
-- 表: subscriptions
-- ============================================
CREATE TABLE IF NOT EXISTS subscriptions (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    plan VARCHAR(20) NOT NULL,
    amount NUMERIC NOT NULL,
    currency VARCHAR(3) NOT NULL DEFAULT 'CNY'::character varying,
    start_at TIMESTAMP WITH TIME ZONE NOT NULL,
    end_at TIMESTAMP WITH TIME ZONE NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active'::character varying,
    payment_method VARCHAR(50),
    payment_id VARCHAR(255),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_at ON subscriptions(end_at);

-- ============================================
-- 表: user_profiles
-- ============================================
CREATE TABLE IF NOT EXISTS user_profiles (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL,
    tier VARCHAR(20) NOT NULL DEFAULT 'guest'::character varying,
    image_used INTEGER NOT NULL DEFAULT 0,
    video_used INTEGER NOT NULL DEFAULT 0,
    story_used INTEGER NOT NULL DEFAULT 0,
    eval_window INTEGER NOT NULL DEFAULT 7,
    total_dreams INTEGER NOT NULL DEFAULT 0,
    total_works INTEGER NOT NULL DEFAULT 0,
    streak_days INTEGER NOT NULL DEFAULT 0,
    last_dream_date DATE,
    theme_preference VARCHAR(20) NOT NULL DEFAULT 'system'::character varying,
    settings JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE (user_id)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_profiles_user_id ON user_profiles(user_id);
CREATE INDEX IF NOT EXISTS idx_profiles_tier ON user_profiles(tier);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tier ON user_profiles(tier);

-- ============================================
-- 表: users
-- ============================================
CREATE TABLE IF NOT EXISTS users (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    phone VARCHAR(20),
    password_hash VARCHAR(255),
    nickname VARCHAR(100),
    avatar_url TEXT,
    gender VARCHAR(10),
    age INTEGER,
    is_anonymous BOOLEAN NOT NULL DEFAULT FALSE,
    device_id VARCHAR(255),
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id),
    UNIQUE (phone)
);

-- 索引
CREATE INDEX IF NOT EXISTS idx_users_phone ON users(phone);
CREATE INDEX IF NOT EXISTS idx_users_device ON users(device_id);
CREATE INDEX IF NOT EXISTS idx_users_created_at ON users(created_at DESC);
