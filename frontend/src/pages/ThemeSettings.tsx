import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Easing,
  Switch,
} from 'react-native';
import { useTheme, ThemeMode } from '../theme/themeContext';

interface ThemeSettingsProps {
  navigation: any;
}

interface ThemeOption {
  value: ThemeMode;
  label: string;
  icon: string;
  description: string;
}

export const ThemeSettings: React.FC<ThemeSettingsProps> = ({ navigation }) => {
  // 使用主题上下文
  const { colors, themeMode, isDark, setThemeMode } = useTheme();
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const themeOptions: ThemeOption[] = [
    {
      value: 'system',
      label: '跟随系统',
      icon: '📱',
      description: '自动跟随系统主题设置',
    },
    {
      value: 'light',
      label: '浅色模式',
      icon: '☀️',
      description: '明亮的界面风格',
    },
    {
      value: 'dark',
      label: '深色模式',
      icon: '🌙',
      description: '护眼的暗色界面',
    },
  ];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  // 处理主题切换 - 实时生效
  const handleThemeChange = async (theme: ThemeMode) => {
    await setThemeMode(theme);
  };

  // 动态样式
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    backButton: {
      padding: 8,
      width: 44,
      height: 44,
      borderRadius: 12,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    placeholder: {
      width: 44,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    previewCard: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
      borderRadius: 16,
      padding: 20,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    previewIcon: {
      fontSize: 32,
      marginRight: 16,
    },
    previewInfo: {
      flex: 1,
    },
    previewTitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 4,
    },
    previewValue: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    section: {
      marginBottom: 24,
    },
    sectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    optionsContainer: {
      gap: 12,
    },
    optionCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    optionCardActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
    },
    optionHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    optionIconContainer: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginRight: 16,
    },
    optionIcon: {
      fontSize: 24,
    },
    optionInfo: {
      flex: 1,
    },
    optionLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    optionDescription: {
      fontSize: 13,
      color: colors.textSecondary,
    },
    selectedIndicator: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 12,
    },
    selectedCheck: {
      fontSize: 14,
      color: '#fff',
      fontWeight: 'bold',
    },
    tipsCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: colors.info,
    },
    tipsIcon: {
      fontSize: 20,
      marginRight: 12,
    },
    tipsContent: {
      flex: 1,
    },
    tipsTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    tipsText: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    note: {
      fontSize: 12,
      color: colors.textLight,
      textAlign: 'center',
      marginTop: 24,
      fontStyle: 'italic',
    },
    // 预览区域样式
    previewSection: {
      marginBottom: 24,
    },
    previewSectionTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 16,
    },
    previewContainer: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewItem: {
      flexDirection: 'row',
      alignItems: 'center',
      marginBottom: 16,
    },
    previewColorBox: {
      width: 40,
      height: 40,
      borderRadius: 8,
      marginRight: 12,
      borderWidth: 1,
      borderColor: colors.border,
    },
    previewColorLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    previewColorValue: {
      fontSize: 12,
      color: colors.textLight,
      marginTop: 2,
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      {/* Header */}
      <View style={dynamicStyles.header}>
        <TouchableOpacity
          style={dynamicStyles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 24, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle}>主题设置</Text>
        <View style={dynamicStyles.placeholder} />
      </View>

      <Animated.ScrollView
        style={[dynamicStyles.scrollView, { opacity: fadeAnim }]}
        contentContainerStyle={dynamicStyles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Preview Card */}
        <View style={dynamicStyles.previewCard}>
          <Text style={dynamicStyles.previewIcon}>🎨</Text>
          <View style={dynamicStyles.previewInfo}>
            <Text style={dynamicStyles.previewTitle}>当前主题</Text>
            <Text style={dynamicStyles.previewValue}>
              {themeOptions.find(t => t.value === themeMode)?.label}
              {themeMode === 'system' && ` (${isDark ? '深色' : '浅色'})`}
            </Text>
          </View>
        </View>

        {/* Theme Options */}
        <View style={dynamicStyles.section}>
          <Text style={dynamicStyles.sectionTitle}>选择主题模式</Text>
          <View style={dynamicStyles.optionsContainer}>
            {themeOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  dynamicStyles.optionCard,
                  themeMode === option.value && dynamicStyles.optionCardActive,
                ]}
                onPress={() => handleThemeChange(option.value)}
                activeOpacity={0.8}
              >
                <View style={dynamicStyles.optionHeader}>
                  <View style={dynamicStyles.optionIconContainer}>
                    <Text style={dynamicStyles.optionIcon}>{option.icon}</Text>
                  </View>
                  <View style={dynamicStyles.optionInfo}>
                    <Text style={dynamicStyles.optionLabel}>{option.label}</Text>
                    <Text style={dynamicStyles.optionDescription}>
                      {option.description}
                    </Text>
                  </View>
                </View>
                
                {themeMode === option.value && (
                  <View style={dynamicStyles.selectedIndicator}>
                    <Text style={dynamicStyles.selectedCheck}>✓</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Color Preview */}
        <View style={dynamicStyles.previewSection}>
          <Text style={dynamicStyles.previewSectionTitle}>当前配色预览</Text>
          <View style={dynamicStyles.previewContainer}>
            <View style={dynamicStyles.previewItem}>
              <View style={[dynamicStyles.previewColorBox, { backgroundColor: colors.background }]} />
              <View>
                <Text style={dynamicStyles.previewColorLabel}>背景色</Text>
                <Text style={dynamicStyles.previewColorValue}>{colors.background}</Text>
              </View>
            </View>
            <View style={dynamicStyles.previewItem}>
              <View style={[dynamicStyles.previewColorBox, { backgroundColor: colors.card }]} />
              <View>
                <Text style={dynamicStyles.previewColorLabel}>卡片色</Text>
                <Text style={dynamicStyles.previewColorValue}>{colors.card}</Text>
              </View>
            </View>
            <View style={dynamicStyles.previewItem}>
              <View style={[dynamicStyles.previewColorBox, { backgroundColor: colors.text }]} />
              <View>
                <Text style={dynamicStyles.previewColorLabel}>文字色</Text>
                <Text style={dynamicStyles.previewColorValue}>{colors.text}</Text>
              </View>
            </View>
            <View style={dynamicStyles.previewItem}>
              <View style={[dynamicStyles.previewColorBox, { backgroundColor: colors.primary }]} />
              <View>
                <Text style={dynamicStyles.previewColorLabel}>主题色</Text>
                <Text style={dynamicStyles.previewColorValue}>{colors.primary}</Text>
              </View>
            </View>
            <View style={[dynamicStyles.previewItem, { marginBottom: 0 }]}>
              <View style={[dynamicStyles.previewColorBox, { backgroundColor: colors.tabBarActive }]} />
              <View>
                <Text style={dynamicStyles.previewColorLabel}>导航栏激活色</Text>
                <Text style={dynamicStyles.previewColorValue}>{colors.tabBarActive}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Tips */}
        <View style={dynamicStyles.tipsCard}>
          <Text style={dynamicStyles.tipsIcon}>💡</Text>
          <View style={dynamicStyles.tipsContent}>
            <Text style={dynamicStyles.tipsTitle}>温馨提示</Text>
            <Text style={dynamicStyles.tipsText}>
              深色模式有助于在夜间使用时减少眼睛疲劳，浅色模式则适合在光线充足的环境下使用。主题切换会立即生效，无需重启应用。
            </Text>
          </View>
        </View>

        {/* Note */}
        <Text style={dynamicStyles.note}>
          主题设置会自动保存，下次启动应用时依然有效
        </Text>
      </Animated.ScrollView>
    </SafeAreaView>
  );
};
