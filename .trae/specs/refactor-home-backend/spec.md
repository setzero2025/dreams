# 首页后端功能重构规格说明书

## Why
当前后端代码结构不够规范，缺乏清晰的分层架构。根据nodejs-backend-patterns最佳实践，需要重构"首页"相关后端功能，包括梦境列表、梦境详情、梦境作品等API，采用分层架构（Controller-Service-Repository）模式，提高代码可维护性和可测试性。

## What Changes
- **重构梦境模块**: 采用分层架构重构梦境相关API
- **新增Repository层**: 实现数据访问层，封装Supabase数据库操作
- **完善Service层**: 实现业务逻辑层，处理梦境业务规则
- **优化Controller层**: 实现HTTP请求处理层，统一响应格式
- **新增类型定义**: 完善TypeScript类型定义
- **新增额度检查**: 实现用户生成额度检查逻辑

## Impact
- 受影响模块:
  - `backend/src/controllers/DreamController.ts` - 重构Controller
  - `backend/src/services/DreamService.ts` - 完善Service层
  - `backend/src/repositories/dream.repository.ts` - 新增Repository层
  - `backend/src/repositories/media.repository.ts` - 新增媒资Repository
  - `backend/src/types/dream.types.ts` - 新增类型定义
  - `backend/src/routes/dreamRoutes.ts` - 更新路由

## ADDED Requirements

### Requirement: 梦境列表查询API
系统 SHALL 提供分页查询用户梦境列表的API，支持按时间范围筛选和搜索。

#### Scenario: 获取今天/本周/全部的梦境列表
- **WHEN** 用户请求获取梦境列表
- **AND** 提供时间范围参数（today/weekly/all）
- **THEN** 返回对应时间范围内的梦境列表
- **AND** 按创建时间倒序排列
- **AND** 包含梦境的基本信息和媒资统计

#### Scenario: 搜索梦境
- **WHEN** 用户输入搜索关键词
- **THEN** 在梦境标题、内容、标签中进行全文搜索
- **AND** 返回匹配的梦境列表

### Requirement: 梦境详情查询API
系统 SHALL 提供获取单个梦境详情的API，包含完整的梦境信息和关联数据。

#### Scenario: 获取梦境详情
- **WHEN** 用户请求特定梦境的详情
- **THEN** 返回梦境的基本信息（标题、内容、情绪、标签等）
- **AND** 返回关联的音频信息
- **AND** 返回关联的媒资列表（图片、视频、长视频）
- **AND** 返回关联的解读结果

#### Scenario: 梦境不存在
- **WHEN** 用户请求不存在的梦境ID
- **THEN** 返回404错误，提示梦境不存在

### Requirement: 梦境创建API
系统 SHALL 提供创建梦境记录的API，支持文字和语音记录。

#### Scenario: 创建文字梦境
- **WHEN** 用户提交梦境信息（标题、内容、日期、情绪、标签）
- **THEN** 验证必填字段
- **AND** 保存梦境记录到数据库
- **AND** 返回创建的梦境信息

#### Scenario: 创建带音频的梦境
- **WHEN** 用户提交梦境信息并关联音频ID
- **THEN** 验证音频记录存在且属于当前用户
- **AND** 保存梦境记录并关联音频

### Requirement: 梦境更新API
系统 SHALL 提供更新梦境记录的API。

#### Scenario: 更新梦境
- **WHEN** 用户提交更新后的梦境信息
- **THEN** 验证梦境存在且属于当前用户
- **AND** 更新梦境记录
- **AND** 返回更新后的信息

### Requirement: 梦境删除API
系统 SHALL 提供删除梦境记录的API，级联删除关联资源。

#### Scenario: 删除梦境
- **WHEN** 用户请求删除梦境
- **THEN** 验证梦境存在且属于当前用户
- **AND** 删除梦境记录
- **AND** 级联删除关联的音频、媒资、解读等数据
- **AND** 返回删除成功响应

### Requirement: 用户额度管理
系统 SHALL 实现用户生成额度检查和管理功能。

#### Scenario: 检查生成额度
- **WHEN** 用户请求生成图片/视频/剧情
- **THEN** 检查用户当前额度使用情况
- **AND** 订阅用户返回无限额度
- **AND** 非订阅用户返回剩余额度

#### Scenario: 额度不足
- **WHEN** 用户额度已用完
- **THEN** 返回429错误，提示订阅后可继续创作

## MODIFIED Requirements

### Requirement: 梦境作品查询
**修改内容**: 梦境详情API中返回的作品数据需要包含完整的媒资信息。

#### Scenario: 获取梦境作品
- **WHEN** 查询梦境详情
- **THEN** 返回关联的图片列表（含缩略图URL、风格信息）
- **AND** 返回关联的视频列表（含封面图、时长）
- **AND** 返回关联的长视频列表（含剧本ID）
- **AND** 返回关联的解读结果

## Design Specifications

### 架构分层
```
┌─────────────────────────────────────────┐
│  Controller Layer (HTTP处理)             │
│  - DreamController                       │
│  - 处理请求/响应，参数校验                  │
├─────────────────────────────────────────┤
│  Service Layer (业务逻辑)                │
│  - DreamService                          │
│  - 业务规则处理，额度检查                   │
├─────────────────────────────────────────┤
│  Repository Layer (数据访问)             │
│  - DreamRepository                       │
│  - MediaRepository                       │
│  - Supabase数据库操作封装                  │
└─────────────────────────────────────────┘
```

### API端点

| 方法 | 端点 | 功能 | 认证 |
|-----|------|------|------|
| GET | /api/dreams | 获取梦境列表 | 是 |
| GET | /api/dreams/:id | 获取梦境详情 | 是 |
| POST | /api/dreams | 创建梦境 | 是 |
| PUT | /api/dreams/:id | 更新梦境 | 是 |
| DELETE | /api/dreams/:id | 删除梦境 | 是 |
| GET | /api/dreams/:id/works | 获取梦境作品 | 是 |

### 数据模型

#### DreamEntity (梦境实体)
```typescript
interface DreamEntity {
  id: string;
  user_id: string;
  title: string;
  content: string;
  emotions: string[];
  tags: string[];
  audio_id: string | null;
  dream_date: string;
  created_at: string;
  updated_at: string;
}
```

#### DreamDetail (梦境详情)
```typescript
interface DreamDetail {
  id: string;
  title: string;
  content: string;
  emotions: string[];
  tags: string[];
  dream_date: string;
  audio: AudioInfo | null;
  media: {
    images: MediaAsset[];
    videos: MediaAsset[];
    stories: MediaAsset[];
  };
  interpretation: Interpretation | null;
  created_at: string;
  updated_at: string;
}
```

#### DreamListItem (梦境列表项)
```typescript
interface DreamListItem {
  id: string;
  title: string;
  content: string;
  emotions: string[];
  tags: string[];
  dream_date: string;
  has_audio: boolean;
  has_media: boolean;
  media_count: {
    image: number;
    video: number;
    story: number;
  };
  has_interpretation: boolean;
  created_at: string;
}
```

### 错误处理

| 错误码 | 说明 | HTTP状态码 |
|-------|------|-----------|
| DREAM_NOT_FOUND | 梦境不存在 | 404 |
| DREAM_ACCESS_DENIED | 无权访问该梦境 | 403 |
| INVALID_DREAM_DATA | 梦境数据验证失败 | 400 |
| QUOTA_EXCEEDED | 生成额度已用完 | 429 |

### 响应格式

统一使用ApiResponse格式：
```typescript
interface ApiResponse<T> {
  code: number;
  message: string;
  data: T;
  timestamp: number;
  requestId: string;
}
```
