# 修复 Seedream 4.5 模型集成计划

## 问题分析

当前 Seedream 4.5 模型接口调用失败，需要检查后端的调用方法并使用 Node.js 后端最佳实践重新实现。

### 现有实现问题

1. **模型 ID 可能已过期**: `doubao-seedream-4-5-251128` 可能不是最新的模型 ID
2. **API 端点配置**: 需要确认 Volces 平台的最新 API 规范
3. **请求参数格式**: 可能需要调整请求体结构
4. **错误处理不够完善**: 缺乏重试机制和详细的错误日志
5. **缺少服务层抽象**: 直接调用 axios，没有统一的服务层封装

## 解决方案

### 1. 使用 Node.js 后端最佳实践重构

按照 `nodejs-backend-patterns` skill 的指导：

* 分层架构（Controller → Service → Repository）

* 统一的错误处理

* 请求重试机制

* 完善的日志记录

* 配置管理

### 2. Seedream 4.5 API 规范

根据字节跳动 Volces 平台文档：

* **Base URL**: `https://ark.cn-beijing.volces.com/api/v3`

* **Endpoint**: `/images/generations`

* **Model ID**: 需要确认最新的 Seedream 4.5 模型 ID

* **认证**: Bearer Token (API Key)

* **请求格式**: OpenAI 兼容格式

### 3. 实现步骤

#### 步骤 1: 创建配置管理

* 在 `config/index.ts` 中添加 Seedream 配置

* 支持环境变量配置

* 添加配置验证

#### 步骤 2: 创建 Seedream 服务类

* 使用 Class-based 服务层

* 实现单例模式

* 添加请求拦截器和重试逻辑

* 完善错误处理

#### 步骤 3: 更新路由处理器

* 使用 async/await 模式

* 统一响应格式

* 添加请求验证

#### 步骤 4: 测试和验证

* 添加单元测试

* 验证 API 调用

* 检查响应处理

## 详细实现

### 步骤 1: 配置管理

```typescript
// config/ai.ts
export const seedreamConfig = {
  modelId: process.env.SEEDREAM_MODEL_ID || 'doubao-seedream-4-5-251128',
  baseUrl: process.env.SEEDREAM_BASE_URL || 'https://ark.cn-beijing.volces.com/api/v3',
  apiKey: process.env.SEEDREAM_API_KEY || '',
  timeout: parseInt(process.env.SEEDREAM_TIMEOUT || '120000'),
  maxRetries: parseInt(process.env.SEEDREAM_MAX_RETRIES || '3'),
  retryDelay: parseInt(process.env.SEEDREAM_RETRY_DELAY || '1000'),
};
```

### 步骤 2: Seedream 服务类

```typescript
// services/SeedreamService.ts
export class SeedreamService {
  private readonly config: SeedreamConfig;
  private readonly client: AxiosInstance;
  
  constructor() {
    this.config = seedreamConfig;
    this.client = this.createClient();
  }
  
  async generateImage(options: GenerateImageOptions): Promise<GenerateImageResult>
}
```

### 步骤 3: 错误处理

```typescript
// utils/errors.ts
export class AIServiceError extends AppError {
  constructor(message: string, public readonly provider: string) {
    super(message, 503);
  }
}
```

## 验证清单

* [ ] 配置正确加载

* [ ] API Key 有效

* [ ] 模型 ID 正确

* [ ] 请求格式符合规范

* [ ] 响应解析正确

* [ ] 错误处理完善

* [ ] 重试机制工作正常

* [ ] 日志记录完整

## 回滚计划

如果新实现出现问题：

1. 保留原有 `seedreamService.ts` 文件
2. 可以通过切换导入路径快速回滚
3. <br />

