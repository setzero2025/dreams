import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Dimensions,
  Share,
} from 'react-native';
import { useTheme } from '../theme/themeContext';
import { Dream } from '../types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ScriptScene {
  id: string;
  title: string;
  description: string;
  duration: number;
  visual: string;
  narration: string;
  mood: string;
}

interface ScriptData {
  title: string;
  scenes: ScriptScene[];
}

interface ScriptViewerProps {
  navigation: any;
  route: {
    params: {
      dream: Dream;
      script: ScriptData;
    };
  };
}

const getMoodStyle = (mood: string, isDark: boolean) => {
  const moodStyles: Record<string, { bg: string; text: string; icon: string }> = {
    '神秘': { bg: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)', text: '#a78bfa', icon: '🔮' },
    '朦胧': { bg: 'rgba(156, 163, 175, 0.15)', text: '#9ca3af', icon: '🌫️' },
    '奇幻': { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc', icon: '✨' },
    '梦幻': { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6', icon: '🌙' },
    '探索': { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa', icon: '🔍' },
    '好奇': { bg: 'rgba(34, 197, 94, 0.15)', text: '#4ade80', icon: '❓' },
    '紧张': { bg: 'rgba(239, 68, 68, 0.15)', text: '#f87171', icon: '⚡' },
    '激动': { bg: 'rgba(249, 115, 22, 0.15)', text: '#fb923c', icon: '🔥' },
    '顿悟': { bg: 'rgba(234, 179, 8, 0.15)', text: '#facc15', icon: '💡' },
    '释然': { bg: 'rgba(20, 184, 166, 0.15)', text: '#2dd4bf', icon: '🕊️' },
    '温暖': { bg: 'rgba(251, 146, 60, 0.15)', text: '#fdba74', icon: '☀️' },
    '怀念': { bg: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)', text: '#818cf8', icon: '📸' },
  };
  const moodKey = Object.keys(moodStyles).find(key => mood.includes(key));
  return moodKey ? moodStyles[moodKey] : { bg: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)', text: '#a78bfa', icon: '🎭' };
};

export const ScriptViewer: React.FC<ScriptViewerProps> = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const { dream, script } = route.params;
  const [activeScene, setActiveScene] = useState(0);
  const scrollY = useRef(new Animated.Value(0)).current;
  const sceneAnimations = useRef<Animated.Value[]>([]);

  // 初始化场景动画
  if (sceneAnimations.current.length === 0) {
    sceneAnimations.current = script.scenes.map(() => new Animated.Value(1));
  }

  const totalDuration = script.scenes.reduce((sum, scene) => sum + scene.duration, 0);

  const handleScenePress = (index: number) => {
    // 点击动画
    const anim = sceneAnimations.current[index];
    Animated.sequence([
      Animated.timing(anim, {
        toValue: 0.95,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(anim, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    setActiveScene(index);
  };

  const handleShare = async () => {
    try {
      const sceneTexts = script.scenes.map((scene, i) => 
        `场景${i + 1}：${scene.title}\n${scene.description}`
      ).join('\n\n');
      
      await Share.share({
        message: `《${script.title}》\n\n${sceneTexts}\n\n—— 来自梦境空间`,
        title: script.title,
      });
    } catch (error) {
      console.error('分享失败:', error);
    }
  };

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
      paddingTop: 16,
      paddingBottom: 12,
    },
    backButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    backButtonText: {
      fontSize: 20,
    },
    headerTitle: {
      fontSize: 18,
      fontWeight: '600',
      color: colors.text,
    },
    shareButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
      alignItems: 'center',
      justifyContent: 'center',
    },
    shareButtonText: {
      fontSize: 20,
    },
    scrollView: {
      flex: 1,
    },
    contentContainer: {
      padding: 20,
    },
    // 剧本标题区域
    titleSection: {
      marginBottom: 24,
    },
    titleCard: {
      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
      borderRadius: 16,
      padding: 20,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
    },
    titleLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    titleText: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 12,
      lineHeight: 32,
    },
    titleMeta: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    metaItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    metaText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    // 场景导航
    sceneNav: {
      marginBottom: 20,
    },
    sceneNavTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    sceneNavList: {
      flexDirection: 'row',
      gap: 8,
    },
    sceneNavItem: {
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 2,
      borderColor: 'transparent',
    },
    sceneNavItemActive: {
      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
      borderColor: colors.primary,
    },
    sceneNavItemText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.textSecondary,
    },
    sceneNavItemTextActive: {
      color: colors.primary,
    },
    // 场景卡片
    sceneCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sceneCardActive: {
      borderColor: colors.primary,
      borderWidth: 2,
    },
    sceneHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    sceneNumber: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sceneNumberText: {
      fontSize: 14,
      fontWeight: 'bold',
      color: '#fff',
    },
    sceneDuration: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
    },
    sceneDurationText: {
      fontSize: 12,
      color: colors.textSecondary,
    },
    sceneTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    sceneDescription: {
      fontSize: 15,
      color: colors.textSecondary,
      lineHeight: 24,
      marginBottom: 16,
    },
    // 视觉描述
    visualSection: {
      backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
    },
    visualLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    visualText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 22,
      fontStyle: 'italic',
    },
    // 旁白
    narrationSection: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
      borderRadius: 12,
      padding: 16,
    },
    narrationLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    narrationText: {
      fontSize: 14,
      color: colors.text,
      lineHeight: 22,
    },
    // 情绪标签
    moodTag: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      paddingHorizontal: 10,
      paddingVertical: 4,
      borderRadius: 12,
      marginTop: 12,
      alignSelf: 'flex-start',
    },
    moodTagText: {
      fontSize: 12,
      fontWeight: '500',
    },
    // 底部信息
    footer: {
      marginTop: 24,
      padding: 20,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    footerTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 12,
    },
    footerInfo: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      marginBottom: 8,
    },
    footerLabel: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    footerValue: {
      fontSize: 14,
      fontWeight: '500',
      color: colors.text,
    },
    // 操作按钮
    actionButtons: {
      flexDirection: 'row',
      gap: 12,
      marginTop: 20,
    },
    actionButton: {
      flex: 1,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    actionButtonSecondary: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    },
    actionButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    actionButtonTextSecondary: {
      color: colors.text,
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      {/* Header */}
      <View style={dynamicStyles.header}>
        <TouchableOpacity 
          style={dynamicStyles.backButton}
          onPress={() => navigation.goBack()}
        >
          <Text style={dynamicStyles.backButtonText}>←</Text>
        </TouchableOpacity>
        <Text style={dynamicStyles.headerTitle} numberOfLines={1}>
          剧本预览
        </Text>
        <TouchableOpacity 
          style={dynamicStyles.shareButton}
          onPress={handleShare}
        >
          <Text style={dynamicStyles.shareButtonText}>📤</Text>
        </TouchableOpacity>
      </View>

      <ScrollView 
        style={dynamicStyles.scrollView}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={dynamicStyles.contentContainer}
      >
        {/* 标题卡片 */}
        <View style={dynamicStyles.titleSection}>
          <View style={dynamicStyles.titleCard}>
            <Text style={dynamicStyles.titleLabel}>梦境剧本</Text>
            <Text style={dynamicStyles.titleText}>{script.title}</Text>
            <View style={dynamicStyles.titleMeta}>
              <View style={dynamicStyles.metaItem}>
                <Text>🎬</Text>
                <Text style={dynamicStyles.metaText}>{script.scenes.length} 个场景</Text>
              </View>
              <View style={dynamicStyles.metaItem}>
                <Text>⏱️</Text>
                <Text style={dynamicStyles.metaText}>{totalDuration} 秒</Text>
              </View>
            </View>
          </View>
        </View>

        {/* 场景导航 */}
        <View style={dynamicStyles.sceneNav}>
          <Text style={dynamicStyles.sceneNavTitle}>场景导航</Text>
          <ScrollView 
            horizontal 
            showsHorizontalScrollIndicator={false}
            style={dynamicStyles.sceneNavList}
          >
            {script.scenes.map((scene, index) => (
              <TouchableOpacity
                key={scene.id}
                style={[
                  dynamicStyles.sceneNavItem,
                  activeScene === index && dynamicStyles.sceneNavItemActive,
                ]}
                onPress={() => handleScenePress(index)}
              >
                <Text style={[
                  dynamicStyles.sceneNavItemText,
                  activeScene === index && dynamicStyles.sceneNavItemTextActive,
                ]}>
                  {index + 1}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>

        {/* 场景详情 */}
        {script.scenes.map((scene, index) => {
          const moodStyle = getMoodStyle(scene.mood, isDark);
          const anim = sceneAnimations.current[index];
          
          return (
            <Animated.View
              key={scene.id}
              style={[
                dynamicStyles.sceneCard,
                activeScene === index && dynamicStyles.sceneCardActive,
                { transform: [{ scale: anim }] },
              ]}
            >
              <TouchableOpacity onPress={() => handleScenePress(index)}>
                {/* 场景头部 */}
                <View style={dynamicStyles.sceneHeader}>
                  <View style={dynamicStyles.sceneNumber}>
                    <Text style={dynamicStyles.sceneNumberText}>{index + 1}</Text>
                  </View>
                  <View style={dynamicStyles.sceneDuration}>
                    <Text>⏱️</Text>
                    <Text style={dynamicStyles.sceneDurationText}>{scene.duration}秒</Text>
                  </View>
                </View>

                {/* 场景标题 */}
                <Text style={dynamicStyles.sceneTitle}>{scene.title}</Text>

                {/* 场景描述 */}
                <Text style={dynamicStyles.sceneDescription}>
                  {scene.description}
                </Text>

                {/* 视觉描述 */}
                <View style={dynamicStyles.visualSection}>
                  <Text style={dynamicStyles.visualLabel}>🎨 视觉描述</Text>
                  <Text style={dynamicStyles.visualText}>{scene.visual}</Text>
                </View>

                {/* 旁白 */}
                <View style={dynamicStyles.narrationSection}>
                  <Text style={dynamicStyles.narrationLabel}>🎤 旁白</Text>
                  <Text style={dynamicStyles.narrationText}>{scene.narration}</Text>
                </View>

                {/* 情绪标签 */}
                <View style={[dynamicStyles.moodTag, { backgroundColor: moodStyle.bg }]}>
                  <Text>{moodStyle.icon}</Text>
                  <Text style={[dynamicStyles.moodTagText, { color: moodStyle.text }]}>
                    {scene.mood}
                  </Text>
                </View>
              </TouchableOpacity>
            </Animated.View>
          );
        })}

        {/* 底部信息 */}
        <View style={dynamicStyles.footer}>
          <Text style={dynamicStyles.footerTitle}>📊 剧本信息</Text>
          <View style={dynamicStyles.footerInfo}>
            <Text style={dynamicStyles.footerLabel}>原始梦境</Text>
            <Text style={dynamicStyles.footerValue} numberOfLines={1}>
              {dream.title}
            </Text>
          </View>
          <View style={dynamicStyles.footerInfo}>
            <Text style={dynamicStyles.footerLabel}>场景数量</Text>
            <Text style={dynamicStyles.footerValue}>{script.scenes.length} 个</Text>
          </View>
          <View style={dynamicStyles.footerInfo}>
            <Text style={dynamicStyles.footerLabel}>预计时长</Text>
            <Text style={dynamicStyles.footerValue}>{totalDuration} 秒</Text>
          </View>
        </View>

        {/* 操作按钮 */}
        <View style={dynamicStyles.actionButtons}>
          <TouchableOpacity 
            style={dynamicStyles.actionButton}
            onPress={() => navigation.navigate('ScriptToVideo', { dream, script })}
          >
            <Text style={dynamicStyles.actionButtonText}>🎬 生成视频</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[dynamicStyles.actionButton, dynamicStyles.actionButtonSecondary]}
            onPress={handleShare}
          >
            <Text style={[dynamicStyles.actionButtonText, dynamicStyles.actionButtonTextSecondary]}>
              分享剧本
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};
