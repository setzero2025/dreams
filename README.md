# 记梦App - Dream Recorder

一个基于 AI 的梦境记录与分析应用，支持语音转文字、AI 绘画、视频生成等功能。

## 📁 项目结构

```
dreams/
├── backend/          # 后端服务 (Node.js + Express + Supabase)
│   ├── src/
│   │   ├── config/      # 配置文件
│   │   ├── controllers/ # 控制器
│   │   ├── middleware/  # 中间件
│   │   ├── models/      # 数据模型
│   │   ├── routes/      # API 路由
│   │   ├── services/    # 业务服务
│   │   ├── app.ts       # Express 应用
│   │   └── server.ts    # 服务器入口
│   ├── .env             # 环境变量（需手动创建）
│   ├── .env.example     # 环境变量示例
│   ├── package.json
│   └── tsconfig.json
├── frontend/         # 前端应用 (React Native + Expo)
│   ├── src/
│   │   ├── components/  # UI 组件
│   │   ├── config/      # 配置文件
│   │   ├── navigation/  # 导航配置
│   │   ├── pages/       # 页面组件
│   │   ├── services/    # 服务层
│   │   ├── theme/       # 主题配置
│   │   ├── types/       # TypeScript 类型
│   │   └── App.tsx      # 应用入口
│   ├── android/         # Android 原生代码
│   ├── app.json         # Expo 配置
│   ├── babel.config.js
│   ├── package.json
│   └── tsconfig.json
├── doc/              # 文档
│   ├── PRD-记梦App.md
│   ├── UI-Design-Spec.md
│   ├── database-design-doc.md
│   ├── XFYUN_CONFIG_GUIDE.md
│   └── supabase/
│       └── migrations/
└── README.md         # 本文件
```

## 🚀 快速开始

### 1. 后端启动

```bash
cd backend
npm install

# 复制环境变量示例并填写
cp .env.example .env
# 编辑 .env 文件，填写 Supabase 和 AI 服务配置

npm run dev
```

### 2. 前端启动

```bash
cd frontend
npm install
npx expo start
```

## 🔧 环境配置

### 后端环境变量 (`backend/.env`)

```bash
# Supabase
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI 服务 API Keys
SEEDREAM_API_KEY=your_seedream_api_key
KIMI_API_KEY=your_kimi_api_key
WAN26T2V_API_KEY=your_wan26t2v_api_key
XFYUN_APP_ID=your_xfyun_app_id
XFYUN_API_KEY=your_xfyun_api_key
XFYUN_API_SECRET=your_xfyun_api_secret
```

### 前端配置 (`frontend/src/config/api.ts`)

```typescript
export const API_BASE_URL = 'http://your-backend-url:3001/api/v1';
```

## 📚 技术栈

### 后端
- **框架**: Node.js + Express + TypeScript
- **数据库**: Supabase (PostgreSQL)
- **认证**: JWT + Supabase Auth
- **AI 服务**: 讯飞、豆包 Seedream、Kimi、阿里云 Wan2.6

### 前端
- **框架**: React Native + Expo
- **导航**: React Navigation
- **状态管理**: React Hooks
- **UI**: 自定义组件

## 📝 文档

- [产品需求文档 (PRD)](doc/PRD-记梦App.md)
- [UI 设计规范](doc/UI-Design-Spec.md)
- [数据库设计文档](doc/database-design-doc.md)
- [讯飞配置指南](doc/XFYUN_CONFIG_GUIDE.md)

## 🤝 贡献

欢迎提交 Issue 和 Pull Request！

## 📄 许可证

MIT License
