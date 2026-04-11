import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { authApi, User } from '../services/api/authApi';
import { handleUnauthorized } from '../services/api/apiInterceptor';

// 认证上下文类型定义
interface AuthContextType {
  isAuthenticated: boolean;
  isLoading: boolean;
  user: User | null;
  isAnonymous: boolean;  // 是否为匿名用户
  login: (phone: string, password: string) => Promise<boolean>;
  register: (phone: string, password: string, confirmPassword: string) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  handleTokenExpired: () => Promise<void>;  // 处理token过期
}

// 创建上下文
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 认证提供者组件
export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  const [isAnonymous, setIsAnonymous] = useState(true);  // 默认为匿名用户

  // 初始化时检查登录状态
  useEffect(() => {
    checkAuthStatus();
  }, []);

  // 检查认证状态
  const checkAuthStatus = async () => {
    try {
      const authenticated = await authApi.isAuthenticated();
      setIsAuthenticated(authenticated);

      if (authenticated) {
        // 获取用户信息
        const userInfo = await authApi.getUserInfo();
        setUser(userInfo);
        // 根据 tier 判断是否为匿名用户（guest 为匿名，registered/subscribed 为真实用户）
        const anonymous = !userInfo?.tier || userInfo.tier === 'guest';
        setIsAnonymous(anonymous);
        console.log('【AuthContext】用户类型:', anonymous ? '匿名用户' : '真实用户', 'tier:', userInfo?.tier);
      } else {
        setIsAnonymous(true);
      }
    } catch (error) {
      console.error('检查登录状态失败:', error);
      setIsAuthenticated(false);
      setUser(null);
      setIsAnonymous(true);
    } finally {
      setIsLoading(false);
    }
  };

  // 登录
  const login = async (phone: string, password: string): Promise<boolean> => {
    try {
      const result = await authApi.login({ phone, password });

      if (result.success && result.data) {
        setIsAuthenticated(true);
        setUser(result.data.user);
        setIsAnonymous(false);  // 真实登录用户不是匿名用户
        return true;
      }
      return false;
    } catch (error) {
      console.error('登录失败:', error);
      return false;
    }
  };

  // 注册
  const register = async (phone: string, password: string, confirmPassword: string): Promise<boolean> => {
    try {
      const result = await authApi.register({ phone, password, confirmPassword });
      
      if (result.success && result.data) {
        setIsAuthenticated(true);
        setUser(result.data.user);
        return true;
      }
      return false;
    } catch (error) {
      console.error('注册失败:', error);
      return false;
    }
  };

  // 退出登录
  const logout = async () => {
    console.log('=== AuthContext logout 开始 ===');
    try {
      // 调用后端退出登录
      console.log('调用 authApi.logout...');
      await authApi.logout();
      console.log('authApi.logout 完成');

      // 清空登录状态，显示为未登录
      console.log('清空登录状态');
      setIsAuthenticated(false);
      setUser(null);
      setIsAnonymous(true);  // 退出后变为匿名用户
    } catch (error) {
      console.error('退出登录失败:', error);
      // 即使出错也清空状态
      setIsAuthenticated(false);
      setUser(null);
      setIsAnonymous(true);
    }
    console.log('=== AuthContext logout 结束 ===');
  };

  // 刷新用户信息
  const refreshUser = async () => {
    try {
      const result = await authApi.getCurrentUser();
      if (result.success && result.data) {
        setUser(result.data);
      }
    } catch (error) {
      console.error('刷新用户信息失败:', error);
    }
  };

  // 处理Token过期 - 自动切换为匿名用户
  const handleTokenExpired = async () => {
    console.log('【AuthContext】处理Token过期');
    await handleUnauthorized();
    // 更新状态为未登录
    setIsAuthenticated(false);
    setUser(null);
    setIsAnonymous(true);
  };

  // 监听全局token过期事件（仅在Web环境）
  useEffect(() => {
    const handleTokenExpiredEvent = () => {
      console.log('【AuthContext】收到token过期事件');
      setIsAuthenticated(false);
      setUser(null);
    };

    // 检查是否在Web环境且有addEventListener方法
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('auth:tokenExpired', handleTokenExpiredEvent);
      return () => {
        window.removeEventListener('auth:tokenExpired', handleTokenExpiredEvent);
      };
    }
  }, []);

  return (
    <AuthContext.Provider
      value={{
        isAuthenticated,
        isLoading,
        user,
        isAnonymous,
        login,
        register,
        logout,
        refreshUser,
        handleTokenExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// 使用认证上下文的Hook
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
