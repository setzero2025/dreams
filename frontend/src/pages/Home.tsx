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
  ActivityIndicator,
  TextInput,
  Alert,
  Dimensions,
} from 'react-native';
import { useTheme } from '../theme/themeContext';
import { Dream } from '../types';
import { dreamStorageManager } from '../services/storage';
import { useFocusEffect } from '@react-navigation/native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface HomeProps {
  navigation: any;
  route: any;
}

// 全局请求锁，确保整个应用同时只有一个 dreams 请求
let globalDreamsRequestLock = false;
let globalLastFetchTime = 0;

export const Home: React.FC<HomeProps> = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);

  const [activeTab, setActiveTab] = useState('today');
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [filteredDreams, setFilteredDreams] = useState<Dream[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [streakDays, setStreakDays] = useState(0);
  const starAnimations = useRef<Animated.Value[]>([]);
  const floatingAnimation = useRef(new Animated.Value(0)).current;

  // 获取梦境列表的核心逻辑
  const fetchDreamsCore = async () => {
    console.log('【Home】开始获取梦境列表');
    const dreams = await dreamStorageManager.getDreams();
    console.log('【Home】获取到梦境数量:', dreams.length, '数据:', dreams);
    setDreams(dreams);
    console.log('【Home】已设置 dreams state，长度:', dreams.length);
    calculateStreakDays(dreams);
    return dreams;
  };

  const calculateStreakDays = (dreams: Dream[]) => {
    if (dreams.length === 0) {
      setStreakDays(0);
      return;
    }

    const sortedDreams = [...dreams].sort((a, b) => 
      new Date(b.dreamDate).getTime() - new Date(a.dreamDate).getTime()
    );

    let streak = 0;
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const latestDreamDate = new Date(sortedDreams[0].dreamDate);
    latestDreamDate.setHours(0, 0, 0, 0);

    if (latestDreamDate.getTime() === today.getTime()) {
      streak = 1;
      
      for (let i = 1; i < sortedDreams.length; i++) {
        const dreamDate = new Date(sortedDreams[i].dreamDate);
        dreamDate.setHours(0, 0, 0, 0);
        
        const expectedDate = new Date(today);
        expectedDate.setDate(today.getDate() - streak);
        
        if (dreamDate.getTime() === expectedDate.getTime()) {
          streak++;
        } else {
          break;
        }
      }
    }

    setStreakDays(streak);
  };

  const filterDreams = useCallback((dreamsList: Dream[], tab: string, query: string) => {
    console.log('【Home】开始过滤梦境，tab:', tab, '查询:', query);
    console.log('【Home】原始梦境数量:', dreamsList.length);

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    today.setHours(23, 59, 59, 999);
    const weekAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    weekAgo.setDate(weekAgo.getDate() - 6);
    weekAgo.setHours(0, 0, 0, 0);

    let filtered = dreamsList;

    switch (tab) {
      case 'today':
        filtered = dreamsList.filter(dream => {
          // 处理无效的日期
          if (!dream.dreamDate) {
            console.log('【Home】梦境日期为空，跳过:', dream.id);
            return false;
          }
          const dreamDate = new Date(dream.dreamDate);
          // 检查日期是否有效
          if (isNaN(dreamDate.getTime())) {
            console.log('【Home】梦境日期无效:', dream.dreamDate);
            return false;
          }
          const dreamDateOnly = new Date(dreamDate.getFullYear(), dreamDate.getMonth(), dreamDate.getDate());
          const todayOnly = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const isToday = dreamDateOnly.getTime() === todayOnly.getTime();
          console.log('【Home】梦境日期:', dream.dreamDate, '是否是今天:', isToday);
          return isToday;
        });
        break;
      case 'week':
        filtered = dreamsList.filter(dream => {
          if (!dream.dreamDate) return false;
          const dreamDate = new Date(dream.dreamDate);
          if (isNaN(dreamDate.getTime())) return false;
          const dreamDateOnly = new Date(dreamDate.getFullYear(), dreamDate.getMonth(), dreamDate.getDate());
          return dreamDateOnly >= weekAgo && dreamDateOnly <= today;
        });
        break;
      case 'all':
      default:
        filtered = dreamsList;
        break;
    }

    if (query.trim()) {
      const lowerQuery = query.toLowerCase();
      filtered = filtered.filter(dream =>
        dream.title?.toLowerCase().includes(lowerQuery) ||
        dream.content?.toLowerCase().includes(lowerQuery) ||
        dream.tags?.some(tag => tag.toLowerCase().includes(lowerQuery))
      );
    }

    console.log('【Home】过滤后梦境数量:', filtered.length);

    setFilteredDreams(filtered);
  }, []);

  // 启动浮动动画
  useEffect(() => {
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

  // 页面首次加载和重新聚焦时获取数据
  useFocusEffect(
    useCallback(() => {
      console.log('【首页】页面聚焦，开始获取数据');

      // 检查全局锁
      if (globalDreamsRequestLock) {
        console.log('【Home】全局请求锁已锁定，跳过重复请求');
        return;
      }

      // 检查时间间隔（500ms内不重复请求）
      const now = Date.now();
      if (now - globalLastFetchTime < 500) {
        console.log('【Home】距离上次请求时间太短，跳过重复请求');
        return;
      }

      globalDreamsRequestLock = true;
      globalLastFetchTime = now;
      setLoading(true);

      // 直接调用核心逻辑，避免依赖问题
      fetchDreamsCore().then((dreams) => {
        // 使用当前的 activeTab 和 searchQuery 进行过滤
        filterDreams(dreams, activeTab, searchQuery);
      }).catch((error) => {
        console.error('【Home】获取梦境列表失败:', error);
      }).finally(() => {
        setLoading(false);
        globalDreamsRequestLock = false;
      });
    }, [activeTab, searchQuery]) // 依赖 activeTab 和 searchQuery
  );

  useEffect(() => {
    if (route.params?.refresh) {
      console.log('【首页】收到刷新参数，开始刷新数据');

      // 检查全局锁
      if (globalDreamsRequestLock) {
        console.log('【Home】全局请求锁已锁定，跳过重复请求');
        navigation.setParams({ refresh: false });
        return;
      }

      globalDreamsRequestLock = true;
      setLoading(true);

      // 直接调用核心逻辑
      fetchDreamsCore().then((dreams) => {
        filterDreams(dreams, activeTab, searchQuery);
      }).catch((error) => {
        console.error('【Home】获取梦境列表失败:', error);
      }).finally(() => {
        setLoading(false);
        globalDreamsRequestLock = false;
        navigation.setParams({ refresh: false });
      });
    }
  }, [route.params?.refresh, activeTab, searchQuery, navigation]);

  useEffect(() => {
    starAnimations.current = filteredDreams.map(() => new Animated.Value(1));
  }, [filteredDreams]);

  useEffect(() => {
    filterDreams(dreams, activeTab, searchQuery);
  }, [searchQuery, activeTab, dreams, filterDreams]);

  const handleRecord = (type: 'voice' | 'text') => {
    navigation.navigate('Record', { type });
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    filterDreams(dreams, tab, searchQuery);
  };

  const handleDreamPress = (dream: Dream, index: number) => {
    const animationValue = starAnimations.current[index] || new Animated.Value(1);
    Animated.sequence([
      Animated.timing(animationValue, {
        toValue: 0.8,
        duration: 100,
        useNativeDriver: true,
      }),
      Animated.timing(animationValue, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
    
    navigation.navigate('DreamDetail', { dream });
  };

  const handleDeleteDream = (dream: Dream) => {
    Alert.alert(
      '确认删除',
      `确定要删除梦境"${dream.title}"吗？相关的图片、视频、解读结果也将被删除。`,
      [
        { text: '取消', style: 'cancel' },
        { 
          text: '删除', 
          style: 'destructive',
          onPress: async () => {
            try {
              await dreamStorageManager.deleteDream(dream.id);
              // 删除后刷新列表
              const dreams = await fetchDreamsCore();
              filterDreams(dreams, activeTab, searchQuery);
            } catch (error) {
              console.error('删除梦境失败:', error);
              Alert.alert('删除失败', '请稍后重试');
            }
          }
        },
      ]
    );
  };

  const renderMoodEmoji = (rating: number) => {
    const emojis = ['😢', '😕', '😐', '😊', '😁'];
    return emojis[rating - 1];
  };

  const renderStars = () => {
    return (
      <View style={styles.starContainer}>
        {[...Array(30)].map((_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.star,
              {
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
                opacity: floatingAnimation.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2 + Math.random() * 0.3, 0.5 + Math.random() * 0.5],
                }),
                transform: [{
                  scale: floatingAnimation.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8, 1.2],
                  }),
                }],
              },
            ]}
          />
        ))}
      </View>
    );
  };

  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    starContainer: {
      ...StyleSheet.absoluteFillObject,
      zIndex: -1,
    },
    star: {
      position: 'absolute',
      width: 2,
      height: 2,
      backgroundColor: colors.primary,
      borderRadius: 1,
    },
    scrollView: {
      flex: 1,
    },
    content: {
      padding: 20,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 20,
      position: 'relative',
    },
    appTitle: {
      fontSize: 32,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 8,
    },
    greeting: {
      fontSize: 16,
      color: colors.textSecondary,
    },
    searchContainer: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.card,
      borderRadius: 12,
      paddingHorizontal: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    searchIcon: {
      fontSize: 16,
      marginRight: 12,
    },
    searchInput: {
      flex: 1,
      height: 48,
      fontSize: 15,
      color: colors.text,
    },
    clearIcon: {
      fontSize: 16,
      color: colors.textSecondary,
      padding: 8,
    },
    tabs: {
      flexDirection: 'row',
      marginBottom: 24,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 4,
      borderWidth: 1,
      borderColor: colors.border,
    },
    tab: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 12,
      paddingHorizontal: 16,
      borderRadius: 8,
    },
    activeTab: {
      backgroundColor: colors.primary,
      shadowColor: colors.primary,
      shadowOffset: {
        width: 0,
        height: 4,
      },
      shadowOpacity: 0.3,
      shadowRadius: 8,
      elevation: 5,
    },
    tabText: {
      fontSize: 14,
      color: colors.textLight,
      fontWeight: '500',
    },
    activeTabText: {
      color: '#fff',
      fontWeight: '600',
    },
    quickActions: {
      flexDirection: 'row',
      gap: 16,
      marginBottom: 24,
    },
    quickButtonWrapper: {
      flex: 1,
      position: 'relative',
    },
    quickButtonGlow: {
      ...StyleSheet.absoluteFillObject,
      borderRadius: 12,
      backgroundColor: colors.primary,
      opacity: 0.3,
      zIndex: -1,
    },
    quickButtonContent: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 16,
      paddingHorizontal: 20,
      gap: 8,
    },
    quickButtonSecondaryContent: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      borderWidth: 1,
      borderColor: colors.border,
    },
    quickButtonIcon: {
      fontSize: 20,
    },
    quickButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
    streakBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.1)' : 'rgba(245, 158, 11, 0.1)',
      borderRadius: 12,
      padding: 16,
      marginBottom: 24,
      borderWidth: 1,
      borderColor: colors.warning,
    },
    streakText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    dreamList: {
      marginBottom: 24,
    },
    sectionHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    searchResultText: {
      fontSize: 14,
      color: colors.textSecondary,
    },
    dreamCardContainer: {
      marginBottom: 12,
    },
    dreamCardWrapper: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    dreamCardTouchable: {
      flex: 1,
    },
    dreamCard: {
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
    },
    dreamCardContent: {
      flex: 1,
    },
    dreamCardHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'flex-start',
      marginBottom: 8,
    },
    dreamCardTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      flex: 1,
      marginRight: 8,
    },
    dreamCardMood: {
      fontSize: 20,
    },
    dreamCardDate: {
      fontSize: 12,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    dreamCardDesc: {
      fontSize: 14,
      color: colors.textSecondary,
      lineHeight: 20,
      marginBottom: 8,
    },
    deleteButton: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(239, 68, 68, 0.2)' : 'rgba(239, 68, 68, 0.1)',
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(239, 68, 68, 0.3)' : 'rgba(239, 68, 68, 0.2)',
    },
    deleteButtonText: {
      fontSize: 18,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    tag: {
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
      paddingHorizontal: 10,
      paddingVertical: 3,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: isDark ? 'rgba(99, 102, 241, 0.3)' : 'rgba(99, 102, 241, 0.2)',
    },
    tagText: {
      fontSize: 11,
      color: colors.primary,
      fontWeight: '500',
    },
    loadingContainer: {
      padding: 40,
      alignItems: 'center',
    },
    loadingText: {
      marginTop: 16,
      fontSize: 16,
      color: colors.textSecondary,
    },
    emptyContainer: {
      padding: 40,
      alignItems: 'center',
      justifyContent: 'center',
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
      textAlign: 'center',
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      {renderStars()}
      
      <ScrollView 
        style={dynamicStyles.scrollView}
        contentContainerStyle={dynamicStyles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={dynamicStyles.header}>
          <Text style={dynamicStyles.appTitle}>梦境空间</Text>
          <Text style={dynamicStyles.greeting}>
            记录你的梦境，探索潜意识
          </Text>
        </View>

        <View style={dynamicStyles.searchContainer}>
          <Text style={dynamicStyles.searchIcon}>🔍</Text>
          <TextInput
            style={dynamicStyles.searchInput}
            placeholder="搜索梦境标题、内容或标签..."
            placeholderTextColor={colors.textDisabled}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Text style={dynamicStyles.clearIcon}>✕</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={dynamicStyles.tabs}>
          <TouchableOpacity
            style={[dynamicStyles.tab, activeTab === 'today' && dynamicStyles.activeTab]}
            onPress={() => handleTabChange('today')}
            activeOpacity={0.7}
          >
            <Text style={[dynamicStyles.tabText, activeTab === 'today' && dynamicStyles.activeTabText]}>
              今天
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[dynamicStyles.tab, activeTab === 'week' && dynamicStyles.activeTab]}
            onPress={() => handleTabChange('week')}
            activeOpacity={0.7}
          >
            <Text style={[dynamicStyles.tabText, activeTab === 'week' && dynamicStyles.activeTabText]}>
              本周
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[dynamicStyles.tab, activeTab === 'all' && dynamicStyles.activeTab]}
            onPress={() => handleTabChange('all')}
            activeOpacity={0.7}
          >
            <Text style={[dynamicStyles.tabText, activeTab === 'all' && dynamicStyles.activeTabText]}>
              全部
            </Text>
          </TouchableOpacity>
        </View>

        <View style={dynamicStyles.quickActions}>
          <TouchableOpacity 
            style={dynamicStyles.quickButtonWrapper}
            onPress={() => handleRecord('voice')}
            activeOpacity={0.9}
          >
            <Animated.View
              style={[
                dynamicStyles.quickButtonGlow,
                {
                  transform: [
                    {
                      scale: floatingAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.05],
                      }),
                    },
                  ],
                },
              ]}
            />
            <View style={dynamicStyles.quickButtonContent}>
              <Text style={dynamicStyles.quickButtonIcon}>🎤</Text>
              <Text style={dynamicStyles.quickButtonText}>语音记梦</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity 
            style={dynamicStyles.quickButtonWrapper}
            onPress={() => handleRecord('text')}
            activeOpacity={0.9}
          >
            <View style={[dynamicStyles.quickButtonContent, dynamicStyles.quickButtonSecondaryContent]}>
              <Text style={dynamicStyles.quickButtonIcon}>✏️</Text>
              <Text style={[dynamicStyles.quickButtonText, { color: colors.text }]}>文字记梦</Text>
            </View>
          </TouchableOpacity>
        </View>

        {streakDays > 0 && (
          <View style={dynamicStyles.streakBadge}>
            <Text style={dynamicStyles.streakText}>🔥 连续记录 {streakDays} 天</Text>
          </View>
        )}

        <View style={dynamicStyles.dreamList}>
          <View style={dynamicStyles.sectionHeader}>
            <Text style={dynamicStyles.sectionTitle}>最近的梦境</Text>
            {searchQuery.length > 0 && (
              <Text style={dynamicStyles.searchResultText}>
                找到 {filteredDreams.length} 个结果
              </Text>
            )}
          </View>
          
          {loading ? (
            <View style={dynamicStyles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={dynamicStyles.loadingText}>加载梦境中...</Text>
            </View>
          ) : dreams.length === 0 ? (
            <View style={dynamicStyles.emptyContainer}>
              <Text style={dynamicStyles.emptyIcon}>🌙</Text>
              <Text style={dynamicStyles.emptyText}>还没有梦境记录</Text>
              <Text style={dynamicStyles.emptySubtext}>点击上方按钮开始记录你的第一个梦境</Text>
            </View>
          ) : filteredDreams.length === 0 ? (
            <View style={dynamicStyles.emptyContainer}>
              <Text style={dynamicStyles.emptyIcon}>🔍</Text>
              <Text style={dynamicStyles.emptyText}>没有找到匹配的梦境</Text>
              <Text style={dynamicStyles.emptySubtext}>试试其他搜索词</Text>
            </View>
          ) : (
            filteredDreams.map((dream, index) => {
              const animationValue = starAnimations.current[index] || new Animated.Value(1);
              // 截取内容预览，最多显示50个字符
              const contentPreview = dream.content.length > 50 
                ? dream.content.substring(0, 50) + '...' 
                : dream.content;
              return (
                <View key={dream.id} style={dynamicStyles.dreamCardContainer}>
                  <Animated.View
                    style={[
                      dynamicStyles.dreamCardWrapper,
                      {
                        opacity: animationValue,
                        transform: [
                          {
                            scale: animationValue.interpolate({
                              inputRange: [0.8, 1],
                              outputRange: [0.95, 1],
                            }),
                          },
                        ],
                      },
                    ]}
                  >
                    <TouchableOpacity
                      onPress={() => handleDreamPress(dream, index)}
                      activeOpacity={0.8}
                      style={dynamicStyles.dreamCardTouchable}
                    >
                      <View style={dynamicStyles.dreamCard}>
                        <View style={dynamicStyles.dreamCardContent}>
                          <View style={dynamicStyles.dreamCardHeader}>
                            <Text style={dynamicStyles.dreamCardTitle} numberOfLines={1}>
                              {dream.title}
                            </Text>
                            <Text style={dynamicStyles.dreamCardMood}>
                              {renderMoodEmoji(dream.moodRating)}
                            </Text>
                          </View>
                          <Text style={dynamicStyles.dreamCardDate}>
                            {new Date(dream.dreamDate).toLocaleDateString('zh-CN', { 
                              year: 'numeric', 
                              month: '2-digit', 
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </Text>
                          <Text style={dynamicStyles.dreamCardDesc} numberOfLines={2}>
                            {contentPreview}
                          </Text>
                          {dream.tags.length > 0 && (
                            <View style={dynamicStyles.tags}>
                              {dream.tags.slice(0, 3).map((tag) => (
                                <View key={tag} style={dynamicStyles.tag}>
                                  <Text style={dynamicStyles.tagText}>{tag}</Text>
                                </View>
                              ))}
                              {dream.tags.length > 3 && (
                                <View style={dynamicStyles.tag}>
                                  <Text style={dynamicStyles.tagText}>+{dream.tags.length - 3}</Text>
                                </View>
                              )}
                            </View>
                          )}
                        </View>
                      </View>
                    </TouchableOpacity>
                    
                    <TouchableOpacity
                      style={dynamicStyles.deleteButton}
                      onPress={() => handleDeleteDream(dream)}
                      activeOpacity={0.7}
                    >
                      <Text style={dynamicStyles.deleteButtonText}>🗑️</Text>
                    </TouchableOpacity>
                  </Animated.View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({});
