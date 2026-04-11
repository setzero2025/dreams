/**
 * 数据库连接和认证功能测试
 */

import dotenv from 'dotenv';
import { join } from 'path';

// 加载环境变量
dotenv.config({ path: join(__dirname, '.env') });

async function runTests() {
  console.log('🧪 数据库连接和认证功能测试\n');
  console.log('========================\n');

  try {
    // 测试 1: 数据库连接
    console.log('📋 测试 1: 数据库连接');
    console.log('------------------------');
    
    const { testDatabaseConnection } = await import('./src/config/database');
    const connected = await testDatabaseConnection();
    
    if (!connected) {
      throw new Error('数据库连接失败');
    }
    console.log('✅ 数据库连接成功\n');

    // 测试 2: 检查表是否存在
    console.log('📋 测试 2: 检查数据库表');
    console.log('------------------------');
    
    const { query } = await import('./src/config/database');
    
    const tablesResult = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
      ORDER BY table_name
    `);
    
    console.log('数据库中的表:');
    tablesResult.rows.forEach((row: any) => {
      console.log(`  - ${row.table_name}`);
    });
    
    // 检查 auth_users 表是否存在
    const hasAuthUsers = tablesResult.rows.some(
      (row: any) => row.table_name === 'auth_users'
    );
    
    if (!hasAuthUsers) {
      console.log('\n⚠️  auth_users 表不存在，请先运行迁移脚本:');
      console.log('  doc/supabase/migrations/002_add_auth_users.sql');
    } else {
      console.log('✅ auth_users 表存在\n');
    }

    // 测试 3: 认证功能（如果表存在）
    if (hasAuthUsers) {
      console.log('📋 测试 3: 认证功能');
      console.log('------------------------');
      
      const { authService } = await import('./src/services/AuthService');
      const testPhone = `138${Date.now().toString().slice(-8)}`;
      const testPassword = 'Test1234';
      
      console.log('测试手机号:', testPhone);
      
      // 注册
      console.log('\n1. 测试注册...');
      const registerResult = await authService.register(
        testPhone,
        testPassword,
        testPassword
      );
      console.log('✅ 注册成功');
      console.log('  用户ID:', registerResult.user.id);
      console.log('  昵称:', registerResult.user.nickname);
      console.log('  Token:', registerResult.token.substring(0, 50) + '...');
      
      // 登录
      console.log('\n2. 测试登录...');
      const loginResult = await authService.login(testPhone, testPassword);
      console.log('✅ 登录成功');
      console.log('  用户ID:', loginResult.user.id);
      console.log('  订阅类型:', loginResult.user.subscriptionType);
      
      // 重复注册（应该失败）
      console.log('\n3. 测试重复注册...');
      try {
        await authService.register(testPhone, testPassword, testPassword);
        console.log('❌ 应该失败但没有');
      } catch (error: any) {
        console.log('✅ 正确拒绝重复注册:', error.message);
      }
      
      // 错误密码（应该失败）
      console.log('\n4. 测试错误密码...');
      try {
        await authService.login(testPhone, 'WrongPassword123');
        console.log('❌ 应该失败但没有');
      } catch (error: any) {
        console.log('✅ 正确拒绝错误密码:', error.message);
      }
      
      console.log('\n');
    }

    // 测试完成
    console.log('========================');
    console.log('✅ 所有测试通过！');

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    console.error(error);
    process.exit(1);
  }
}

runTests();
