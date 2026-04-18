import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Easing,
  Image,
  Alert,
  Dimensions,
  FlatList,
} from 'react-native';
import { useTheme } from '../theme/themeContext';
import { creationStorageService, CreationItem } from '../services/CreationStorageService';
import { Button } from '../components/Button';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type AssetTab = 'images' | 'audio' | 'videos';

interface AssetsProps {
  navigation: any;
}

export const Assets: React.FC<any> = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [activeTab, setActiveTab] = useState<AssetTab>('images');
  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const floatingAnimation = useRef(new Animated.Value(0)).current;

  // 检查登录状态
  const checkLoginStatus = useCallback(async () => {
    const loggedIn = await creationStorageService.checkLoginStatus();
    setIsLoggedIn(loggedIn);
    return loggedIn;
  }, []);

  // 加载创作内容
  const loadCreations = useCallback(async () => {
    setLoading(true);
    try {
      console.log('【Assets】开始加载创作...');
      
      // 先检查登录状态
      const loggedIn = await checkLoginStatus();
      
      if (!loggedIn) {
        console.log('【Assets】未登录，不加载创作数据');
        setCreations([]);
        setLoading(false);
        return;
      }
      
      const allCreations = await creationStorageService.getAllCreations();
      console.log('【Assets】加载到创作数量:', allCreations.length);
      console.log('【Assets】创作数据:', allCreations);
      setCreations(allCreations);
    } catch (error) {
      console.error('【Assets】加载创作失败:', error);
    } finally {
      setLoading(false);
    }
  }, [checkLoginStatus]);

  useEffect(() => {
    loadCreations();
    
    // 页面获得焦点时刷新数据
    const unsubscribe = navigation.addListener('focus', () => {
      loadCreations();
    });

    return unsubscribe;
  }, [navigation, loadCreations]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();

    // 悬浮动画
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingAnimation, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatingAnimation, {
          toValue: 0,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // 根据类型筛选创作
  const getFilteredCreations = () => {
    switch (activeTab) {
      case 'images':
        return creations.filter(c => c.type === 'image');
      case 'audio':
        return creations.filter(c => c.type === 'audio' || c.type === 'voice');
      case 'videos':
        return creations.filter(c => c.type === 'video' || c.type === 'video_long');
      default:
        return [];
    }
  };

  // 删除创作
  const handleDelete = (creation: CreationItem) => {
    Alert.alert(
      '确认删除',
      `确定要删除"${creation.title}"吗？`,
      [
        { text: '取消', style: 'cancel' },
        {
          text: '删除',
          style: 'destructive',
          onPress: async () => {
            try {
              await creationStorageService.deleteCreation(creation.id);
              loadCreations();
            } catch (error) {
              console.error('删除失败:', error);
              Alert.alert('删除失败', '请稍后重试');
            }
          },
        },
      ]
    );
  };

  // 查看创作详情
  const handleViewCreation = (creation: CreationItem) => {
    switch (creation.type) {
      case 'image':
        navigation.navigate('ImageViewer', {
          imageUrl: creation.imageUrl || creation.thumbnail,
          title: creation.title,
        });
        break;
      case 'video':
      case 'video_long':
        navigation.navigate('VideoPlayer', {
          videoUrl: creation.videoUrl,
          coverUrl: creation.coverUrl,
          title: creation.title,
        });
        break;
      case 'script':
        if (creation.script) {
          navigation.navigate('ScriptViewer', {
            script: creation.script,
          });
        }
        break;
    }
  };

  // 下载创作
  const handleDownload = (creation: CreationItem) => {
    // 模拟下载
    Alert.alert('下载', '已开始下载到本地相册');
  };

  // 跳转到登录页面
  const handleLogin = () => {
    navigation.navigate('Login');
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return '🖼️';
      case 'script': return '📝';
      case 'video': return '🎬';
      case 'video_long': return '🎥';
      case 'audio': return '🎵';
      case 'voice': return '🎤';
      case 'interpretation': return '🔮';
      default: return '🎨';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'image': return '图片';
      case 'script': return '剧本';
      case 'video': return '短视频';
      case 'video_long': return '长视频';
      case 'audio': return '音频';
      case 'voice': return '录音';
      case 'interpretation': return '解读';
      default: return '创作';
    }
  };

  const filteredCreations = getFilteredCreations();

  // 渲染未登录状态
  const renderNotLoggedIn = () => {
    return (
      <View style={styles.notLoggedInContainer}>
        <Animated.View
          style={[
            styles.notLoggedInIconContainer,
            {
              transform: [{
                translateY: floatingAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0, -10],
                }),
              }],
            },
          ]}
        >
          <Text style={styles.notLoggedInIcon}>🔒</Text>
        </Animated.View>
        <Text style={styles.notLoggedInTitle}>请先登录</Text>
        <Text style={styles.notLoggedInSubtitle}>
          登录后可以查看和管理您的创作资产
        </Text>
        <View style={styles.notLoggedInButtons}>
          <Button
            title="立即登录"
            onPress={handleLogin}
            style={styles.loginButton}
          />
          <TouchableOpacity
            style={styles.exploreButton}
            onPress={() => navigation.navigate('Discover')}
            activeOpacity={0.7}
          >
            <Text style={styles.exploreButtonText}>先去看看别人的创作 →</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // 渲染图片网格
  const renderImageGrid = () => {
    if (filteredCreations.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🖼️</Text>
          <Text style={styles.emptyText}>暂无图片</Text>
          <Text style={styles.emptySubtext}>去生成一些梦境图片吧</Text>
        </View>
      );
    }

    return (
      <View style={styles.imageGrid}>
        {filteredCreations.map((creation, index) => (
          <Animated.View
            key={creation.id}
            style={[
              styles.imageCard,
              {
                opacity: fadeAnim,
                transform: [{
                  translateY: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [20, 0],
                  }),
                }],
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => handleViewCreation(creation)}
              activeOpacity={0.8}
              style={styles.imageCardTouchable}
            >
              <Image
                source={{ uri: creation.imageUrl || creation.thumbnail, cache: 'reload' }}
                style={styles.imageThumbnail}
                resizeMode="cover"
                onLoadStart={() => console.log('【Assets】开始加载图片:', creation.imageUrl || creation.thumbnail)}
                onLoad={() => console.log('【Assets】图片加载成功:', creation.id)}
                onError={(e) => {
                  console.error('【Assets】图片加载失败:', creation.imageUrl || creation.thumbnail);
                  console.error('【Assets】错误详情:', e.nativeEvent.error);
                }}
              />
              <View style={styles.imageOverlay}>
                <Text style={styles.imageTitle} numberOfLines={1}>
                  {creation.title}
                </Text>
                <Text style={styles.imageDate}>
                  {new Date(creation.createdAt).toLocaleDateString('zh-CN')}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={styles.imageActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleDownload(creation)}
              >
                <Text style={styles.actionBtnText}>⬇️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={() => handleDelete(creation)}
              >
                <Text style={styles.actionBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ))}
      </View>
    );
  };

  // 渲染音频列表
  const renderAudioList = () => {
    if (filteredCreations.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🎵</Text>
          <Text style={styles.emptyText}>暂无音频</Text>
          <Text style={styles.emptySubtext}>去录制一些梦境语音吧</Text>
        </View>
      );
    }

    return (
      <View style={styles.audioList}>
        {filteredCreations.map((creation, index) => (
          <Animated.View
            key={creation.id}
            style={[
              styles.audioCard,
              {
                opacity: fadeAnim,
                transform: [{
                  translateX: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-20, 0],
                  }),
                }],
              },
            ]}
          >
            <View style={styles.audioIconContainer}>
              <Text style={styles.audioIcon}>🎵</Text>
            </View>
            <View style={styles.audioInfo}>
              <Text style={styles.audioTitle} numberOfLines={1}>
                {creation.title}
              </Text>
              <Text style={styles.audioDate}>
                {new Date(creation.createdAt).toLocaleDateString('zh-CN')}
              </Text>
            </View>
            <View style={styles.audioActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleDownload(creation)}
              >
                <Text style={styles.actionBtnText}>⬇️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={() => handleDelete(creation)}
              >
                <Text style={styles.actionBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ))}
      </View>
    );
  };

  // 渲染视频网格
  const renderVideoGrid = () => {
    const videoCreations = creations.filter(c => 
      c.type === 'video' || c.type === 'video_long' || c.type === 'script'
    );

    if (videoCreations.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🎬</Text>
          <Text style={styles.emptyText}>暂无视频</Text>
          <Text style={styles.emptySubtext}>去生成一些梦境视频吧</Text>
        </View>
      );
    }

    return (
      <View style={styles.videoGrid}>
        {videoCreations.map((creation, index) => (
          <Animated.View
            key={creation.id}
            style={[
              styles.videoCard,
              {
                opacity: fadeAnim,
                transform: [{
                  scale: fadeAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.9, 1],
                  }),
                }],
              },
            ]}
          >
            <TouchableOpacity
              onPress={() => handleViewCreation(creation)}
              activeOpacity={0.8}
              style={styles.videoCardTouchable}
            >
              {creation.thumbnail || creation.coverUrl ? (
                <Image
                  source={{ uri: creation.thumbnail || creation.coverUrl }}
                  style={styles.videoThumbnail}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.videoPlaceholder}>
                  <Text style={styles.videoPlaceholderIcon}>
                    {getTypeIcon(creation.type)}
                  </Text>
                </View>
              )}
              <View style={styles.videoOverlay}>
                <View style={styles.playButton}>
                  <Text style={styles.playIcon}>▶️</Text>
                </View>
              </View>
              <View style={styles.videoInfo}>
                <Text style={styles.videoType}>{getTypeLabel(creation.type)}</Text>
                <Text style={styles.videoTitle} numberOfLines={1}>
                  {creation.title}
                </Text>
              </View>
            </TouchableOpacity>
            <View style={styles.videoActions}>
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={() => handleDownload(creation)}
              >
                <Text style={styles.actionBtnText}>⬇️</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.deleteBtn]}
                onPress={() => handleDelete(creation)}
              >
                <Text style={styles.actionBtnText}>🗑️</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>我的资产</Text>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'images' && styles.activeTab]}
          onPress={() => setActiveTab('images')}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>🖼️</Text>
          <Text style={[styles.tabText, activeTab === 'images' && styles.activeTabText]}>
            照片
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'audio' && styles.activeTab]}
          onPress={() => setActiveTab('audio')}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>🎵</Text>
          <Text style={[styles.tabText, activeTab === 'audio' && styles.activeTabText]}>
            音频
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'videos' && styles.activeTab]}
          onPress={() => setActiveTab('videos')}
          activeOpacity={0.7}
        >
          <Text style={styles.tabIcon}>🎬</Text>
          <Text style={[styles.tabText, activeTab === 'videos' && styles.activeTabText]}>
            视频
          </Text>
        </TouchableOpacity>
      </View>

      {/* Stats - 仅登录时显示 */}
      {isLoggedIn && (
        <View style={styles.statsContainer}>
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {creations.filter(c => c.type === 'image').length}
            </Text>
            <Text style={styles.statLabel}>图片</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {creations.filter(c => c.type === 'video' || c.type === 'video_long').length}
            </Text>
            <Text style={styles.statLabel}>视频</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>
              {creations.filter(c => c.type === 'script').length}
            </Text>
            <Text style={styles.statLabel}>剧本</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statNumber}>{creations.length}</Text>
            <Text style={styles.statLabel}>总计</Text>
          </View>
        </View>
      )}

      {/* Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {!isLoggedIn ? (
          renderNotLoggedIn()
        ) : (
          <>
            {activeTab === 'images' && renderImageGrid()}
            {activeTab === 'audio' && renderAudioList()}
            {activeTab === 'videos' && renderVideoGrid()}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    gap: 12,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.card,
    borderRadius: 12,
    paddingVertical: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
  },
  activeTab: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  tabIcon: {
    fontSize: 16,
  },
  tabText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: colors.text,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: colors.card,
    marginHorizontal: 20,
    marginBottom: 16,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  statDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.divider,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  // Not logged in state
  notLoggedInContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    minHeight: 400,
  },
  notLoggedInIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  notLoggedInIcon: {
    fontSize: 56,
  },
  notLoggedInTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 12,
  },
  notLoggedInSubtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 40,
  },
  notLoggedInButtons: {
    width: '100%',
    paddingHorizontal: 40,
    gap: 16,
  },
  loginButton: {
    width: '100%',
  },
  exploreButton: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  exploreButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '500',
  },
  // Empty state
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  // Image grid
  imageGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  imageCard: {
    width: (SCREEN_WIDTH - 52) / 2,
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  imageCardTouchable: {
    position: 'relative',
  },
  imageThumbnail: {
    width: '100%',
    height: 160,
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  imageTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  imageDate: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  imageActions: {
    flexDirection: 'row',
    padding: 8,
    gap: 8,
  },
  // Audio list
  audioList: {
    gap: 12,
  },
  audioCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  audioIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  audioIcon: {
    fontSize: 24,
  },
  audioInfo: {
    flex: 1,
  },
  audioTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  audioDate: {
    fontSize: 13,
    color: colors.textSecondary,
    marginTop: 4,
  },
  audioActions: {
    flexDirection: 'row',
    gap: 8,
  },
  // Video grid
  videoGrid: {
    gap: 16,
  },
  videoCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  videoCardTouchable: {
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: 200,
  },
  videoPlaceholder: {
    width: '100%',
    height: 200,
    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderIcon: {
    fontSize: 48,
  },
  videoOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playIcon: {
    fontSize: 28,
  },
  videoInfo: {
    padding: 16,
  },
  videoType: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  videoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  videoActions: {
    flexDirection: 'row',
    padding: 12,
    paddingTop: 0,
    gap: 8,
  },
  // Common action buttons
  actionBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtn: {
    backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
  },
  actionBtnText: {
    fontSize: 16,
  },
});
