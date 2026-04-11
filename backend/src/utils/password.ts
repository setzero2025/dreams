/**
 * 密码工具函数
 * 包含密码哈希、验证和规则检查
 */

import bcrypt from 'bcrypt';

// bcrypt salt rounds (越高越安全但越慢，12 是推荐值)
const SALT_ROUNDS = 12;

/**
 * 密码规则验证
 * - 至少8位
 * - 必须包含字母和数字
 * @param password 密码
 * @returns 验证结果
 */
export function validatePasswordRule(password: string): {
  valid: boolean;
  message: string;
} {
  if (!password || password.length < 8) {
    return {
      valid: false,
      message: '密码长度至少8位',
    };
  }

  // 必须包含字母
  if (!/[a-zA-Z]/.test(password)) {
    return {
      valid: false,
      message: '密码必须包含字母',
    };
  }

  // 必须包含数字
  if (!/\d/.test(password)) {
    return {
      valid: false,
      message: '密码必须包含数字',
    };
  }

  // 只允许字母和数字
  if (!/^[a-zA-Z0-9]+$/.test(password)) {
    return {
      valid: false,
      message: '密码只能包含字母和数字',
    };
  }

  return {
    valid: true,
    message: '密码符合要求',
  };
}

/**
 * 哈希密码
 * @param password 明文密码
 * @returns 密码哈希
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 验证密码
 * @param password 明文密码
 * @param hash 密码哈希
 * @returns 是否匹配
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 生成随机密码
 * @param length 密码长度（默认12）
 * @returns 随机密码
 */
export function generateRandomPassword(length: number = 12): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let password = '';
  
  // 确保至少有一个字母和一个数字
  password += chars[Math.floor(Math.random() * 26)]; // 大写字母
  password += chars[26 + Math.floor(Math.random() * 26)]; // 小写字母
  password += chars[52 + Math.floor(Math.random() * 10)]; // 数字
  
  // 填充剩余长度
  for (let i = 3; i < length; i++) {
    password += chars[Math.floor(Math.random() * chars.length)];
  }
  
  // 打乱顺序
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
