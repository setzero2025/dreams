# 统一数据库连接迁移计划

## 目标
将所有使用 Supabase 客户端的代码迁移为使用 pg 直接连接，只保留一种数据库连接方案。

## 当前状态分析

### 使用 Supabase 客户端的文件
1. `config/supabase.ts` - Supabase 配置（需要删除）
2. `services/DreamService.ts` - 梦境服务（已迁移）
3. `services/GenerationService.ts` - 生成服务
4. `services/UserService.ts` - 用户服务
5. `repositories/UserRepository.ts` - 用户仓库
6. `routes/creationRoutes.ts` - 创作路由

### 已使用 pg 连接的文件
1. `config/database.ts` - 统一的数据库配置 ✅
2. `repositories/AuthRepository.ts` - 认证仓库 ✅
3. `services/AuthService.ts` - 认证服务 ✅
4. `services/DreamService.ts` - 梦境服务 ✅（刚刚完成）

## 迁移步骤

### 步骤 1: 更新 GenerationService
- 将 `supabase.from(TABLES.GENERATIONS)` 改为 SQL 查询
- 使用 `query()` 和 `withTransaction()` 方法
- 保持原有业务逻辑不变

### 步骤 2: 更新 UserService
- 将微信登录逻辑改为 SQL 查询
- 更新用户资料查询
- 绑定手机号逻辑

### 步骤 3: 更新 UserRepository
- 替换所有 Supabase 查询为 SQL
- 使用 pg 连接池

### 步骤 4: 更新 creationRoutes
- 将路由中的 Supabase 查询改为 SQL
- 保持 API 响应格式不变

### 步骤 5: 清理工作
- 删除 `config/supabase.ts`
- 删除 `@supabase/supabase-js` 依赖
- 更新 `.env` 文件，移除 Supabase 相关配置
- 更新 `package.json`

## 数据库表结构确认

需要操作的表：
- `user_profiles` - 用户资料
- `auth_users` - 认证用户（新增）
- `dreams` - 梦境记录
- `dream_tags` - 梦境标签
- `generations` - AI 生成内容
- `generation_scenes` - 生成场景

## 实施计划

### 阶段 1: 服务层迁移
1. GenerationService
2. UserService

### 阶段 2: 仓库层迁移
1. UserRepository

### 阶段 3: 路由层迁移
1. creationRoutes

### 阶段 4: 清理
1. 删除 supabase.ts
2. 更新依赖
3. 更新配置

## 验证清单

- [ ] GenerationService 所有方法正常工作
- [ ] UserService 所有方法正常工作
- [ ] UserRepository 所有方法正常工作
- [ ] creationRoutes 所有端点正常
- [ ] 认证功能正常
- [ ] 梦境管理功能正常
- [ ] 创作生成功能正常
- [ ] 无 Supabase 客户端残留
- [ ] 所有测试通过

## 回滚方案

如果迁移出现问题：
1. 保留原文件备份
2. 可以快速切换回 Supabase 客户端
3. 数据库结构保持不变
