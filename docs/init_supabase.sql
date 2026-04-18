-- ============================================================
-- Supabase 数据库初始化脚本
-- 根据真实数据库结构自动生成
-- 生成时间: 2026-04-18T08:03:27.999Z
-- ============================================================

-- ============================================================
-- 3. 函数定义
-- ============================================================
-- 函数: check_user_quota

DECLARE
  v_subscription_type VARCHAR(20);
  v_subscription_expires_at TIMESTAMPTZ;
  v_quota_value INT;
  v_current_value INT;
  v_is_subscribed BOOLEAN;
BEGIN
  -- 获取用户订阅信息
  SELECT subscription_type, subscription_expires_at
  INTO v_subscription_type, v_subscription_expires_at
  FROM users
  WHERE id = p_user_id;

  -- 检查是否已订阅且未过期
  v_is_subscribed := v_subscription_type <> 'free'
                    AND (v_subscription_expires_at IS NULL OR v_subscription_expires_at > NOW());

  -- 已订阅用户不限制配额
  IF v_is_subscribed THEN
    RETURN TRUE;
  END IF;

  -- 获取当前配额值
  SELECT
    CASE p_resource_type
      WHEN 'dream' THEN dream_count
      WHEN 'image' THEN image_count
      WHEN 'video' THEN video_count
      WHEN 'long_video' THEN long_video_count
    END
  INTO v_current_value
  FROM user_quotas
  WHERE user_id = p_user_id;

  -- 如果配额记录不存在，返回true
  IF v_current_value IS NULL THEN
    RETURN TRUE;
  END IF;

  -- 获取配额限制
  v_quota_value := CASE p_resource_type
    WHEN 'dream' THEN 99999  -- 免费用户不限梦境记录
    WHEN 'image' THEN 5
    WHEN 'video' THEN 2
    WHEN 'long_video' THEN 1
    ELSE 0
  END;

  -- 检查是否超出配额
  RETURN v_current_value < v_quota_value;
END;

-- 函数: consume_quota

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

-- 函数: increment_user_quota

BEGIN
  -- 如果配额记录不存在，创建新记录
  INSERT INTO user_quotas (user_id, dream_count, image_count, video_count, long_video_count)
  VALUES (p_user_id, 0, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  -- 增加对应配额
  UPDATE user_quotas
  SET
    dream_count = dream_count + CASE WHEN p_resource_type = 'dream' THEN 1 ELSE 0 END,
    image_count = image_count + CASE WHEN p_resource_type = 'image' THEN 1 ELSE 0 END,
    video_count = video_count + CASE WHEN p_resource_type = 'video' THEN 1 ELSE 0 END,
    long_video_count = long_video_count + CASE WHEN p_resource_type = 'long_video' THEN 1 ELSE 0 END,
    updated_at = NOW()
  WHERE user_id = p_user_id;
END;

-- 函数: search_dreams

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

-- 函数: update_dream_search_vector

BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
    RETURN NEW;
END;

-- 函数: update_knowledge_search_vector

BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('simple', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('simple', COALESCE(NEW.content, '')), 'B') ||
        setweight(to_tsvector('simple', COALESCE(array_to_string(NEW.tags, ' '), '')), 'C');
    RETURN NEW;
END;

-- 函数: update_updated_at_column

BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;

-- 函数: update_user_stats

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

-- 函数: update_works_count

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


-- ============================================================
-- 4. 表结构定义
-- ============================================================
-- 表: ai_generation_tasks
CREATE TABLE IF NOT EXISTS "ai_generation_tasks" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "dream_id" uuid, "type" character varying(20) NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'queued'::character varying, "progress" integer(32,0) NOT NULL DEFAULT 0, "current_step" character varying(100), "model_source" character varying(50), "params" jsonb DEFAULT '{}'::jsonb, "result" jsonb, "error" jsonb, "started_at" timestamp with time zone, "completed_at" timestamp with time zone, "created_at" timestamp with time zone NOT NULL DEFAULT now());

-- 表: audio_profiles
CREATE TABLE IF NOT EXISTS "audio_profiles" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "storage_path" text NOT NULL, "duration" integer(32,0), "file_size" bigint(64,0), "mime_type" character varying(50) DEFAULT 'audio/wav'::character varying, "is_tone_extracted" boolean NOT NULL DEFAULT false, "tone_features" jsonb, "metadata" jsonb DEFAULT '{}'::jsonb, "created_at" timestamp with time zone NOT NULL DEFAULT now());

-- 表: auth_users
CREATE TABLE IF NOT EXISTS "auth_users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "phone" character varying(20) NOT NULL, "password_hash" character varying(255) NOT NULL, "created_at" timestamp with time zone DEFAULT now(), "updated_at" timestamp with time zone DEFAULT now(), "last_login_at" timestamp with time zone);

-- 表: dream_entries
CREATE TABLE IF NOT EXISTS "dream_entries" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "content" text NOT NULL, "dream_date" date NOT NULL, "emotions" ARRAY DEFAULT '{}'::text[], "tags" ARRAY DEFAULT '{}'::text[], "audio_id" uuid, "is_synced" boolean NOT NULL DEFAULT false, "local_id" character varying(50), "search_vector" tsvector, "metadata" jsonb DEFAULT '{}'::jsonb, "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now());

-- 表: dream_images
CREATE TABLE IF NOT EXISTS "dream_images" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "dream_id" uuid NOT NULL, "image_url" text NOT NULL, "is_primary" boolean DEFAULT false, "created_at" timestamp with time zone DEFAULT now());

-- 表: dream_tags
CREATE TABLE IF NOT EXISTS "dream_tags" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "tag" character varying(50) NOT NULL, "count" integer(32,0) NOT NULL DEFAULT 1, "last_used_at" timestamp with time zone NOT NULL DEFAULT now(), "created_at" timestamp with time zone NOT NULL DEFAULT now());

-- 表: dreams
CREATE TABLE IF NOT EXISTS "dreams" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "title" character varying(200) NOT NULL, "content" text NOT NULL, "content_type" character varying(20) DEFAULT 'text'::character varying, "voice_url" text, "voice_duration" integer(32,0), "mood_rating" integer(32,0), "dream_date" date NOT NULL, "is_lucid" boolean DEFAULT false, "sleep_quality" integer(32,0), "created_at" timestamp with time zone DEFAULT now(), "updated_at" timestamp with time zone DEFAULT now());

-- 表: emotion_analyses
CREATE TABLE IF NOT EXISTS "emotion_analyses" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "interpretation_id" uuid NOT NULL, "emotion_type" character varying(50) NOT NULL, "intensity" integer(32,0), "description" text, "created_at" timestamp with time zone DEFAULT now());

