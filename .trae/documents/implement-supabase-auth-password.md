# 实现 Supabase Auth 密码认证计划

## 需求分析

将用户注册和登录的密码管理从本地实现改为使用 Supabase Auth 官方方案：
1. **注册**: 使用 Supabase Auth `signUp` API，密码自动存储在 Supabase Auth 中
2. **登录**: 使用 Supabase Auth `signInWithPassword` API 进行密码验证
3. **优势**: 安全性更高，支持 Supabase 的完整认证生态（密码重置、邮箱验证等）

## 技术方案

### 1. Supabase Auth 流程

**注册流程:**
1. 调用 `supabase.auth.signUp({ phone, password })`
2. Supabase 在 `auth.users` 表中创建用户
3. 在 `user_profiles` 表中创建关联的用户资料
4. 返回 JWT Token

**登录流程:**
1. 调用 `supabase.auth.signInWithPassword({ phone, password })`
2. Supabase 验证密码
3. 返回 JWT Token
4. 查询 `user_profiles` 获取用户资料

### 2. 架构调整

```
src/
├── config/
│   └── supabase.ts              # 添加 Service Role Key 支持
├── services/
│   └── AuthService.ts           # 重构为使用 Supabase Auth
├── repositories/
│   └── UserRepository.ts        # 调整用户资料操作
└── middleware/
    └── auth.ts                  # 调整 Token 验证
```

### 3. 环境变量配置

需要添加 `SUPABASE_SERVICE_ROLE_KEY`（用于服务端操作）：
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key  # 新增
```

## 实现步骤

### 步骤 1: 更新 Supabase 配置

在 `config/supabase.ts` 中添加：
- Service Role Key 客户端（用于服务端操作，绕过 RLS）
- 保持现有的 Anon Key 客户端（用于用户操作）

### 步骤 2: 重构 AuthService

修改 `services/AuthService.ts`:
- `register()`: 使用 `supabase.auth.signUp()`
- `login()`: 使用 `supabase.auth.signInWithPassword()`
- `refreshToken()`: 使用 `supabase.auth.refreshSession()`

### 步骤 3: 创建用户资料同步

注册成功后，自动在 `user_profiles` 表创建记录：
- 使用 `auth.users` 的 `id` 作为外键
- 填充默认昵称、订阅类型等

### 步骤 4: 调整密码验证逻辑

移除本地 bcrypt 密码验证，完全依赖 Supabase Auth：
- 删除 `utils/password.ts` 中的验证逻辑（保留生成随机密码功能）
- 删除密码哈希存储逻辑

### 步骤 5: 更新中间件

调整 `middleware/auth.ts`:
- 使用 Supabase 验证 JWT Token
- 或者保持现有 JWT 验证（与 Supabase 兼容）

## API 设计

### 1. 用户注册

**请求:**
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "phone": "13800138000",
  "password": "Abc12345",
  "confirmPassword": "Abc12345"
}
```

**响应:**
```json
{
  "success": true,
  "message": "注册成功",
  "data": {
    "user": {
      "id": "uuid",
      "phone": "13800138000",
      "nickname": "用户xxx"
    },
    "token": "supabase-jwt-token",
    "refreshToken": "supabase-refresh-token"
  }
}
```

### 2. 用户登录

**请求:**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "phone": "13800138000",
  "password": "Abc12345"
}
```

**响应:**
```json
{
  "success": true,
  "message": "登录成功",
  "data": {
    "user": {
      "id": "uuid",
      "phone": "13800138000",
      "nickname": "用户xxx"
    },
    "token": "supabase-jwt-token",
    "refreshToken": "supabase-refresh-token"
  }
}
```

## Supabase Auth 配置

### 1. 启用手机号认证

在 Supabase Dashboard -> Authentication -> Providers -> Phone 中启用

### 2. 配置密码规则

Supabase Auth 默认密码规则：
- 最少 6 位字符
- 可以配置更复杂的规则

### 3. 数据库触发器

创建触发器，当 `auth.users` 有新用户时自动创建 `user_profiles`：

```sql
-- 创建触发器函数
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, phone, nickname, subscription_type)
  VALUES (
    NEW.id,
    NEW.phone,
    '用户' || substring(NEW.phone from length(NEW.phone)-3 for 4),
    'free'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 创建触发器
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

## 验证清单

- [ ] Supabase Auth 配置正确
- [ ] Service Role Key 配置正确
- [ ] 注册时密码保存到 Supabase Auth
- [ ] 登录时密码验证通过 Supabase Auth
- [ ] 用户资料自动同步到 user_profiles
- [ ] JWT Token 正确生成和验证
- [ ] 错误处理完善
- [ ] 与现有微信登录兼容

## 回滚计划

如果需要回滚到本地密码管理：
1. 保留原有 bcrypt 实现代码
2. 切换 AuthService 的实现方式
3. 迁移用户密码（需要用户重新设置密码）
