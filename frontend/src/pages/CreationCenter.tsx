import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Dimensions,
  Animated,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import { BackButton } from '../components/BackButton';
import { useTheme } from '../theme/themeContext';
import { creationStorageService, CreationItem } from '../services/CreationStorageService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface CreationCenterProps {
  navigation: any;
  route?: {
    params?: {
      dreamId?: string;
    };
  };
}

const getTypeConfig = (isDark: boolean) => ({
  image: { icon: '🖼️', label: '画作', color: '#ec4899', bgColor: 'rgba(236, 72, 153, 0.15)' },
  script: { icon: '📝', label: '剧本', color: '#8b5cf6', bgColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)' },
  video: { icon: '🎬', label: '短视频', color: '#3b82f6', bgColor: 'rgba(59, 130, 246, 0.15)' },
  video_long: { icon: '🎥', label: '长视频', color: '#10b981', bgColor: 'rgba(16, 185, 129, 0.15)' },
});

// 视频播放器组件
const VideoPlayerModal: React.FC<{
  visible: boolean;
  videoUrl: string;
  onClose: () => void;
}> = ({ visible, videoUrl, onClose }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.modalOverlay} onPress={onClose}>
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            {Platform.OS === 'web' ? (
              <video
                src={videoUrl}
                controls
                autoPlay
                style={styles.videoPlayer}
                playsInline
              />
            ) : (
              <View style={styles.videoPlaceholder}>
                <Text style={styles.videoPlaceholderText}>视频播放</Text>
                <Text style={styles.videoUrlText} numberOfLines={2}>{videoUrl}</Text>
              </View>
            )}
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

// 图片预览组件
const ImagePreviewModal: React.FC<{
  visible: boolean;
  imageUrl: string;
  onClose: () => void;
}> = ({ visible, imageUrl, onClose }) => {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.modalContainer}>
        <TouchableOpacity style={styles.modalOverlay} onPress={onClose}>
          <View style={styles.imageModalContent} onStartShouldSetResponder={() => true}>
            <TouchableOpacity style={styles.closeButton} onPress={onClose}>
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
            <Image
              source={{ uri: imageUrl }}
              style={styles.previewImage}
              resizeMode="contain"
            />
          </View>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