-- 表: generation_scenes
CREATE TABLE IF NOT EXISTS "generation_scenes" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "generation_id" uuid NOT NULL, "scene_number" integer(32,0) NOT NULL, "description" text NOT NULL, "camera_angle" character varying(100), "narration" text, "mood" character varying(50), "image_url" text, "video_url" text, "status" character varying(20) DEFAULT 'pending'::character varying, "created_at" timestamp with time zone DEFAULT now(), "updated_at" timestamp with time zone DEFAULT now(), "completed_at" timestamp with time zone);

-- 表: generations
CREATE TABLE IF NOT EXISTS "generations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "dream_id" uuid NOT NULL, "generation_type" character varying(20) NOT NULL, "status" character varying(20) DEFAULT 'pending'::character varying, "prompt" text NOT NULL, "result_url" text, "style" character varying(50), "resolution" character varying(20), "duration" integer(32,0), "error_message" text, "created_at" timestamp with time zone DEFAULT now(), "updated_at" timestamp with time zone DEFAULT now(), "completed_at" timestamp with time zone, "title" character varying(200), "thumbnail" text, "image_url" text, "video_url" text, "cover_url" text, "script_data" jsonb);

-- 表: interpretations
CREATE TABLE IF NOT EXISTS "interpretations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "dream_id" uuid, "type" character varying(20) NOT NULL, "content" text NOT NULL, "symbols" jsonb DEFAULT '[]'::jsonb, "emotions_analysis" jsonb, "suggestions" ARRAY DEFAULT '{}'::text[], "reference_ids" ARRAY DEFAULT '{}'::uuid[], "model_source" character varying(50), "metadata" jsonb DEFAULT '{}'::jsonb, "created_at" timestamp with time zone NOT NULL DEFAULT now());

-- 表: knowledge_items
CREATE TABLE IF NOT EXISTS "knowledge_items" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "title" character varying(200) NOT NULL, "content" text NOT NULL, "source" character varying(200) NOT NULL, "category" character varying(50), "tags" ARRAY DEFAULT '{}'::text[], "status" character varying(20) NOT NULL DEFAULT 'active'::character varying, "view_count" integer(32,0) NOT NULL DEFAULT 0, "search_vector" tsvector, "metadata" jsonb DEFAULT '{}'::jsonb, "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now());

-- 表: long_video_scripts
CREATE TABLE IF NOT EXISTS "long_video_scripts" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "dream_id" uuid NOT NULL, "user_id" uuid NOT NULL, "title" character varying(255) NOT NULL, "content" text NOT NULL, "scenes" jsonb NOT NULL DEFAULT '[]'::jsonb, "status" character varying(20) NOT NULL DEFAULT 'pending'::character varying, "progress" integer(32,0) NOT NULL DEFAULT 0, "current_step" character varying(100), "error_message" text, "model_source" character varying(50), "metadata" jsonb DEFAULT '{}'::jsonb, "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now());

-- 表: media_assets
CREATE TABLE IF NOT EXISTS "media_assets" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "dream_id" uuid, "type" character varying(20) NOT NULL, "storage_path" text NOT NULL, "thumbnail_path" text, "model_source" character varying(50), "style" character varying(50), "ratio" character varying(10), "duration" integer(32,0), "file_size" bigint(64,0) NOT NULL, "long_video_script_id" uuid, "is_favorite" boolean NOT NULL DEFAULT false, "download_count" integer(32,0) NOT NULL DEFAULT 0, "share_count" integer(32,0) NOT NULL DEFAULT 0, "metadata" jsonb DEFAULT '{}'::jsonb, "created_at" timestamp with time zone NOT NULL DEFAULT now());

-- 表: subscriptions
CREATE TABLE IF NOT EXISTS "subscriptions" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "plan" character varying(20) NOT NULL, "amount" numeric(10,2) NOT NULL, "currency" character varying(3) NOT NULL DEFAULT 'CNY'::character varying, "start_at" timestamp with time zone NOT NULL, "end_at" timestamp with time zone NOT NULL, "status" character varying(20) NOT NULL DEFAULT 'active'::character varying, "payment_method" character varying(50), "payment_id" character varying(255), "metadata" jsonb DEFAULT '{}'::jsonb, "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now());

-- 表: symbol_interpretations
CREATE TABLE IF NOT EXISTS "symbol_interpretations" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "interpretation_id" uuid NOT NULL, "symbol" character varying(100) NOT NULL, "meaning" text NOT NULL, "cultural_context" text, "created_at" timestamp with time zone DEFAULT now());

-- 表: user_profiles
CREATE TABLE IF NOT EXISTS "user_profiles" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "user_id" uuid NOT NULL, "tier" character varying(20) NOT NULL DEFAULT 'guest'::character varying, "image_used" integer(32,0) NOT NULL DEFAULT 0, "video_used" integer(32,0) NOT NULL DEFAULT 0, "story_used" integer(32,0) NOT NULL DEFAULT 0, "eval_window" integer(32,0) NOT NULL DEFAULT 7, "total_dreams" integer(32,0) NOT NULL DEFAULT 0, "total_works" integer(32,0) NOT NULL DEFAULT 0, "streak_days" integer(32,0) NOT NULL DEFAULT 0, "last_dream_date" date, "theme_preference" character varying(20) NOT NULL DEFAULT 'system'::character varying, "settings" jsonb DEFAULT '{}'::jsonb, "updated_at" timestamp with time zone NOT NULL DEFAULT now());

-- 表: user_settings
CREATE TABLE IF NOT EXISTS "user_settings" ("id" uuid NOT NULL, "theme" character varying(20) DEFAULT 'dark'::character varying, "language" character varying(10) DEFAULT 'zh-CN'::character varying, "notifications_enabled" boolean DEFAULT true, "auto_sync" boolean DEFAULT true, "created_at" timestamp with time zone DEFAULT now(), "updated_at" timestamp with time zone DEFAULT now());

-- 表: users
CREATE TABLE IF NOT EXISTS "users" ("id" uuid NOT NULL DEFAULT gen_random_uuid(), "phone" character varying(20), "password_hash" character varying(255), "nickname" character varying(100), "avatar_url" text, "gender" character varying(10), "age" integer(32,0), "is_anonymous" boolean NOT NULL DEFAULT false, "device_id" character varying(255), "last_login_at" timestamp with time zone, "created_at" timestamp with time zone NOT NULL DEFAULT now(), "updated_at" timestamp with time zone NOT NULL DEFAULT now());


