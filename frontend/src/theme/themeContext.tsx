import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useColorScheme } from 'react-native';

// 主题模式类型
type ThemeMode = 'system' | 'light' | 'dark';

// 主题颜色配置接口
interface ThemeColors {
  // 主色系
  primary: string;
  secondary: string;
  accent: string;
  success: string;
  
  // 背景色
  background: string;
  card: string;
  glass: string;
  
  // 文字色
  text: string;
  textSecondary: string;
  textLight: string;
  textDisabled: string;
  
  // 状态色
  warning: string;
  error: string;
  info: string;
  loading: string;
  
  // 边框和分割线
  border: string;
  divider: string;
  
  // 底部导航栏专用
  tabBarBackground: string;
  tabBarActive: string;
  tabBarInactive: string;
}

// 浅色主题颜色配置
const lightColors: ThemeColors = {
  // 主色系 - 保持品牌色
  primary: '#6366f1',
  secondary: '#8b5cf6',
  accent: '#ec4899',
  success: '#10b981',
  
  // 背景色 - 浅色
  background: '#f8fafc',
  card: '#ffffff',
  glass: 'rgba(255, 255, 255, 0.8)',
  
  // 文字色 - 深色
  text: '#1e293b',
  textSecondary: '#64748b',
  textLight: '#94a3b8',
  textDisabled: '#cbd5e1',
  
  // 状态色
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  loading: '#6366f1',
  
  // 边框和分割线
  border: 'rgba(0, 0, 0, 0.1)',
  divider: 'rgba(0, 0, 0, 0.05)',
  
  // 底部导航栏专用
  tabBarBackground: '#ffffff',
  tabBarActive: '#f97316',
  tabBarInactive: '#9ca3af',
};

// 深色主题颜色配置
const darkColors: ThemeColors = {
  // 主色系 - 保持品牌色
  primary: '#6366f1',
  secondary: '#8b5cf6',
  accent: '#ec4899',
  success: '#10b981',
  
  // 背景色 - 深色
  background: '#0a0a0f',
  card: '#1a1a2e',
  glass: 'rgba(26, 26, 46, 0.7)',
  
  // 文字色 - 浅色
  text: '#ffffff',
  textSecondary: 'rgba(255, 255, 255, 0.8)',
  textLight: 'rgba(255, 255, 255, 0.6)',
  textDisabled: 'rgba(255, 255, 255, 0.4)',
  
  // 状态色
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',
  loading: '#6366f1',
  
  // 边框和分割线
  border: 'rgba(255, 255, 255, 0.2)',
  divider: 'rgba(255, 255, 255, 0.1)',
  
  // 底部导航栏专用
  tabBarBackground: '#0f0f1a',
  tabBarActive: '#f97316',
  tabBarInactive: '#9ca3af',
};

// 主题上下文接口
interface ThemeContextType {
  // 当前主题模式
  themeMode: ThemeMode;
  // 当前实际使用的颜色配置
  colors: ThemeColors;
  // 是否为深色模式
  isDark: boolean;
  // 设置主题模式
  setThemeMode: (mode: ThemeMode) => Promise<void>;
}

// 创建上下文
const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

// 存储键名
const THEME_STORAGE_KEY = 'theme_mode';

// 主题提供者组件
interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({ children }) => {
  // 获取系统颜色方案
  const systemColorScheme = useColorScheme();
  
  // 主题模式状态
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [isLoading, setIsLoading] = useState(true);

  // 计算当前是否为深色模式
  const isDark = themeMode === 'system' 
    ? systemColorScheme === 'dark' 
    : themeMode === 'dark';

  // 获取当前颜色配置
  const colors = isDark ? darkColors : lightColors;

  // 加载保存的主题设置
  useEffect(() => {
    loadThemeSetting();
  }, []);

  const loadThemeSetting = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem(THEME_STORAGE_KEY);
      if (savedTheme) {
        setThemeModeState(savedTheme as ThemeMode);
      }
    } catch (error) {
      console.error('加载主题设置失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 设置主题模式
  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('保存主题设置失败:', error);
    }
  };

  // 提供上下文值
  const value: ThemeContextType = {
    themeMode,
    colors,
    isDark,
    setThemeMode,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

// 使用主题的Hook
export const useTheme = (): ThemeContextType => {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// 导出颜色配置供直接使用
export { lightColors, darkColors };
export type { ThemeMode, ThemeColors };
