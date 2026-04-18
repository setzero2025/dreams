/**
 * 数据库结构导出脚本
 * 连接真实数据库，获取所有表结构并生成 SQL 文件
 */

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';

// 数据库连接配置
const dbConfig = {
  host: 'aws-1-ap-south-1.pooler.supabase.com',
  port: 5432,
  database: 'postgres',
  user: 'postgres.tlwqaldjhfqjymtjiqjk',
  password: 'sj12#$%qWER',
  ssl: { rejectUnauthorized: false },
};

const pool = new Pool(dbConfig);

/**
 * 获取所有表的创建语句
 */
async function getTableDefinitions(): Promise<string[]> {
  const client = await pool.connect();
  try {
    // 获取所有用户创建的表（排除系统表）
    const tablesResult = await client.query(`
      SELECT 
        schemaname,
        tablename
      FROM pg_tables 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);

    const definitions: string[] = [];

    for (const table of tablesResult.rows) {
      const tableName = table.tablename;
      
      // 获取表的创建语句
      const ddlResult = await client.query(`
        SELECT 
          'CREATE TABLE IF NOT EXISTS "' || table_name || '" (' ||
          string_agg(
            '"' || column_name || '" ' || 
            data_type || 
            CASE 
              WHEN character_maximum_length IS NOT NULL 
              THEN '(' || character_maximum_length || ')'
              WHEN numeric_precision IS NOT NULL AND numeric_scale IS NOT NULL
              THEN '(' || numeric_precision || ',' || numeric_scale || ')'
              ELSE ''
            END ||
            CASE WHEN is_nullable = 'NO' THEN ' NOT NULL' ELSE '' END ||
            CASE WHEN column_default IS NOT NULL THEN ' DEFAULT ' || column_default ELSE '' END,
            ', '
            ORDER BY ordinal_position
          ) || ');' as create_statement
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        GROUP BY table_name
      `, [tableName]);

      if (ddlResult.rows.length > 0) {
        definitions.push(`-- 表: ${tableName}`);
        definitions.push(ddlResult.rows[0].create_statement);
        definitions.push('');
      }
    }

    return definitions;
  } finally {
    client.release();
  }
}

/**
 * 获取所有主键约束
 */
async function getPrimaryKeys(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        tc.table_name,
        kcu.column_name
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name, kcu.ordinal_position
    `);

    const pkMap = new Map<string, string[]>();
    for (const row of result.rows) {
      if (!pkMap.has(row.table_name)) {
        pkMap.set(row.table_name, []);
      }
      pkMap.get(row.table_name)!.push(row.column_name);
    }

    const definitions: string[] = [];
    for (const [tableName, columns] of pkMap) {
      definitions.push(`ALTER TABLE "${tableName}" ADD PRIMARY KEY (${columns.map(c => `"${c}"`).join(', ')});`);
    }

    return definitions;
  } finally {
    client.release();
  }
}

/**
 * 获取所有外键约束
 */
async function getForeignKeys(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        tc.table_name,
        kcu.column_name,
        ccu.table_name AS foreign_table_name,
        ccu.column_name AS foreign_column_name,
        rc.delete_rule,
        rc.update_rule
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      JOIN information_schema.constraint_column_usage ccu
        ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
      JOIN information_schema.referential_constraints rc
        ON rc.constraint_name = tc.constraint_name
        AND rc.constraint_schema = tc.table_schema
      WHERE tc.constraint_type = 'FOREIGN KEY'
        AND tc.table_schema = 'public'
      ORDER BY tc.table_name
    `);

    const definitions: string[] = [];
    for (const row of result.rows) {
      const onDelete = row.delete_rule !== 'NO ACTION' ? ` ON DELETE ${row.delete_rule}` : '';
      const onUpdate = row.update_rule !== 'NO ACTION' ? ` ON UPDATE ${row.update_rule}` : '';
      
      definitions.push(
        `ALTER TABLE "${row.table_name}" ` +
        `ADD CONSTRAINT "${row.table_name}_${row.column_name}_fkey" ` +
        `FOREIGN KEY ("${row.column_name}") ` +
        `REFERENCES "${row.foreign_table_name}"("${row.foreign_column_name}")` +
        `${onDelete}${onUpdate};`
      );
    }

    return definitions;
  } finally {
    client.release();
  }
}

/**
 * 获取所有索引
 */
async function getIndexes(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        indexname,
        tablename,
        indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname NOT LIKE '%_pkey'
        AND indexname NOT LIKE '%_key'
      ORDER BY tablename, indexname
    `);

    return result.rows.map(row => {
      // 提取索引创建语句（去掉 schema 限定）
      let def = row.indexdef;
      // 替换 "public"."tablename" 为 "tablename"
      def = def.replace(/"public"\./g, '');
      return def + ';';
    });
  } finally {
    client.release();
  }
}