-- ============================================================
-- 5. 主键约束
-- ============================================================
ALTER TABLE "ai_generation_tasks" ADD PRIMARY KEY ("id");
ALTER TABLE "audio_profiles" ADD PRIMARY KEY ("id");
ALTER TABLE "auth_users" ADD PRIMARY KEY ("id");
ALTER TABLE "dream_entries" ADD PRIMARY KEY ("id");
ALTER TABLE "dream_images" ADD PRIMARY KEY ("id");
ALTER TABLE "dream_tags" ADD PRIMARY KEY ("id");
ALTER TABLE "dreams" ADD PRIMARY KEY ("id");
ALTER TABLE "emotion_analyses" ADD PRIMARY KEY ("id");
ALTER TABLE "generation_scenes" ADD PRIMARY KEY ("id");
ALTER TABLE "generations" ADD PRIMARY KEY ("id");
ALTER TABLE "interpretations" ADD PRIMARY KEY ("id");
ALTER TABLE "knowledge_items" ADD PRIMARY KEY ("id");
ALTER TABLE "long_video_scripts" ADD PRIMARY KEY ("id");
ALTER TABLE "media_assets" ADD PRIMARY KEY ("id");
ALTER TABLE "subscriptions" ADD PRIMARY KEY ("id");
ALTER TABLE "symbol_interpretations" ADD PRIMARY KEY ("id");
ALTER TABLE "user_profiles" ADD PRIMARY KEY ("id");
ALTER TABLE "user_settings" ADD PRIMARY KEY ("id");
ALTER TABLE "users" ADD PRIMARY KEY ("id");

-- ============================================================
-- 6. 唯一约束
-- ============================================================
ALTER TABLE "auth_users" ADD CONSTRAINT "auth_users_phone_key" UNIQUE ("phone");
ALTER TABLE "dream_tags" ADD CONSTRAINT "dream_tags_user_id_tag_key" UNIQUE ("user_id", "tag");
ALTER TABLE "generation_scenes" ADD CONSTRAINT "generation_scenes_generation_id_scene_number_key" UNIQUE ("generation_id", "scene_number");
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_key" UNIQUE ("user_id");
ALTER TABLE "users" ADD CONSTRAINT "users_phone_key" UNIQUE ("phone");

-- ============================================================
-- 7. 外键约束
-- ============================================================
ALTER TABLE "ai_generation_tasks" ADD CONSTRAINT "ai_generation_tasks_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "ai_generation_tasks" ADD CONSTRAINT "ai_generation_tasks_dream_id_fkey" FOREIGN KEY ("dream_id") REFERENCES "dream_entries"("id") ON DELETE SET NULL;
ALTER TABLE "audio_profiles" ADD CONSTRAINT "audio_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "dream_entries" ADD CONSTRAINT "dream_entries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "dream_entries" ADD CONSTRAINT "dream_entries_audio_id_fkey" FOREIGN KEY ("audio_id") REFERENCES "audio_profiles"("id") ON DELETE SET NULL;
ALTER TABLE "dream_images" ADD CONSTRAINT "dream_images_dream_id_fkey" FOREIGN KEY ("dream_id") REFERENCES "dream_entries"("id") ON DELETE CASCADE;
ALTER TABLE "dream_tags" ADD CONSTRAINT "dream_tags_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "dreams" ADD CONSTRAINT "dreams_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "emotion_analyses" ADD CONSTRAINT "emotion_analyses_interpretation_id_fkey" FOREIGN KEY ("interpretation_id") REFERENCES "interpretations"("id") ON DELETE CASCADE;
ALTER TABLE "generation_scenes" ADD CONSTRAINT "generation_scenes_generation_id_fkey" FOREIGN KEY ("generation_id") REFERENCES "generations"("id") ON DELETE CASCADE;
ALTER TABLE "generations" ADD CONSTRAINT "generations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "interpretations" ADD CONSTRAINT "interpretations_dream_id_fkey" FOREIGN KEY ("dream_id") REFERENCES "dream_entries"("id") ON DELETE CASCADE;
ALTER TABLE "interpretations" ADD CONSTRAINT "interpretations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "long_video_scripts" ADD CONSTRAINT "long_video_scripts_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "long_video_scripts" ADD CONSTRAINT "long_video_scripts_dream_id_fkey" FOREIGN KEY ("dream_id") REFERENCES "dream_entries"("id") ON DELETE CASCADE;
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_dream_id_fkey" FOREIGN KEY ("dream_id") REFERENCES "dream_entries"("id") ON DELETE SET NULL;
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_long_video_script_id_fkey" FOREIGN KEY ("long_video_script_id") REFERENCES "long_video_scripts"("id") ON DELETE SET NULL;
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "symbol_interpretations" ADD CONSTRAINT "symbol_interpretations_interpretation_id_fkey" FOREIGN KEY ("interpretation_id") REFERENCES "interpretations"("id") ON DELETE CASCADE;
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_id_fkey" FOREIGN KEY ("id") REFERENCES "auth_users"("id") ON DELETE CASCADE;

