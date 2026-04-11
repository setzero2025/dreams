/**
 * 认证功能测试脚本
 * 测试用户注册和登录功能
 */

import dotenv from 'dotenv';
import { join } from 'path';

// 加载环境变量
dotenv.config({ path: join(__dirname, '.env') });

async function runTests() {
  console.log('🧪 认证功能测试\n');
  console.log('========================\n');

  const API_BASE_URL = 'http://localhost:3001/api/v1';
  const testPhone = `138${Date.now().toString().slice(-8)}`;
  const testPassword = 'Test1234';

  try {
    // 测试 1: 用户注册
    console.log('📋 测试 1: 用户注册');
    console.log('------------------------');
    console.log('手机号:', testPhone);
    console.log('密码:', testPassword);
    console.log('');

    const registerRes = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone,
        password: testPassword,
        confirmPassword: testPassword,
      }),
    });

    const registerData = await registerRes.json();
    console.log('注册响应:', JSON.stringify(registerData, null, 2));

    if (!registerData.success) {
      throw new Error(`注册失败: ${registerData.message}`);
    }

    console.log('✅ 注册成功\n');

    // 测试 2: 重复注册（应该失败）
    console.log('📋 测试 2: 重复注册检查');
    console.log('------------------------');

    const duplicateRes = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone,
        password: testPassword,
        confirmPassword: testPassword,
      }),
    });

    const duplicateData = await duplicateRes.json();
    console.log('重复注册响应:', JSON.stringify(duplicateData, null, 2));

    if (duplicateData.success) {
      throw new Error('重复注册应该失败');
    }

    console.log('✅ 重复注册正确拒绝\n');

    // 测试 3: 用户登录
    console.log('📋 测试 3: 用户登录');
    console.log('------------------------');

    const loginRes = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone,
        password: testPassword,
      }),
    });

    const loginData = await loginRes.json();
    console.log('登录响应:', JSON.stringify(loginData, null, 2));

    if (!loginData.success) {
      throw new Error(`登录失败: ${loginData.message}`);
    }

    console.log('✅ 登录成功\n');

    // 测试 4: 错误密码登录
    console.log('📋 测试 4: 错误密码登录');
    console.log('------------------------');

    const wrongPasswordRes = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: testPhone,
        password: 'WrongPassword123',
      }),
    });

    const wrongPasswordData = await wrongPasswordRes.json();
    console.log('错误密码响应:', JSON.stringify(wrongPasswordData, null, 2));

    if (wrongPasswordData.success) {
      throw new Error('错误密码应该登录失败');
    }

    console.log('✅ 错误密码正确拒绝\n');

    // 测试 5: 参数验证
    console.log('📋 测试 5: 参数验证');
    console.log('------------------------');

    const invalidRes = await fetch(`${API_BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: 'invalid-phone',
        password: '123', // 太短
        confirmPassword: '456', // 不匹配
      }),
    });

    const invalidData = await invalidRes.json();
    console.log('无效参数响应:', JSON.stringify(invalidData, null, 2));

    if (invalidData.success) {
      throw new Error('无效参数应该被拒绝');
    }

    console.log('✅ 参数验证正常工作\n');

    // 测试完成
    console.log('========================');
    console.log('✅ 所有测试通过！');
    console.log('认证功能正常工作');

  } catch (error: any) {
    console.error('\n❌ 测试失败:', error.message);
    process.exit(1);
  }
}

// 检查服务器是否运行
async function checkServer() {
  try {
    const res = await fetch('http://localhost:3001/health');
    if (res.ok) {
      console.log('✅ 服务器运行正常\n');
      return true;
    }
  } catch (error) {
    console.error('❌ 服务器未运行，请先启动服务器:');
    console.error('   npm run dev');
    process.exit(1);
  }
  return false;
}

// 主函数
async function main() {
  console.log('检查服务器状态...\n');
  await checkServer();
  await runTests();
}

main();