/**
 * 获取所有唯一约束
 */
async function getUniqueConstraints(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu 
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
      GROUP BY tc.table_name, tc.constraint_name
      ORDER BY tc.table_name
    `);

    return result.rows.map(row => {
      const columns = row.columns.split(', ').map((c: string) => `"${c}"`).join(', ');
      return `ALTER TABLE "${row.table_name}" ADD CONSTRAINT "${row.constraint_name}" UNIQUE (${columns});`;
    });
  } finally {
    client.release();
  }
}

/**
 * 获取所有 CHECK 约束
 */
async function getCheckConstraints(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        cc.check_clause
      FROM information_schema.table_constraints tc
      JOIN information_schema.check_constraints cc 
        ON tc.constraint_name = cc.constraint_name
      WHERE tc.constraint_type = 'CHECK'
        AND tc.table_schema = 'public'
        AND tc.constraint_name NOT LIKE 'pg_%'
      ORDER BY tc.table_name
    `);

    return result.rows.map(row => {
      return `ALTER TABLE "${row.table_name}" ADD CONSTRAINT "${row.constraint_name}" CHECK (${row.check_clause});`;
    });
  } finally {
    client.release();
  }
}

/**
 * 获取所有触发器
 */
async function getTriggers(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        trigger_name,
        event_object_table,
        action_timing,
        event_manipulation,
        action_statement
      FROM information_schema.triggers
      WHERE trigger_schema = 'public'
      ORDER BY event_object_table, trigger_name
    `);

    return result.rows.map(row => {
      return `-- 触发器: ${row.trigger_name} ON ${row.event_object_table}\n` +
             `-- ${row.action_timing} ${row.event_manipulation}: ${row.action_statement}`;
    });
  } finally {
    client.release();
  }
}

/**
 * 获取所有函数
 */
async function getFunctions(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        routine_name,
        routine_definition
      FROM information_schema.routines
      WHERE routine_schema = 'public'
        AND routine_type = 'FUNCTION'
      ORDER BY routine_name
    `);

    return result.rows.map(row => {
      if (!row.routine_definition) return '';
      return `-- 函数: ${row.routine_name}\n${row.routine_definition}`;
    }).filter(f => f !== '');
  } finally {
    client.release();
  }
}

/**
 * 获取所有序列
 */
async function getSequences(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        sequence_name,
        data_type,
        start_value,
        minimum_value,
        maximum_value,
        increment
      FROM information_schema.sequences
      WHERE sequence_schema = 'public'
      ORDER BY sequence_name
    `);

    return result.rows.map(row => {
      return `CREATE SEQUENCE IF NOT EXISTS "${row.sequence_name}" ` +
             `AS ${row.data_type} ` +
             `START WITH ${row.start_value} ` +
             `INCREMENT BY ${row.increment} ` +
             `MINVALUE ${row.minimum_value} ` +
             `MAXVALUE ${row.maximum_value};`;
    });
  } finally {
    client.release();
  }
}

/**
 * 获取所有枚举类型
 */
async function getEnumTypes(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        t.typname as enum_name,
        string_agg(e.enumlabel, ', ' ORDER BY e.enumsortorder) as enum_values
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      JOIN pg_namespace n ON n.oid = t.typnamespace
      WHERE n.nspname = 'public'
      GROUP BY t.typname
      ORDER BY t.typname
    `);

    return result.rows.map(row => {
      const values = row.enum_values.split(', ').map((v: string) => `'${v}'`).join(', ');
      return `CREATE TYPE "${row.enum_name}" AS ENUM (${values});`;
    });
  } finally {
    client.release();
  }
}