-- ============================================================
-- 8. CHECK 约束
-- ============================================================
ALTER TABLE "ai_generation_tasks" ADD CONSTRAINT "2200_25290_5_not_null" CHECK (status IS NOT NULL);
ALTER TABLE "ai_generation_tasks" ADD CONSTRAINT "2200_25290_4_not_null" CHECK (type IS NOT NULL);
ALTER TABLE "ai_generation_tasks" ADD CONSTRAINT "2200_25290_2_not_null" CHECK (user_id IS NOT NULL);
ALTER TABLE "ai_generation_tasks" ADD CONSTRAINT "2200_25290_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "ai_generation_tasks" ADD CONSTRAINT "ai_generation_tasks_progress_check" CHECK (((progress >= 0) AND (progress <= 100)));
ALTER TABLE "ai_generation_tasks" ADD CONSTRAINT "ai_generation_tasks_status_check" CHECK (((status)::text = ANY ((ARRAY['queued'::character varying, 'processing'::character varying, 'partial'::character varying, 'completed'::character varying, 'failed'::character varying, 'cancelled'::character varying])::text[])));
ALTER TABLE "ai_generation_tasks" ADD CONSTRAINT "ai_generation_tasks_type_check" CHECK (((type)::text = ANY ((ARRAY['image'::character varying, 'video'::character varying, 'story'::character varying, 'interpretation'::character varying])::text[])));
ALTER TABLE "ai_generation_tasks" ADD CONSTRAINT "2200_25290_14_not_null" CHECK (created_at IS NOT NULL);
ALTER TABLE "ai_generation_tasks" ADD CONSTRAINT "2200_25290_6_not_null" CHECK (progress IS NOT NULL);
ALTER TABLE "audio_profiles" ADD CONSTRAINT "2200_25173_2_not_null" CHECK (user_id IS NOT NULL);
ALTER TABLE "audio_profiles" ADD CONSTRAINT "2200_25173_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "audio_profiles" ADD CONSTRAINT "2200_25173_10_not_null" CHECK (created_at IS NOT NULL);
ALTER TABLE "audio_profiles" ADD CONSTRAINT "2200_25173_3_not_null" CHECK (storage_path IS NOT NULL);
ALTER TABLE "audio_profiles" ADD CONSTRAINT "audio_profiles_duration_check" CHECK ((duration > 0));
ALTER TABLE "audio_profiles" ADD CONSTRAINT "audio_profiles_file_size_check" CHECK ((file_size > 0));
ALTER TABLE "audio_profiles" ADD CONSTRAINT "2200_25173_7_not_null" CHECK (is_tone_extracted IS NOT NULL);
ALTER TABLE "auth_users" ADD CONSTRAINT "2200_26528_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "auth_users" ADD CONSTRAINT "2200_26528_3_not_null" CHECK (password_hash IS NOT NULL);
ALTER TABLE "auth_users" ADD CONSTRAINT "2200_26528_2_not_null" CHECK (phone IS NOT NULL);
ALTER TABLE "dream_entries" ADD CONSTRAINT "2200_25192_2_not_null" CHECK (user_id IS NOT NULL);
ALTER TABLE "dream_entries" ADD CONSTRAINT "2200_25192_4_not_null" CHECK (content IS NOT NULL);
ALTER TABLE "dream_entries" ADD CONSTRAINT "2200_25192_5_not_null" CHECK (dream_date IS NOT NULL);
ALTER TABLE "dream_entries" ADD CONSTRAINT "2200_25192_9_not_null" CHECK (is_synced IS NOT NULL);
ALTER TABLE "dream_entries" ADD CONSTRAINT "2200_25192_13_not_null" CHECK (created_at IS NOT NULL);
ALTER TABLE "dream_entries" ADD CONSTRAINT "2200_25192_14_not_null" CHECK (updated_at IS NOT NULL);
ALTER TABLE "dream_entries" ADD CONSTRAINT "2200_25192_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "dream_entries" ADD CONSTRAINT "2200_25192_3_not_null" CHECK (title IS NOT NULL);
ALTER TABLE "dream_images" ADD CONSTRAINT "2200_26574_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "dream_images" ADD CONSTRAINT "2200_26574_3_not_null" CHECK (image_url IS NOT NULL);
ALTER TABLE "dream_images" ADD CONSTRAINT "2200_26574_2_not_null" CHECK (dream_id IS NOT NULL);
ALTER TABLE "dream_tags" ADD CONSTRAINT "2200_25216_3_not_null" CHECK (tag IS NOT NULL);
ALTER TABLE "dream_tags" ADD CONSTRAINT "2200_25216_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "dream_tags" ADD CONSTRAINT "2200_25216_2_not_null" CHECK (user_id IS NOT NULL);
ALTER TABLE "dream_tags" ADD CONSTRAINT "2200_25216_4_not_null" CHECK (count IS NOT NULL);
ALTER TABLE "dream_tags" ADD CONSTRAINT "2200_25216_5_not_null" CHECK (last_used_at IS NOT NULL);
ALTER TABLE "dream_tags" ADD CONSTRAINT "2200_25216_6_not_null" CHECK (created_at IS NOT NULL);
ALTER TABLE "dreams" ADD CONSTRAINT "dreams_sleep_quality_check" CHECK (((sleep_quality >= 1) AND (sleep_quality <= 5)));
ALTER TABLE "dreams" ADD CONSTRAINT "dreams_mood_rating_check" CHECK (((mood_rating >= 1) AND (mood_rating <= 5)));
ALTER TABLE "dreams" ADD CONSTRAINT "2200_30056_9_not_null" CHECK (dream_date IS NOT NULL);
ALTER TABLE "dreams" ADD CONSTRAINT "2200_30056_4_not_null" CHECK (content IS NOT NULL);
ALTER TABLE "dreams" ADD CONSTRAINT "2200_30056_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "dreams" ADD CONSTRAINT "2200_30056_2_not_null" CHECK (user_id IS NOT NULL);
ALTER TABLE "dreams" ADD CONSTRAINT "2200_30056_3_not_null" CHECK (title IS NOT NULL);
ALTER TABLE "dreams" ADD CONSTRAINT "dreams_content_type_check" CHECK (((content_type)::text = ANY ((ARRAY['text'::character varying, 'voice'::character varying, 'mixed'::character varying])::text[])));
ALTER TABLE "emotion_analyses" ADD CONSTRAINT "2200_26649_2_not_null" CHECK (interpretation_id IS NOT NULL);
ALTER TABLE "emotion_analyses" ADD CONSTRAINT "2200_26649_3_not_null" CHECK (emotion_type IS NOT NULL);
ALTER TABLE "emotion_analyses" ADD CONSTRAINT "2200_26649_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "emotion_analyses" ADD CONSTRAINT "emotion_analyses_intensity_check" CHECK (((intensity >= 1) AND (intensity <= 10)));
ALTER TABLE "generation_scenes" ADD CONSTRAINT "2200_26612_2_not_null" CHECK (generation_id IS NOT NULL);
ALTER TABLE "generation_scenes" ADD CONSTRAINT "2200_26612_3_not_null" CHECK (scene_number IS NOT NULL);
ALTER TABLE "generation_scenes" ADD CONSTRAINT "2200_26612_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "generation_scenes" ADD CONSTRAINT "2200_26612_4_not_null" CHECK (description IS NOT NULL);
ALTER TABLE "generation_scenes" ADD CONSTRAINT "generation_scenes_status_check" CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'generating_image'::character varying, 'image_complete'::character varying, 'generating_video'::character varying, 'video_complete'::character varying, 'failed'::character varying])::text[])));
ALTER TABLE "generations" ADD CONSTRAINT "generations_status_check" CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'processing'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])));
ALTER TABLE "generations" ADD CONSTRAINT "generations_generation_type_check" CHECK (((generation_type)::text = ANY ((ARRAY['image'::character varying, 'video_5s'::character varying, 'video_10s'::character varying, 'video_long'::character varying, 'script'::character varying, 'interpretation'::character varying])::text[])));
ALTER TABLE "generations" ADD CONSTRAINT "2200_26589_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "generations" ADD CONSTRAINT "2200_26589_2_not_null" CHECK (user_id IS NOT NULL);
ALTER TABLE "generations" ADD CONSTRAINT "2200_26589_3_not_null" CHECK (dream_id IS NOT NULL);
ALTER TABLE "generations" ADD CONSTRAINT "2200_26589_4_not_null" CHECK (generation_type IS NOT NULL);
ALTER TABLE "generations" ADD CONSTRAINT "2200_26589_6_not_null" CHECK (prompt IS NOT NULL);
ALTER TABLE "interpretations" ADD CONSTRAINT "2200_25315_12_not_null" CHECK (created_at IS NOT NULL);
ALTER TABLE "interpretations" ADD CONSTRAINT "interpretations_type_check" CHECK (((type)::text = ANY ((ARRAY['interpretation'::character varying, 'evaluation'::character varying])::text[])));
ALTER TABLE "interpretations" ADD CONSTRAINT "2200_25315_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "interpretations" ADD CONSTRAINT "2200_25315_2_not_null" CHECK (user_id IS NOT NULL);
ALTER TABLE "interpretations" ADD CONSTRAINT "2200_25315_4_not_null" CHECK (type IS NOT NULL);
ALTER TABLE "interpretations" ADD CONSTRAINT "2200_25315_5_not_null" CHECK (content IS NOT NULL);
ALTER TABLE "knowledge_items" ADD CONSTRAINT "2200_25339_11_not_null" CHECK (created_at IS NOT NULL);
ALTER TABLE "knowledge_items" ADD CONSTRAINT "2200_25339_2_not_null" CHECK (title IS NOT NULL);
ALTER TABLE "knowledge_items" ADD CONSTRAINT "2200_25339_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "knowledge_items" ADD CONSTRAINT "2200_25339_8_not_null" CHECK (view_count IS NOT NULL);
ALTER TABLE "knowledge_items" ADD CONSTRAINT "2200_25339_7_not_null" CHECK (status IS NOT NULL);
ALTER TABLE "knowledge_items" ADD CONSTRAINT "2200_25339_4_not_null" CHECK (source IS NOT NULL);
ALTER TABLE "knowledge_items" ADD CONSTRAINT "knowledge_items_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'inactive'::character varying])::text[])));
ALTER TABLE "knowledge_items" ADD CONSTRAINT "2200_25339_3_not_null" CHECK (content IS NOT NULL);
ALTER TABLE "knowledge_items" ADD CONSTRAINT "2200_25339_12_not_null" CHECK (updated_at IS NOT NULL);
ALTER TABLE "long_video_scripts" ADD CONSTRAINT "2200_25232_5_not_null" CHECK (content IS NOT NULL);
ALTER TABLE "long_video_scripts" ADD CONSTRAINT "2200_25232_6_not_null" CHECK (scenes IS NOT NULL);
ALTER TABLE "long_video_scripts" ADD CONSTRAINT "2200_25232_7_not_null" CHECK (status IS NOT NULL);
ALTER TABLE "long_video_scripts" ADD CONSTRAINT "2200_25232_8_not_null" CHECK (progress IS NOT NULL);
ALTER TABLE "long_video_scripts" ADD CONSTRAINT "2200_25232_13_not_null" CHECK (created_at IS NOT NULL);
ALTER TABLE "long_video_scripts" ADD CONSTRAINT "2200_25232_14_not_null" CHECK (updated_at IS NOT NULL);
ALTER TABLE "long_video_scripts" ADD CONSTRAINT "long_video_scripts_status_check" CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'script_generated'::character varying, 'keyframes_generated'::character varying, 'videos_generated'::character varying, 'completed'::character varying, 'failed'::character varying])::text[])));
ALTER TABLE "long_video_scripts" ADD CONSTRAINT "long_video_scripts_progress_check" CHECK (((progress >= 0) AND (progress <= 100)));
ALTER TABLE "long_video_scripts" ADD CONSTRAINT "2200_25232_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "long_video_scripts" ADD CONSTRAINT "2200_25232_2_not_null" CHECK (dream_id IS NOT NULL);
ALTER TABLE "long_video_scripts" ADD CONSTRAINT "2200_25232_3_not_null" CHECK (user_id IS NOT NULL);
ALTER TABLE "long_video_scripts" ADD CONSTRAINT "2200_25232_4_not_null" CHECK (title IS NOT NULL);
ALTER TABLE "media_assets" ADD CONSTRAINT "2200_25258_2_not_null" CHECK (user_id IS NOT NULL);
ALTER TABLE "media_assets" ADD CONSTRAINT "2200_25258_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "media_assets" ADD CONSTRAINT "2200_25258_4_not_null" CHECK (type IS NOT NULL);
ALTER TABLE "media_assets" ADD CONSTRAINT "2200_25258_5_not_null" CHECK (storage_path IS NOT NULL);
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_duration_check" CHECK ((duration > 0));
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_ratio_check" CHECK (((ratio)::text = ANY ((ARRAY['9:16'::character varying, '16:9'::character varying, '1:1'::character varying])::text[])));
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_type_check" CHECK (((type)::text = ANY ((ARRAY['image'::character varying, 'video'::character varying, 'long_video'::character varying])::text[])));
ALTER TABLE "media_assets" ADD CONSTRAINT "media_assets_file_size_check" CHECK ((file_size > 0));
ALTER TABLE "media_assets" ADD CONSTRAINT "2200_25258_17_not_null" CHECK (created_at IS NOT NULL);
ALTER TABLE "media_assets" ADD CONSTRAINT "2200_25258_15_not_null" CHECK (share_count IS NOT NULL);
ALTER TABLE "media_assets" ADD CONSTRAINT "2200_25258_14_not_null" CHECK (download_count IS NOT NULL);
ALTER TABLE "media_assets" ADD CONSTRAINT "2200_25258_13_not_null" CHECK (is_favorite IS NOT NULL);
ALTER TABLE "media_assets" ADD CONSTRAINT "2200_25258_11_not_null" CHECK (file_size IS NOT NULL);
ALTER TABLE "subscriptions" ADD CONSTRAINT "2200_25153_7_not_null" CHECK (end_at IS NOT NULL);
ALTER TABLE "subscriptions" ADD CONSTRAINT "2200_25153_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "subscriptions" ADD CONSTRAINT "2200_25153_2_not_null" CHECK (user_id IS NOT NULL);
ALTER TABLE "subscriptions" ADD CONSTRAINT "2200_25153_3_not_null" CHECK (plan IS NOT NULL);
ALTER TABLE "subscriptions" ADD CONSTRAINT "2200_25153_4_not_null" CHECK (amount IS NOT NULL);
ALTER TABLE "subscriptions" ADD CONSTRAINT "2200_25153_5_not_null" CHECK (currency IS NOT NULL);
ALTER TABLE "subscriptions" ADD CONSTRAINT "2200_25153_6_not_null" CHECK (start_at IS NOT NULL);
ALTER TABLE "subscriptions" ADD CONSTRAINT "2200_25153_8_not_null" CHECK (status IS NOT NULL);
ALTER TABLE "subscriptions" ADD CONSTRAINT "2200_25153_12_not_null" CHECK (created_at IS NOT NULL);
ALTER TABLE "subscriptions" ADD CONSTRAINT "2200_25153_13_not_null" CHECK (updated_at IS NOT NULL);
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_status_check" CHECK (((status)::text = ANY ((ARRAY['active'::character varying, 'expired'::character varying, 'cancelled'::character varying, 'pending'::character varying])::text[])));
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_plan_check" CHECK (((plan)::text = ANY ((ARRAY['monthly'::character varying, 'yearly'::character varying])::text[])));
ALTER TABLE "symbol_interpretations" ADD CONSTRAINT "2200_26635_4_not_null" CHECK (meaning IS NOT NULL);
ALTER TABLE "symbol_interpretations" ADD CONSTRAINT "2200_26635_2_not_null" CHECK (interpretation_id IS NOT NULL);
ALTER TABLE "symbol_interpretations" ADD CONSTRAINT "2200_26635_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "symbol_interpretations" ADD CONSTRAINT "2200_26635_3_not_null" CHECK (symbol IS NOT NULL);
ALTER TABLE "user_profiles" ADD CONSTRAINT "2200_25121_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_eval_window_check" CHECK ((eval_window = ANY (ARRAY[7, 15, 30])));
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_video_used_check" CHECK ((video_used >= 0));
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_image_used_check" CHECK ((image_used >= 0));
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_tier_check" CHECK (((tier)::text = ANY ((ARRAY['guest'::character varying, 'registered'::character varying, 'subscribed'::character varying])::text[])));
ALTER TABLE "user_profiles" ADD CONSTRAINT "2200_25121_7_not_null" CHECK (eval_window IS NOT NULL);
ALTER TABLE "user_profiles" ADD CONSTRAINT "2200_25121_6_not_null" CHECK (story_used IS NOT NULL);
ALTER TABLE "user_profiles" ADD CONSTRAINT "2200_25121_5_not_null" CHECK (video_used IS NOT NULL);
ALTER TABLE "user_profiles" ADD CONSTRAINT "2200_25121_12_not_null" CHECK (theme_preference IS NOT NULL);
ALTER TABLE "user_profiles" ADD CONSTRAINT "2200_25121_2_not_null" CHECK (user_id IS NOT NULL);
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_theme_preference_check" CHECK (((theme_preference)::text = ANY ((ARRAY['light'::character varying, 'dark'::character varying, 'system'::character varying])::text[])));
ALTER TABLE "user_profiles" ADD CONSTRAINT "2200_25121_3_not_null" CHECK (tier IS NOT NULL);
ALTER TABLE "user_profiles" ADD CONSTRAINT "2200_25121_4_not_null" CHECK (image_used IS NOT NULL);
ALTER TABLE "user_profiles" ADD CONSTRAINT "2200_25121_14_not_null" CHECK (updated_at IS NOT NULL);
ALTER TABLE "user_profiles" ADD CONSTRAINT "2200_25121_10_not_null" CHECK (streak_days IS NOT NULL);
ALTER TABLE "user_profiles" ADD CONSTRAINT "2200_25121_9_not_null" CHECK (total_works IS NOT NULL);
ALTER TABLE "user_profiles" ADD CONSTRAINT "2200_25121_8_not_null" CHECK (total_dreams IS NOT NULL);
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_story_used_check" CHECK ((story_used >= 0));
ALTER TABLE "user_settings" ADD CONSTRAINT "2200_26538_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "users" ADD CONSTRAINT "2200_25106_1_not_null" CHECK (id IS NOT NULL);
ALTER TABLE "users" ADD CONSTRAINT "2200_25106_8_not_null" CHECK (is_anonymous IS NOT NULL);
ALTER TABLE "users" ADD CONSTRAINT "users_gender_check" CHECK (((gender)::text = ANY ((ARRAY['male'::character varying, 'female'::character varying, 'other'::character varying])::text[])));
ALTER TABLE "users" ADD CONSTRAINT "users_age_check" CHECK (((age >= 0) AND (age <= 150)));
ALTER TABLE "users" ADD CONSTRAINT "2200_25106_12_not_null" CHECK (updated_at IS NOT NULL);
ALTER TABLE "users" ADD CONSTRAINT "2200_25106_11_not_null" CHECK (created_at IS NOT NULL);

