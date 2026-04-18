import { pool } from './src/config/database';

async function getDatabaseSchema() {
  try {
    // 获取所有表
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map((row: any) => row.table_name);
    
    console.log('-- ============================================');
    console.log('-- 数据库初始化脚本 - 根据真实数据库结构生成');
    console.log('-- ============================================\n');
    
    for (const tableName of tables) {
      // 获取表结构
      const columnsResult = await pool.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          is_nullable,
          column_default,
          ordinal_position
        FROM information_schema.columns 
        WHERE table_name = $1 
        AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [tableName]);
      
      // 获取主键
      const pkResult = await pool.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1 
        AND tc.constraint_type = 'PRIMARY KEY'
      `, [tableName]);
      
      const pkColumns = pkResult.rows.map((row: any) => row.column_name);
      
      // 获取外键
      const fkResult = await pool.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu 
          ON ccu.constraint_name = tc.constraint_name
        WHERE tc.table_name = $1 
        AND tc.constraint_type = 'FOREIGN KEY'
      `, [tableName]);
      
      // 获取唯一约束
      const uniqueResult = await pool.query(`
        SELECT tc.constraint_name, kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1 
        AND tc.constraint_type = 'UNIQUE'
      `, [tableName]);
      
      // 获取CHECK约束
      const checkResult = await pool.query(`
        SELECT conname, pg_get_constraintdef(oid) as def
        FROM pg_constraint 
        WHERE conrelid = $1::regclass 
        AND contype = 'c'
      `, [tableName]);
      
      // 生成CREATE TABLE语句
      console.log(`-- ============================================`);
      console.log(`-- ${tableName} 表`);
      console.log(`-- ============================================`);
      console.log(`CREATE TABLE IF NOT EXISTS ${tableName} (`);
      
      const columnDefs: string[] = [];
      
      for (const col of columnsResult.rows) {
        let dataType = col.data_type;
        
        // 处理特殊类型
        if (dataType === 'character varying') {
          dataType = col.character_maximum_length 
            ? `VARCHAR(${col.character_maximum_length})`
            : 'VARCHAR';
        } else if (dataType === 'character') {
          dataType = `CHAR(${col.character_maximum_length})`;
        } else if (dataType === 'numeric') {
          dataType = `NUMERIC(${col.numeric_precision},${col.numeric_scale})`;
        } else if (dataType === 'timestamp with time zone') {
          dataType = 'TIMESTAMP WITH TIME ZONE';
        } else if (dataType === 'timestamp without time zone') {
          dataType = 'TIMESTAMP';
        } else if (dataType === 'double precision') {
          dataType = 'DOUBLE PRECISION';
        } else if (dataType === 'ARRAY') {
          // 需要查询数组元素类型
          const arrayTypeResult = await pool.query(`
            SELECT pg_catalog.format_type(a.atttypid, a.atttypmod) as type
            FROM pg_catalog.pg_attribute a
            WHERE a.attrelid = $1::regclass
            AND a.attname = $2
          `, [tableName, col.column_name]);
          dataType = arrayTypeResult.rows[0]?.type || 'TEXT[]';
        } else {
          dataType = dataType.toUpperCase();
        }
        
        let def = `    ${col.column_name} ${dataType}`;
        
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        
        if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`;
        }
        
        columnDefs.push(def);
      }
      
      // 添加主键约束
      if (pkColumns.length > 0) {
        columnDefs.push(`    CONSTRAINT ${tableName}_pkey PRIMARY KEY (${pkColumns.join(', ')})`);
      }
      
      // 添加外键约束
      for (const fk of fkResult.rows) {
        columnDefs.push(`    CONSTRAINT ${tableName}_${fk.column_name}_fkey FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table_name}(${fk.foreign_column_name}) ON DELETE CASCADE`);
      }
      
      // 添加唯一约束
      const uniqueGroups: { [key: string]: string[] } = {};
      for (const unique of uniqueResult.rows) {
        if (!uniqueGroups[unique.constraint_name]) {
          uniqueGroups[unique.constraint_name] = [];
        }
        uniqueGroups[unique.constraint_name].push(unique.column_name);
      }
      
      for (const [constraintName, columns] of Object.entries(uniqueGroups)) {
        columnDefs.push(`    CONSTRAINT ${constraintName} UNIQUE (${columns.join(', ')})`);
      }
      
      console.log(columnDefs.join(',\n'));
      console.log(`);\n`);
      
      // 获取索引
      const indexResult = await pool.query(`
        SELECT 
          indexname,
          indexdef
        FROM pg_indexes 
        WHERE tablename = $1 
        AND schemaname = 'public'
      `, [tableName]);
      
      for (const idx of indexResult.rows) {
        // 跳过主键索引
        if (!idx.indexname.includes('_pkey')) {
          console.log(`${idx.indexdef};`);
        }
      }
      
      console.log('');
    }
    
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('获取数据库结构失败:', error);
    process.exit(1);
  }
}

getDatabaseSchema();