export const CreationCenter: React.FC<CreationCenterProps> = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [activeFilter, setActiveFilter] = useState<'all' | 'image' | 'script' | 'video'>('all');
  const [creations, setCreations] = useState<CreationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  // 视频播放弹窗状态
  const [videoModalVisible, setVideoModalVisible] = useState(false);
  const [currentVideoUrl, setCurrentVideoUrl] = useState('');

  // 图片预览弹窗状态
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [currentImageUrl, setCurrentImageUrl] = useState('');

  const dreamId = route?.params?.dreamId;

  // 格式化日期时间为 YYYY-MM-dd HH:mm:ss
  const formatDateTime = (dateString: string): string => {
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  };

  const loadCreations = useCallback(async () => {
    try {
      let data: CreationItem[];
      if (dreamId) {
        data = await creationStorageService.getCreationsByDreamId(dreamId);
      } else {
        data = await creationStorageService.getAllCreations();
      }
      setCreations(data);
    } catch (error) {
      console.error('加载创作列表失败:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [dreamId]);

  useEffect(() => {
    loadCreations();
    const unsubscribe = navigation.addListener('focus', () => {
      loadCreations();
    });
    return unsubscribe;
  }, [navigation, loadCreations]);

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();
  }, []);

  const filteredCreations = activeFilter === 'all'
    ? creations
    : creations.filter(item => {
        if (activeFilter === 'video') {
          return item.type === 'video' || item.type === 'video_long';
        }
        return item.type === activeFilter;
      });

  const handleDelete = async (id: string) => {
    try {
      await creationStorageService.deleteCreation(id);
      setCreations(prev => prev.filter(item => item.id !== id));
    } catch (error) {
      console.error('删除创作失败:', error);
    }
  };

  // 处理媒体点击（图片或视频）
  const handleMediaPress = (item: CreationItem) => {
    if (item.type === 'image') {
      // 点击图片直接预览
      setCurrentImageUrl(item.imageUrl || item.thumbnail || '');
      setImageModalVisible(true);
    } else if (item.type === 'video' || item.type === 'video_long') {
      // 点击视频直接播放
      setCurrentVideoUrl(item.videoUrl || '');
      setVideoModalVisible(true);
    }
  };

  // 处理标题点击（跳转到详情页）
  const handleTitlePress = (item: CreationItem) => {
    switch (item.type) {
      case 'image':
        navigation.navigate('ImageViewer', { imageUrl: item.imageUrl, title: item.title });
        break;
      case 'video':
      case 'video_long':
        navigation.navigate('VideoPlayer', { videoUrl: item.videoUrl, coverUrl: item.thumbnail, title: item.title });
        break;
      case 'script':
        // 剧本类型可以跳转到剧本详情页
        navigation.navigate('ScriptDetail', { script: item.script, title: item.title });
        break;
    }
  };

  const renderFilterTabs = () => {
    const filters: { key: typeof activeFilter; label: string }[] = [
      { key: 'all', label: '全部' },
      { key: 'image', label: '画作' },
      { key: 'video', label: '视频' },
      { key: 'script', label: '剧本' },
    ];
    return (
      <View style={styles.filterContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {filters.map(filter => (
            <TouchableOpacity
              key={filter.key}
              style={[styles.filterTab, activeFilter === filter.key && styles.filterTabActive]}
              onPress={() => setActiveFilter(filter.key)}
            >
              <Text style={[styles.filterTabText, activeFilter === filter.key && styles.filterTabTextActive]}>
                {filter.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    );
  };

  const renderCreationCard = (item: CreationItem) => {
    const typeConfig = getTypeConfig(isDark)[item.type as keyof ReturnType<typeof getTypeConfig>] ||
      { icon: '🎨', label: '创作', color: colors.primary, bgColor: colors.card };
    const isVideo = item.type === 'video' || item.type === 'video_long';

    return (
      <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
        {/* 媒体区域 - 点击预览/播放 */}
        <TouchableOpacity
          style={styles.mediaTouchable}
          onPress={() => handleMediaPress(item)}
          activeOpacity={0.9}
        >
          <View style={[styles.thumbnailContainer, { backgroundColor: typeConfig.bgColor }]}>
            {item.thumbnail || item.imageUrl ? (
              <Image source={{ uri: item.thumbnail || item.imageUrl }} style={styles.thumbnail} resizeMode="cover" />
            ) : (
              <Text style={[styles.typeIcon, { color: typeConfig.color }]}>{typeConfig.icon}</Text>
            )}

            {/* 视频播放按钮 */}
            {isVideo && (
              <View style={styles.playButtonOverlay}>
                <View style={styles.playButton}>
                  <Text style={styles.playIcon}>▶</Text>
                </View>
              </View>
            )}

            {/* 类型标签 */}
            <View style={[styles.typeBadge, { backgroundColor: typeConfig.color }]}>
              <Text style={styles.typeBadgeText}>{typeConfig.label}</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* 信息区域 - 点击跳转到详情 */}
        <TouchableOpacity
          style={styles.infoTouchable}
          onPress={() => handleTitlePress(item)}
          activeOpacity={0.7}
        >
          <View style={styles.cardInfo}>
            <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
            <Text style={styles.cardDreamTitle} numberOfLines={1}>关联梦境: {item.dreamTitle}</Text>
            <Text style={styles.cardDate}>{formatDateTime(item.createdAt)}</Text>
          </View>
        </TouchableOpacity>

        {/* 删除按钮 */}
        <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(item.id)}>
          <Text style={styles.deleteButtonText}>🗑️</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>加载中...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* 视频播放弹窗 */}
      <VideoPlayerModal
        visible={videoModalVisible}
        videoUrl={currentVideoUrl}
        onClose={() => setVideoModalVisible(false)}
      />

      {/* 图片预览弹窗 */}
      <ImagePreviewModal
        visible={imageModalVisible}
        imageUrl={currentImageUrl}
        onClose={() => setImageModalVisible(false)}
      />

      <View style={styles.header}>
        <BackButton onPress={() => navigation.goBack()} style={styles.backButton} />
        <Text style={styles.headerTitle}>创作中心</Text>
        <View style={styles.headerRight} />
      </View>
      {renderFilterTabs()}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCreations(); }} />
        }
      >
        {filteredCreations.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>🎨</Text>
            <Text style={styles.emptyText}>还没有创作</Text>
            <Text style={styles.emptySubtext}>快去生成你的第一个作品吧</Text>
          </View>
        ) : (
          filteredCreations.map(item => renderCreationCard(item))
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backButton: {
    marginRight: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
  },
  filterContainer: {
    paddingVertical: 12,
  },
  filterTab: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    marginHorizontal: 6,
    borderRadius: 20,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterTabActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterTabText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  filterTabTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  card: {
    marginBottom: 16,
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  mediaTouchable: {
    width: '100%',
  },
  infoTouchable: {
    width: '100%',
  },
  thumbnailContainer: {
    width: '100%',
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  typeIcon: {
    fontSize: 48,
  },
  // 视频播放按钮样式
  playButtonOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  playButton: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(139, 92, 246, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8b5cf6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  playIcon: {
    fontSize: 24,
    color: '#fff',
    marginLeft: 4,
  },
  typeBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  typeBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  cardInfo: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  cardDreamTitle: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  cardDate: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  deleteButton: {
    position: 'absolute',
    top: 12,
    left: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
  },
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  // 弹窗样式
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalOverlay: {
    flex: 1,
    width: '100%',
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    maxWidth: 800,
    backgroundColor: '#000',
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
  },
  imageModalContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
  },
  closeButtonText: {
    fontSize: 20,
    color: '#fff',
    fontWeight: '600',
  },
  videoPlayer: {
    width: '100%',
    height: 450,
    backgroundColor: '#000',
  },
  videoPlaceholder: {
    width: '100%',
    height: 300,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  videoPlaceholderText: {
    fontSize: 18,
    color: '#fff',
    marginBottom: 12,
  },
  videoUrlText: {
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  previewImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * 0.75,
  },
});
