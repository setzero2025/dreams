import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppNavigator } from './src/navigation/AppNavigator';
import { ThemeProvider, useTheme } from './src/theme/themeContext';
import { AuthProvider } from './src/context/AuthContext';

// 包装组件，用于获取主题状态并设置 StatusBar
function AppContent() {
  const { isDark } = useTheme();
  
  return (
    <>
      {/* 根据主题设置状态栏样式 */}
      <StatusBar style={isDark ? 'light' : 'dark'} />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
