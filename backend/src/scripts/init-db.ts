/**
 * 数据库初始化脚本
 * 手动执行数据库表结构初始化
 */

import { initializeDatabase } from '../config/database';

async function main() {
  console.log('🚀 开始初始化数据库...');
  try {
    await initializeDatabase();
    console.log('✅ 数据库初始化完成！');
    process.exit(0);
  } catch (error) {
    console.error('❌ 数据库初始化失败:', error);
    process.exit(1);
  }
}

main();
