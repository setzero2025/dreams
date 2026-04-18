/**
 * 检查数据库表结构
 */

import { query, closePool } from '../config/database';

async function main() {
  try {
    console.log('🔍 检查数据库表结构...');
    
    // 检查 dream_entries 表是否存在
    const dreamsResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'dream_entries'
      )
    `);
    console.log('dream_entries 表存在:', dreamsResult.rows[0].exists);
    
    // 检查 dream_tags 表结构
    const dreamTagsResult = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'dream_tags'
    `);
    console.log('dream_tags 表列:', dreamTagsResult.rows);
    
    // 检查 user_profiles 表结构
    const userProfilesResult = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'user_profiles'
    `);
    console.log('user_profiles 表列:', userProfilesResult.rows);
    
    // 检查 generations 表是否存在
    const generationsResult = await query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'generations'
      )
    `);
    console.log('generations 表存在:', generationsResult.rows[0].exists);
    
    if (generationsResult.rows[0].exists) {
      const genColumnsResult = await query(`
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'generations'
      `);
      console.log('generations 表列:', genColumnsResult.rows.map((r: any) => r.column_name));
    }
    
  } catch (error) {
    console.error('❌ 检查失败:', error);
  } finally {
    await closePool();
  }
}

main();