/**
 * 获取表注释
 */
async function getTableComments(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        c.relname as table_name,
        obj_description(c.oid) as description
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE c.relkind = 'r'
        AND n.nspname = 'public'
        AND obj_description(c.oid) IS NOT NULL
      ORDER BY c.relname
    `);

    return result.rows.map(row => {
      return `COMMENT ON TABLE "${row.table_name}" IS '${row.description.replace(/'/g, "''")}';`;
    });
  } finally {
    client.release();
  }
}

/**
 * 获取列注释
 */
async function getColumnComments(): Promise<string[]> {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        c.table_name,
        c.column_name,
        pgd.description
      FROM pg_catalog.pg_statio_all_tables as st
      JOIN pg_catalog.pg_description pgd ON pgd.objoid = st.relid
      JOIN information_schema.columns c ON 
        pgd.objsubid = c.ordinal_position AND
        c.table_schema = st.schemaname AND
        c.table_name = st.relname
      WHERE c.table_schema = 'public'
        AND pgd.description IS NOT NULL
      ORDER BY c.table_name, c.ordinal_position
    `);

    return result.rows.map(row => {
      return `COMMENT ON COLUMN "${row.table_name}"."${row.column_name}" IS '${row.description.replace(/'/g, "''")}';`;
    });
  } finally {
    client.release();
  }
}

/**
 * 主函数：导出数据库结构
 */
