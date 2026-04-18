/**
 * 更新 generations 表的 generation_type 约束
 * 添加 interpretation 类型支持
 */

import { query, closePool } from '../config/database';

async function main() {
  try {
    console.log('🔧 更新 generations 表约束...');
    
    // 删除旧约束
    await query(`
      ALTER TABLE generations 
      DROP CONSTRAINT IF EXISTS generations_generation_type_check
    `);
    console.log('✅ 删除旧约束');
    
    // 添加新约束（包含 interpretation 类型）
    await query(`
      ALTER TABLE generations 
      ADD CONSTRAINT generations_generation_type_check 
      CHECK (generation_type IN ('image', 'video_5s', 'video_10s', 'video_long', 'script', 'interpretation'))
    `);
    console.log('✅ 添加新约束（包含 interpretation 类型）');
    
    // 验证约束
    const result = await query(`
      SELECT constraint_name, check_clause 
      FROM information_schema.check_constraints 
      WHERE constraint_name = 'generations_generation_type_check'
    `);
    console.log('新约束:', result.rows[0]);
    
    console.log('✅ 更新完成！');
    
  } catch (error) {
    console.error('❌ 更新失败:', error);
  } finally {
    await closePool();
  }
}

main();