-- ============================================================
-- 9. 索引定义
-- ============================================================
CREATE INDEX idx_tasks_created_at ON public.ai_generation_tasks USING btree (created_at DESC);
CREATE INDEX idx_tasks_dream_id ON public.ai_generation_tasks USING btree (dream_id);
CREATE INDEX idx_tasks_status ON public.ai_generation_tasks USING btree (status);
CREATE INDEX idx_tasks_type_status ON public.ai_generation_tasks USING btree (type, status);
CREATE INDEX idx_tasks_user_id ON public.ai_generation_tasks USING btree (user_id);
CREATE INDEX idx_audio_created_at ON public.audio_profiles USING btree (created_at DESC);
CREATE INDEX idx_audio_user_id ON public.audio_profiles USING btree (user_id);
CREATE INDEX idx_auth_users_phone ON public.auth_users USING btree (phone);
CREATE INDEX idx_dreams_created_at ON public.dream_entries USING btree (created_at DESC);
CREATE INDEX idx_dreams_dream_date ON public.dream_entries USING btree (dream_date);
CREATE INDEX idx_dreams_search ON public.dream_entries USING gin (search_vector);
CREATE INDEX idx_dreams_user_date ON public.dream_entries USING btree (user_id, dream_date DESC);
CREATE INDEX idx_dreams_user_id ON public.dream_entries USING btree (user_id);
CREATE INDEX idx_generations_dream_id ON public.generations USING btree (dream_id);
CREATE INDEX idx_generations_status ON public.generations USING btree (status);
CREATE INDEX idx_generations_type ON public.generations USING btree (generation_type);
CREATE INDEX idx_generations_user_id ON public.generations USING btree (user_id);
CREATE INDEX idx_interpretations_created_at ON public.interpretations USING btree (created_at DESC);
CREATE INDEX idx_interpretations_dream_id ON public.interpretations USING btree (dream_id);
CREATE INDEX idx_interpretations_type ON public.interpretations USING btree (type);
CREATE INDEX idx_interpretations_user_id ON public.interpretations USING btree (user_id);
CREATE INDEX idx_knowledge_category ON public.knowledge_items USING btree (category);
CREATE INDEX idx_knowledge_search ON public.knowledge_items USING gin (search_vector);
CREATE INDEX idx_knowledge_status ON public.knowledge_items USING btree (status);
CREATE INDEX idx_scripts_dream_id ON public.long_video_scripts USING btree (dream_id);
CREATE INDEX idx_scripts_status ON public.long_video_scripts USING btree (status);
CREATE INDEX idx_scripts_user_id ON public.long_video_scripts USING btree (user_id);
CREATE INDEX idx_media_created_at ON public.media_assets USING btree (created_at DESC);
CREATE INDEX idx_media_dream_id ON public.media_assets USING btree (dream_id);
CREATE INDEX idx_media_favorite ON public.media_assets USING btree (user_id, is_favorite) WHERE (is_favorite = true);
CREATE INDEX idx_media_type ON public.media_assets USING btree (type);
CREATE INDEX idx_media_user_id ON public.media_assets USING btree (user_id);
CREATE INDEX idx_subscriptions_end_at ON public.subscriptions USING btree (end_at);
CREATE INDEX idx_subscriptions_status ON public.subscriptions USING btree (status);
CREATE INDEX idx_subscriptions_user_id ON public.subscriptions USING btree (user_id);
CREATE INDEX idx_profiles_tier ON public.user_profiles USING btree (tier);
CREATE INDEX idx_profiles_user_id ON public.user_profiles USING btree (user_id);
CREATE INDEX idx_users_created_at ON public.users USING btree (created_at DESC);
CREATE INDEX idx_users_device ON public.users USING btree (device_id) WHERE (is_anonymous = true);
CREATE INDEX idx_users_phone ON public.users USING btree (phone) WHERE (phone IS NOT NULL);

