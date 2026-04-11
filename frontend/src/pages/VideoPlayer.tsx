import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  Dimensions,
  Image,
  ScrollView,
  Alert,
  Linking,
  Clipboard,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../theme/themeContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface VideoPlayerProps {
  navigation: any;
  route: {
    params: {
      videoUrl: string;
      title?: string;
      coverUrl?: string;
    };
  };
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const { videoUrl, title, coverUrl } = route.params;
  const [imageError, setImageError] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 复制视频链接
  const copyVideoUrl = async () => {
    try {
      await Clipboard.setString(videoUrl);
      Alert.alert('复制成功', '视频链接已复制到剪贴板');
    } catch (error) {
      Alert.alert('复制失败', '请手动复制视频链接');
    }
  };

  // 用外部浏览器打开
  const openInBrowser = async () => {
    setIsLoading(true);
    try {
      const supported = await Linking.canOpenURL(videoUrl);
      if (supported) {
        await Linking.openURL(videoUrl);
      } else {
        Alert.alert('无法打开', '无法打开该视频链接');
      }
    } catch (error) {
      Alert.alert('打开失败', '请手动复制链接到浏览器打开');
    } finally {
      setIsLoading(false);
    }
  };

  // 分享视频
  const shareVideo = async () => {
    try {
      const shareMessage = `${title || '梦境视频'}\n${videoUrl}`;
      await Clipboard.setString(shareMessage);
      Alert.alert('分享内容已复制', '视频标题和链接已复制，可以粘贴分享了');
    } catch (error) {
      Alert.alert('分享失败', '请手动复制视频链接');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 顶部导航 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {title || '视频详情'}
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 视频封面展示 */}
        <View style={[styles.videoContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {coverUrl && !imageError ? (
            <Image
              source={{ uri: coverUrl }}
              style={styles.coverImage}
              resizeMode="cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <View style={styles.videoPlaceholder}>
              <Text style={styles.videoIcon}>🎬</Text>
              <Text style={[styles.videoLabel, { color: colors.textSecondary }]}>梦境视频</Text>
            </View>
          )}

          {/* 播放按钮遮罩 */}
          <TouchableOpacity
            style={styles.playOverlay}
            onPress={openInBrowser}
            activeOpacity={0.8}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator size="large" color="#fff" />
            ) : (
              <>
                <View style={styles.playButton}>
                  <Text style={styles.playIcon}>▶</Text>
                </View>
                <Text style={styles.playText}>点击播放</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 视频信息卡片 */}
        <View style={[styles.infoCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.infoTitle, { color: colors.text }]}>视频信息</Text>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>状态</Text>
            <View style={styles.statusBadge}>
              <Text style={styles.statusText}>✅ 生成完成</Text>
            </View>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>时长</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>5-10 秒</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>分辨率</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>720p</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>格式</Text>
            <Text style={[styles.infoValue, { color: colors.text }]}>MP4</Text>
          </View>
        </View>

        {/* 操作按钮 */}
        <View style={[styles.actionSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.actionTitle, { color: colors.text }]}>操作</Text>

          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)', borderColor: colors.border }]}
              onPress={copyVideoUrl}
              activeOpacity={0.8}
            >
              <Text style={styles.actionIcon}>📋</Text>
              <Text style={[styles.actionText, { color: colors.text }]}>复制链接</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)', borderColor: colors.border }]}
              onPress={shareVideo}
              activeOpacity={0.8}
            >
              <Text style={styles.actionIcon}>↗️</Text>
              <Text style={[styles.actionText, { color: colors.text }]}>分享</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.actionButton, styles.primaryButton, { borderColor: colors.secondary }]}
              onPress={openInBrowser}
              activeOpacity={0.8}
              disabled={isLoading}
            >
              <Text style={styles.actionIcon}>🌐</Text>
              <Text style={[styles.actionText, styles.primaryButtonText, { color: colors.secondary }]}>
                {isLoading ? '打开中...' : '浏览器播放'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* 提示信息 */}
        <View style={[styles.tipCard, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)', borderColor: 'rgba(139, 92, 246, 0.3)' }]}>
          <Text style={[styles.tipTitle, { color: colors.text }]}>💡 播放说明</Text>
          <Text style={[styles.tipText, { color: colors.textSecondary }]}>
            点击播放按钮将使用系统浏览器打开视频。您也可以：
          </Text>
          <View style={styles.tipList}>
            <Text style={[styles.tipItem, { color: colors.textLight }]}>1. 点击"浏览器播放"用系统浏览器打开</Text>
            <Text style={[styles.tipItem, { color: colors.textLight }]}>2. 点击"复制链接"后粘贴到其他播放器</Text>
            <Text style={[styles.tipItem, { color: colors.textLight }]}>3. 打包成独立应用后可内置播放</Text>
          </View>
        </View>

        {/* 视频链接 */}
        <View style={[styles.urlCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.urlTitle, { color: colors.text }]}>视频链接</Text>
          <Text style={[styles.urlText, { color: colors.secondary }]} numberOfLines={3}>
            {videoUrl}
          </Text>
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.2)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  placeholder: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  videoContainer: {
    margin: 20,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    height: 220,
    position: 'relative',
  },
  coverImage: {
    width: '100%',
    height: '100%',
  },
  videoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoIcon: {
    fontSize: 56,
    marginBottom: 8,
  },
  videoLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  playOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(139, 92, 246, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 8,
  },
  playIcon: {
    fontSize: 28,
    color: '#fff',
    marginLeft: 4,
  },
  playText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  infoCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  statusBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 13,
    color: '#10b981',
    fontWeight: '600',
  },
  actionSection: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  actionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  actionButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    marginHorizontal: 4,
  },
  primaryButton: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
  },
  actionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },
  actionText: {
    fontSize: 13,
    fontWeight: '500',
  },
  primaryButtonText: {
    fontWeight: '600',
  },
  tipCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 16,
    borderWidth: 1,
  },
  tipTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  tipList: {
    gap: 8,
  },
  tipItem: {
    fontSize: 13,
    lineHeight: 18,
  },
  urlCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    borderWidth: 1,
  },
  urlTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  urlText: {
    fontSize: 12,
    lineHeight: 18,
  },
  bottomSpace: {
    height: 40,
  },
});
