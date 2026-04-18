/**
 * 检查 dream_entries 表结构
 */

import { query, closePool } from '../config/database';

async function main() {
  try {
    console.log('🔍 检查 dream_entries 表结构...');
    
    const result = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'dream_entries'
      ORDER BY ordinal_position
    `);
    
    console.log('dream_entries 表列:');
    result.rows.forEach((row: any) => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
    
  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await closePool();
  }
}

main();