-- ============================================================
-- 10. 触发器定义
-- ============================================================
-- 触发器: trigger_dream_entries_updated_at ON dream_entries
-- BEFORE UPDATE: EXECUTE FUNCTION update_updated_at_column()
-- 触发器: trigger_dream_search_vector ON dream_entries
-- BEFORE UPDATE: EXECUTE FUNCTION update_dream_search_vector()
-- 触发器: trigger_dream_search_vector ON dream_entries
-- BEFORE INSERT: EXECUTE FUNCTION update_dream_search_vector()
-- 触发器: trigger_user_stats ON dream_entries
-- AFTER DELETE: EXECUTE FUNCTION update_user_stats()
-- 触发器: trigger_user_stats ON dream_entries
-- AFTER INSERT: EXECUTE FUNCTION update_user_stats()
-- 触发器: trigger_knowledge_items_updated_at ON knowledge_items
-- BEFORE UPDATE: EXECUTE FUNCTION update_updated_at_column()
-- 触发器: trigger_knowledge_search_vector ON knowledge_items
-- BEFORE UPDATE: EXECUTE FUNCTION update_knowledge_search_vector()
-- 触发器: trigger_knowledge_search_vector ON knowledge_items
-- BEFORE INSERT: EXECUTE FUNCTION update_knowledge_search_vector()
-- 触发器: trigger_long_video_scripts_updated_at ON long_video_scripts
-- BEFORE UPDATE: EXECUTE FUNCTION update_updated_at_column()
-- 触发器: trigger_works_count ON media_assets
-- AFTER INSERT: EXECUTE FUNCTION update_works_count()
-- 触发器: trigger_works_count ON media_assets
-- AFTER DELETE: EXECUTE FUNCTION update_works_count()
-- 触发器: trigger_subscriptions_updated_at ON subscriptions
-- BEFORE UPDATE: EXECUTE FUNCTION update_updated_at_column()
-- 触发器: trigger_user_profiles_updated_at ON user_profiles
-- BEFORE UPDATE: EXECUTE FUNCTION update_updated_at_column()
-- 触发器: trigger_users_updated_at ON users
-- BEFORE UPDATE: EXECUTE FUNCTION update_updated_at_column()

