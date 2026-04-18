import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { useTheme } from '../theme/themeContext';
import { useAuth } from '../context/AuthContext';
import { dreamStorageManager } from '../services/storage';
import { authApi, User } from '../services/api/authApi';
import { creationStorageService } from '../services/CreationStorageService';

interface ProfileProps {
  navigation: any;
}

// 全局请求锁，防止重复请求
let globalUserInfoRequestLock = false;
let globalStatsRequestLock = false;
let globalUserInfoLastFetchTime = 0;
let globalStatsLastFetchTime = 0;

export const Profile: React.FC<ProfileProps> = ({ navigation }) => {
  const { colors, isDark, themeMode } = useTheme();
  const { isAuthenticated, isAnonymous, user: authUser, logout } = useAuth();
  
  const [stats, setStats] = useState({
    totalDreams: 0,
    streakDays: 0,
    totalCreations: 0,
    totalWorks: 0,
  });
  const [loading, setLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [subscriptionStatus, setSubscriptionStatus] = useState<{
    type: 'none' | 'monthly' | 'yearly';
    expiresAt?: string;
    isActive: boolean;
  }>({ type: 'none', isActive: false });
  const statsAnimations = useRef<Animated.Value[]>([]);
  const avatarAnimation = useRef(new Animated.Value(1)).current;
  // 组件级别的请求追踪
  const hasInitialLoadedRef = useRef(false);
  
  // 编辑资料弹窗
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editNickname, setEditNickname] = useState('');
  const [editGender, setEditGender] = useState<'male' | 'female' | 'other'>('other');
  const [editAge, setEditAge] = useState('');

  // 菜单项
  const menuItems = [
    {
      icon: '⭐',
      title: '我的收藏',
      description: '查看收藏的作品',
      onPress: () => navigation.navigate('Favorites'),
    },
    {
      icon: '🧠',
      title: '心理测评',
      description: '基于梦境的心理分析',
      onPress: () => navigation.navigate('PsychologicalTest'),
    },
    {
      icon: '🎨',
      title: '主题设置',
      description: '浅色/深色/跟随系统',
      onPress: () => navigation.navigate('ThemeSettings'),
    },
    {
      icon: '📚',
      title: '知识库管理',
      description: '梦境知识库',
      onPress: () => Alert.alert('功能开发中', '该功能正在开发中，敬请期待'),
    },
    {
      icon: '💳',
      title: '订阅管理',
      description: '管理您的订阅',
      onPress: () => navigation.navigate('Subscription'),
    },
    {
      icon: '⚙️',
      title: '账号设置',
      description: '修改密码、绑定手机',
      onPress: () => Alert.alert('功能开发中', '该功能正在开发中，敬请期待'),
    },
  ];

  // 获取用户信息
  const fetchUserInfo = async (force = false) => {
    // 检查全局锁
    if (globalUserInfoRequestLock) {
      console.log('【Profile】用户信息请求锁已锁定，跳过重复请求');
      return;
    }

    // 检查时间间隔（500ms内不重复请求）
    const now = Date.now();
    if (!force && now - globalUserInfoLastFetchTime < 500) {
      console.log('【Profile】用户信息距离上次请求时间太短，跳过重复请求');
      return;
    }

    globalUserInfoRequestLock = true;
    globalUserInfoLastFetchTime = now;

    try {
      setUserLoading(true);
      
      // 使用 AuthContext 中的用户状态
      if (authUser) {
        setUser(authUser);
        setEditNickname(authUser.nickname || '');
      }
      
      // 如果已认证，获取最新用户信息
      if (isAuthenticated) {
        const result = await authApi.getCurrentUser();
        if (result.success && result.data) {
          setUser(result.data);
          setEditNickname(result.data.nickname || '');
        }
        
        // 获取订阅状态
        const subResult = await authApi.getSubscriptionStatus();
        if (subResult.success && subResult.data) {
          setSubscriptionStatus(subResult.data);
        }
      } else {
        // 未登录状态，清空用户信息
        setUser(null);
      }
    } catch (error) {
      console.error('获取用户信息失败:', error);
    } finally {
      setUserLoading(false);
      globalUserInfoRequestLock = false;
    }
  };

  // 获取用户统计数据
  const fetchStats = async (force = false) => {
    // 检查全局锁
    if (globalStatsRequestLock) {
      console.log('【Profile】统计数据请求锁已锁定，跳过重复请求');
      return;
    }

    // 检查时间间隔（500ms内不重复请求）
    const now = Date.now();
    if (!force && now - globalStatsLastFetchTime < 500) {
      console.log('【Profile】统计数据距离上次请求时间太短，跳过重复请求');
      return;
    }

    globalStatsRequestLock = true;
    globalStatsLastFetchTime = now;

    setLoading(true);
    try {
      console.log('【Profile】开始加载统计数据...');
      // 从本地存储获取数据（无论登录与否，都计算真实数据）
      const dreams = await dreamStorageManager.getDreams();
      console.log('【Profile】梦境数据:', dreams);
      const creations = await creationStorageService.getAllCreations();
      console.log('【Profile】创作数据:', creations);

      console.log('【Profile】获取到梦境数量:', dreams.length);
      console.log('【Profile】获取到创作数量:', creations.length);

      const totalDreams = dreams.length;

      // 计算连续天数
      let streakDays = 0;
      if (dreams.length > 0) {
        const sortedDreams = [...dreams].sort((a, b) =>
          new Date(b.dreamDate).getTime() - new Date(a.dreamDate).getTime()
        );

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const latestDreamDate = new Date(sortedDreams[0].dreamDate);
        latestDreamDate.setHours(0, 0, 0, 0);

        if (latestDreamDate.getTime() === today.getTime()) {
          streakDays = 1;

          for (let i = 1; i < sortedDreams.length; i++) {
            const dreamDate = new Date(sortedDreams[i].dreamDate);
            dreamDate.setHours(0, 0, 0, 0);

            const expectedDate = new Date(today);
            expectedDate.setDate(today.getDate() - streakDays);

            if (dreamDate.getTime() === expectedDate.getTime()) {
              streakDays++;
            } else {
              break;
            }
          }
        }
      }

      const totalCreations = creations.length;
      const totalWorks = creations.filter(c =>
        c.type === 'image' || c.type === 'video' || c.type === 'video_long'
      ).length;

      console.log('【Profile】统计数据:', { totalDreams, streakDays, totalCreations, totalWorks });

      setStats({
        totalDreams,
        streakDays,
        totalCreations,
        totalWorks,
      });
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setLoading(false);
      globalStatsRequestLock = false;
    }
  };

  // 页面首次加载时获取数据
  useEffect(() => {
    console.log('【Profile】组件挂载，开始获取数据');
    fetchUserInfo();
    fetchStats();

    // 头像悬浮动画
    Animated.loop(
      Animated.sequence([
        Animated.timing(avatarAnimation, {
          toValue: 1.05,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(avatarAnimation, {
          toValue: 1,
          duration: 2000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 页面重新聚焦时刷新数据
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      console.log('【Profile】页面聚焦，检查是否需要刷新');
      // 只有在已经初始加载后才刷新（避免和初始加载重复）
      if (hasInitialLoadedRef.current) {
        fetchUserInfo(true); // 强制刷新
        fetchStats(true); // 强制刷新
      } else {
        hasInitialLoadedRef.current = true;
      }
    });

    return unsubscribe;
  }, [navigation]);

  // 监听 AuthContext 用户变化
  useEffect(() => {
    if (authUser) {
      setUser(authUser);
      setEditNickname(authUser.nickname || '');
    } else {
      setUser(null);
    }
  }, [authUser]);

  // 监听 user 变化，当获取到用户信息后更新统计数据（只在用户信息变化时执行一次）
  useEffect(() => {
    if (isAuthenticated && user?.stats && !hasInitialLoadedRef.current) {
      fetchStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]); // 只在用户ID变化时触发

  useEffect(() => {
    statsAnimations.current = [
      new Animated.Value(0),
      new Animated.Value(0),
      new Animated.Value(0),
      new Animated.Value(0),
    ];

    setTimeout(() => {
      statsAnimations.current.forEach((anim, index) => {
        const values = [stats.totalDreams, stats.streakDays, stats.totalCreations, stats.totalWorks];
        Animated.timing(anim, {
          toValue: values[index],
          duration: 1500,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }).start();
      });
    }, 300);
  }, [stats]);

  const handleLogout = async () => {
    console.log('=== 退出登录按钮被点击 ===');
    console.log('isAuthenticated:', isAuthenticated);
    console.log('logoutLoading:', logoutLoading);
    
    // 临时简化：直接执行退出，不显示确认弹窗
    setLogoutLoading(true);
    setUserLoading(true); // 显示加载状态
    try {
      console.log('开始调用 logout...');
      // 1. 调用 AuthContext 的 logout（会自动匿名登录）
      await logout();
      console.log('logout 调用完成');
      
      // 2. 立即清空本地用户状态，确保UI立即更新为未登录状态
      setUser(null);
      setEditNickname('');
      setSubscriptionStatus({ type: 'none', isActive: false });
      
      // 3. 刷新统计数据
      await fetchStats();
      console.log('fetchStats 调用完成');
      
      // 4. 显示提示（不跳转页面）
      Alert.alert('已退出登录', '您现在以匿名用户身份继续使用');
    } catch (error) {
      console.error('退出登录错误:', error);
      // 即使出错也要清空本地状态
      setUser(null);
      setEditNickname('');
      setSubscriptionStatus({ type: 'none', isActive: false });
      Alert.alert('退出成功', '已退出登录');
    } finally {
      setLogoutLoading(false);
      setUserLoading(false); // 关闭加载状态
    }
  };

  // 更换头像
  const handleChangeAvatar = () => {
    // 未登录时点击头像跳转到登录页面
    if (!isAuthenticated) {
      navigation.navigate('Auth');
      return;
    }
    
    Alert.alert(
      '更换头像',
      '选择头像来源',
      [
        { text: '取消', style: 'cancel' },
        { text: '从相册选择', onPress: () => Alert.alert('提示', '相册选择功能开发中') },
        { text: '拍照', onPress: () => Alert.alert('提示', '拍照功能开发中') },
      ]
    );
  };

  // 打开编辑资料弹窗
  const handleEditProfile = () => {
    setEditModalVisible(true);
  };

  // 保存编辑资料
  const handleSaveProfile = async () => {
    try {
      setUserLoading(true);

      // 调用 API 更新用户资料
      const result = await authApi.updateProfile({
        nickname: editNickname.trim(),
        gender: editGender,
        age: editAge ? parseInt(editAge, 10) : undefined,
      });

      if (result.success && result.data) {
        // 立即更新本地状态，让 UI 立即显示新昵称
        setUser(result.data);
        // 同时更新编辑框中的值
        setEditNickname(result.data.nickname || '');

        Alert.alert('成功', '资料已更新');
        setEditModalVisible(false);
      } else {
        Alert.alert('失败', result.message || '更新资料失败');
      }
    } catch (error) {
      console.error('保存资料失败:', error);
      Alert.alert('失败', '请稍后重试');
    } finally {
      setUserLoading(false);
    }
  };

  // 动画数字组件
  const AnimatedNumber: React.FC<{ value: number; index: number }> = ({ value, index }) => {
    const animatedValue = statsAnimations.current[index] || new Animated.Value(0);
    const [displayValue, setDisplayValue] = useState(0);

    useEffect(() => {
      const listener = animatedValue.addListener(({ value: v }) => {
        setDisplayValue(Math.round(v));
      });
      return () => {
        animatedValue.removeListener(listener);
      };
    }, [animatedValue]);

    return <Text style={dynamicStyles.statNumber}>{displayValue}</Text>;
  };

  const renderStats = () => {
    return (
      <View style={dynamicStyles.statsContainer}>
        <View style={dynamicStyles.statCard}>
          <Text style={{ fontSize: 24 }}>📅</Text>
          <Text style={dynamicStyles.statLabel}>累计梦境</Text>
          <AnimatedNumber value={stats.totalDreams} index={0} />
        </View>
        <View style={dynamicStyles.statCard}>
          <Text style={{ fontSize: 24 }}>🏆</Text>
          <Text style={dynamicStyles.statLabel}>连续天数</Text>
          <AnimatedNumber value={stats.streakDays} index={1} />
        </View>
        <View style={dynamicStyles.statCard}>
          <Text style={{ fontSize: 24 }}>🎨</Text>
          <Text style={dynamicStyles.statLabel}>梦境作品</Text>
          <AnimatedNumber value={stats.totalCreations} index={2} />
        </View>
      </View>
    );
  };

  // 获取当前主题图标
  const getThemeIcon = () => {
    switch (themeMode) {
      case 'light':
        return '☀️';
      case 'dark':
        return '🌙';
      case 'system':
      default:
        return '📱';
    }
  };

  // 获取头像URL - 根据登录状态返回不同头像
  const getAvatarUrl = () => {
    // 未登录状态或匿名用户使用本地默认头像
    if (isAnonymous || !isAuthenticated) {
      return require('../../assets/images/default-avatar.png');
    }
    // 已登录但没有自定义头像，使用本地默认头像
    if (!user?.avatarUrl) {
      return require('../../assets/images/default-avatar.png');
    }
    // 使用用户自定义头像
    return { uri: user.avatarUrl };
  };

  // 获取昵称 - 根据登录状态返回不同昵称
  const getNickname = () => {
    if (isAnonymous) {
      return '梦境探索者'; // 匿名用户显示默认昵称
    }
    return user?.nickname || '梦境探索者';
  };

  // 获取用户描述/手机号展示 - 根据登录状态返回不同内容
  const getUserDescription = () => {
    if (isAnonymous) {
      return null; // 匿名用户返回null，由UI层处理显示登录按钮
    }
    // 已登录用户显示手机号（中间替换为*）
    if (user?.phone) {
      return user.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2');
    }
    return '已登录用户';
  };

  // 格式化订阅到期日期
  const formatSubscriptionExpiry = (expiresAt?: string) => {
    if (!expiresAt) return '';
    const date = new Date(expiresAt);
    return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`;
  };

  // 动态样式
  const dynamicStyles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    // 顶部导航栏样式
    headerNav: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 8,
      backgroundColor: colors.card,
    },
    themeButton: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    themeButtonIcon: {
      fontSize: 18,
    },
    userSection: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 20,
      paddingTop: 8,
      backgroundColor: colors.card,
    },
    avatarContainer: {
      position: 'relative',
      marginRight: 16,
    },
    avatar: {
      width: 72,
      height: 72,
      borderRadius: 36,
      borderWidth: 3,
      borderColor: colors.primary,
    },
    avatarLoading: {
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    avatarEditBadge: {
      position: 'absolute',
      bottom: 0,
      right: 0,
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: colors.primary,
      justifyContent: 'center',
      alignItems: 'center',
      borderWidth: 2,
      borderColor: colors.background,
    },
    avatarEditText: {
      fontSize: 14,
    },
    skeletonText: {
      height: 24,
      width: 100,
      backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
      borderRadius: 4,
    },
    streakBadge: {
      position: 'absolute',
      top: -4,
      right: -4,
      backgroundColor: colors.warning,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 4,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
    },
    streakBadgeText: {
      fontSize: 12,
      fontWeight: 'bold',
      color: colors.text,
    },
    userInfo: {
      flex: 1,
    },
    nickname: {
      fontSize: 24,
      fontWeight: '600',
      color: colors.text,
      marginBottom: 4,
    },
    userDescription: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 8,
    },
    // 登录按钮样式 - 未登录状态
    loginButton: {
      backgroundColor: colors.primary,
      borderRadius: 16,
      paddingHorizontal: 20,
      paddingVertical: 8,
      alignSelf: 'flex-start',
      marginTop: 8,
      marginBottom: 4,
    },
    loginButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: '#fff',
    },
    // 订阅按钮样式 - 登录未订阅状态
    subscribeButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.1)',
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      alignSelf: 'flex-start',
      marginTop: 8,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: '#f59e0b',
    },
    subscribeButtonText: {
      fontSize: 12,
      fontWeight: '600',
      color: '#f59e0b',
    },
    // 订阅徽章样式 - 登录已订阅状态
    subscriptionBadge: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
      alignSelf: 'flex-start',
      marginTop: 8,
      marginBottom: 4,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    subscriptionText: {
      fontSize: 12,
      fontWeight: '500',
      color: colors.primary,
    },
    statsContainer: {
      flexDirection: 'row',
      justifyContent: 'space-around',
      paddingHorizontal: 20,
      paddingVertical: 20,
      gap: 12,
    },
    statCard: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 8,
      marginBottom: 4,
    },
    statNumber: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
    },
    menuSection: {
      marginHorizontal: 20,
      backgroundColor: colors.card,
      borderRadius: 12,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      marginTop: 20,
    },
    menuItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: colors.divider,
    },
    menuIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 16,
    },
    menuContent: {
      flex: 1,
    },
    menuTitle: {
      fontSize: 16,
      fontWeight: '500',
      color: colors.text,
      marginBottom: 2,
    },
    menuDescription: {
      fontSize: 12,
      color: colors.textLight,
    },
    menuArrow: {
      fontSize: 20,
      color: colors.textLight,
    },
    logoutButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 20,
      marginVertical: 24,
      paddingVertical: 16,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.error,
    },
    logoutButtonDisabled: {
      opacity: 0.7,
    },
    logoutText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.error,
      marginLeft: 8,
    },
    // 大登录按钮样式 - 未登录状态
    loginButtonLarge: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      marginHorizontal: 20,
      marginVertical: 24,
      paddingVertical: 16,
      backgroundColor: colors.primary,
      borderRadius: 12,
      gap: 8,
    },
    loginButtonLargeText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
      marginLeft: 8,
    },
    version: {
      textAlign: 'center',
      fontSize: 12,
      color: colors.textLight,
      marginBottom: 20,
    },
    // Modal styles
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.7)',
      justifyContent: 'flex-end',
    },
    modalContent: {
      backgroundColor: colors.background,
      borderTopLeftRadius: 24,
      borderTopRightRadius: 24,
      padding: 24,
      maxHeight: '80%',
    },
    modalHeader: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: 20,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '600',
      color: colors.text,
    },
    modalClose: {
      fontSize: 20,
      color: colors.textSecondary,
      padding: 8,
    },
    modalLabel: {
      fontSize: 14,
      color: colors.textSecondary,
      marginBottom: 12,
      marginTop: 16,
    },
    modalInput: {
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      fontSize: 16,
      color: colors.text,
      borderWidth: 1,
      borderColor: colors.border,
    },
    genderSelector: {
      flexDirection: 'row',
      gap: 12,
    },
    genderOption: {
      flex: 1,
      backgroundColor: colors.card,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: colors.border,
    },
    genderOptionActive: {
      borderColor: colors.primary,
      backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
    },
    genderIcon: {
      fontSize: 28,
      marginBottom: 8,
    },
    genderText: {
      fontSize: 14,
      color: colors.text,
      fontWeight: '500',
    },
    saveButton: {
      backgroundColor: colors.primary,
      borderRadius: 12,
      padding: 16,
      alignItems: 'center',
      marginTop: 24,
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#fff',
    },
  });

  return (
    <SafeAreaView style={dynamicStyles.container}>
      <ScrollView style={dynamicStyles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 顶部导航栏 - 主题设置快捷入口 */}
        <View style={dynamicStyles.headerNav}>
          <TouchableOpacity
            style={dynamicStyles.themeButton}
            onPress={() => navigation.navigate('ThemeSettings')}
            activeOpacity={0.7}
          >
            <Text style={dynamicStyles.themeButtonIcon}>{getThemeIcon()}</Text>
          </TouchableOpacity>
        </View>

        {/* User Info */}
        <View style={dynamicStyles.userSection}>
          <TouchableOpacity onPress={handleChangeAvatar} activeOpacity={0.8}>
            <Animated.View
              style={[
                dynamicStyles.avatarContainer,
                {
                  transform: [{ scale: avatarAnimation }],
                },
              ]}
            >
              {userLoading ? (
                <View style={[dynamicStyles.avatar, dynamicStyles.avatarLoading]}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : (
                <Image
                  source={getAvatarUrl()}
                  style={dynamicStyles.avatar}
                />
              )}
              {isAuthenticated && (
                <View style={dynamicStyles.avatarEditBadge}>
                  <Text style={dynamicStyles.avatarEditText}>📷</Text>
                </View>
              )}
              {stats.streakDays > 0 && (
                <View style={dynamicStyles.streakBadge}>
                  <Text style={{ fontSize: 12 }}>🔥</Text>
                  <Text style={dynamicStyles.streakBadgeText}>{stats.streakDays}天</Text>
                </View>
              )}
            </Animated.View>
          </TouchableOpacity>
          
          <View style={dynamicStyles.userInfo}>
            {userLoading ? (
              <>
                <View style={dynamicStyles.skeletonText} />
                <View style={[dynamicStyles.skeletonText, { width: 120, marginTop: 8 }]} />
              </>
            ) : (
              <>
                {/* 昵称 - 已登录可点击编辑 */}
                <TouchableOpacity 
                  onPress={isAuthenticated ? handleEditProfile : undefined}
                  activeOpacity={isAuthenticated ? 0.7 : 1}
                >
                  <Text style={dynamicStyles.nickname}>{getNickname()}</Text>
                </TouchableOpacity>
                
                {/* 手机号/登录按钮区域 */}
                {!isAnonymous ? (
                  // 真实登录状态 - 显示手机号和订阅信息
                  <>
                    <Text style={dynamicStyles.userDescription}>{getUserDescription()}</Text>
                    {/* 订阅状态展示 */}
                    {subscriptionStatus.isActive ? (
                      // 已订阅用户 - 显示到期日期
                      <View style={dynamicStyles.subscriptionBadge}>
                        <Text style={{ fontSize: 12 }}>👑</Text>
                        <Text style={dynamicStyles.subscriptionText}>
                          会员有效期至 {formatSubscriptionExpiry(subscriptionStatus.expiresAt)}
                        </Text>
                      </View>
                    ) : (
                      // 未订阅用户 - 显示订阅按钮
                      <TouchableOpacity
                        style={dynamicStyles.subscribeButton}
                        onPress={() => navigation.navigate('Subscription')}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 12 }}>⭐</Text>
                        <Text style={dynamicStyles.subscribeButtonText}>订阅会员</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : (
                  // 匿名用户状态 - 显示登录按钮
                  <TouchableOpacity
                    style={dynamicStyles.loginButton}
                    onPress={() => navigation.navigate('Auth')}
                    activeOpacity={0.8}
                  >
                    <Text style={dynamicStyles.loginButtonText}>登录</Text>
                  </TouchableOpacity>
                )}
              </>
            )}
            
          </View>
        </View>

        {/* Stats */}
        {renderStats()}

        {/* Menu */}
        <View style={dynamicStyles.menuSection}>
          {menuItems.map((item, index) => (
            <TouchableOpacity
              key={index}
              style={dynamicStyles.menuItem}
              activeOpacity={0.7}
              onPress={item.onPress}
            >
              <View style={dynamicStyles.menuIcon}>
                <Text style={{ fontSize: 24 }}>{item.icon}</Text>
              </View>
              <View style={dynamicStyles.menuContent}>
                <Text style={dynamicStyles.menuTitle}>{item.title}</Text>
                <Text style={dynamicStyles.menuDescription}>{item.description}</Text>
              </View>
              <Text style={dynamicStyles.menuArrow}>›</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 登录/退出登录按钮 */}
        {!isAnonymous ? (
          // 真实登录状态 - 显示退出登录按钮
          <TouchableOpacity
            style={[dynamicStyles.logoutButton, logoutLoading && dynamicStyles.logoutButtonDisabled]}
            onPress={handleLogout}
            disabled={logoutLoading}
          >
            {logoutLoading ? (
              <ActivityIndicator size="small" color={colors.error} />
            ) : (
              <>
                <Text style={{ fontSize: 20 }}>🚪</Text>
                <Text style={dynamicStyles.logoutText}>退出登录</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          // 匿名用户状态 - 显示登录按钮
          <TouchableOpacity
            style={dynamicStyles.loginButtonLarge}
            onPress={() => navigation.navigate('Auth')}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 20 }}>🔑</Text>
            <Text style={dynamicStyles.loginButtonLargeText}>登录</Text>
          </TouchableOpacity>
        )}

        {/* Version */}
        <Text style={dynamicStyles.version}>版本 1.0.0</Text>
      </ScrollView>

      {/* Edit Profile Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={editModalVisible}
        onRequestClose={() => setEditModalVisible(false)}
      >
        <View style={dynamicStyles.modalOverlay}>
          <View style={dynamicStyles.modalContent}>
            <View style={dynamicStyles.modalHeader}>
              <Text style={dynamicStyles.modalTitle}>编辑资料</Text>
              <TouchableOpacity onPress={() => setEditModalVisible(false)}>
                <Text style={dynamicStyles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={dynamicStyles.modalLabel}>昵称</Text>
            <TextInput
              style={dynamicStyles.modalInput}
              value={editNickname}
              onChangeText={setEditNickname}
              placeholder="输入昵称"
              placeholderTextColor={colors.textDisabled}
            />

            <Text style={dynamicStyles.modalLabel}>性别</Text>
            <View style={dynamicStyles.genderSelector}>
              <TouchableOpacity
                style={[
                  dynamicStyles.genderOption,
                  editGender === 'male' && dynamicStyles.genderOptionActive
                ]}
                onPress={() => setEditGender('male')}
              >
                <Text style={dynamicStyles.genderIcon}>👨</Text>
                <Text style={dynamicStyles.genderText}>男</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.genderOption,
                  editGender === 'female' && dynamicStyles.genderOptionActive
                ]}
                onPress={() => setEditGender('female')}
              >
                <Text style={dynamicStyles.genderIcon}>👩</Text>
                <Text style={dynamicStyles.genderText}>女</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  dynamicStyles.genderOption,
                  editGender === 'other' && dynamicStyles.genderOptionActive
                ]}
                onPress={() => setEditGender('other')}
              >
                <Text style={dynamicStyles.genderIcon}>🤔</Text>
                <Text style={dynamicStyles.genderText}>保密</Text>
              </TouchableOpacity>
            </View>

            <Text style={dynamicStyles.modalLabel}>年龄</Text>
            <TextInput
              style={dynamicStyles.modalInput}
              value={editAge}
              onChangeText={setEditAge}
              placeholder="输入年龄"
              placeholderTextColor={colors.textDisabled}
              keyboardType="number-pad"
            />

            <TouchableOpacity
              style={dynamicStyles.saveButton}
              onPress={handleSaveProfile}
            >
              <Text style={dynamicStyles.saveButtonText}>保存</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
};
