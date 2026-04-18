/**
 * 修复数据库表结构
 * 添加缺失的列
 */

import { query, closePool } from '../config/database';

async function main() {
  try {
    console.log('🔧 修复数据库表结构...');
    
    // 检查 dream_entries 表列
    const dreamsColumns = await query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'dream_entries'
    `);
    console.log('dream_entries 表现有列:', dreamsColumns.rows.map((r: any) => r.column_name));
    
    // 检查是否缺少 emotions 和 tags 列
    const hasEmotions = dreamsColumns.rows.some((r: any) => r.column_name === 'emotions');
    const hasTags = dreamsColumns.rows.some((r: any) => r.column_name === 'tags');
    
    if (!hasEmotions) {
      console.log('添加 emotions 列...');
      await query(`ALTER TABLE dream_entries ADD COLUMN IF NOT EXISTS emotions TEXT[] DEFAULT '{}'`);
    }
    
    if (!hasTags) {
      console.log('添加 tags 列...');
      await query(`ALTER TABLE dream_entries ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}'`);
    }
    
    // 检查 generations 表的 generation_type 约束
    const genTypeCheck = await query(`
      SELECT constraint_name, check_clause 
      FROM information_schema.check_constraints 
      WHERE constraint_name LIKE '%generation%'
    `);
    console.log('generations 表约束:', genTypeCheck.rows);
    
    // 检查是否需要添加 interpretation 类型支持
    const hasInterpretation = genTypeCheck.rows.some((r: any) => 
      r.check_clause && r.check_clause.includes('interpretation')
    );
    
    if (!hasInterpretation) {
      console.log('⚠️ 需要添加 interpretation 类型支持');
      console.log('请手动执行以下 SQL:');
      console.log(`
ALTER TABLE generations DROP CONSTRAINT IF EXISTS generations_generation_type_check;
ALTER TABLE generations ADD CONSTRAINT generations_generation_type_check 
  CHECK (generation_type IN ('image', 'video_5s', 'video_10s', 'video_long', 'script', 'interpretation'));
      `);
    }
    
    console.log('✅ 数据库表结构修复完成！');
    
  } catch (error) {
    console.error('❌ 修复失败:', error);
  } finally {
    await closePool();
  }
}

main();
