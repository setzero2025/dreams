/**
 * 验证工具函数
 * 包含手机号、密码等格式验证
 */

/**
 * 验证手机号格式（中国大陆）
 * @param phone 手机号
 * @returns 是否有效
 */
export function isValidPhone(phone: string): boolean {
  // 中国大陆手机号规则：1[3-9]xxxxxxxx
  const phoneRegex = /^1[3-9]\d{9}$/;
  return phoneRegex.test(phone);
}

/**
 * 验证手机号并返回详细信息
 * @param phone 手机号
 * @returns 验证结果
 */
export function validatePhone(phone: string): {
  valid: boolean;
  message: string;
} {
  if (!phone) {
    return {
      valid: false,
      message: '手机号不能为空',
    };
  }

  if (!/^1\d{10}$/.test(phone)) {
    return {
      valid: false,
      message: '手机号格式不正确',
    };
  }

  if (!isValidPhone(phone)) {
    return {
      valid: false,
      message: '请输入有效的手机号',
    };
  }

  return {
    valid: true,
    message: '手机号格式正确',
  };
}

/**
 * 验证注册请求参数
 * @param data 请求数据
 * @returns 验证结果
 */
export function validateRegisterRequest(data: {
  phone?: string;
  password?: string;
  confirmPassword?: string;
}): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 验证手机号
  if (!data.phone) {
    errors.push('手机号不能为空');
  } else {
    const phoneValidation = validatePhone(data.phone);
    if (!phoneValidation.valid) {
      errors.push(phoneValidation.message);
    }
  }

  // 验证密码
  if (!data.password) {
    errors.push('密码不能为空');
  } else {
    if (data.password.length < 8) {
      errors.push('密码长度至少8位');
    }
    if (!/[a-zA-Z]/.test(data.password)) {
      errors.push('密码必须包含字母');
    }
    if (!/\d/.test(data.password)) {
      errors.push('密码必须包含数字');
    }
    if (!/^[a-zA-Z0-9]+$/.test(data.password)) {
      errors.push('密码只能包含字母和数字');
    }
  }

  // 验证确认密码
  if (!data.confirmPassword) {
    errors.push('确认密码不能为空');
  } else if (data.password !== data.confirmPassword) {
    errors.push('两次输入的密码不一致');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 验证登录请求参数
 * @param data 请求数据
 * @returns 验证结果
 */
export function validateLoginRequest(data: {
  phone?: string;
  password?: string;
}): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // 验证手机号
  if (!data.phone) {
    errors.push('手机号不能为空');
  } else {
    const phoneValidation = validatePhone(data.phone);
    if (!phoneValidation.valid) {
      errors.push(phoneValidation.message);
    }
  }

  // 验证密码
  if (!data.password) {
    errors.push('密码不能为空');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * 清理用户输入
 * @param input 输入字符串
 * @returns 清理后的字符串
 */
export function sanitizeInput(input: string | undefined): string {
  if (!input) return '';
  return input.trim();
}
