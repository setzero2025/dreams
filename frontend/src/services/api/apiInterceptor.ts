import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE_URL } from '../../config/api';

// 设备ID存储键名
const DEVICE_ID_KEY = 'device_id';

// 生成设备ID
const generateDeviceId = (): string => {
  return 'device_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
};

// 获取或创建设备ID
export const getOrCreateDeviceId = async (): Promise<string> => {
  let deviceId = await AsyncStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = generateDeviceId();
    await AsyncStorage.setItem(DEVICE_ID_KEY, deviceId);
    console.log('【设备ID】生成新设备ID:', deviceId);
  }
  return deviceId;
};

// 匿名登录
export const anonymousLogin = async (): Promise<boolean> => {
  try {
    const deviceId = await getOrCreateDeviceId();
    console.log('【匿名登录】使用设备ID:', deviceId);

    const response = await fetch(`${API_BASE_URL}/auth/anonymous`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ deviceId }),
    });

    const result = await response.json();

    if (result.code === 200 || result.code === 201) {
      // 保存匿名用户的token
      if (result.data?.accessToken) {
        await AsyncStorage.setItem('access_token', result.data.accessToken);
        await AsyncStorage.setItem('refresh_token', result.data.refreshToken);
        if (result.data.user) {
          await AsyncStorage.setItem('user_info', JSON.stringify(result.data.user));
        }
        console.log('【匿名登录】成功，已保存token');
        return true;
      }
    }
    console.log('【匿名登录】失败:', result.message);
    return false;
  } catch (error) {
    console.error('【匿名登录】错误:', error);
    return false;
  }
};

// 清除认证数据
export const clearAuthData = async (): Promise<void> => {
  await AsyncStorage.removeItem('access_token');
  await AsyncStorage.removeItem('refresh_token');
  await AsyncStorage.removeItem('user_info');
  console.log('【认证】已清除认证数据');
};

// 处理401未授权错误
export const handleUnauthorized = async (): Promise<void> => {
  console.log('【认证】Token过期，执行自动切换为匿名用户');
  
  // 1. 清除旧的认证数据
  await clearAuthData();
  
  // 2. 执行匿名登录
  const success = await anonymousLogin();
  
  if (success) {
    console.log('【认证】已成功切换为匿名用户');
    // 触发全局事件通知应用状态已更新（仅在Web环境）
    if (typeof window !== 'undefined' && window.dispatchEvent) {
      window.dispatchEvent(new CustomEvent('auth:tokenExpired', {
        detail: { message: '认证已过期，已切换为匿名用户' }
      }));
    }
  } else {
    console.error('【认证】匿名登录失败');
  }
};

// 请求计数器，用于追踪重复请求
let requestCounter = 0;

// 带自动重试的fetch封装
export const fetchWithAuth = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const requestId = ++requestCounter;
  console.log(`【API】[${requestId}] 发起请求: ${options.method || 'GET'} ${url}`);

  // 获取当前token
  const token = await AsyncStorage.getItem('access_token');

  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  console.log(`【API】[${requestId}] 收到响应: ${response.status}`);

  // 检查响应头中是否有新的token（滑动过期时间机制）
  const newToken = response.headers.get('X-Access-Token');
  if (newToken) {
    console.log(`【API】[${requestId}] 收到新的token，更新本地存储`);
    await AsyncStorage.setItem('access_token', newToken);
  }

  // 处理401错误
  if (response.status === 401) {
    console.log(`【API】[${requestId}] 收到401响应，准备切换为匿名用户`);
    await handleUnauthorized();

    // 使用新的token重新请求
    const retryToken = await AsyncStorage.getItem('access_token');
    if (retryToken) {
      console.log(`【API】[${requestId}] 使用新token重新请求`);
      const retryHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${retryToken}`,
        ...options.headers,
      };

      return fetch(url, {
        ...options,
        headers: retryHeaders,
      });
    }
  }

  return response;
};
