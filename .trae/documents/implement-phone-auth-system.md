# 实现手机号注册登录系统计划

## 需求分析

### 用户权限策略
1. **未登录用户**: 梦境数据临时保存在本地 SQLite，重新安装 App 数据清空
2. **微信登录用户**: 数据保存在 Supabase 数据库，永久保存
3. **手机号登录用户**: 数据保存在 Supabase 数据库，永久保存

### 功能需求
1. **用户注册**
   - 填写手机号（验证数据库唯一性）
   - 填写密码（字母+数字，至少8位）
   - 填写确认密码
   - 注册成功后数据永久保存

2. **用户登录**
   - 填写手机号
   - 填写密码
   - 登录成功后梦境数据同步到云端

3. **密码规则**
   - 必须包含字母和数字
   - 至少8位字符

## 技术方案

### 1. 数据库设计

需要在现有 `user_profiles` 表基础上扩展：
- `password_hash`: 密码哈希（bcrypt）
- `auth_type`: 认证类型（phone/wechat）
- `phone_verified`: 手机号是否验证

### 2. 后端架构（Node.js 后端最佳实践）

```
src/
├── controllers/
│   └── AuthController.ts      # 认证控制器（注册、登录）
├── services/
│   └── AuthService.ts         # 认证服务层
├── repositories/
│   └── UserRepository.ts      # 用户数据访问层
├── middleware/
│   ├── validation.ts          # 请求验证中间件
│   └── rateLimit.ts           # 限流中间件
├── utils/
│   ├── password.ts            # 密码工具（验证规则、哈希）
│   └── validators.ts          # 验证器（手机号、密码）
└── routes/
    └── authRoutes.ts          # 认证路由
```

### 3. 密码安全

- 使用 `bcrypt` 进行密码哈希（salt rounds: 12）
- 密码规则验证：字母+数字，至少8位
- 不存储明文密码

### 4. JWT Token

- Access Token: 15分钟有效期
- Refresh Token: 7天有效期
- 支持 Token 刷新

## 实现步骤

### 步骤 1: 数据库迁移

创建 SQL 迁移文件，添加必要字段：
```sql
-- 添加密码相关字段到 user_profiles 表
ALTER TABLE user_profiles ADD COLUMN password_hash VARCHAR(255);
ALTER TABLE user_profiles ADD COLUMN auth_type VARCHAR(20) DEFAULT 'phone';
ALTER TABLE user_profiles ADD COLUMN phone_verified BOOLEAN DEFAULT FALSE;
```

### 步骤 2: 创建工具函数

1. `utils/password.ts` - 密码哈希和验证
2. `utils/validators.ts` - 手机号和密码格式验证
3. `utils/errors.ts` - 扩展错误类（如果还没有）

### 步骤 3: 创建 Repository 层

`repositories/UserRepository.ts`:
- `findByPhone(phone)` - 根据手机号查找用户
- `create(userData)` - 创建新用户
- `updatePassword(userId, passwordHash)` - 更新密码
- `updateLastLogin(userId)` - 更新最后登录时间

### 步骤 4: 创建 Service 层

`services/AuthService.ts`:
- `register(phone, password)` - 用户注册
- `login(phone, password)` - 用户登录
- `validatePassword(password)` - 验证密码规则
- `generateTokens(userId)` - 生成 JWT Token

### 步骤 5: 创建 Controller 层

`controllers/AuthController.ts`:
- `register(req, res)` - 处理注册请求
- `login(req, res)` - 处理登录请求
- `refreshToken(req, res)` - 刷新 Token

### 步骤 6: 创建路由

`routes/authRoutes.ts`:
- POST `/auth/register` - 注册
- POST `/auth/login` - 登录
- POST `/auth/refresh` - 刷新 Token

### 步骤 7: 集成到现有系统

更新 `routes/index.ts` 和 `app.ts` 注册新的 auth 路由

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
      "nickname": "用户xxx",
      "authType": "phone"
    },
    "token": "jwt-access-token",
    "refreshToken": "jwt-refresh-token"
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
      "nickname": "用户xxx",
      "authType": "phone"
    },
    "token": "jwt-access-token",
    "refreshToken": "jwt-refresh-token"
  }
}
```

### 3. Token 刷新

**请求:**
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "jwt-refresh-token"
}
```

## 验证规则

### 手机号验证
- 格式：中国大陆手机号（1[3-9]xxxxxxxx）
- 唯一性：数据库中不能重复

### 密码验证
- 长度：至少8位
- 复杂度：必须同时包含字母和数字
- 正则：`^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$`

## 安全措施

1. **限流**: 注册/登录接口限制频率（5次/15分钟）
2. **密码强度**: 强制要求字母+数字组合
3. **HTTPS**: 所有请求通过 HTTPS
4. **CORS**: 限制允许的域名
5. **错误信息**: 不泄露敏感信息

## 前端集成

注册成功后：
1. 保存 Token 到本地存储
2. 将本地 SQLite 数据同步到 Supabase
3. 后续请求携带 Authorization Header

## 验证清单

- [ ] 手机号格式验证正确
- [ ] 密码规则验证正确
- [ ] 注册时手机号唯一性检查
- [ ] 密码哈希存储安全
- [ ] JWT Token 生成和验证正常
- [ ] 登录后数据同步正常
- [ ] 错误处理完善
- [ ] 限流机制工作正常
