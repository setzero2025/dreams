import app from './app';
import { config } from './config';
import { initializeDatabase } from './config/database';
import fs from 'fs';
import path from 'path';

// 创建上传目录
const uploadDir = path.join(__dirname, '../uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 强制使用 3002 端口
const PORT = 3002;
console.log('【服务器配置】强制使用端口:', PORT);

async function startServer() {
  try {
    // 初始化数据库连接
    await initializeDatabase();
    
    // 启动服务器，监听所有网络接口
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`记梦App后端服务启动成功！`);
      console.log(`服务器地址: http://localhost:${PORT}`);
      console.log(`局域网地址: http://192.168.1.7:${PORT}`);
      console.log(`健康检查: http://localhost:${PORT}/health`);
      console.log(`API文档: http://localhost:${PORT}/api/v1`);
    });
  } catch (error) {
    console.error('服务器启动失败:', error);
    process.exit(1);
  }
}

startServer();
