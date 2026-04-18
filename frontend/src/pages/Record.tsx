import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Animated,
  Easing,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { Button } from '../components/Button';
import { useTheme } from '../theme/themeContext';
import { dreamStorageManager } from '../services/storage';
import { creationStorageService, CreationItem } from '../services/CreationStorageService';
import {
  startImageGeneration,
  startVideoGeneration,
  startLongVideoGeneration,
  startPollingProgress,
  stopAllPolling,
  TaskProgress,
} from '../services/generationTask.service';
import { GenerationProgress } from '../components/GenerationProgress';
import { QuotaDisplay, QUOTA_CONFIG, UserTier } from '../components/QuotaDisplay';
import { audioApi } from '../services/api/audioApi';
import { generateInterpretation } from '../services/api/aiService';
import { authApi } from '../services/api/authApi';

// 动态导入录音服务
let AudioRecordingService: any = null;
let MockAudioRecordingService: any = null;

// 检测是否在 Expo Go 环境中
const isExpoGo = true;
const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RecordProps {
  navigation: any;
  route: any;
}

export const Record: React.FC<RecordProps> = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const initialType = route.params?.type || 'text';
  const [mode, setMode] = useState<'voice' | 'text'>(initialType);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [moodRating, setMoodRating] = useState<1 | 2 | 3 | 4 | 5>(3);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);

  // 保存后的状态
  const [isDreamSaved, setIsDreamSaved] = useState(false);
  const [savedDreamId, setSavedDreamId] = useState<string>('');
  const [savedDream, setSavedDream] = useState<any>(null);

  // 生成相关状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<'image' | 'video' | 'video_long' | 'interpretation' | null>(null);
  const [progress, setProgress] = useState(0);
  const [selectedStyle, setSelectedStyle] = useState('写实');
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const stopPollingRef = useRef<(() => void) | null>(null);

  // 作品列表
  const [generatedContents, setGeneratedContents] = useState<CreationItem[]>([]);

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
  const [interpretationExpanded, setInterpretationExpanded] = useState(false);

  // 录音服务实例
  const audioRecordingRef = useRef<any>(null);
  // 音频URL（用于上传到后端）
  const [audioUri, setAudioUri] = useState<string | null>(null);
  // 保存的音频信息
  const [savedAudioInfo, setSavedAudioInfo] = useState<{audioId: string; url: string} | null>(null);

  const tags = ['噩梦', '美梦', '奇幻', '冒险', '未来', '科技', '森林', '星空'];
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

  const waveformAnimations = useRef<Animated.Value[]>([]);
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const moodAnimations = useRef<Animated.Value[]>([]);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // 初始化波形动画
    waveformAnimations.current = Array(8).fill(0).map(() => new Animated.Value(1));
    moodAnimations.current = Array(5).fill(0).map(() => new Animated.Value(1));

    // 入场动画
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      useNativeDriver: true,
    }).start();

    // 脉动动画
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnimation, {
            toValue: 1.2,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnimation, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    }

    // 录音计时器
    let timer: NodeJS.Timeout;
    if (isRecording) {
      timer = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
      // 组件卸载时停止所有轮询
      if (stopPollingRef.current) {
        stopPollingRef.current();
        stopPollingRef.current = null;
      }
      stopAllPolling();
    };
  }, [isRecording]);

  useEffect(() => {
    // 波形动画
    if (isRecording) {
      const animations = waveformAnimations.current.map((anim, index) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: Math.random() * 3 + 1,
              duration: Math.random() * 300 + 200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 1,
              duration: Math.random() * 300 + 200,
              easing: Easing.inOut(Easing.ease),
              useNativeDriver: false,
            }),
          ])
        );
      });

      animations.forEach(anim => anim.start());
    }
  }, [isRecording]);

  // 加载该梦境的创作内容
  const loadCreations = useCallback(async () => {
    if (savedDreamId) {
      console.log('【Record】加载梦境创作:', savedDreamId);
      const creations = await creationStorageService.getCreationsByDreamId(savedDreamId);
      console.log('【Record】加载到创作数量:', creations.length);
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
  }, [savedDreamId]);

  useEffect(() => {
    if (isDreamSaved && savedDreamId) {
      loadCreations();
    }
  }, [isDreamSaved, savedDreamId, loadCreations]);

  const handleSave = async () => {
    if (!title.trim()) {
      Alert.alert('提示', '请输入梦境标题');
      return;
    }
    if (!content.trim() && mode === 'text') {
      Alert.alert('提示', '请输入梦境内容');
      return;
    }

    setIsSaving(true);

    try {
      // 使用存储管理器保存梦境
      const dreamData = {
        title: title.trim(),
        content: content.trim(),
        contentType: mode,
        moodRating,
        dreamDate: new Date().toISOString(),
        tags: selectedTags,
      };

      const savedDreamResult = await dreamStorageManager.saveDream(dreamData);

      // 获取存储模式信息
      const storageMode = await dreamStorageManager.getStorageMode();
      const successMessage = storageMode.isLoggedIn
        ? '梦境已保存到云端，现在可以生成作品了！'
        : '梦境已保存到本地，现在可以生成作品了！';

      // 设置保存后的状态
      setIsDreamSaved(true);
      setSavedDreamId(savedDreamResult.id || `dream_${Date.now()}`);
      setSavedDream({
        id: savedDreamResult.id || `dream_${Date.now()}`,
        title: title.trim(),
        content: content.trim(),
        moodRating,
        dreamDate: new Date().toISOString(),
        tags: selectedTags,
      });

      Alert.alert('保存成功', successMessage);
    } catch (error) {
      console.error('保存梦境失败:', error);
      Alert.alert('保存失败', error instanceof Error ? error.message : '保存梦境时发生错误');
    } finally {
      setIsSaving(false);
    }
  };

  /**
   * 处理录音开始/停止
   * 停止录音后，将音频上传到后端进行存储和转写
   */
  const handleToggleRecording = async () => {
    if (isRecording) {
      // 停止录音
      setIsRecording(false);
      setIsTranscribing(true);

      // 停止录音服务
      if (audioRecordingRef.current) {
        try {
          const uri = await audioRecordingRef.current.stop();
          console.log('【录音】录音文件URI:', uri);
          setAudioUri(uri);

          // 上传音频到后端并转写
          if (uri) {
            await uploadAndTranscribeAudio(uri);
          }

          audioRecordingRef.current = null;
        } catch (error) {
          console.error('【录音】停止录音失败:', error);
          Alert.alert('录音失败', error instanceof Error ? error.message : '停止录音时发生错误');
        }
      }

      setIsTranscribing(false);
      setRecordingTime(0);
    } else {
      // 开始录音
      setIsRecording(true);
      setIsTranscribing(false);
      setContent('');
      setAudioUri(null);

      try {
        // 根据环境选择录音服务
        if (isExpoGo) {
          // Expo Go 环境使用模拟录音
          if (!MockAudioRecordingService) {
            const mockModule = await import('../services/MockAudioRecordingService');
            MockAudioRecordingService = mockModule.MockAudioRecordingService;
          }
        } else {
          // 真实环境使用真实录音
          if (!AudioRecordingService) {
            const audioModule = await import('../services/AudioRecordingService');
            AudioRecordingService = audioModule.AudioRecordingService;
          }
        }

        // 初始化录音服务
        const RecordingService = isExpoGo ? MockAudioRecordingService : AudioRecordingService;
        audioRecordingRef.current = new RecordingService({
          onAudioData: (audioData: ArrayBuffer) => {
            // 实时音频数据（用于波形显示等）
            console.log('【录音】实时音频数据:', audioData.byteLength);
          },
          onError: (error: Error) => {
            console.error('【录音】录音错误:', error);
            Alert.alert('录音失败', error.message);
            setIsRecording(false);
            setIsTranscribing(false);
          }
        });

        // 开始录音
        await audioRecordingRef.current.start();

        console.log('【录音】录音服务已启动');
      } catch (error) {
        console.error('【录音】开始录音失败:', error);
        Alert.alert('录音失败', error instanceof Error ? error.message : '无法开始录音，请检查配置和网络连接');
        setIsRecording(false);
        setIsTranscribing(false);
      }
    }
  };

  /**
   * 上传音频到后端并转写
   * @param uri 音频文件URI
   */
  const uploadAndTranscribeAudio = async (uri: string) => {
    try {
      console.log('【录音】开始上传音频并转写...');

      // 调用API上传音频并转写
      const response = await audioApi.transcribeAudio(uri, recordingTime);

      if (response.code === 200 && response.data) {
        console.log('【录音】音频上传成功，URL:', response.data.url);
        console.log('【录音】转写结果:', response.data.text);

        // 保存音频信息
        setSavedAudioInfo({
          audioId: response.data.audioId,
          url: response.data.url,
        });

        // 将转写结果添加到内容中
        if (response.data.text) {
          setContent(prev => {
            const newContent = prev + (prev ? ' ' : '') + response.data.text;
            return newContent;
          });
        }

        // 如果梦境已保存，更新梦境的音频关联
        if (isDreamSaved && savedDreamId) {
          try {
            await audioApi.uploadDreamAudio(savedDreamId, uri, recordingTime);
            console.log('【录音】已更新梦境音频关联');
          } catch (error) {
            console.error('【录音】更新梦境音频关联失败:', error);
          }
        }
      } else {
        console.error('【录音】音频上传失败:', response.message);
        Alert.alert('转写失败', response.message || '音频上传失败');
      }
    } catch (error) {
      console.error('【录音】上传音频失败:', error);
      Alert.alert('转写失败', error instanceof Error ? error.message : '音频上传失败');
    }
  };

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleMoodSelect = (rating: 1 | 2 | 3 | 4 | 5, index: number) => {
    // 添加点击动画
    const animationValue = moodAnimations.current[index] || new Animated.Value(1);
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

    setMoodRating(rating);
  };

  const renderMoodEmoji = (rating: number) => {
    const emojis = ['😢', '😕', '😐', '😊', '😁'];
    return emojis[rating - 1];
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const renderWaveform = () => {
    return (
      <View style={styles.waveformContainer}>
        {waveformAnimations.current.map((anim, index) => (
          <Animated.View
            key={index}
            style={[
              styles.waveformBar,
              {
                height: Animated.multiply(anim, 30),
                opacity: isRecording ? 1 : 0.3,
              },
            ]}
          />
        ))}
      </View>
    );
  };

  // 生成图片 - 异步流程
  const handleGenerateImage = async () => {
    if (!savedDream) return;

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
    setShowProgress(true);
    setTaskProgress(null);

    try {
      // 1. 启动异步生成任务
      const taskId = await startImageGeneration({
        prompt: savedDream.content,
        style: selectedStyle,
        dreamId: savedDreamId,
        dreamTitle: savedDream.title,
      });

      console.log('【Record】图片生成任务已启动，任务ID:', taskId);

      // 2. 开始轮询进度
      stopPollingRef.current = startPollingProgress(taskId, async (progress) => {
        setTaskProgress(progress);
        setProgress(progress.progress);

        // 任务完成
        if (progress.status === 'completed') {
          console.log('【Record】图片生成完成，结果:', progress.result);

          // 停止轮询
          if (stopPollingRef.current) {
            stopPollingRef.current();
            stopPollingRef.current = null;
          }

          // 保存创作数据
          if (progress.result?.url) {
            const imagePrompt = `梦境场景：${savedDream.content}，风格：${selectedStyle}`;
            const creationData = {
              id: `img_${Date.now()}`,
              type: 'image' as const,
              title: `${savedDream.title} - 梦境画作`,
              dreamTitle: savedDream.title,
              dreamId: savedDreamId,
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
    if (!savedDream) return;

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
    setShowProgress(true);
    setTaskProgress(null);

    try {
      // 1. 启动异步生成任务
      const taskId = await startVideoGeneration({
        prompt: savedDream.content,
        dreamId: savedDreamId,
        dreamTitle: savedDream.title,
      });

      console.log('【Record】视频生成任务已启动，任务ID:', taskId);

      // 2. 开始轮询进度
      stopPollingRef.current = startPollingProgress(taskId, async (progress) => {
        setTaskProgress(progress);
        setProgress(progress.progress);

        // 任务完成
        if (progress.status === 'completed') {
          console.log('【Record】视频生成完成，结果:', progress.result);

          // 停止轮询
          if (stopPollingRef.current) {
            stopPollingRef.current();
            stopPollingRef.current = null;
          }

          // 保存创作数据
          if (progress.result?.url) {
            const videoPrompt = `梦境视频：${savedDream.title} - ${savedDream.content}`;
            await creationStorageService.saveCreation({
              id: `video_${Date.now()}`,
              type: 'video',
              title: `${savedDream.title} - 梦境视频`,
              dreamTitle: savedDream.title,
              dreamId: savedDreamId,
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
    if (!savedDream) return;

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
    setShowProgress(true);
    setTaskProgress(null);

    try {
      // 注意：长视频生成需要先获取剧本，这里简化处理
      // 1. 启动异步生成任务（这里传入空剧本，实际应该先生成剧本）
      const taskId = await startLongVideoGeneration({
        script: {
          title: savedDream.title,
          scenes: [], // 实际应该从剧本生成服务获取
        },
        dreamId: savedDreamId,
        dreamTitle: savedDream.title,
      });

      console.log('【Record】长视频生成任务已启动，任务ID:', taskId);

      // 2. 开始轮询进度
      stopPollingRef.current = startPollingProgress(taskId, async (progress) => {
        setTaskProgress(progress);
        setProgress(progress.progress);

        // 任务完成
        if (progress.status === 'completed') {
          console.log('【Record】长视频生成完成，结果:', progress.result);

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
              title: `${savedDream.title} - 梦境剧情`,
              dreamTitle: savedDream.title,
              dreamId: savedDreamId,
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

  // 生成梦境解读 - 带进度条
  const handleGenerateInterpretation = async () => {
    if (!savedDream) return;

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
        dreamId: savedDreamId,
        dreamContent: savedDream.content,
        dreamTitle: savedDream.title,
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
            title: `${savedDream.title} - 梦境解读`,
            dreamTitle: savedDream.title,
            dreamId: savedDreamId,
            interpretation: data.interpretation,
            symbols: data.symbols,
            emotions: data.emotions,
            suggestions: data.suggestions,
            createdAt: new Date().toISOString(),
          };

          await creationStorageService.saveCreation(interpretationItem);

          // 重新加载创作列表
          await loadCreations();

          // 自动展开解读区域显示结果
          setInterpretationExpanded(true);
        }, 1000);
      } else {
        throw new Error(response.message || '解读生成失败');
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error('【Record】解读生成失败:', error);
      setShowProgress(false);
      setIsGenerating(false);
      setGeneratingType(null);
      Alert.alert('生成失败', error instanceof Error ? error.message : '梦境解读生成失败，请重试');
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
            dream: savedDream,
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
        }
        break;
      case 'interpretation':
        // 梦境解读展开详情
        setInterpretationExpanded(true);
        break;
    }
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

  const latestCreations = generatedContents.slice(0, 3);

  return (
    <SafeAreaView style={styles.container}>
      {/* 生成进度遮罩层 - 支持任务轮询和模拟进度两种方式 */}
      <GenerationProgress
        progress={taskProgress?.progress ?? progress}
        status={taskProgress?.status ?? (progress >= 100 ? 'completed' : 'processing')}
        type={generatingType || 'image'}
        onCancel={() => {
          if (taskProgress?.taskId) {
            stopPollingRef.current?.();
          }
          setShowProgress(false);
          setIsGenerating(false);
          setGeneratingType(null);
        }}
        visible={showProgress}
      />

      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 24, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>记录梦境</Text>
        {!isDreamSaved ? (
          <Button
            title="保存"
            onPress={handleSave}
            variant="primary"
            size="small"
            loading={isSaving}
            disabled={isSaving}
          />
        ) : (
          <View style={styles.savedBadge}>
            <Text style={styles.savedBadgeText}>✓ 已保存</Text>
          </View>
        )}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Mode Selector - 仅在未保存时显示 */}
        {!isDreamSaved && (
          <View style={styles.modeSelector}>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'voice' && styles.activeMode]}
              onPress={() => setMode('voice')}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20, color: mode === 'voice' ? colors.text : colors.textLight }}>🎤</Text>
              <Text style={[styles.modeText, mode === 'voice' && styles.activeModeText]}>
                语音模式
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modeButton, mode === 'text' && styles.activeMode]}
              onPress={() => setMode('text')}
              activeOpacity={0.7}
            >
              <Text style={{ fontSize: 20, color: mode === 'text' ? colors.text : colors.textLight }}>✏️</Text>
              <Text style={[styles.modeText, mode === 'text' && styles.activeModeText]}>
                文字模式
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Title Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>梦境标题</Text>
          <TextInput
            style={[styles.titleInput, isDreamSaved && styles.disabledInput]}
            placeholder="给你的梦境起个名字..."
            placeholderTextColor={colors.textDisabled}
            value={title}
            onChangeText={setTitle}
            autoFocus={mode === 'text' && !isDreamSaved}
            maxLength={50}
            editable={!isDreamSaved}
          />
          {!isDreamSaved && <Text style={styles.charCount}>{title.length}/50</Text>}
        </View>

        {/* Content Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>梦境内容</Text>
          {mode === 'voice' && !isDreamSaved ? (
            <>
              {/* 录音按钮区域 */}
              <TouchableOpacity
                style={[styles.voiceRecorder, isRecording && styles.recording]}
                onPress={handleToggleRecording}
                activeOpacity={0.8}
              >
                <Animated.View
                  style={[
                    styles.micContainer,
                    {
                      transform: [{ scale: pulseAnimation }],
                    },
                  ]}
                >
                  <Text style={{ fontSize: 48, color: isRecording ? colors.error : colors.primary }}>🎤</Text>
                </Animated.View>

                {isRecording ? (
                  <>
                    <View style={styles.recordingInfo}>
                      <Text style={{ fontSize: 16, color: colors.error }}>⏱️</Text>
                      <Text style={styles.recordingTime}>{formatTime(recordingTime)}</Text>
                      {isTranscribing && (
                        <View style={styles.transcribingBadge}>
                          <ActivityIndicator size="small" color={colors.info} />
                          <Text style={styles.transcribingText}>实时转写中...</Text>
                        </View>
                      )}
                    </View>
                    {renderWaveform()}
                    <Text style={styles.recordingText}>🎵 正在录音...</Text>
                  </>
                ) : (
                  <Text style={styles.recordingText}>🎤 点击开始录音</Text>
                )}
              </TouchableOpacity>

              {/* 转写文本显示区域 */}
              <View style={[styles.voiceContentContainer, !content && styles.voiceContentContainerEmpty]}>
                <Text style={styles.voiceContent}>
                  {content || '语音转写内容将显示在这里...'}
                </Text>
              </View>
            </>
          ) : (
            <View>
              <TextInput
                style={[styles.contentInput, isDreamSaved && styles.disabledInput]}
                placeholder="描述你的梦境..."
                placeholderTextColor={colors.textDisabled}
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
                maxLength={1000}
                editable={!isDreamSaved}
              />
              {!isDreamSaved && <Text style={styles.charCount}>{content.length}/1000</Text>}
            </View>
          )}
        </View>

        {/* Mood Rating */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>情绪评分</Text>
          <View style={styles.moodSelector}>
            {[1, 2, 3, 4, 5].map((rating, index) => {
              const animationValue = moodAnimations.current[index] || new Animated.Value(1);
              return (
                <Animated.View
                  key={rating}
                  style={[
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
                    style={[
                      styles.moodButton,
                      moodRating === rating && styles.activeMood
                    ]}
                    onPress={() => handleMoodSelect(rating as 1 | 2 | 3 | 4 | 5, index)}
                    activeOpacity={0.7}
                    disabled={isDreamSaved}
                  >
                    <Text style={styles.moodEmoji}>{renderMoodEmoji(rating)}</Text>
                    <Text style={[
                      styles.moodText,
                      moodRating === rating && styles.activeMoodText
                    ]}>
                      {rating}
                    </Text>
                  </TouchableOpacity>
                </Animated.View>
              );
            })}
          </View>
        </View>

        {/* Tags */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>标签</Text>
          <View style={styles.tagsContainer}>
            {tags.map((tag) => (
              <TouchableOpacity
                key={tag}
                style={[
                  styles.tagButton,
                  selectedTags.includes(tag) && styles.selectedTag
                ]}
                onPress={() => toggleTag(tag)}
                activeOpacity={0.7}
                disabled={isDreamSaved}
              >
                <Text style={[
                  styles.tagText,
                  selectedTags.includes(tag) && styles.selectedTagText
                ]}>
                  {tag}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 保存后显示的AI创作区域 */}
        {isDreamSaved && (
          <Animated.View style={[styles.aiCreationSection, { opacity: fadeAnim }]}>
            <Text style={styles.sectionTitle}>✨ AI创作</Text>

            {/* 风格选择 - 仅在生成图片时显示 */}
            <View style={styles.styleSelector}>
              <Text style={styles.styleLabel}>艺术风格</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {artStyles.map((style) => (
                  <TouchableOpacity
                    key={style}
                    style={[
                      styles.styleButton,
                      selectedStyle === style && styles.activeStyle
                    ]}
                    onPress={() => setSelectedStyle(style)}
                    activeOpacity={0.7}
                  >
                    <Text style={[
                      styles.styleText,
                      selectedStyle === style && styles.activeStyleText
                    ]}>
                      {style}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* AI创作按钮 */}
            <View style={styles.aiButtonsGrid}>
              {/* 梦生图片按钮 */}
              <TouchableOpacity
                style={[
                  styles.aiButton,
                  isGenerating && styles.aiButtonDisabled,
                  generatingType === 'image' && styles.aiButtonActive
                ]}
                onPress={handleGenerateImage}
                disabled={isGenerating}
                activeOpacity={0.8}
              >
                <View style={[styles.aiButtonIcon, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>🖼️</Text>
                </View>
                <Text style={styles.aiButtonTitle}>梦生图片</Text>
                {/* 额度显示 - 传入当前梦境已生成的图片数量 */}
                {!isGenerating && (
                  <View style={styles.quotaBadge}>
                    <QuotaDisplay 
                      type="image" 
                      compact 
                      dreamId={savedDreamId}
                      currentCount={getCreationCountByType('image')}
                    />
                  </View>
                )}
              </TouchableOpacity>

              {/* 梦生视频按钮 */}
              <TouchableOpacity
                style={[
                  styles.aiButton,
                  isGenerating && styles.aiButtonDisabled,
                  generatingType === 'video' && styles.aiButtonActive
                ]}
                onPress={handleGenerateVideo}
                disabled={isGenerating}
                activeOpacity={0.8}
              >
                <View style={[styles.aiButtonIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>🎬</Text>
                </View>
                <Text style={styles.aiButtonTitle}>梦生视频</Text>
                {/* 额度显示 - 传入当前梦境已生成的视频数量 */}
                {!isGenerating && (
                  <View style={styles.quotaBadge}>
                    <QuotaDisplay 
                      type="video" 
                      compact 
                      dreamId={savedDreamId}
                      currentCount={getCreationCountByType('video')}
                    />
                  </View>
                )}
              </TouchableOpacity>

              {/* 梦境剧情按钮 */}
              <TouchableOpacity
                style={[
                  styles.aiButton,
                  isGenerating && styles.aiButtonDisabled,
                  generatingType === 'video_long' && styles.aiButtonActive
                ]}
                onPress={handleGenerateLongVideo}
                disabled={isGenerating}
                activeOpacity={0.8}
              >
                <View style={[styles.aiButtonIcon, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)' }]}>
                  <Text style={{ fontSize: 24 }}>🎥</Text>
                </View>
                <Text style={styles.aiButtonTitle}>梦境剧情</Text>
                {/* 额度显示 - 传入当前梦境已生成的长视频数量 */}
                {!isGenerating && (
                  <View style={styles.quotaBadge}>
                    <QuotaDisplay 
                      type="longVideo" 
                      compact 
                      dreamId={savedDreamId}
                      currentCount={getCreationCountByType('video_long')}
                    />
                  </View>
                )}
              </TouchableOpacity>

              {/* 梦境解读按钮 */}
              <TouchableOpacity
                style={[
                  styles.aiButton,
                  isGenerating && styles.aiButtonDisabled,
                  generatingType === 'interpretation' && styles.aiButtonActive
                ]}
                onPress={handleGenerateInterpretation}
                disabled={isGenerating}
                activeOpacity={0.8}
              >
                <View style={[styles.aiButtonIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>🔮</Text>
                </View>
                <Text style={styles.aiButtonTitle}>梦境解读</Text>
                {/* 额度显示 - 传入当前梦境已生成的解读数量 */}
                {!isGenerating && (
                  <View style={styles.quotaBadge}>
                    <QuotaDisplay 
                      type="interpretation" 
                      compact 
                      dreamId={savedDreamId}
                      currentCount={getCreationCountByType('interpretation')}
                    />
                  </View>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* 生成的作品列表 */}
        {isDreamSaved && (
          <Animated.View style={[styles.worksSection, { opacity: fadeAnim }]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>🎨 梦境作品</Text>
              {generatedContents.length > 0 && (
                <TouchableOpacity onPress={() => navigation.navigate('CreationCenter', { dreamId: savedDreamId })}>
                  <Text style={styles.viewAllText}>查看全部 →</Text>
                </TouchableOpacity>
              )}
            </View>

            {generatedContents.length > 0 ? (
              <View style={styles.worksGrid}>
                {latestCreations.map((content) => (
                  <TouchableOpacity
                    key={content.id}
                    style={styles.workCard}
                    onPress={() => handleViewCreation(content)}
                    activeOpacity={0.8}
                  >
                    {content.thumbnail ? (
                      <View style={styles.thumbnailContainer}>
                        <Image
                          source={{ uri: content.thumbnail, cache: 'reload' }}
                          style={styles.workThumbnail}
                          resizeMode="cover"
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
                      // 梦境解读专用温馨封面 - 与梦境详情页面保持一致
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
                      <View style={styles.workPlaceholder}>
                        <Text style={styles.workIcon}>{getTypeIcon(content.type)}</Text>
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
                    <View style={styles.workInfo}>
                      <Text style={styles.workType}>{getTypeLabel(content.type)}</Text>
                      <Text style={styles.workTitle} numberOfLines={1}>{content.title}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            ) : (
              <View style={styles.emptyWorks}>
                <Text style={styles.emptyWorksIcon}>🎨</Text>
                <Text style={styles.emptyWorksText}>还没有生成作品</Text>
                <Text style={styles.emptyWorksSubtext}>点击上方AI创作按钮开始创作</Text>
              </View>
            )}

            {/* 梦境解读详情展示区域 - 与梦境详情页面保持一致 */}
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
          </Animated.View>
        )}

        {/* Voice Tone Notice */}
        {mode === 'voice' && !isDreamSaved && (
          <View style={styles.toneNotice}>
            <Text style={{ fontSize: 16 }}>🎤</Text>
            <Text style={styles.toneNoticeText}>
              录音时会自动记录你的音色，用于后续声音克隆功能
            </Text>
          </View>
        )}

        {/* Tips */}
        {!isDreamSaved && (
          <View style={styles.tips}>
            <Text style={{ fontSize: 16, color: colors.info }}>🌙</Text>
            <Text style={styles.tipsText}>
              💡 记录梦境的最佳时间是刚醒来时，尽量详细描述你的感受和细节
            </Text>
          </View>
        )}

        {/* 底部空间 */}
        <View style={styles.bottomSpace} />
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
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  savedBadge: {
    backgroundColor: isDark ? 'rgba(34, 197, 94, 0.2)' : 'rgba(34, 197, 94, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  savedBadgeText: {
    fontSize: 12,
    color: '#22c55e',
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  modeSelector: {
    flexDirection: 'row',
    margin: 20,
    backgroundColor: 'colors.card',
    borderRadius: 12,
    padding: 4,
    backdropFilter: 'blur(10px)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    transition: 'all 0.3s',
  },
  activeMode: {
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
  modeText: {
    fontSize: 14,
    color: colors.textLight,
    marginLeft: 8,
    fontWeight: '500',
  },
  activeModeText: {
    color: colors.text,
    fontWeight: '600',
  },
  inputSection: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  titleInput: {
    backgroundColor: 'colors.card',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    backdropFilter: 'blur(10px)',
  },
  disabledInput: {
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    color: colors.textSecondary,
  },
  contentInput: {
    backgroundColor: 'colors.card',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 200,
    backdropFilter: 'blur(10px)',
  },
  charCount: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'right',
    marginTop: 4,
  },
  voiceRecorder: {
    backgroundColor: 'colors.card',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backdropFilter: 'blur(10px)',
  },
  recording: {
    borderColor: colors.error,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  micContainer: {
    marginBottom: 20,
  },
  recordingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  recordingTime: {
    fontSize: 16,
    color: colors.error,
    fontWeight: '600',
    marginLeft: 8,
  },
  transcribingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginLeft: 12,
  },
  transcribingText: {
    fontSize: 12,
    color: colors.info,
    marginLeft: 4,
    fontWeight: '500',
  },
  waveformContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginBottom: 16,
    height: 40,
  },
  waveformBar: {
    width: 4,
    backgroundColor: colors.error,
    borderRadius: 2,
  },
  recordingText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 16,
    fontWeight: '500',
  },
  voiceContentContainer: {
    marginTop: 16,
    padding: 16,
    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.primary,
    alignSelf: 'stretch',
    minHeight: 100,
  },
  voiceContentContainerEmpty: {
    backgroundColor: 'colors.card',
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  voiceContent: {
    fontSize: 16,
    color: colors.text,
    lineHeight: 24,
  },
  moodSelector: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  moodButton: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: 'colors.card',
    borderWidth: 1,
    borderColor: colors.border,
    backdropFilter: 'blur(10px)',
  },
  activeMood: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  moodEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  moodText: {
    fontSize: 14,
    color: colors.textLight,
    fontWeight: '500',
  },
  activeMoodText: {
    color: colors.text,
    fontWeight: '600',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  tagButton: {
    backgroundColor: 'colors.card',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backdropFilter: 'blur(10px)',
  },
  selectedTag: {
    backgroundColor: isDark ? 'rgba(99, 102, 241, 0.2)' : 'rgba(99, 102, 241, 0.1)',
    borderColor: colors.primary,
  },
  tagText: {
    fontSize: 14,
    color: colors.textLight,
    fontWeight: '500',
  },
  selectedTagText: {
    color: colors.primary,
    fontWeight: '600',
  },
  // AI创作区域样式
  aiCreationSection: {
    marginHorizontal: 20,
    marginBottom: 24,
    padding: 20,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  styleSelector: {
    marginBottom: 16,
  },
  styleLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  styleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: 8,
  },
  activeStyle: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  styleText: {
    fontSize: 14,
    color: colors.textLight,
    fontWeight: '500',
  },
  activeStyleText: {
    color: colors.text,
    fontWeight: '600',
  },
  aiButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
    gap: 8,
  },
  aiButton: {
    width: (SCREEN_WIDTH - 72) / 4,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    position: 'relative',
  },
  aiButtonDisabled: {
    opacity: 0.5,
  },
  aiButtonActive: {
    borderWidth: 2,
    borderColor: colors.secondary,
  },
  aiButtonIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  aiButtonTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.text,
  },
  quotaBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  // 作品列表样式
  worksSection: {
    marginHorizontal: 20,
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
  worksGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  workCard: {
    width: (SCREEN_WIDTH - 56) / 3,
    backgroundColor: colors.card,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border,
  },
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
    height: 80,
  },
  workThumbnail: {
    width: '100%',
    height: 80,
  },
  workPlaceholder: {
    width: '100%',
    height: 80,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  playButtonIcon: {
    fontSize: 12,
    color: '#1a1a2e',
    marginLeft: 2,
  },
  workIcon: {
    fontSize: 24,
  },
  workInfo: {
    padding: 8,
  },
  workType: {
    fontSize: 10,
    color: colors.secondary,
    fontWeight: '600',
    marginBottom: 2,
  },
  workTitle: {
    fontSize: 12,
    color: colors.text,
    fontWeight: '500',
  },
  emptyWorks: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: 'dashed',
  },
  emptyWorksIcon: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyWorksText: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  emptyWorksSubtext: {
    fontSize: 13,
    color: colors.textLight,
  },
  // 梦境解读封面样式 - 与梦境详情页面保持一致
  interpretationCover: {
    width: '100%',
    height: 80,
    borderRadius: 8,
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
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  crystalBallIcon: {
    fontSize: 24,
  },
  interpretationDecorativeLine: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  // 梦境解读详情卡片样式 - 与梦境详情页面保持一致
  interpretationCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
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
    color: colors.textSecondary,
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
    borderRadius: 10,
    padding: 12,
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
  toneNotice: {
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 12,
    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
  },
  toneNoticeText: {
    flex: 1,
    fontSize: 13,
    color: colors.textSecondary,
    marginLeft: 8,
  },
  tips: {
    margin: 20,
    padding: 16,
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.info,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipsText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: 8,
    lineHeight: 20,
  },
  bottomSpace: {
    height: 40,
  },
});
