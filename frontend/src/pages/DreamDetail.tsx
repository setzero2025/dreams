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
import { QuotaDisplay } from '../components/QuotaDisplay';
import { GenerationProgress } from '../components/GenerationProgress';
import { useTheme } from '../theme/themeContext';
import { Dream } from '../types';
import { creationStorageService, CreationItem } from '../services/CreationStorageService';
import { generateInterpretation } from '../services/api/aiService';
import {
  startImageGeneration,
  startVideoGeneration,
  startLongVideoGeneration,
  startPollingProgress,
  stopAllPolling,
  TaskProgress,
} from '../services/generationTask.service';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface DreamDetailProps {
  navigation: any;
  route: any;
}

export const DreamDetail: React.FC<DreamDetailProps> = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const dream = route.params?.dream as Dream;
  
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

  const artStyles = ['写实', '油画', '水彩', '赛博朋克', '国潮', '动漫'];

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
    }
  }, [dream?.id]);

  useEffect(() => {
    loadCreations();

    const unsubscribe = navigation.addListener('focus', () => {
      loadCreations();
    });

    return () => {
      unsubscribe();
      // 组件卸载时停止所有轮询
      if (stopPollingRef.current) {
        stopPollingRef.current();
        stopPollingRef.current = null;
      }
      stopAllPolling();
    };
  }, [navigation, loadCreations]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
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

  const renderMoodEmoji = (rating: number) => {
    const emojis = ['😢', '😕', '😐', '😊', '😁'];
    return emojis[rating - 1];
  };

  // 生成图片 - 异步流程
  const handleGenerateImage = async () => {
    setIsGenerating(true);
    setGeneratingType('image');
    setShowProgress(true);
    setTaskProgress(null);

    try {
      // 1. 启动异步生成任务
      const taskId = await startImageGeneration({
        prompt: dream.content,
        style: selectedStyle,
        dreamId: dream.id,
        dreamTitle: dream.title,
      });

      console.log('【DreamDetail】图片生成任务已启动，任务ID:', taskId);

      // 2. 开始轮询进度
      stopPollingRef.current = startPollingProgress(taskId, async (progress) => {
        setTaskProgress(progress);
        setProgress(progress.progress);

        // 任务完成
        if (progress.status === 'completed') {
          console.log('【DreamDetail】图片生成完成，结果:', progress.result);

          // 停止轮询
          if (stopPollingRef.current) {
            stopPollingRef.current();
            stopPollingRef.current = null;
          }

          // 保存创作数据
          if (progress.result?.url) {
            const imagePrompt = `梦境场景：${dream.content}，风格：${selectedStyle}`;
            const creationData = {
              id: `img_${Date.now()}`,
              type: 'image' as const,
              title: `${dream.title} - 梦境画作`,
              dreamTitle: dream.title,
              dreamId: dream.id,
              prompt: imagePrompt,
              thumbnail: progress.result.url,
              imageUrl: progress.result.url,
              createdAt: new Date().toISOString(),
            };

            await creationStorageService.saveCreation(creationData);
            await loadCreations();
          }

          // 延迟隐藏进度并显示完成提示
          setTimeout(() => {
            setShowProgress(false);
            setIsGenerating(false);
            setGeneratingType(null);
            setProgress(0);
            Alert.alert('生成完成', '梦境画作已生成完成！');
          }, 1000);
        }

        // 任务失败
        if (progress.status === 'failed') {
          if (stopPollingRef.current) {
            stopPollingRef.current();
            stopPollingRef.current = null;
          }

          setTimeout(() => {
            setShowProgress(false);
            setIsGenerating(false);
            setGeneratingType(null);
            setProgress(0);
            Alert.alert('生成失败', progress.error || '请检查配置和网络连接');
          }, 1000);
        }
      });
    } catch (error) {
      console.error('启动图片生成任务失败:', error);
      setShowProgress(false);
      setIsGenerating(false);
      setGeneratingType(null);
      setProgress(0);
      Alert.alert('生成失败', error instanceof Error ? error.message : '请检查配置和网络连接');
    }
  };

  // 生成视频 - 异步流程
  const handleGenerateVideo = async () => {
    setIsGenerating(true);
    setGeneratingType('video');
    setShowProgress(true);
    setTaskProgress(null);

    try {
      // 1. 启动异步生成任务
      const taskId = await startVideoGeneration({
        prompt: dream.content,
        dreamId: dream.id,
        dreamTitle: dream.title,
      });

      console.log('【DreamDetail】视频生成任务已启动，任务ID:', taskId);

      // 2. 开始轮询进度
      stopPollingRef.current = startPollingProgress(taskId, async (progress) => {
        setTaskProgress(progress);
        setProgress(progress.progress);

        // 任务完成
        if (progress.status === 'completed') {
          console.log('【DreamDetail】视频生成完成，结果:', progress.result);

          // 停止轮询
          if (stopPollingRef.current) {
            stopPollingRef.current();
            stopPollingRef.current = null;
          }

          // 保存创作数据
          if (progress.result?.url) {
            const videoPrompt = `梦境视频：${dream.title} - ${dream.content}`;
            await creationStorageService.saveCreation({
              id: `video_${Date.now()}`,
              type: 'video',
              title: `${dream.title} - 梦境视频`,
              dreamTitle: dream.title,
              dreamId: dream.id,
              prompt: videoPrompt,
              thumbnail: progress.result.coverUrl || progress.result.url,
              videoUrl: progress.result.url,
              coverUrl: progress.result.coverUrl,
              createdAt: new Date().toISOString(),
            });

            await loadCreations();
          }

          // 延迟隐藏进度并显示完成提示
          setTimeout(() => {
            setShowProgress(false);
            setIsGenerating(false);
            setGeneratingType(null);
            setProgress(0);
            Alert.alert('生成完成', '梦境视频已生成完成！');
          }, 1000);
        }

        // 任务失败
        if (progress.status === 'failed') {
          if (stopPollingRef.current) {
            stopPollingRef.current();
            stopPollingRef.current = null;
          }

          const errorMessage = progress.error || '请检查配置和网络连接';

          setTimeout(() => {
            setShowProgress(false);
            setIsGenerating(false);
            setGeneratingType(null);
            setProgress(0);

            if (errorMessage.includes('任务已启动') || errorMessage.includes('进行中')) {
              Alert.alert('提示', '该梦境的视频生成任务已在进行中，请稍后再试');
            } else {
              Alert.alert('生成失败', errorMessage);
            }
          }, 1000);
        }
      });
    } catch (error) {
      console.error('启动视频生成任务失败:', error);
      setShowProgress(false);
      setIsGenerating(false);
      setGeneratingType(null);
      setProgress(0);
      Alert.alert('生成失败', error instanceof Error ? error.message : '请检查配置和网络连接');
    }
  };

  // 生成长视频 - 异步流程
  const handleGenerateLongVideo = async () => {
    setIsGenerating(true);
    setGeneratingType('video_long');
    setShowProgress(true);
    setTaskProgress(null);

    try {
      // 注意：长视频生成需要先获取剧本，这里简化处理
      // 实际实现中，可能需要先调用剧本生成API，然后再启动长视频生成任务
      // 1. 启动异步生成任务（这里传入空剧本，实际应该先生成剧本）
      const taskId = await startLongVideoGeneration({
        script: {
          title: dream.title,
          scenes: [], // 实际应该从剧本生成服务获取
        },
        dreamId: dream.id,
        dreamTitle: dream.title,
      });

      console.log('【DreamDetail】长视频生成任务已启动，任务ID:', taskId);

      // 2. 开始轮询进度
      stopPollingRef.current = startPollingProgress(taskId, async (progress) => {
        setTaskProgress(progress);
        setProgress(progress.progress);

        // 任务完成
        if (progress.status === 'completed') {
          console.log('【DreamDetail】长视频生成完成，结果:', progress.result);

          // 停止轮询
          if (stopPollingRef.current) {
            stopPollingRef.current();
            stopPollingRef.current = null;
          }

          // 保存创作数据
          if (progress.result?.url) {
            await creationStorageService.saveCreation({
              id: `video_long_${Date.now()}`,
              type: 'video_long',
              title: `${dream.title} - 梦境剧情`,
              dreamTitle: dream.title,
              dreamId: dream.id,
              thumbnail: progress.result.coverUrl || progress.result.url,
              videoUrl: progress.result.url,
              coverUrl: progress.result.coverUrl,
              createdAt: new Date().toISOString(),
            });

            await loadCreations();
          }

          // 延迟隐藏进度并显示完成提示
          setTimeout(() => {
            setShowProgress(false);
            setIsGenerating(false);
            setGeneratingType(null);
            setProgress(0);
            Alert.alert('生成完成', '梦境剧情视频已生成完成！');
          }, 1000);
        }

        // 任务失败
        if (progress.status === 'failed') {
          if (stopPollingRef.current) {
            stopPollingRef.current();
            stopPollingRef.current = null;
          }

          const errorMessage = progress.error || '请检查配置和网络连接';

          setTimeout(() => {
            setShowProgress(false);
            setIsGenerating(false);
            setGeneratingType(null);
            setProgress(0);

            if (errorMessage.includes('任务已启动') || errorMessage.includes('进行中')) {
              Alert.alert('提示', '该梦境的剧情生成任务已在进行中，请稍后再试');
            } else {
              Alert.alert('生成失败', errorMessage);
            }
          }, 1000);
        }
      });
    } catch (error) {
      console.error('启动长视频生成任务失败:', error);
      setShowProgress(false);
      setIsGenerating(false);
      setGeneratingType(null);
      setProgress(0);
      Alert.alert('生成失败', error instanceof Error ? error.message : '请检查配置和网络连接');
    }
  };

  // 生成梦境解读
  const handleGenerateInterpretation = async () => {
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

    setIsGenerating(true);
    setGeneratingType('interpretation');
    setProgress(0);

    try {
      const progressInterval = setInterval(() => {
        setProgress(prev => (prev >= 90 ? 90 : prev + 10));
      }, 600);

      const response = await generateInterpretation({
        dreamContent: dream.content,
        dreamTitle: dream.title,
        dreamId: dream.id,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.success && response.data.interpretation) {
        const data = response.data;
        setInterpretation(data.interpretation);
        setInterpretationData({
          symbols: data.symbols || [],
          emotions: data.emotions || null,
          suggestions: data.suggestions || [],
          references: data.references || [],
        });
        setInterpretationExpanded(true);
        
        // 保存解读到创作列表
        await creationStorageService.saveCreation({
          id: `interp_${Date.now()}`,
          type: 'interpretation',
          title: `${dream.title} - 梦境解读`,
          dreamTitle: dream.title,
          dreamId: dream.id,
          interpretation: data.interpretation,
          symbols: data.symbols || [],
          emotions: data.emotions ? [data.emotions] : [],
          suggestions: data.suggestions || [],
          createdAt: new Date().toISOString(),
        });

        await loadCreations();
      } else {
        throw new Error(response.message || '解读生成失败');
      }
    } catch (error) {
      console.error('生成解读失败:', error);
      // 使用默认解读
      const defaultInterpretation = `根据心理学理论，你的梦境「${dream.title}」可能反映了内心深处的情感和想法。\n\n梦境中的意象往往与日常生活中的经历和情绪有关。建议你关注近期的生活状态，保持良好的作息习惯。`;
      setInterpretation(defaultInterpretation);
      setInterpretationData({
        symbols: [],
        emotions: { primary: '平静', intensity: 5, description: '梦境整体情绪较为平和' },
        suggestions: [
          '保持规律的作息时间，有助于提高睡眠质量',
          '尝试记录梦境日记，有助于更好地了解自己的潜意识',
        ],
        references: [{ id: 'default', title: '梦境分析基础理论', source: '《梦的解析》- 弗洛伊德' }],
      });
      setInterpretationExpanded(true);
    } finally {
      setIsGenerating(false);
      setGeneratingType(null);
      setProgress(0);
    }
  };

  const handleViewCreation = (content: CreationItem) => {
    switch (content.type) {
      case 'image':
        if (content.imageUrl || content.thumbnail) {
          navigation.navigate('ImageViewer', { 
            imageUrl: content.imageUrl || content.thumbnail,
            title: content.title 
          });
        }
        break;
      case 'script':
        if (content.script) {
          navigation.navigate('ScriptViewer', {
            dream,
            script: content.script
          });
        }
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
      case 'interpretation':
        // 显示解读详情
        if (content.interpretation) {
          setInterpretation(content.interpretation);
        }
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

  return (
    <SafeAreaView style={styles.container}>
      {/* 生成进度遮罩层 */}
      <GenerationProgress progress={taskProgress} visible={showProgress} />

      {/* Header */}
      <Animated.View style={[styles.header, { opacity: fadeAnim }]}>
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
              {/* 额度显示 */}
              {!isGenerating && (
                <View style={styles.quotaBadge}>
                  <QuotaDisplay type="image" compact />
                </View>
              )}
              {/* 图片生成进度 */}
              {generatingType === 'image' && (
                <View style={styles.progressOverlay}>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{Math.round(progress)}%</Text>
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
              {/* 额度显示 */}
              {!isGenerating && (
                <View style={styles.quotaBadge}>
                  <QuotaDisplay type="video" compact />
                </View>
              )}
              {/* 视频生成进度 */}
              {generatingType === 'video' && (
                <View style={styles.progressOverlay}>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{Math.round(progress)}%</Text>
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
              {/* 额度显示 */}
              {!isGenerating && (
                <View style={styles.quotaBadge}>
                  <QuotaDisplay type="longVideo" compact />
                </View>
              )}
              {/* 长视频生成进度 */}
              {generatingType === 'video_long' && (
                <View style={styles.progressOverlay}>
                  <View style={styles.progressBarContainer}>
                    <View style={[styles.progressBarFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{Math.round(progress)}%</Text>
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
              {/* 额度显示 */}
              {!isGenerating && (
                <View style={styles.quotaBadge}>
                  <QuotaDisplay type="interpretation" compact />
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.generatedScroll}
              >
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
                          onLoadStart={() => console.log('【DreamDetail】开始加载图片:', content.thumbnail)}
                          onLoad={() => console.log('【DreamDetail】图片加载成功:', content.thumbnail)}
                          onError={(e) => {
                            console.error('【DreamDetail】图片加载失败:', content.thumbnail);
                            console.error('【DreamDetail】错误详情:', e.nativeEvent.error);
                            // 尝试使用原始URL（如果存在）
                            if (content.imageUrl && content.imageUrl !== content.thumbnail) {
                              console.log('【DreamDetail】尝试使用原始URL:', content.imageUrl);
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
              </ScrollView>
            </View>
          ) : (
            <View style={styles.emptyCreations}>
              <Text style={styles.emptyCreationsIcon}>🎨</Text>
              <Text style={styles.emptyCreationsText}>还没有生成创作</Text>
              <Text style={styles.emptyCreationsSubtext}>点击上方AI创作按钮开始创作</Text>
            </View>
          )}
        </Animated.View>

        {/* Interpretation Section */}
        {(interpretation || isGenerating) && (
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
                <View style={styles.miniProgressBar}>
                  <View style={[styles.miniProgressFill, { width: `${progress}%` }]} />
                </View>
              </View>
            ) : interpretationExpanded ? (
              <View style={styles.interpretationContent}>
                {/* 整体解读 */}
                <View style={styles.interpretationSection}>
                  <Text style={styles.interpretationSectionTitle}>📖 整体解读</Text>
                  <Text style={styles.interpretationText}>{interpretation}</Text>
                </View>

                {/* 符号解读 */}
                {interpretationData.symbols.length > 0 && (
                  <View style={styles.interpretationSection}>
                    <Text style={styles.interpretationSectionTitle}>🔍 符号解读</Text>
                    {interpretationData.symbols.map((symbol, index) => (
                      <View key={index} style={styles.symbolItem}>
                        <Text style={styles.symbolName}>{symbol.symbol}</Text>
                        <Text style={styles.symbolMeaning}>{symbol.meaning}</Text>
                        <Text style={styles.symbolContext}>语境：{symbol.context}</Text>
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

                {/* 建议 */}
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

                {/* 知识库引用 */}
                {interpretationData.references.length > 0 && (
                  <View style={styles.interpretationSection}>
                    <Text style={styles.interpretationSectionTitle}>📚 参考来源</Text>
                    {interpretationData.references.map((ref, index) => (
                      <View key={index} style={styles.referenceItem}>
                        <Text style={styles.referenceTitle}>• {ref.title}</Text>
                        <Text style={styles.referenceSource}>来源：{ref.source}</Text>
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

        {/* Tips */}
        <Animated.View 
          style={[
            styles.tipsCard,
            { opacity: fadeAnim }
          ]}
        >
          <Text style={{ fontSize: 16, color: colors.info }}>💡</Text>
          <View style={styles.tipsContent}>
            <Text style={styles.tipsTitle}>记录小贴士</Text>
            <Text style={styles.tipsText}>
              定期回顾梦境可以帮助你更好地了解自己的潜意识，发现生活中的模式和线索。
            </Text>
          </View>
        </Animated.View>
      </Animated.ScrollView>

      {/* Share Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={shareModalVisible}
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

            <Text style={styles.modalLabel}>选择分享平台</Text>
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
              placeholder="输入分享文案..."
              placeholderTextColor={colors.textDisabled}
            />

            {generatedContents.length > 0 && (
              <>
                <Text style={styles.modalLabel}>选择要分享的作品</Text>
                <ScrollView horizontal style={styles.creationSelector}>
                  {generatedContents.map((content) => (
                    <TouchableOpacity
                      key={content.id}
                      style={[
                        styles.creationSelectItem,
                        selectedCreations.includes(content.id) && styles.creationSelectItemActive
                      ]}
                      onPress={() => toggleCreationSelection(content.id)}
                    >
                      <Text style={styles.creationSelectIcon}>{getTypeIcon(content.type)}</Text>
                      <Text style={styles.creationSelectText} numberOfLines={1}>
                        {getTypeLabel(content.type)}
                      </Text>
                      {selectedCreations.includes(content.id) && (
                        <View style={styles.selectedBadge}>
                          <Text style={styles.selectedBadgeText}>✓</Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </>
            )}

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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
    backgroundColor: colors.card,
  },
  backButton: {
    padding: 8,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  shareButton: {
    padding: 8,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  dreamCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dreamHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  dreamTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    marginRight: 16,
  },
  moodBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  moodEmoji: {
    fontSize: 16,
    marginRight: 4,
  },
  moodText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  dreamDate: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 20,
  },
  contentSection: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  dreamContent: {
    fontSize: 16,
    color: colors.textSecondary,
    lineHeight: 24,
  },
  emotionsSection: {
    marginBottom: 20,
  },
  emotionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  emotionTag: {
    backgroundColor: isDark ? 'rgba(245, 158, 11, 0.2)' : 'rgba(245, 158, 11, 0.15)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  emotionTagText: {
    fontSize: 14,
    color: '#f59e0b',
    fontWeight: '500',
  },
  tagsSection: {
    marginBottom: 16,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tag: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  tagText: {
    fontSize: 14,
    color: colors.secondary,
    fontWeight: '500',
  },
  quickActionsSection: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionButton: {
    width: (SCREEN_WIDTH - 64) / 2,
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    minHeight: 100,
    justifyContent: 'center',
    position: 'relative',
    overflow: 'hidden',
  },
  quickActionButtonDisabled: {
    opacity: 0.5,
  },
  quickActionButtonActive: {
    borderColor: colors.secondary,
    borderWidth: 2,
    shadowColor: colors.secondary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  // 进度条样式
  progressOverlay: {
    position: 'absolute',
    bottom: 8,
    left: 12,
    right: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressBarContainer: {
    flex: 1,
    height: 6,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: 3,
  },
  progressText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.secondary,
    minWidth: 36,
    textAlign: 'right',
  },
  // 额度徽章样式
  quotaBadge: {
    position: 'absolute',
    top: 8,
    right: 8,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickActionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: isDark ? '#ffffff' : '#1a1a2e',
    minHeight: 20,
  },
  generatedSection: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: colors.secondary,
    fontWeight: '500',
  },
  emptyCreations: {
    backgroundColor: 'rgba(26, 26, 46, 0.6)',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyCreationsIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyCreationsText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emptyCreationsSubtext: {
    fontSize: 13,
    color: colors.textLight,
  },
  generatedScroll: {
    gap: 12,
    paddingRight: 20,
  },
  generatedCard: {
    width: 140,
    backgroundColor: colors.card,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
    height: 100,
  },
  generatedThumbnail: {
    width: '100%',
    height: 100,
  },
  generatedPlaceholder: {
    width: '100%',
    height: 100,
    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
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
    color: '#1a1a2e',
    marginLeft: 2,
  },
  generatedIcon: {
    fontSize: 32,
  },
  generatedInfo: {
    padding: 12,
  },
  generatedType: {
    fontSize: 12,
    color: colors.secondary,
    fontWeight: '600',
    marginBottom: 4,
  },
  generatedTitle: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  interpretationCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  generatingContainer: {
    alignItems: 'center',
    padding: 20,
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
    color: '#f59e0b',
    minWidth: 60,
  },
  intensityBar: {
    flex: 1,
    height: 8,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  intensityFill: {
    height: '100%',
    backgroundColor: '#f59e0b',
    borderRadius: 4,
  },
  intensityText: {
    fontSize: 12,
    color: colors.textSecondary,
    minWidth: 70,
    textAlign: 'right',
  },
  emotionDescription: {
    fontSize: 13,
    color: colors.textSecondary,
    lineHeight: 20,
    paddingHorizontal: 4,
  },
  // 建议样式
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 10,
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.1)' : 'rgba(34, 197, 94, 0.05)',
    padding: 12,
    borderRadius: 10,
  },
  suggestionNumber: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.success || '#22c55e',
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 22,
  },
  suggestionText: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    lineHeight: 20,
  },
  // 知识库引用样式
  referenceItem: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
    borderRadius: 8,
    padding: 10,
    marginBottom: 8,
    borderLeftWidth: 2,
    borderLeftColor: colors.info,
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
});
