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
  Dimensions,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Button } from '../components/Button';
import { BackButton } from '../components/BackButton';
import { QuotaDisplay, QUOTA_CONFIG, UserTier } from '../components/QuotaDisplay';
import { GenerationProgress } from '../components/GenerationProgress';
import { useTheme } from '../theme/themeContext';
import { Dream } from '../types';
import { creationStorageService, CreationItem } from '../services/CreationStorageService';
import { generateInterpretation } from '../services/api/aiService';
import { audioApi, DreamAudioInfo } from '../services/api/audioApi';
import { authApi } from '../services/api/authApi';
import {
  startImageGeneration,
  startVideoGeneration,
  startLongVideoGeneration,
  startPollingProgress,
  stopAllPolling,
  TaskProgress,
} from '../services/generationTask.service';
import { Audio } from 'expo-av';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DreamDetailProps {
  navigation: any;
  route: any;
}

export const DreamDetail: React.FC<DreamDetailProps> = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const dream = route.params?.dream as Dream;

  // 添加动画值引用
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const titleAnim = useRef(new Animated.Value(50)).current;
  
  const [generatedContents, setGeneratedContents] = useState<CreationItem[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<'image' | 'video' | 'video_long' | 'interpretation' | null>(null);
  const [progress, setProgress] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState('写实');
  // 异步生成任务相关状态
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const stopPollingRef = useRef<(() => void) | null>(null);
  // 梦境解读相关状态
  const [interpretation, setInterpretation] = useState<string>('');
  const [interpretationData, setInterpretationData] = useState<{
    symbols: Array<{ symbol: string; meaning: string; context: string }>;
    emotions: { primary: string; intensity: number; description: string } | null;
    suggestions: string[];
    references: Array<{ id: string; title: string; source: string }>;
  }>({
    symbols: [],
    emotions: null,
    suggestions: [],
    references: [],
  });
  const [isLoadingInterpretation, setIsLoadingInterpretation] = useState(false);
  const [interpretationExpanded, setInterpretationExpanded] = useState(false);
  
  // 分享相关状态
  const [shareModalVisible, setShareModalVisible] = useState(false);
  const [sharePlatform, setSharePlatform] = useState<'wechat' | 'xiaohongshu' | null>(null);
  const [shareText, setShareText] = useState('');
  const [selectedCreations, setSelectedCreations] = useState<string[]>([]);

  // 音频相关状态
  const [dreamAudio, setDreamAudio] = useState<DreamAudioInfo | null>(null);
  const [isLoadingAudio, setIsLoadingAudio] = useState(false);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [audioPlayback, setAudioPlayback] = useState<Audio.Sound | null>(null);

  const artStyles = ['写实', '油画', '水彩', '赛博朋克', '国潮', '动漫'];

  // 计算当前梦境各类型的生成数量
  const getCreationCountByType = useCallback((type: 'image' | 'video' | 'video_long' | 'interpretation'): number => {
    switch (type) {
      case 'image':
        return generatedContents.filter(c => c.type === 'image').length;
      case 'video':
        return generatedContents.filter(c => c.type === 'video').length;
      case 'video_long':
        return generatedContents.filter(c => c.type === 'video_long').length;
      case 'interpretation':
        return generatedContents.filter(c => c.type === 'interpretation').length;
      default:
        return 0;
    }
  }, [generatedContents]);

  // 检查是否有生成额度
  const checkQuota = async (type: 'image' | 'video' | 'video_long' | 'interpretation'): Promise<{ canGenerate: boolean; message?: string }> => {
    const userInfo = await authApi.getUserInfo();
    const tier: UserTier = userInfo?.tier || 'guest';
    const config = QUOTA_CONFIG[tier];
    
    let typeConfig;
    let currentCount;
    
    switch (type) {
      case 'image':
        typeConfig = config.image;
        currentCount = getCreationCountByType('image');
        break;
      case 'video':
        typeConfig = config.video;
        currentCount = getCreationCountByType('video');
        break;
      case 'video_long':
        typeConfig = config.longVideo;
        currentCount = getCreationCountByType('video_long');
        break;
      case 'interpretation':
        typeConfig = config.interpretation;
        currentCount = getCreationCountByType('interpretation');
        break;
      default:
        return { canGenerate: false, message: '未知的生成类型' };
    }
    
    // 检查是否无限额度
    if (typeConfig.unlimited) {
      return { canGenerate: true };
    }
    
    // 检查额度是否用完
    if (currentCount >= typeConfig.limit) {
      const typeNames = {
        image: '图片',
        video: '视频',
        video_long: '长视频',
        interpretation: '解读'
      };
      
      if (tier === 'guest') {
        return {
          canGenerate: false,
          message: `访客每个梦境只能生成 ${typeConfig.limit} 个${typeNames[type]}，请登录后享受更多额度`
        };
      } else if (tier === 'registered') {
        return {
          canGenerate: false,
          message: `您已达到每个梦境 ${typeConfig.limit} 个${typeNames[type]}的限制，订阅会员可无限生成`
        };
      }
    }
    
    return { canGenerate: true };
  };

  // 加载该梦境的创作内容（按创建时间倒序排序）
  const loadCreations = useCallback(async () => {
    if (dream?.id) {
      console.log('【DreamDetail】加载梦境创作:', dream.id);
      const creations = await creationStorageService.getCreationsByDreamId(dream.id);
      console.log('【DreamDetail】加载到创作数量:', creations.length);
      // 按创建时间倒序排序（最新的在前）
      const sortedCreations = creations.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setGeneratedContents(sortedCreations);
      
      // 检查是否已有解读，恢复解读数据
      const existingInterpretation = sortedCreations.find(c => c.type === 'interpretation');
      if (existingInterpretation?.interpretation) {
        setInterpretation(existingInterpretation.interpretation);
        // 恢复完整的解读数据
        setInterpretationData({
          symbols: existingInterpretation.symbols || [],
          emotions: existingInterpretation.emotions 
            ? (Array.isArray(existingInterpretation.emotions) 
                ? existingInterpretation.emotions[0] 
                : existingInterpretation.emotions)
            : null,
          suggestions: existingInterpretation.suggestions || [],
          references: [], // 引用数据不保存在本地
        });
      }
    }
  }, [dream?.id]);

  useEffect(() => {
    loadCreations();
    loadDreamAudio();

    const unsubscribe = navigation.addListener('focus', () => {
      loadCreations();
      loadDreamAudio();
    });

    return () => {
      unsubscribe();
      // 组件卸载时停止所有轮询
      if (stopPollingRef.current) {
        stopPollingRef.current();
        stopPollingRef.current = null;
      }
      stopAllPolling();
      // 停止音频播放
      if (audioPlayback) {
        audioPlayback.unloadAsync();
      }
    };
  }, [navigation, loadCreations]);

  /**
   * 加载梦境关联的音频
   */
  const loadDreamAudio = async () => {
    if (!dream?.id) return;

    setIsLoadingAudio(true);
    try {
      const response = await audioApi.getDreamAudio(dream.id);
      if (response.code === 200 && response.data) {
        setDreamAudio(response.data);
      }
    } catch (error) {
      // 404表示没有音频，不显示错误
      console.log('【梦境详情】该梦境没有关联的音频');
    } finally {
      setIsLoadingAudio(false);
    }
  };

  /**
   * 播放/暂停音频
   */
  const handleToggleAudioPlayback = async () => {
    if (!dreamAudio?.url) return;

    try {
      if (isPlayingAudio && audioPlayback) {
        // 暂停播放
        await audioPlayback.pauseAsync();
        setIsPlayingAudio(false);
      } else {
        // 开始播放
        if (!audioPlayback) {
          // 首次播放，创建新的播放对象
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: false,
            playsInSilentModeIOS: true,
            staysActiveInBackground: true,
            shouldDuckAndroid: true,
          });

          const { sound } = await Audio.Sound.createAsync(
            { uri: dreamAudio.url },
            { shouldPlay: true }
          );

          setAudioPlayback(sound);

          // 监听播放完成事件
          sound.setOnPlaybackStatusUpdate((status) => {
            if (status.isLoaded && status.didJustFinish) {
              setIsPlayingAudio(false);
            }
          });
        } else {
          // 继续播放
          await audioPlayback.playAsync();
        }
        setIsPlayingAudio(true);
      }
    } catch (error) {
      console.error('【梦境详情】音频播放失败:', error);
      Alert.alert('播放失败', '音频播放失败，请重试');
    }
  };

  useEffect(() => {
    // 入场动画
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
      Animated.timing(titleAnim, {
        toValue: 0,
        duration: 600,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  // 生成梦境图片
  const handleGenerateImage = async () => {
    if (isGenerating) return;
    
    // 检查额度
    const quotaCheck = await checkQuota('image');
    if (!quotaCheck.canGenerate) {
      Alert.alert(
        '额度不足',
        quotaCheck.message,
        [
          { text: '取消', style: 'cancel' },
          { text: '去升级', onPress: () => navigation.navigate('Subscription') }
        ]
      );
      return;
    }
    
    setIsGenerating(true);
    setGeneratingType('image');
    setProgress(0);
    setShowProgress(true);
    
    try {
      // 启动图片生成任务
      const taskId = await startImageGeneration({
        dreamId: dream.id,
        dreamContent: dream.content,
        style: selectedStyle,
      });
      
      console.log('【DreamDetail】图片生成任务已启动:', taskId);
      
      // 开始轮询进度
      const stopPolling = startPollingProgress({
        taskId,
        onProgress: (progressData) => {
          setTaskProgress(progressData);
          // 更新进度条
          if (progressData.status === 'processing') {
            setProgress(progressData.progress || 0);
          }
        },
        onComplete: (result) => {
          console.log('【DreamDetail】图片生成完成:', result);
          setIsGenerating(false);
          setGeneratingType(null);
          setShowProgress(false);
          setProgress(100);
          // 刷新创作列表
          loadCreations();
        },
        onError: (error) => {
          console.error('【DreamDetail】图片生成失败:', error);
          setIsGenerating(false);
          setGeneratingType(null);
          setShowProgress(false);
          Alert.alert('生成失败', error.message || '图片生成失败，请重试');
        },
      });
      
      // 保存停止轮询的函数
      stopPollingRef.current = stopPolling;
      
    } catch (error) {
      console.error('【DreamDetail】启动图片生成失败:', error);
      setIsGenerating(false);
      setGeneratingType(null);
      setShowProgress(false);
      Alert.alert('生成失败', '启动图片生成失败，请重试');
    }
  };

  // 生成梦境视频
  const handleGenerateVideo = async () => {
    if (isGenerating) return;
    
    // 检查额度
    const quotaCheck = await checkQuota('video');
    if (!quotaCheck.canGenerate) {
      Alert.alert(
        '额度不足',
        quotaCheck.message,
        [
          { text: '取消', style: 'cancel' },
          { text: '去升级', onPress: () => navigation.navigate('Subscription') }
        ]
      );
      return;
    }
    
    setIsGenerating(true);
    setGeneratingType('video');
    setProgress(0);
    setShowProgress(true);
    
    try {
      // 启动视频生成任务
      const taskId = await startVideoGeneration({
        dreamId: dream.id,
        dreamContent: dream.content,
        style: selectedStyle,
      });
      
      console.log('【DreamDetail】视频生成任务已启动:', taskId);
      
      // 开始轮询进度
      const stopPolling = startPollingProgress({
        taskId,
        onProgress: (progressData) => {
          setTaskProgress(progressData);
          if (progressData.status === 'processing') {
            setProgress(progressData.progress || 0);
          }
        },
        onComplete: (result) => {
          console.log('【DreamDetail】视频生成完成:', result);
          setIsGenerating(false);
          setGeneratingType(null);
          setShowProgress(false);
          setProgress(100);
          loadCreations();
        },
        onError: (error) => {
          console.error('【DreamDetail】视频生成失败:', error);
          setIsGenerating(false);
          setGeneratingType(null);
          setShowProgress(false);
          Alert.alert('生成失败', error.message || '视频生成失败，请重试');
        },
      });
      
      stopPollingRef.current = stopPolling;
      
    } catch (error) {
      console.error('【DreamDetail】启动视频生成失败:', error);
      setIsGenerating(false);
      setGeneratingType(null);
      setShowProgress(false);
      Alert.alert('生成失败', '启动视频生成失败，请重试');
    }
  };

  // 生成梦境长视频（剧情）
  const handleGenerateLongVideo = async () => {
    if (isGenerating) return;
    
    // 检查额度
    const quotaCheck = await checkQuota('video_long');
    if (!quotaCheck.canGenerate) {
      Alert.alert(
        '额度不足',
        quotaCheck.message,
        [
          { text: '取消', style: 'cancel' },
          { text: '去升级', onPress: () => navigation.navigate('Subscription') }
        ]
      );
      return;
    }
    
    setIsGenerating(true);
    setGeneratingType('video_long');
    setProgress(0);
    setShowProgress(true);
    
    try {
      // 启动长视频生成任务
      const taskId = await startLongVideoGeneration({
        dreamId: dream.id,
        dreamContent: dream.content,
        style: selectedStyle,
      });
      
      console.log('【DreamDetail】长视频生成任务已启动:', taskId);
      
      // 开始轮询进度
      const stopPolling = startPollingProgress({
        taskId,
        onProgress: (progressData) => {
          setTaskProgress(progressData);
          if (progressData.status === 'processing') {
            setProgress(progressData.progress || 0);
          }
        },
        onComplete: (result) => {
          console.log('【DreamDetail】长视频生成完成:', result);
          setIsGenerating(false);
          setGeneratingType(null);
          setShowProgress(false);
          setProgress(100);
          loadCreations();
        },
        onError: (error) => {
          console.error('【DreamDetail】长视频生成失败:', error);
          setIsGenerating(false);
          setGeneratingType(null);
          setShowProgress(false);
          Alert.alert('生成失败', error.message || '长视频生成失败，请重试');
        },
      });
      
      stopPollingRef.current = stopPolling;
      
    } catch (error) {
      console.error('【DreamDetail】启动长视频生成失败:', error);
      setIsGenerating(false);
      setGeneratingType(null);
      setShowProgress(false);
      Alert.alert('生成失败', '启动长视频生成失败，请重试');
    }
  };

  // 生成梦境解读
  const handleGenerateInterpretation = async () => {
    if (isGenerating) return;
    
    // 如果已经存在解读且已展开，则收起
    if (interpretation && interpretationExpanded) {
      setInterpretationExpanded(false);
      return;
    }
    
    // 如果已经存在解读但未展开，则展开
    if (interpretation && !interpretationExpanded) {
      setInterpretationExpanded(true);
      return;
    }
    
    // 检查额度
    const quotaCheck = await checkQuota('interpretation');
    if (!quotaCheck.canGenerate) {
      Alert.alert(
        '额度不足',
        quotaCheck.message,
        [
          { text: '取消', style: 'cancel' },
          { text: '去升级', onPress: () => navigation.navigate('Subscription') }
        ]
      );
      return;
    }
    
    setIsGenerating(true);
    setGeneratingType('interpretation');
    setShowProgress(true);
    setProgress(0);
    
    // 模拟进度增长
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.random() * 15 + 5; // 每次增加5-20%
      if (currentProgress >= 90) {
        currentProgress = 90; // 最多到90%，等待实际完成
      }
      setProgress(Math.floor(currentProgress));
    }, 800);
    
    try {
      const response = await generateInterpretation({
        dreamId: dream.id,
        dreamContent: dream.content,
        dreamTitle: dream.title,
      });
      
      // 清除进度定时器
      clearInterval(progressInterval);
      
      if (response.success && response.data.interpretation) {
        const data = response.data;
        
        // 进度达到100%
        setProgress(100);
        
        // 延迟关闭进度弹框，让用户看到100%
        setTimeout(async () => {
          setShowProgress(false);
          setIsGenerating(false);
          setGeneratingType(null);
          
          // 设置解读数据
          setInterpretation(data.interpretation);
          setInterpretationData({
            symbols: data.symbols || [],
            emotions: data.emotions || null,
            suggestions: data.suggestions || [],
            references: data.references || [],
          });
          
          // 保存解读到创作列表
          const interpretationItem: CreationItem = {
            id: `interpretation_${Date.now()}`,
            type: 'interpretation',
            title: `${dream.title} - 梦境解读`,
            dreamTitle: dream.title,
            dreamId: dream.id,
            interpretation: data.interpretation,
            symbols: data.symbols,
            emotions: data.emotions,
            suggestions: data.suggestions,
            createdAt: new Date().toISOString(),
          };
          
          await creationStorageService.saveCreation(interpretationItem);
          
          // 重新加载创作列表（在梦境作品中显示）
          await loadCreations();
          
          // 自动展开解读区域显示结果
          setInterpretationExpanded(true);
          
          // 滚动到解读区域
          setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
          }, 300);
        }, 500);
      } else {
        throw new Error(response.message || '解读生成失败');
      }
    } catch (error) {
      // 清除进度定时器
      clearInterval(progressInterval);
      
      console.error('生成解读失败:', error);
      setShowProgress(false);
      setIsGenerating(false);
      setGeneratingType(null);
      
      // 显示明确的失败提示
      Alert.alert(
        '解读生成失败',
        '梦境解读生成失败，请检查网络连接后重试。',
        [{ text: '确定' }]
      );
    }
  };

  // 查看创作详情
  const handleViewCreation = (content: CreationItem) => {
    switch (content.type) {
      case 'image':
        navigation.navigate('ImageViewer', {
          imageUrl: content.imageUrl || content.thumbnail,
          title: content.title,
        });
        break;
      case 'video':
      case 'video_long':
        if (content.videoUrl) {
          navigation.navigate('VideoPlayer', {
            videoUrl: content.videoUrl,
            coverUrl: content.coverUrl,
            title: content.title 
          });
        } else {
          navigation.navigate('ScriptToVideo', { dream });
        }
        break;
      case 'script':
        if (content.script) {
          navigation.navigate('ScriptViewer', {
            script: content.script,
          });
        }
        break;
      case 'interpretation':
        // 显示解读详情 - 点击卡片展开解读区域
        console.log('【DreamDetail】点击梦境解读:', content.id, 'interpretation:', content.interpretation);
        console.log('【DreamDetail】完整的content数据:', JSON.stringify(content, null, 2));
        console.log('【DreamDetail】当前interpretation状态:', interpretation);
        console.log('【DreamDetail】当前interpretationExpanded状态:', interpretationExpanded);
        // 设置解读内容（如果有）
        if (content.interpretation) {
          console.log('【DreamDetail】设置interpretation:', content.interpretation.substring(0, 50) + '...');
          setInterpretation(content.interpretation);
        } else {
          console.log('【DreamDetail】警告: content.interpretation为空');
        }
        // 恢复完整的解读数据
        setInterpretationData({
          symbols: content.symbols || [],
          emotions: content.emotions
            ? (Array.isArray(content.emotions) ? content.emotions[0] : content.emotions)
            : null,
          suggestions: content.suggestions || [],
          references: [], // 引用数据不保存在本地
        });
        // 展开解读区域 - 无论是否有数据都展开
        setInterpretationExpanded(true);
        console.log('【DreamDetail】已设置interpretationExpanded为true');
        
        // 延迟滚动到解读区域
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 300);
        break;
    }
  };

  const handleViewAllCreations = () => {
    navigation.navigate('CreationCenter', { dreamId: dream.id });
  };

  // 打开分享弹窗
  const handleOpenShare = () => {
    setShareText(`我做了一个梦：${dream.title}\n\n${dream.content.substring(0, 100)}...`);
    setSelectedCreations([]);
    setShareModalVisible(true);
  };

  // 选择/取消选择创作
  const toggleCreationSelection = (creationId: string) => {
    setSelectedCreations(prev => 
      prev.includes(creationId) 
        ? prev.filter(id => id !== creationId)
        : [...prev, creationId]
    );
  };

  // 执行分享
  const handleShare = () => {
    if (!sharePlatform) {
      Alert.alert('提示', '请选择分享平台');
      return;
    }

    // 模拟分享成功
    setTimeout(() => {
      setShareModalVisible(false);
      Alert.alert(
        '分享成功（模拟）',
        `已分享到${sharePlatform === 'wechat' ? '朋友圈' : '小红书'}`,
        [{ text: '确定' }]
      );
    }, 500);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'image': return '🖼️';
      case 'script': return '📝';
      case 'video': return '🎬';
      case 'video_long': return '🎥';
      case 'interpretation': return '🔮';
      default: return '🎨';
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'image': return '画作';
      case 'script': return '剧本';
      case 'video': return '短视频';
      case 'video_long': return '长视频';
      case 'interpretation': return '解读';
      default: return '创作';
    }
  };

  const latestCreations = generatedContents.slice(0, 2);

  const renderMoodEmoji = (rating: number) => {
    const emojis = ['😢', '😕', '😐', '😊', '😁'];
    return emojis[rating - 1];
  };

  /**
   * 格式化时长显示
   * @param seconds 秒数
   * @returns 格式化后的时间字符串
   */
  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <Animated.View 
        style={[
          styles.header,
          { opacity: fadeAnim }
        ]}
      >
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 24, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>梦境详情</Text>
        <TouchableOpacity
          style={styles.shareButton}
          onPress={handleOpenShare}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 20 }}>📤</Text>
        </TouchableOpacity>
      </Animated.View>

      <Animated.ScrollView 
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Dream Content */}
        <Animated.View 
          style={[
            styles.dreamCard,
            { 
              opacity: fadeAnim,
              transform: [{ translateY: titleAnim }]
            }
          ]}
        >
          <View style={styles.dreamHeader}>
            <Text style={styles.dreamTitle}>{dream.title}</Text>
            <View style={styles.moodBadge}>
              <Text style={styles.moodEmoji}>{renderMoodEmoji(dream.moodRating)}</Text>
              <Text style={styles.moodText}>情绪评分 {dream.moodRating}</Text>
            </View>
          </View>

          <Text style={styles.dreamDate}>{dream.dreamDate}</Text>
          
          {/* 情绪感受 */}
          {(dream.emotions?.length || 0) > 0 && (
            <View style={styles.emotionsSection}>
              <Text style={styles.sectionLabel}>情绪感受</Text>
              <View style={styles.emotionsContainer}>
                {dream.emotions?.map((emotion) => (
                  <View key={emotion} style={styles.emotionTag}>
                    <Text style={styles.emotionTagText}>{emotion}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={styles.contentSection}>
            <Text style={styles.sectionLabel}>梦境内容</Text>
            <Text style={styles.dreamContent}>{dream.content}</Text>
          </View>

          {/* 音频播放器 - 如果有音频 */}
          {dreamAudio && (
            <View style={styles.audioSection}>
              <Text style={styles.sectionLabel}>录音回放</Text>
              <TouchableOpacity
                style={[
                  styles.audioPlayer,
                  { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)' }
                ]}
                onPress={handleToggleAudioPlayback}
                activeOpacity={0.8}
              >
                <View style={[styles.audioPlayButton, { backgroundColor: colors.primary }]}>
                  <Text style={styles.audioPlayIcon}>
                    {isPlayingAudio ? '⏸️' : '▶️'}
                  </Text>
                </View>
                <View style={styles.audioInfo}>
                  <Text style={[styles.audioTitle, { color: colors.text }]}>
                    梦境录音
                  </Text>
                  <Text style={[styles.audioDuration, { color: colors.textSecondary }]}>
                    {dreamAudio.duration ? formatDuration(dreamAudio.duration) : '未知时长'}
                  </Text>
                </View>
                <View style={styles.audioWaveform}>
                  <Text style={{ fontSize: 20 }}>🎵</Text>
                </View>
              </TouchableOpacity>
            </View>
          )}

          {/* 自定义标签 */}
          {(dream.tags?.length || 0) > 0 && (
            <View style={styles.tagsSection}>
              <Text style={styles.sectionLabel}>自定义标签</Text>
              <View style={styles.tagsContainer}>
                {dream.tags?.map((tag) => (
                  <View key={tag} style={styles.tag}>
                    <Text style={styles.tagText}>{tag}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}
        </Animated.View>

        {/* Quick Actions - 四个快捷功能 */}
        <Animated.View style={[styles.quickActionsSection, { opacity: fadeAnim }]}>
          <Text style={styles.sectionTitle}>✨ AI创作</Text>

          {/* 艺术风格选择器 */}
          <View style={styles.styleSelector}>
            <Text style={[styles.styleLabel, { color: colors.textSecondary }]}>艺术风格</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {artStyles.map((style) => (
                <TouchableOpacity
                  key={style}
                  style={[
                    styles.styleButton,
                    { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)', borderColor: colors.border },
                    selectedStyle === style && [styles.activeStyle, { backgroundColor: colors.primary, borderColor: colors.primary }]
                  ]}
                  onPress={() => setSelectedStyle(style)}
                  activeOpacity={0.7}
                >
                  <Text style={[
                    styles.styleText,
                    { color: colors.textLight },
                    selectedStyle === style && styles.activeStyleText
                  ]}>
                    {style}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <View style={styles.quickActionsGrid}>
            {/* 梦生图片按钮 */}
            <TouchableOpacity
              style={[
                styles.quickActionButton,
                isGenerating && styles.quickActionButtonDisabled,
                generatingType === 'image' && styles.quickActionButtonActive
              ]}
              onPress={handleGenerateImage}
              disabled={isGenerating}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                <Text style={{ fontSize: 24 }}>🖼️</Text>
              </View>
              <Text style={styles.quickActionTitle}>梦生图片</Text>
              {/* 额度显示 - 传入当前梦境已生成的图片数量 */}
              {!isGenerating && (
                <View style={styles.quotaBadge}>
                  <QuotaDisplay 
                    type="image" 
                    compact 
                    dreamId={dream?.id}
                    currentCount={getCreationCountByType('image')}
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* 梦生视频按钮 */}
            <TouchableOpacity
              style={[
                styles.quickActionButton, 
                isGenerating && styles.quickActionButtonDisabled,
                generatingType === 'video' && styles.quickActionButtonActive
              ]}
              onPress={handleGenerateVideo}
              disabled={isGenerating}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                <Text style={{ fontSize: 24 }}>🎬</Text>
              </View>
              <Text style={styles.quickActionTitle}>梦生视频</Text>
              {/* 额度显示 - 传入当前梦境已生成的视频数量 */}
              {!isGenerating && (
                <View style={styles.quotaBadge}>
                  <QuotaDisplay 
                    type="video" 
                    compact 
                    dreamId={dream?.id}
                    currentCount={getCreationCountByType('video')}
                  />
                </View>
              )}
            </TouchableOpacity>

            {/* 梦境剧情按钮 */}
            <TouchableOpacity
              style={[
                styles.quickActionButton, 
                isGenerating && styles.quickActionButtonDisabled,
                generatingType === 'video_long' && styles.quickActionButtonActive
              ]}
              onPress={handleGenerateLongVideo}
              disabled={isGenerating}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)' }]}>
                <Text style={{ fontSize: 24 }}>🎥</Text>
              </View>
              <Text style={styles.quickActionTitle}>梦境剧情</Text>
              {/* 额度显示 - 传入当前梦境已生成的长视频数量 */}
              {!isGenerating && (
                <View style={styles.quotaBadge}>
                  <QuotaDisplay 
                    type="longVideo" 
                    compact 
                    dreamId={dream?.id}
                    currentCount={getCreationCountByType('video_long')}
                  />
                </View>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.quickActionButton, isGenerating && styles.quickActionButtonDisabled]}
              onPress={handleGenerateInterpretation}
              disabled={isGenerating}
              activeOpacity={0.8}
            >
              <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                <Text style={{ fontSize: 24 }}>🔮</Text>
              </View>
              <Text style={styles.quickActionTitle}>梦境解读</Text>
              {/* 额度显示 - 传入当前梦境已生成的解读数量 */}
              {!isGenerating && (
                <View style={styles.quotaBadge}>
                  <QuotaDisplay 
                    type="interpretation" 
                    compact 
                    dreamId={dream?.id}
                    currentCount={getCreationCountByType('interpretation')}
                  />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </Animated.View>

        {/* Generated Content Section - 梦境作品 */}
        <Animated.View 
          style={[
            styles.generatedSection,
            { opacity: fadeAnim }
          ]}
        >
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>🎨 梦境作品</Text>
            {generatedContents.length > 0 && (
              <TouchableOpacity onPress={handleViewAllCreations}>
                <Text style={styles.viewAllText}>查看全部 →</Text>
              </TouchableOpacity>
            )}
          </View>
          
          {generatedContents.length > 0 ? (
            <View>
              <View style={styles.generatedScroll}>
                {latestCreations.map((content) => (
                  <TouchableOpacity
                    key={content.id}
                    style={styles.generatedCard}
                    onPress={() => handleViewCreation(content)}
                    activeOpacity={0.8}
                  >
                    {content.thumbnail ? (
                      <View style={styles.thumbnailContainer}>
                        <Image
                          source={{ uri: content.thumbnail, cache: 'reload' }}
                          style={styles.generatedThumbnail}
                          resizeMode="cover"
                          onError={(e) => {
                            // 只在非阿里云OSS域名错误时输出日志
                            const errorMsg = e.nativeEvent?.error || '';
                            if (!errorMsg.includes('403') && !errorMsg.includes('404')) {
                              console.warn('【DreamDetail】图片加载失败，将在后台重试:', content.thumbnail?.substring(0, 50));
                            }
                          }}
                        />
                        {/* 视频类型显示播放按钮 */}
                        {(content.type === 'video' || content.type === 'video_long') && (
                          <View style={styles.playButtonOverlay}>
                            <View style={styles.playButton}>
                              <Text style={styles.playButtonIcon}>▶</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    ) : content.type === 'interpretation' ? (
                      // 梦境解读专用温馨封面 - 使用View而不是TouchableOpacity，因为外层卡片已经处理点击
                      <View style={styles.thumbnailContainer}>
                        <View
                          style={[
                            styles.interpretationCover,
                            { backgroundColor: isDark ? '#2D1B4E' : '#F8F4FF' }
                          ]}
                        >
                          {/* 装饰性星星 */}
                          <View style={styles.interpretationStars} pointerEvents="none">
                            <Text style={[styles.starIcon, { top: 10, left: 20, fontSize: 12 }]}>✨</Text>
                            <Text style={[styles.starIcon, { top: 30, right: 25, fontSize: 16 }]}>⭐</Text>
                            <Text style={[styles.starIcon, { bottom: 25, left: 30, fontSize: 14 }]}>✨</Text>
                            <Text style={[styles.starIcon, { bottom: 15, right: 20, fontSize: 10 }]}>⭐</Text>
                          </View>
                          {/* 水晶球图标 */}
                          <View 
                            style={[
                              styles.crystalBallContainer,
                              { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.3)' : 'rgba(139, 92, 246, 0.15)' }
                            ]}
                            pointerEvents="none"
                          >
                            <Text style={styles.crystalBallIcon}>🔮</Text>
                          </View>
                          {/* 底部装饰线 */}
                          <View 
                            style={[
                              styles.interpretationDecorativeLine,
                              { backgroundColor: isDark ? 'rgba(167, 139, 250, 0.5)' : 'rgba(139, 92, 246, 0.3)' }
                            ]}
                            pointerEvents="none"
                          />
                        </View>
                      </View>
                    ) : (
                      <View style={styles.generatedPlaceholder}>
                        <Text style={styles.generatedIcon}>{getTypeIcon(content.type)}</Text>
                        {/* 视频类型显示播放按钮 */}
                        {(content.type === 'video' || content.type === 'video_long') && (
                          <View style={styles.playButtonOverlay}>
                            <View style={styles.playButton}>
                              <Text style={styles.playButtonIcon}>▶</Text>
                            </View>
                          </View>
                        )}
                      </View>
                    )}
                    <View style={styles.generatedInfo}>
                      <Text style={styles.generatedType}>{getTypeLabel(content.type)}</Text>
                      <Text style={styles.generatedTitle} numberOfLines={1}>{content.title}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.emptyCreations}>
              {/* 装饰性背景光晕 */}
              <View style={styles.emptyStateGlow1} />
              <View style={styles.emptyStateGlow2} />
              
              <View style={styles.emptyIconContainer}>
                <Text style={styles.emptyIcon}>🎨</Text>
              </View>
              <Text style={styles.emptyTitle}>还没有创作</Text>
              <Text style={styles.emptySubtitle}>点击上方按钮，用AI创作你的梦境作品</Text>
            </View>
          )}
        </Animated.View>

        {/* 梦境解读区域 */}
        {(interpretation || isGenerating || interpretationExpanded) && (
          <Animated.View 
            style={[
              styles.interpretationCard,
              { opacity: fadeAnim }
            ]}
          >
            <TouchableOpacity 
              style={styles.interpretationHeader}
              onPress={() => setInterpretationExpanded(!interpretationExpanded)}
              activeOpacity={0.8}
            >
              <Text style={styles.cardTitle}>🔮 梦境解读</Text>
              <Text style={styles.expandIcon}>{interpretationExpanded ? '▼' : '▶'}</Text>
            </TouchableOpacity>
            
            {isGenerating && generatingType === 'interpretation' ? (
              <View style={styles.generatingContainer}>
                <ActivityIndicator size="small" color={colors.secondary} />
                <Text style={styles.generatingText}>正在生成解读...</Text>
              </View>
            ) : interpretationExpanded ? (
              <View style={styles.interpretationContent}>
                {/* 整体解读 */}
                <View style={styles.interpretationSection}>
                  <Text style={styles.interpretationSectionTitle}>📖 整体解读</Text>
                  {interpretation ? (
                    <Text style={styles.interpretationText}>{interpretation}</Text>
                  ) : (
                    <Text style={styles.interpretationText}>加载中...</Text>
                  )}
                </View>

                {/* 符号解读 */}
                {interpretationData.symbols.length > 0 && (
                  <View style={styles.interpretationSection}>
                    <Text style={styles.interpretationSectionTitle}>🔍 符号解读</Text>
                    {interpretationData.symbols.map((symbol, index) => (
                      <View key={index} style={styles.symbolItem}>
                        <Text style={styles.symbolName}>{symbol.symbol}</Text>
                        <Text style={styles.symbolMeaning}>{symbol.meaning}</Text>
                        <Text style={styles.symbolContext}>{symbol.context}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* 情绪分析 */}
                {interpretationData.emotions && (
                  <View style={styles.interpretationSection}>
                    <Text style={styles.interpretationSectionTitle}>💭 情绪分析</Text>
                    <View style={styles.emotionContainer}>
                      <View style={styles.emotionBadge}>
                        <Text style={styles.emotionPrimary}>{interpretationData.emotions.primary}</Text>
                        <View style={styles.intensityBar}>
                          <View 
                            style={[
                              styles.intensityFill, 
                              { width: `${interpretationData.emotions.intensity * 10}%` }
                            ]} 
                          />
                        </View>
                        <Text style={styles.intensityText}>强度: {interpretationData.emotions.intensity}/10</Text>
                      </View>
                      <Text style={styles.emotionDescription}>{interpretationData.emotions.description}</Text>
                    </View>
                  </View>
                )}

                {/* 实用建议 */}
                {interpretationData.suggestions.length > 0 && (
                  <View style={styles.interpretationSection}>
                    <Text style={styles.interpretationSectionTitle}>💡 实用建议</Text>
                    {interpretationData.suggestions.map((suggestion, index) => (
                      <View key={index} style={styles.suggestionItem}>
                        <Text style={styles.suggestionNumber}>{index + 1}</Text>
                        <Text style={styles.suggestionText}>{suggestion}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {/* 参考来源 */}
                {interpretationData.references.length > 0 && (
                  <View style={styles.interpretationSection}>
                    <Text style={styles.interpretationSectionTitle}>📚 参考来源</Text>
                    {interpretationData.references.map((ref, index) => (
                      <View key={index} style={styles.referenceItem}>
                        <Text style={styles.referenceTitle}>• {ref.title}</Text>
                        <Text style={styles.referenceSource}>{ref.source}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.interpretationPreview}>
                <Text style={styles.interpretationPreviewText} numberOfLines={2}>
                  {interpretation}
                </Text>
                <Text style={styles.tapToExpand}>点击展开查看详情</Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* 生成进度显示 */}
        {showProgress && (
          <GenerationProgress
            progress={progress}
            status={taskProgress?.status || 'processing'}
            type={generatingType || 'image'}
            onCancel={() => {
              if (stopPollingRef.current) {
                stopPollingRef.current();
                stopPollingRef.current = null;
              }
              setIsGenerating(false);
              setGeneratingType(null);
              setShowProgress(false);
            }}
            visible={showProgress}
          />
        )}

        {/* Tips Card */}
        <Animated.View 
          style={[
            styles.tipsCard,
            { opacity: fadeAnim }
          ]}
        >
          <Text style={{ fontSize: 20 }}>💡</Text>
          <View style={styles.tipsContent}>
            <Text style={styles.tipsTitle}>创作小贴士</Text>
            <Text style={styles.tipsText}>
              选择不同的艺术风格，可以让同一个梦境呈现出完全不同的视觉效果。尝试多种风格，发现梦境的无限可能！
            </Text>
          </View>
        </Animated.View>
      </Animated.ScrollView>

      {/* 分享弹窗 */}
      <Modal
        visible={shareModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setShareModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>分享梦境</Text>
              <TouchableOpacity onPress={() => setShareModalVisible(false)}>
                <Text style={styles.modalClose}>✕</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>选择平台</Text>
            <View style={styles.platformButtons}>
              <TouchableOpacity
                style={[
                  styles.platformButton,
                  sharePlatform === 'wechat' && styles.platformButtonActive
                ]}
                onPress={() => setSharePlatform('wechat')}
              >
                <Text style={styles.platformIcon}>💬</Text>
                <Text style={styles.platformText}>朋友圈</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.platformButton,
                  sharePlatform === 'xiaohongshu' && styles.platformButtonActive
                ]}
                onPress={() => setSharePlatform('xiaohongshu')}
              >
                <Text style={styles.platformIcon}>📕</Text>
                <Text style={styles.platformText}>小红书</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>分享文案</Text>
            <TextInput
              style={styles.shareTextInput}
              multiline
              numberOfLines={4}
              value={shareText}
              onChangeText={setShareText}
              placeholder="写下你的分享文案..."
            />

            <TouchableOpacity
              style={styles.shareConfirmButton}
              onPress={handleShare}
            >
              <Text style={styles.shareConfirmText}>分享</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
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
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  shareButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 100,
  },
  dreamCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dreamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  dreamTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    flex: 1,
    marginRight: 12,
  },
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
  },
  moodEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  moodText: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  dreamDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  emotionsSection: {
    marginBottom: 16,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emotionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emotionTag: {
    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  emotionTagText: {
    fontSize: 13,
    color: colors.primary,
    fontWeight: '500',
  },
  contentSection: {
    marginBottom: 16,
  },
  dreamContent: {
    fontSize: 15,
    color: colors.text,
    lineHeight: 24,
  },
  // 音频播放器样式
  audioSection: {
    marginBottom: 24,
  },
  audioPlayer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  audioPlayButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  audioPlayIcon: {
    fontSize: 20,
  },
  audioInfo: {
    flex: 1,
  },
  audioTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  audioDuration: {
    fontSize: 14,
  },
  audioWaveform: {
    marginLeft: 12,
  },
  tagsSection: {
    marginBottom: 8,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.2)' : 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  tagText: {
    fontSize: 13,
    color: colors.secondary,
    fontWeight: '500',
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  styleSelector: {
    marginBottom: 16,
  },
  styleLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  styleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    borderWidth: 1,
  },
  activeStyle: {
    borderWidth: 0,
  },
  styleText: {
    fontSize: 14,
  },
  activeStyleText: {
    color: '#fff',
    fontWeight: '500',
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionButton: {
    width: (SCREEN_WIDTH - 56) / 2,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  quickActionButtonDisabled: {
    opacity: 0.6,
  },
  quickActionButtonActive: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  quickActionIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  quotaBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  generatedSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  generatedScroll: {
    flexDirection: 'row',
    gap: 12,
  },
  generatedCard: {
    width: (SCREEN_WIDTH - 44) / 2,
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
    height: 120,
  },
  generatedThumbnail: {
    width: '100%',
    height: 120,
  },
  generatedPlaceholder: {
    width: '100%',
    height: 120,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  generatedIcon: {
    fontSize: 32,
  },
  generatedInfo: {
    padding: 12,
  },
  generatedType: {
    fontSize: 12,
    color: colors.primary,
    fontWeight: '600',
    marginBottom: 4,
  },
  generatedTitle: {
    fontSize: 14,
    color: colors.text,
  },
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonIcon: {
    fontSize: 16,
    color: colors.text,
    marginLeft: 2,
  },
  emptyCreations: {
    alignItems: 'center',
    paddingVertical: 40,
    position: 'relative',
  },
  emptyStateGlow1: {
    position: 'absolute',
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.15)' : 'rgba(99, 102, 241, 0.1)',
    top: 20,
    left: '20%',
  },
  emptyStateGlow2: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: isDark ? 'rgba(236, 72, 153, 0.15)' : 'rgba(236, 72, 153, 0.1)',
    top: 60,
    right: '20%',
  },
  emptyIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  emptyIcon: {
    fontSize: 36,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  interpretationCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  generatingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  generatingText: {
    fontSize: 14,
    color: colors.text,
    marginTop: 12,
    marginBottom: 12,
  },
  miniProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  miniProgressFill: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: 3,
  },
  interpretationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  expandIcon: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  interpretationContent: {
    gap: 16,
  },
  interpretationPreview: {
    paddingVertical: 8,
  },
  interpretationPreviewText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  tapToExpand: {
    fontSize: 12,
    color: colors.secondary,
    marginTop: 8,
    fontStyle: 'italic',
  },
  interpretationSection: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  interpretationSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  interpretationText: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
  },
  // 符号解读样式
  symbolItem: {
    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.secondary,
  },
  symbolName: {
    fontSize: 15,
    fontWeight: '600',
    color: colors.secondary,
    marginBottom: 4,
  },
  symbolMeaning: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 4,
    lineHeight: 18,
  },
  symbolContext: {
    fontSize: 12,
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  // 情绪分析样式
  emotionContainer: {
    gap: 12,
  },
  emotionBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
  },
  emotionPrimary: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  intensityBar: {
    flex: 1,
    height: 6,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  intensityFill: {
    height: '100%',
    backgroundColor: '#F59E0B',
    borderRadius: 3,
  },
  intensityText: {
    fontSize: 12,
    color: colors.textSecondary,
    minWidth: 50,
  },
  emotionDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  // 建议样式
  suggestionItem: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 8,
  },
  suggestionNumber: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    textAlign: 'center',
    lineHeight: 24,
    fontSize: 12,
    fontWeight: '600',
    color: '#fff',
  },
  suggestionText: {
    flex: 1,
    fontSize: 14,
    color: colors.text,
    lineHeight: 20,
  },
  // 参考来源样式
  referenceItem: {
    marginBottom: 8,
  },
  referenceTitle: {
    fontSize: 13,
    color: colors.text,
    marginBottom: 2,
  },
  referenceSource: {
    fontSize: 11,
    color: colors.textSecondary,
    fontStyle: 'italic',
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
  tipsContent: {
    flex: 1,
    marginLeft: 12,
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
  platformButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  platformButton: {
    flex: 1,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  platformButtonActive: {
    borderColor: colors.primary,
    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
  },
  platformIcon: {
    fontSize: 28,
    marginBottom: 8,
  },
  platformText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  shareTextInput: {
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 16,
    fontSize: 14,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  creationSelector: {
    marginBottom: 8,
  },
  creationSelectItem: {
    width: 80,
    backgroundColor: colors.card,
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: colors.border,
    position: 'relative',
  },
  creationSelectItemActive: {
    borderColor: colors.primary,
    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
  },
  creationSelectIcon: {
    fontSize: 24,
    marginBottom: 4,
  },
  creationSelectText: {
    fontSize: 12,
    color: colors.text,
  },
  selectedBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedBadgeText: {
    fontSize: 12,
    color: '#fff',
    fontWeight: '600',
  },
  shareConfirmButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 24,
  },
  shareConfirmText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // 梦境解读封面样式
  interpretationCover: {
    width: '100%',
    height: 120,
    borderRadius: 12,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  interpretationStars: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  starIcon: {
    position: 'absolute',
    opacity: 0.8,
  },
  crystalBallContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  crystalBallIcon: {
    fontSize: 32,
  },
  interpretationDecorativeLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
  },
});
