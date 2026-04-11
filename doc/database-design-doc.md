# 梦境工坊 (Dreams) 数据库设计文档

> 生成日期: 2026-04-06  
> 数据库: PostgreSQL 14+  
> 文档版本: v1.0

---

## 目录

1. [概述](#概述)
2. [数据库架构](#数据库架构)
3. [表结构详细说明](#表结构详细说明)
4. [索引设计](#索引设计)
5. [触发器与函数](#触发器与函数)
6. [关系图](#关系图)
7. [枚举值定义](#枚举值定义)

---

## 概述

### 设计目标

梦境工坊数据库设计旨在支持以下核心功能：

- **用户管理**: 支持匿名用户和注册用户，灵活的认证机制
- **梦境记录**: 存储用户的梦境内容、情绪、标签等信息
- **AI创作**: 支持图片、视频、长视频(故事)的生成与存储
- **梦境解读**: AI驱动的梦境分析和心理学测评
- **知识库**: 梦境符号和心理学知识的管理

### 技术选型

| 技术 | 版本 | 用途 |
|------|------|------|
| PostgreSQL | 14+ | 主数据库 |
| UUID | - | 主键生成 |
| JSONB | - | 灵活存储元数据 |
| TSVECTOR | - | 全文搜索 |

---

## 数据库架构

### 表清单

| 序号 | 表名 | 说明 | 数据量预估 |
|------|------|------|-----------|
| 1 | `users` | 用户主表 | 百万级 |
| 2 | `user_profiles` | 用户档案 | 百万级 |
| 3 | `subscriptions` | 订阅记录 | 十万级 |
| 4 | `dream_entries` | 梦境记录 | 千万级 |
| 5 | `dream_tags` | 标签统计 | 百万级 |
| 6 | `audio_profiles` | 音频记录 | 百万级 |
| 7 | `media_assets` | 媒资资源 | 千万级 |
| 8 | `long_video_scripts` | 长视频脚本 | 百万级 |
| 9 | `interpretations` | 梦境解读 | 千万级 |
| 10 | `knowledge_items` | 知识库 | 万级 |

### 模块划分

```
┌─────────────────────────────────────────────────────────────┐
│                        用户模块                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │    users     │  │user_profiles │  │ subscriptions│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        梦境模块                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │dream_entries │  │  dream_tags  │  │audio_profiles│       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        媒资模块                              │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │ media_assets │  │long_video_scripts                     │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        解读模块                              │
│  ┌──────────────┐  ┌──────────────┐                         │
│  │interpretations│  │knowledge_items                       │
│  └──────────────┘  └──────────────┘                         │
└─────────────────────────────────────────────────────────────┘
```

---

## 表结构详细说明

### 1. 用户模块

#### 1.1 users (用户主表)

存储用户的基本信息，支持匿名用户和注册用户两种模式。

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | PRIMARY KEY | gen_random_uuid() | 用户唯一标识 |
| phone | VARCHAR(20) | UNIQUE, NULLABLE | - | 手机号，匿名用户可为空 |
| password_hash | VARCHAR(255) | NULLABLE | - | 密码哈希(BCrypt) |
| nickname | VARCHAR(100) | NULLABLE | - | 用户昵称 |
| avatar_url | TEXT | NULLABLE | - | 头像URL地址 |
| gender | VARCHAR(10) | NULLABLE | - | 性别: male/female/other |
| age | INTEGER | NULLABLE | - | 年龄 |
| is_anonymous | BOOLEAN | - | false | 是否匿名用户 |
| device_id | VARCHAR(255) | NULLABLE | - | 设备ID，用于匿名用户识别 |
| last_login_at | TIMESTAMP | NULLABLE | - | 最后登录时间 |
| created_at | TIMESTAMP | - | NOW() | 创建时间 |
| updated_at | TIMESTAMP | - | NOW() | 更新时间 |

**业务规则:**
- 匿名用户通过 `device_id` 识别，`phone` 和 `password_hash` 为空
- 注册用户必须提供手机号和密码
- 用户等级由 `user_profiles.tier` 字段控制

#### 1.2 user_profiles (用户档案表)

存储用户的额度使用情况、统计信息和偏好设置。

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | PRIMARY KEY | gen_random_uuid() | 档案ID |
| user_id | UUID | UNIQUE, NOT NULL, FK | - | 关联用户ID |
| tier | VARCHAR(20) | - | 'guest' | 用户等级 |
| image_used | INTEGER | - | 0 | 已使用图片生成次数 |
| video_used | INTEGER | - | 0 | 已使用视频生成次数 |
| story_used | INTEGER | - | 0 | 已使用故事生成次数 |
| eval_window | INTEGER | - | 7 | 测评时间窗口(天) |
| total_dreams | INTEGER | - | 0 | 梦境记录总数 |
| total_works | INTEGER | - | 0 | 作品总数 |
| streak_days | INTEGER | - | 0 | 连续记录天数 |
| last_dream_date | DATE | NULLABLE | - | 最后记录梦境日期 |
| theme_preference | VARCHAR(20) | - | 'system' | 主题偏好 |
| settings | JSONB | - | '{}' | 用户设置JSON |
| updated_at | TIMESTAMP | - | NOW() | 更新时间 |

**额度规则:**

| 用户等级 | 图片额度 | 视频额度 | 故事额度 | 解读额度 |
|----------|----------|----------|----------|----------|
| guest | 3 | 1 | 0 | 无限 |
| registered | 10 | 3 | 1 | 无限 |
| subscribed | 无限 | 无限 | 无限 | 无限 |

#### 1.3 subscriptions (订阅表)

存储用户的订阅信息，支持月度和年度订阅计划。

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | PRIMARY KEY | gen_random_uuid() | 订阅ID |
| user_id | UUID | NOT NULL, FK | - | 关联用户ID |
| plan | VARCHAR(20) | NOT NULL | - | 订阅计划: monthly/yearly |
| amount | DECIMAL(10,2) | NOT NULL | - | 金额 |
| currency | VARCHAR(10) | - | 'CNY' | 货币 |
| start_at | TIMESTAMP | NOT NULL | - | 开始时间 |
| end_at | TIMESTAMP | NOT NULL | - | 结束时间 |
| status | VARCHAR(20) | - | 'active' | 状态 |
| payment_method | VARCHAR(50) | NULLABLE | - | 支付方式 |
| payment_id | VARCHAR(255) | NULLABLE | - | 支付平台订单ID |
| metadata | JSONB | - | '{}' | 附加信息 |
| created_at | TIMESTAMP | - | NOW() | 创建时间 |
| updated_at | TIMESTAMP | - | NOW() | 更新时间 |

---

### 2. 梦境模块

#### 2.1 dream_entries (梦境记录表)

核心表，存储用户记录的梦境内容。

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | PRIMARY KEY | gen_random_uuid() | 梦境ID |
| user_id | UUID | NOT NULL, FK | - | 关联用户ID |
| title | VARCHAR(255) | NOT NULL | - | 梦境标题 |
| content | TEXT | NOT NULL | - | 梦境内容 |
| dream_date | DATE | NOT NULL | - | 梦境发生日期 |
| emotions | TEXT[] | - | '{}' | 情绪标签数组 |
| tags | TEXT[] | - | '{}' | 标签数组 |
| audio_id | UUID | NULLABLE, FK | - | 关联音频ID |
| created_at | TIMESTAMP | - | NOW() | 创建时间 |
| updated_at | TIMESTAMP | - | NOW() | 更新时间 |

**情绪标签示例:**
```json
["开心", "焦虑", "恐惧", "平静", "兴奋"]
```

**标签示例:**
```json
["飞行", "水", "追逐", "家人", "工作"]
```

#### 2.2 dream_tags (梦境标签表)

统计用户使用的标签及其使用次数。

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | PRIMARY KEY | gen_random_uuid() | 标签ID |
| user_id | UUID | NOT NULL, FK | - | 关联用户ID |
| tag | VARCHAR(50) | NOT NULL | - | 标签名称 |
| count | INTEGER | - | 1 | 使用次数 |
| last_used_at | TIMESTAMP | - | NOW() | 最后使用时间 |
| created_at | TIMESTAMP | - | NOW() | 创建时间 |

**唯一约束:** (user_id, tag)

#### 2.3 audio_profiles (音频记录表)

存储用户的录音和提取的音色特征。

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | PRIMARY KEY | gen_random_uuid() | 音频ID |
| user_id | UUID | NOT NULL, FK | - | 关联用户ID |
| storage_path | TEXT | NOT NULL | - | 存储路径 |
| duration | INTEGER | NULLABLE | - | 时长(秒) |
| file_size | INTEGER | NULLABLE | - | 文件大小(字节) |
| is_tone_extracted | BOOLEAN | - | false | 是否已提取音色 |
| tone_features | JSONB | NULLABLE | - | 音色特征数据 |
| metadata | JSONB | - | '{}' | 元数据 |
| created_at | TIMESTAMP | - | NOW() | 创建时间 |

**tone_features 示例:**
```json
{
  "pitch": 120.5,
  "timbre_vector": [0.1, 0.2, ...],
  "speed": 1.2,
  "emotion": "calm"
}
```

---

### 3. 媒资模块

#### 3.1 media_assets (媒资资源表)

统一存储图片、视频、长视频(故事)等AI生成内容。

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | PRIMARY KEY | gen_random_uuid() | 媒资ID |
| user_id | UUID | NOT NULL, FK | - | 关联用户ID |
| dream_id | UUID | NULLABLE, FK | - | 关联梦境ID |
| type | VARCHAR(20) | NOT NULL | - | 类型: image/video/long_video |
| storage_path | TEXT | NOT NULL | - | 存储路径 |
| thumbnail_path | TEXT | NULLABLE | - | 缩略图路径 |
| model_source | VARCHAR(50) | NULLABLE | - | AI模型来源 |
| style | VARCHAR(50) | NULLABLE | - | 风格 |
| ratio | VARCHAR(20) | NULLABLE | - | 比例 |
| duration | INTEGER | NULLABLE | - | 时长(秒) |
| file_size | INTEGER | - | 0 | 文件大小(字节) |
| long_video_script_id | UUID | NULLABLE | - | 关联脚本ID |
| is_favorite | BOOLEAN | - | false | 是否收藏 |
| download_count | INTEGER | - | 0 | 下载次数 |
| share_count | INTEGER | - | 0 | 分享次数 |
| metadata | JSONB | - | '{}' | 元数据 |
| created_at | TIMESTAMP | - | NOW() | 创建时间 |

**类型说明:**
- `image`: AI生成的梦境图片
- `video`: AI生成的短视频
- `long_video`: AI生成的长视频故事

#### 3.2 long_video_scripts (长视频脚本表)

存储长视频的故事脚本和场景信息。

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | PRIMARY KEY | gen_random_uuid() | 脚本ID |
| user_id | UUID | NOT NULL, FK | - | 关联用户ID |
| dream_id | UUID | NULLABLE, FK | - | 关联梦境ID |
| title | VARCHAR(255) | NOT NULL | - | 脚本标题 |
| content | TEXT | NOT NULL | - | 脚本内容 |
| scenes | JSONB | - | '[]' | 场景列表 |
| status | VARCHAR(20) | - | 'draft' | 状态 |
| model_source | VARCHAR(50) | NULLABLE | - | AI模型来源 |
| metadata | JSONB | - | '{}' | 元数据 |
| created_at | TIMESTAMP | - | NOW() | 创建时间 |
| updated_at | TIMESTAMP | - | NOW() | 更新时间 |

**scenes 示例:**
```json
[
  {
    "index": 1,
    "description": "场景描述...",
    "duration": 5,
    "image_prompt": "图像生成提示词..."
  }
]
```

**状态流转:**
```
draft -> generating -> completed
   |         |
   └-----> failed
```

---

### 4. 解读模块

#### 4.1 interpretations (梦境解读表)

存储AI对梦境的解读和心理学测评结果。

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | PRIMARY KEY | gen_random_uuid() | 解读ID |
| user_id | UUID | NOT NULL, FK | - | 关联用户ID |
| dream_id | UUID | NULLABLE, FK | - | 关联梦境ID |
| type | VARCHAR(20) | NOT NULL | - | 类型 |
| content | TEXT | NOT NULL | - | 解读内容 |
| symbols | JSONB | - | '[]' | 符号解读数组 |
| emotions_analysis | JSONB | NULLABLE | - | 情绪分析 |
| suggestions | TEXT[] | - | '{}' | 建议列表 |
| reference_ids | UUID[] | - | '{}' | 引用知识库ID数组 |
| model_source | VARCHAR(50) | NULLABLE | - | AI模型来源 |
| metadata | JSONB | - | '{}' | 元数据 |
| created_at | TIMESTAMP | - | NOW() | 创建时间 |

**类型说明:**
- `interpretation`: 单个梦境解读
- `evaluation`: 周期性心理测评

**symbols 示例:**
```json
[
  {
    "name": "飞行",
    "meaning": "渴望自由",
    "description": "梦见飞行通常代表..."
  }
]
```

**emotions_analysis 示例:**
```json
{
  "detected": ["焦虑", "期待"],
  "suggestions": "建议关注近期压力源..."
}
```

#### 4.2 knowledge_items (知识库表)

存储梦境符号解释和心理学知识，支持全文搜索。

| 字段名 | 类型 | 约束 | 默认值 | 说明 |
|--------|------|------|--------|------|
| id | UUID | PRIMARY KEY | gen_random_uuid() | 知识ID |
| title | VARCHAR(255) | NOT NULL | - | 标题 |
| content | TEXT | NOT NULL | - | 内容 |
| source | VARCHAR(100) | NULLABLE | - | 来源 |
| category | VARCHAR(50) | NULLABLE | - | 分类 |
| tags | TEXT[] | - | '{}' | 标签 |
| status | VARCHAR(20) | - | 'active' | 状态 |
| view_count | INTEGER | - | 0 | 浏览次数 |
| search_vector | TSVECTOR | NULLABLE | - | 全文搜索向量 |
| metadata | JSONB | - | '{}' | 元数据 |
| created_at | TIMESTAMP | - | NOW() | 创建时间 |
| updated_at | TIMESTAMP | - | NOW() | 更新时间 |

---

## 索引设计

### 用户模块索引

```sql
-- 手机号查询
CREATE INDEX idx_users_phone ON users(phone);

-- 匿名用户设备查询(部分索引)
CREATE INDEX idx_users_device_id ON users(device_id) WHERE is_anonymous = true;

-- 用户创建时间排序
CREATE INDEX idx_users_created_at ON users(created_at);

-- 用户档案查询
CREATE INDEX idx_user_profiles_user_id ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_tier ON user_profiles(tier);

-- 订阅查询
CREATE INDEX idx_subscriptions_user_id ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status);
CREATE INDEX idx_subscriptions_end_at ON subscriptions(end_at);
```

### 梦境模块索引

```sql
-- 用户梦境列表查询
CREATE INDEX idx_dream_entries_user_id ON dream_entries(user_id);
CREATE INDEX idx_dream_entries_created_at ON dream_entries(created_at DESC);

-- 日历视图查询
CREATE INDEX idx_dream_entries_dream_date ON dream_entries(dream_date);

-- 音频关联查询
CREATE INDEX idx_dream_entries_audio_id ON dream_entries(audio_id);

-- 标签统计查询
CREATE INDEX idx_dream_tags_user_id ON dream_tags(user_id);
CREATE INDEX idx_dream_tags_count ON dream_tags(count DESC);
```

### 媒资模块索引

```sql
-- 用户媒资查询
CREATE INDEX idx_media_assets_user_id ON media_assets(user_id);
CREATE INDEX idx_media_assets_created_at ON media_assets(created_at DESC);

-- 梦境关联媒资查询
CREATE INDEX idx_media_assets_dream_id ON media_assets(dream_id);

-- 类型筛选
CREATE INDEX idx_media_assets_type ON media_assets(type);

-- 收藏查询(部分索引)
CREATE INDEX idx_media_assets_favorite ON media_assets(user_id, is_favorite) 
WHERE is_favorite = true;
```

### 解读模块索引

```sql
-- 梦境解读查询
CREATE INDEX idx_interpretations_dream_id ON interpretations(dream_id);
CREATE INDEX idx_interpretations_type ON interpretations(type);

-- 用户解读历史
CREATE INDEX idx_interpretations_user_id ON interpretations(user_id);
CREATE INDEX idx_interpretations_created_at ON interpretations(created_at DESC);

-- 知识库搜索
CREATE INDEX idx_knowledge_items_search ON knowledge_items USING GIN(search_vector);
CREATE INDEX idx_knowledge_items_category ON knowledge_items(category);
```

---

## 触发器与函数

### 自动更新时间戳

```sql
-- 更新函数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 应用到各表
CREATE TRIGGER update_users_updated_at
    BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### 知识库全文搜索

```sql
-- 搜索向量更新函数
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

-- 触发器
CREATE TRIGGER update_knowledge_search_vector_trigger
    BEFORE INSERT OR UPDATE ON knowledge_items
    FOR EACH ROW EXECUTE FUNCTION update_knowledge_search_vector();
```

---

## 关系图

```
┌────────────────────────────────────────────────────────────────────────┐
│                              ER Diagram                                │
└────────────────────────────────────────────────────────────────────────┘

users (1) ───────────────────────┬────────────────────── (1) user_profiles
│                                │
│ (1:N)                          │ (1:N)
│                                │
▼                                ▼
dream_entries (N) ───────┬─── (N) media_assets
│                        │
│ (1:1)                  │ (N:1)
│                        │
audio_profiles           long_video_scripts
│
│ (1:N)
│
▼
interpretations (N) ─────┬─── (N) knowledge_items
                         │
                         │ (引用关系)
                         │
                    reference_ids[]

subscriptions (N:1) ─────┘ users
```

### 外键关系汇总

| 子表 | 外键字段 | 父表 | 删除策略 |
|------|----------|------|----------|
| user_profiles | user_id | users | CASCADE |
| subscriptions | user_id | users | CASCADE |
| dream_entries | user_id | users | CASCADE |
| dream_entries | audio_id | audio_profiles | - |
| dream_tags | user_id | users | CASCADE |
| audio_profiles | user_id | users | CASCADE |
| media_assets | user_id | users | CASCADE |
| media_assets | dream_id | dream_entries | SET NULL |
| long_video_scripts | user_id | users | CASCADE |
| long_video_scripts | dream_id | dream_entries | SET NULL |
| interpretations | user_id | users | CASCADE |
| interpretations | dream_id | dream_entries | CASCADE |

---

## 枚举值定义

### 用户相关

```typescript
// 用户等级
type UserTier = 'guest' | 'registered' | 'subscribed';

// 性别
type Gender = 'male' | 'female' | 'other';

// 主题偏好
type ThemePreference = 'light' | 'dark' | 'system';

// 订阅计划
type SubscriptionPlan = 'monthly' | 'yearly';

// 订阅状态
type SubscriptionStatus = 'active' | 'expired' | 'cancelled' | 'pending';
```

### 媒资相关

```typescript
// 媒资类型
type MediaType = 'image' | 'video' | 'long_video';

// 图片风格
type ImageStyle = 'realistic' | 'anime' | 'oil_painting' | 'watercolor' | 'sketch';

// 视频比例
type VideoRatio = '16:9' | '9:16' | '1:1';

// 脚本状态
type ScriptStatus = 'draft' | 'generating' | 'completed' | 'failed';
```

### 解读相关

```typescript
// 解读类型
type InterpretationType = 'interpretation' | 'evaluation';

// 知识库状态
type KnowledgeStatus = 'active' | 'inactive';
```

---

## 附录

### A. 数据库扩展

```sql
-- UUID生成
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 全文搜索
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
```

### B. 字符集设置

- 数据库编码: UTF-8
- 推荐排序规则: zh_CN.UTF-8 (中文排序)

### C. 备份策略建议

| 数据类型 | 备份频率 | 保留周期 |
|----------|----------|----------|
| 用户数据 | 每日 | 30天 |
| 梦境记录 | 每日 | 30天 |
| 媒资元数据 | 每日 | 30天 |
| 知识库 | 每周 | 90天 |

---

*文档结束*