async function exportDatabaseSchema() {
  console.log('🚀 开始导出数据库结构...\n');

  try {
    // 测试连接
    const testResult = await pool.query('SELECT NOW() as current_time');
    console.log('✅ 数据库连接成功，当前时间:', testResult.rows[0].current_time);
    console.log('');

    // 收集所有结构定义
    const allDefinitions: string[] = [];

    // 文件头注释
    allDefinitions.push('-- ============================================================');
    allDefinitions.push('-- Supabase 数据库初始化脚本');
    allDefinitions.push('-- 根据真实数据库结构自动生成');
    allDefinitions.push(`-- 生成时间: ${new Date().toISOString()}`);
    allDefinitions.push('-- ============================================================');
    allDefinitions.push('');

    // 1. 枚举类型
    console.log('📋 正在获取枚举类型...');
    const enums = await getEnumTypes();
    if (enums.length > 0) {
      allDefinitions.push('-- ============================================================');
      allDefinitions.push('-- 1. 枚举类型定义');
      allDefinitions.push('-- ============================================================');
      allDefinitions.push(...enums);
      allDefinitions.push('');
      console.log(`   ✓ 找到 ${enums.length} 个枚举类型`);
    }

    // 2. 序列
    console.log('📋 正在获取序列...');
    const sequences = await getSequences();
    if (sequences.length > 0) {
      allDefinitions.push('-- ============================================================');
      allDefinitions.push('-- 2. 序列定义');
      allDefinitions.push('-- ============================================================');
      allDefinitions.push(...sequences);
      allDefinitions.push('');
      console.log(`   ✓ 找到 ${sequences.length} 个序列`);
    }

    // 3. 函数
    console.log('📋 正在获取函数...');
    const functions = await getFunctions();
    if (functions.length > 0) {
      allDefinitions.push('-- ============================================================');
      allDefinitions.push('-- 3. 函数定义');
      allDefinitions.push('-- ============================================================');
      allDefinitions.push(...functions);
      allDefinitions.push('');
      console.log(`   ✓ 找到 ${functions.length} 个函数`);
    }

    // 4. 表结构
    console.log('📋 正在获取表结构...');
    const tables = await getTableDefinitions();
    if (tables.length > 0) {
      allDefinitions.push('-- ============================================================');
      allDefinitions.push('-- 4. 表结构定义');
      allDefinitions.push('-- ============================================================');
      allDefinitions.push(...tables);
      allDefinitions.push('');
      console.log(`   ✓ 找到 ${tables.filter(t => t.startsWith('-- 表:')).length} 个表`);
    }

    // 5. 主键约束
    console.log('📋 正在获取主键约束...');
    const primaryKeys = await getPrimaryKeys();
    if (primaryKeys.length > 0) {
      allDefinitions.push('-- ============================================================');
      allDefinitions.push('-- 5. 主键约束');
      allDefinitions.push('-- ============================================================');
      allDefinitions.push(...primaryKeys);
      allDefinitions.push('');
      console.log(`   ✓ 找到 ${primaryKeys.length} 个主键约束`);
    }

    // 6. 唯一约束
    console.log('📋 正在获取唯一约束...');
    const uniqueConstraints = await getUniqueConstraints();
    if (uniqueConstraints.length > 0) {
      allDefinitions.push('-- ============================================================');
      allDefinitions.push('-- 6. 唯一约束');
      allDefinitions.push('-- ============================================================');
      allDefinitions.push(...uniqueConstraints);
      allDefinitions.push('');
      console.log(`   ✓ 找到 ${uniqueConstraints.length} 个唯一约束`);
    }

    // 7. 外键约束
    console.log('📋 正在获取外键约束...');
    const foreignKeys = await getForeignKeys();
    if (foreignKeys.length > 0) {
      allDefinitions.push('-- ============================================================');
      allDefinitions.push('-- 7. 外键约束');
      allDefinitions.push('-- ============================================================');
      allDefinitions.push(...foreignKeys);
      allDefinitions.push('');
      console.log(`   ✓ 找到 ${foreignKeys.length} 个外键约束`);
    }

    // 8. CHECK 约束
    console.log('📋 正在获取 CHECK 约束...');
    const checkConstraints = await getCheckConstraints();
    if (checkConstraints.length > 0) {
      allDefinitions.push('-- ============================================================');
      allDefinitions.push('-- 8. CHECK 约束');
      allDefinitions.push('-- ============================================================');
      allDefinitions.push(...checkConstraints);
      allDefinitions.push('');
      console.log(`   ✓ 找到 ${checkConstraints.length} 个 CHECK 约束`);
    }

    // 9. 索引
    console.log('📋 正在获取索引...');
    const indexes = await getIndexes();
    if (indexes.length > 0) {
      allDefinitions.push('-- ============================================================');
      allDefinitions.push('-- 9. 索引定义');
      allDefinitions.push('-- ============================================================');
      allDefinitions.push(...indexes);
      allDefinitions.push('');
      console.log(`   ✓ 找到 ${indexes.length} 个索引`);
    }

    // 10. 触发器
    console.log('📋 正在获取触发器...');
    const triggers = await getTriggers();
    if (triggers.length > 0) {
      allDefinitions.push('-- ============================================================');
      allDefinitions.push('-- 10. 触发器定义');
      allDefinitions.push('-- ============================================================');
      allDefinitions.push(...triggers);
      allDefinitions.push('');
      console.log(`   ✓ 找到 ${triggers.length} 个触发器`);
    }

    // 11. 表注释
    console.log('📋 正在获取表注释...');
    const tableComments = await getTableComments();
    if (tableComments.length > 0) {
      allDefinitions.push('-- ============================================================');
      allDefinitions.push('-- 11. 表注释');
      allDefinitions.push('-- ============================================================');
      allDefinitions.push(...tableComments);
      allDefinitions.push('');
      console.log(`   ✓ 找到 ${tableComments.length} 个表注释`);
    }

    // 12. 列注释
    console.log('📋 正在获取列注释...');
    const columnComments = await getColumnComments();
    if (columnComments.length > 0) {
      allDefinitions.push('-- ============================================================');
      allDefinitions.push('-- 12. 列注释');
      allDefinitions.push('-- ============================================================');
      allDefinitions.push(...columnComments);
      allDefinitions.push('');
      console.log(`   ✓ 找到 ${columnComments.length} 个列注释`);
    }

    // 写入文件
    const outputPath = path.join(__dirname, '..', '..', 'docs', 'init_supabase.sql');
    const sqlContent = allDefinitions.join('\n');
    
    fs.writeFileSync(outputPath, sqlContent, 'utf-8');

    console.log('\n✅ 数据库结构导出成功！');
    console.log(`📁 文件路径: ${outputPath}`);
    console.log(`📊 文件大小: ${(fs.statSync(outputPath).size / 1024).toFixed(2)} KB`);

  } catch (error) {
    console.error('❌ 导出失败:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// 执行导出
exportDatabaseSchema();
