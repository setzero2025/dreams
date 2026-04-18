import { pool } from './src/config/database';

async function checkTables() {
  try {
    // 查看所有表
    const tablesResult = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name");
    console.log('=== 数据库中的所有表 ===');
    tablesResult.rows.forEach((row: any) => console.log(row.table_name));
    
    // 查看interpretations表结构
    console.log('\n=== interpretations 表结构 ===');
    const interpResult = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'interpretations' ORDER BY ordinal_position");
    interpResult.rows.forEach((row: any) => console.log(`${row.column_name} | ${row.data_type} | ${row.is_nullable}`));
    
    // 查看generations表结构
    console.log('\n=== generations 表结构 ===');
    const genResult = await pool.query("SELECT column_name, data_type, is_nullable FROM information_schema.columns WHERE table_name = 'generations' ORDER BY ordinal_position");
    genResult.rows.forEach((row: any) => console.log(`${row.column_name} | ${row.data_type} | ${row.is_nullable}`));
    
    // 查看creations表是否存在
    console.log('\n=== 检查 creations 表 ===');
    const creationsResult = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_name = 'creations'");
    if (creationsResult.rows.length > 0) {
      const creationsCols = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'creations' ORDER BY ordinal_position");
      creationsCols.rows.forEach((row: any) => console.log(`${row.column_name} | ${row.data_type}`));
    } else {
      console.log('creations 表不存在');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('查询失败:', error);
    process.exit(1);
  }
}

checkTables();