-- ============================================================
-- 11. 表注释
-- ============================================================
COMMENT ON TABLE "ai_generation_tasks" IS 'AI生成任务表，跟踪AI生成任务的状态和进度';
COMMENT ON TABLE "audio_profiles" IS '音频记录表，存储语音录音和音色特征';
COMMENT ON TABLE "dream_entries" IS '梦境记录表，存储用户记录的梦境内容';
COMMENT ON TABLE "dream_tags" IS '梦境标签表，统计用户标签使用情况';
COMMENT ON TABLE "interpretations" IS '解梦结果表，存储梦境解读和心理测评结果';
COMMENT ON TABLE "knowledge_items" IS '知识库表，存储解梦知识库内容';
COMMENT ON TABLE "long_video_scripts" IS '长视频脚本表，存储梦境剧情长视频的剧本和生成状态';
COMMENT ON TABLE "media_assets" IS '媒资资源表，存储生成的图片、视频等媒体资源';
COMMENT ON TABLE "subscriptions" IS '订阅表，存储用户订阅信息';
COMMENT ON TABLE "user_profiles" IS '用户档案表，存储用户额度、统计信息和偏好设置';
COMMENT ON TABLE "users" IS '用户主表，存储用户基础信息，支持注册用户和匿名用户';

-- ============================================================
-- 12. 列注释
-- ============================================================
COMMENT ON COLUMN "ai_generation_tasks"."type" IS '任务类型';
COMMENT ON COLUMN "ai_generation_tasks"."status" IS '任务状态';
COMMENT ON COLUMN "ai_generation_tasks"."progress" IS '任务进度百分比';
COMMENT ON COLUMN "ai_generation_tasks"."current_step" IS '当前步骤描述';
COMMENT ON COLUMN "ai_generation_tasks"."model_source" IS '使用的AI模型来源';
COMMENT ON COLUMN "ai_generation_tasks"."params" IS '任务参数';
COMMENT ON COLUMN "ai_generation_tasks"."result" IS '任务结果';
COMMENT ON COLUMN "ai_generation_tasks"."error" IS '错误信息';
COMMENT ON COLUMN "audio_profiles"."storage_path" IS 'Supabase Storage中的存储路径';
COMMENT ON COLUMN "audio_profiles"."duration" IS '音频时长（秒）';
COMMENT ON COLUMN "audio_profiles"."file_size" IS '文件大小（字节）';
COMMENT ON COLUMN "audio_profiles"."mime_type" IS '音频MIME类型';
COMMENT ON COLUMN "audio_profiles"."is_tone_extracted" IS '是否已提取音色特征';
COMMENT ON COLUMN "audio_profiles"."tone_features" IS '音色特征数据，JSON格式';
COMMENT ON COLUMN "dream_entries"."title" IS '梦境标题';
COMMENT ON COLUMN "dream_entries"."content" IS '梦境内容描述';
COMMENT ON COLUMN "dream_entries"."dream_date" IS '梦境发生的日期';
COMMENT ON COLUMN "dream_entries"."emotions" IS '情绪标签数组';
COMMENT ON COLUMN "dream_entries"."tags" IS '自定义标签数组';
COMMENT ON COLUMN "dream_entries"."audio_id" IS '关联音频记录ID';
COMMENT ON COLUMN "dream_entries"."is_synced" IS '是否已同步到云端';
COMMENT ON COLUMN "dream_entries"."local_id" IS '客户端本地ID';
COMMENT ON COLUMN "dream_entries"."search_vector" IS '全文搜索向量';
COMMENT ON COLUMN "dream_tags"."tag" IS '标签名称';
COMMENT ON COLUMN "dream_tags"."count" IS '使用次数';
COMMENT ON COLUMN "dream_tags"."last_used_at" IS '最后使用时间';
COMMENT ON COLUMN "interpretations"."type" IS '类型：interpretation解梦/evaluation心理测评';
COMMENT ON COLUMN "interpretations"."content" IS '解读内容';
COMMENT ON COLUMN "interpretations"."symbols" IS '梦境符号解析数组';
COMMENT ON COLUMN "interpretations"."emotions_analysis" IS '情绪分析结果';
COMMENT ON COLUMN "interpretations"."suggestions" IS '建议数组';
COMMENT ON COLUMN "interpretations"."reference_ids" IS '引用的知识库条目ID数组';
COMMENT ON COLUMN "interpretations"."model_source" IS '使用的AI模型来源';
COMMENT ON COLUMN "knowledge_items"."title" IS '知识条目标题';
COMMENT ON COLUMN "knowledge_items"."content" IS '知识条目内容';
COMMENT ON COLUMN "knowledge_items"."source" IS '知识来源，如周公解梦/心理学';
COMMENT ON COLUMN "knowledge_items"."category" IS '分类';
COMMENT ON COLUMN "knowledge_items"."tags" IS '标签数组';
COMMENT ON COLUMN "knowledge_items"."status" IS '状态：active有效/inactive无效';
COMMENT ON COLUMN "knowledge_items"."view_count" IS '查看次数';
COMMENT ON COLUMN "knowledge_items"."search_vector" IS '全文搜索向量';
COMMENT ON COLUMN "long_video_scripts"."dream_id" IS '关联梦境ID';
COMMENT ON COLUMN "long_video_scripts"."title" IS '脚本标题';
COMMENT ON COLUMN "long_video_scripts"."content" IS '脚本内容';
COMMENT ON COLUMN "long_video_scripts"."scenes" IS '场景数组，存储每个场景的生成状态';
COMMENT ON COLUMN "long_video_scripts"."status" IS '生成状态';
COMMENT ON COLUMN "long_video_scripts"."progress" IS '生成进度百分比';
COMMENT ON COLUMN "long_video_scripts"."current_step" IS '当前步骤描述';
COMMENT ON COLUMN "long_video_scripts"."error_message" IS '错误信息';
COMMENT ON COLUMN "long_video_scripts"."model_source" IS 'AI模型来源';
COMMENT ON COLUMN "media_assets"."type" IS '媒资类型：image图片/video视频/long_video长视频';
COMMENT ON COLUMN "media_assets"."storage_path" IS 'Supabase Storage中的存储路径';
COMMENT ON COLUMN "media_assets"."thumbnail_path" IS '缩略图/封面图路径';
COMMENT ON COLUMN "media_assets"."model_source" IS '生成模型来源';
COMMENT ON COLUMN "media_assets"."style" IS '图片风格';
COMMENT ON COLUMN "media_assets"."ratio" IS '宽高比';
COMMENT ON COLUMN "media_assets"."duration" IS '视频时长（秒）';
COMMENT ON COLUMN "media_assets"."file_size" IS '文件大小（字节）';
COMMENT ON COLUMN "media_assets"."long_video_script_id" IS '关联长视频脚本ID';
COMMENT ON COLUMN "media_assets"."is_favorite" IS '是否收藏';
COMMENT ON COLUMN "media_assets"."download_count" IS '下载次数';
COMMENT ON COLUMN "media_assets"."share_count" IS '分享次数';
COMMENT ON COLUMN "subscriptions"."plan" IS '订阅计划：monthly月订/yearly年订';
COMMENT ON COLUMN "subscriptions"."amount" IS '订阅金额';
COMMENT ON COLUMN "subscriptions"."currency" IS '货币类型，默认CNY人民币';
COMMENT ON COLUMN "subscriptions"."start_at" IS '订阅开始时间';
COMMENT ON COLUMN "subscriptions"."end_at" IS '订阅结束时间';
COMMENT ON COLUMN "subscriptions"."status" IS '订阅状态：active有效/expired过期/cancelled取消/pending待支付';
COMMENT ON COLUMN "subscriptions"."payment_method" IS '支付方式';
COMMENT ON COLUMN "subscriptions"."payment_id" IS '支付平台订单号';
COMMENT ON COLUMN "user_profiles"."tier" IS '用户等级：guest访客/registered注册用户/subscribed订阅用户';
COMMENT ON COLUMN "user_profiles"."image_used" IS '已使用图片生成次数';
COMMENT ON COLUMN "user_profiles"."video_used" IS '已使用视频生成次数';
COMMENT ON COLUMN "user_profiles"."story_used" IS '已使用故事生成次数';
COMMENT ON COLUMN "user_profiles"."eval_window" IS '测评时间窗口（天）：7/15/30';
COMMENT ON COLUMN "user_profiles"."total_dreams" IS '累计梦境数量';
COMMENT ON COLUMN "user_profiles"."total_works" IS '累计作品数量';
COMMENT ON COLUMN "user_profiles"."streak_days" IS '连续记录天数';
COMMENT ON COLUMN "user_profiles"."last_dream_date" IS '最后记录梦境日期';
COMMENT ON COLUMN "user_profiles"."theme_preference" IS '主题偏好：light浅色/dark深色/system跟随系统';
COMMENT ON COLUMN "user_profiles"."settings" IS '扩展设置字段，JSON格式';
COMMENT ON COLUMN "users"."phone" IS '手机号，注册用户必填，匿名用户可为空';
COMMENT ON COLUMN "users"."password_hash" IS '密码哈希值，使用BCrypt加密';
COMMENT ON COLUMN "users"."nickname" IS '用户昵称';
COMMENT ON COLUMN "users"."avatar_url" IS '头像URL地址';
COMMENT ON COLUMN "users"."gender" IS '性别：male男性/female女性/other其他';
COMMENT ON COLUMN "users"."age" IS '年龄，范围0-150';
COMMENT ON COLUMN "users"."is_anonymous" IS '是否为匿名用户，默认FALSE';
COMMENT ON COLUMN "users"."device_id" IS '匿名用户设备标识';
COMMENT ON COLUMN "users"."last_login_at" IS '最后登录时间';
COMMENT ON COLUMN "users"."created_at" IS '创建时间';
COMMENT ON COLUMN "users"."updated_at" IS '更新时间';
