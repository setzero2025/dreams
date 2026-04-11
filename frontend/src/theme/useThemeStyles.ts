import { useTheme } from './themeContext';
import { StyleSheet } from 'react-native';

/**
 * 主题样式Hook - 简化主题样式创建
 * 使用方式：
 * const styles = useThemeStyles((colors, isDark) => ({
 *   container: {
 *     backgroundColor: colors.background,
 *   },
 *   card: {
 *     backgroundColor: colors.card,
 *   },
 * }));
 */
export function useThemeStyles<T extends StyleSheet.NamedStyles<T>>(
  styleCreator: (colors: ReturnType<typeof useTheme>['colors'], isDark: boolean) => T
): T {
  const { colors, isDark } = useTheme();
  return StyleSheet.create(styleCreator(colors, isDark));
}

/**
 * 常用主题颜色快捷访问
 */
export function useThemeColors() {
  const { colors, isDark } = useTheme();
  return { colors, isDark };
}
