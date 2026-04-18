import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Animated,
  Easing,
  Alert,
  ActivityIndicator,
  Dimensions,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { useTheme } from '../theme/themeContext';
import { dreamStorageManager } from '../services/storage';
import { generateInterpretation } from '../services/api/aiService';
// 已导入的 generationTask.service 包含 startVideoGeneration 和 startLongVideoGeneration
import { creationStorageService, CreationItem } from '../services/CreationStorageService';
import { authApi } from '../services/api/authApi';
import {
  startImageGeneration,
  startVideoGeneration,
  startLongVideoGeneration,
  startPollingProgress,
  stopAllPolling,
  TaskProgress,
} from '../services/generationTask.service';
import { GenerationProgress } from '../components/GenerationProgress';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RecordModuleProps {
  navigation: any;
  route: any;
}

type RecordMode = 'voice' | 'text';

// 情绪选项
const EMOTION_OPTIONS = ['开心', '难过', '焦虑', '恐惧', '惊讶', '愤怒', '平静', '兴奋', '困惑', '自由'];

// 艺术风格选项（用于图片生成）
const ART_STYLES = ['写实', '油画', '水彩', '赛博朋克', '国潮', '动漫'];

// 生成年份选项（前后5年）
const generateYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let i = currentYear - 5; i <= currentYear + 5; i++) {
    years.push(i);
  }
  return years;
};

// 生成月份选项
const generateMonths = () => {
  return Array.from({ length: 12 }, (_, i) => i + 1);
};

// 生成日期选项
const generateDays = (year: number, month: number) => {
  const daysInMonth = new Date(year, month, 0).getDate();
  return Array.from({ length: daysInMonth }, (_, i) => i + 1);
};

export const RecordModule: React.FC<RecordModuleProps> = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  

  
  // 表单数据
  const [dreamDate, setDreamDate] = useState(new Date().toISOString().split('T')[0]);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [selectedEmotions, setSelectedEmotions] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  
  // 录音状态
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  
  // 保存状态
  const [isSaving, setIsSaving] = useState(false);
  const [savedDreamId, setSavedDreamId] = useState<string | null>(null);
  const [showQuickActions, setShowQuickActions] = useState(false);
  
  // 额度状态
  const [quota, setQuota] = useState({
    image: { used: 0, limit: 5, unlimited: false },
    video: { used: 0, limit: 2, unlimited: false },
    story: { used: 0, limit: 1, unlimited: false },
  });
  
  // 作品列表
  const [creations, setCreations] = useState<CreationItem[]>([]);

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

  // 生成相关状态
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatingType, setGeneratingType] = useState<'image' | 'video' | 'story' | 'interpretation' | null>(null);
  const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);
  const [showProgress, setShowProgress] = useState(false);
  const stopPollingRef = useRef<(() => void) | null>(null);

  // 艺术风格选择（用于图片生成）
  const [selectedStyle, setSelectedStyle] = useState('写实');

  // 日期选择器状态
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  
  // 动画
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const quickActionsAnim = useRef(new Animated.Value(0)).current;

  // 录音计时器
  const recordingTimer = useRef<NodeJS.Timeout | null>(null);

  // 初始化动画
  useEffect(() => {
    // 脉冲动画
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // 加载用户额度
    loadQuota();

    // 组件卸载时清理
    return () => {
      if (stopPollingRef.current) {
        stopPollingRef.current();
        stopPollingRef.current = null;
      }
      stopAllPolling();
    };
  }, []);

  // 加载用户额度
  const loadQuota = async () => {
    try {
      const response = await authApi.getUserQuota();
      if (response.success && response.data) {
        setQuota({
          image: response.data.image,
          video: response.data.video,
          story: response.data.longVideo,
        });
      }
    } catch (error) {
      console.error('加载额度失败:', error);
    }
  };

  // 加载该梦境的创作内容
  const loadCreations = useCallback(async () => {
    if (savedDreamId) {
      console.log('【RecordModule】加载梦境创作:', savedDreamId);
      const items = await creationStorageService.getCreationsByDreamId(savedDreamId);
      console.log('【RecordModule】加载到创作数量:', items.length);
      // 按创建时间倒序排序（最新的在前）
      const sortedCreations = items.sort((a, b) => {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
      setCreations(sortedCreations);
    }
  }, [savedDreamId]);

  // 当梦境保存后加载创作列表
  useEffect(() => {
    if (savedDreamId) {
      loadCreations();
    }
  }, [savedDreamId, loadCreations]);

  // 开始录音
  const startRecording = () => {
    setIsRecording(true);
    setRecordingDuration(0);

    // 模拟录音计时
    recordingTimer.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);

    // 模拟语音转写（逐字输出效果）
    const text = '我梦见自己在一片星空下飞翔，周围是闪烁的星星，感觉非常自由和轻松...';
    let index = 0;

    const typeInterval = setInterval(() => {
      if (index < text.length) {
        setContent(prev => prev + text[index]);
        index++;
      } else {
        clearInterval(typeInterval);
      }
    }, 100);
  };

  // 停止录音
  const stopRecording = () => {
    setIsRecording(false);
    if (recordingTimer.current) {
      clearInterval(recordingTimer.current);
      recordingTimer.current = null;
    }
  };

  // 添加标签
  const addTag = () => {
    if (customTag.trim() && !tags.includes(customTag.trim())) {
      setTags([...tags, customTag.trim()]);
      setCustomTag('');
    }
  };

  // 删除标签
  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(tag => tag !== tagToRemove));
  };

  // 切换情绪选择
  const toggleEmotion = (emotion: string) => {
    if (selectedEmotions.includes(emotion)) {
      setSelectedEmotions(selectedEmotions.filter(e => e !== emotion));
    } else if (selectedEmotions.length < 3) {
      setSelectedEmotions([...selectedEmotions, emotion]);
    }
  };

  // 打开日期选择器
  const openDatePicker = () => {
    const date = new Date(dreamDate);
    setSelectedYear(date.getFullYear());
    setSelectedMonth(date.getMonth() + 1);
    setSelectedDay(date.getDate());
    setShowDatePicker(true);
  };

  // 确认日期选择
  const confirmDate = () => {
    const formattedDate = `${selectedYear}-${selectedMonth.toString().padStart(2, '0')}-${selectedDay.toString().padStart(2, '0')}`;
    setDreamDate(formattedDate);
    setShowDatePicker(false);
  };

  // 保存梦境
  const handleSaveDream = async () => {
    // 表单验证
    if (!title.trim()) {
      Alert.alert('提示', '请输入梦境标题');
      return;
    }
    if (!content.trim()) {
      Alert.alert('提示', '请输入梦境内容');
      return;
    }

    setIsSaving(true);
    
    try {
      const dream = {
        id: `dream_${Date.now()}`,
        title: title.trim(),
        content: content.trim(),
        dreamDate,
        moodRating: selectedEmotions.length > 0 ? Math.min(selectedEmotions.length + 2, 5) : 3,
        emotions: selectedEmotions,
        tags,
        createdAt: new Date().toISOString(),
      };

      await dreamStorageManager.saveDream(dream);
      setSavedDreamId(dream.id);
      
      // 显示快捷创作区动画
      setShowQuickActions(true);
      Animated.timing(quickActionsAnim, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      }).start();
      
      Alert.alert('保存成功', '梦境已保存，开始创作吧！');
    } catch (error) {
      console.error('保存失败:', error);
      Alert.alert('保存失败', '请稍后重试');
    } finally {
      setIsSaving(false);
    }
  };

  // 生成图片 - 在当前页面直接生成，不跳转
  const handleGenerateImage = async () => {
    if (!savedDreamId || !title || !content) {
      Alert.alert('提示', '请先保存梦境');
      return;
    }

    setIsGenerating(true);
    setGeneratingType('image');
    setShowProgress(true);
    setTaskProgress(null);

    try {
      // 1. 启动异步生成任务
      const taskId = await startImageGeneration({
        prompt: content,
        style: selectedStyle,
        dreamId: savedDreamId,
        dreamTitle: title,
      });

      console.log('【RecordModule】图片生成任务已启动，任务ID:', taskId);

      // 2. 开始轮询进度
      stopPollingRef.current = startPollingProgress(taskId, async (progress) => {
        setTaskProgress(progress);

        // 任务完成
        if (progress.status === 'completed') {
          console.log('【RecordModule】图片生成完成，结果:', progress.result);

          // 停止轮询
          if (stopPollingRef.current) {
            stopPollingRef.current();
            stopPollingRef.current = null;
          }

          // 保存创作数据
          if (progress.result?.url) {
            const imagePrompt = `梦境场景：${content}，风格：${selectedStyle}`;
            const creationData = {
              id: `img_${Date.now()}`,
              type: 'image' as const,
              title: `${title} - 梦境画作`,
              dreamTitle: title,
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
            Alert.alert('生成失败', progress.error || '请检查配置和网络连接');
          }, 1000);
        }
      });
    } catch (error) {
      console.error('启动图片生成任务失败:', error);
      setShowProgress(false);
      setIsGenerating(false);
      setGeneratingType(null);
      Alert.alert('生成失败', error instanceof Error ? error.message : '请检查配置和网络连接');
    }
  };

  // 生成视频 - 在当前页面直接生成，不跳转
  const handleGenerateVideo = async () => {
    if (!savedDreamId || !title || !content) {
      Alert.alert('提示', '请先保存梦境');
      return;
    }

    setIsGenerating(true);
    setGeneratingType('video');
    setShowProgress(true);
    setTaskProgress(null);

    try {
      const taskId = await startVideoGeneration({
        prompt: content,
        dreamId: savedDreamId,
        dreamTitle: title,
      });

      console.log('【RecordModule】视频生成任务已启动，任务ID:', taskId);

      stopPollingRef.current = startPollingProgress(taskId, async (progress) => {
        setTaskProgress(progress);

        if (progress.status === 'completed') {
          if (stopPollingRef.current) {
            stopPollingRef.current();
            stopPollingRef.current = null;
          }

          if (progress.result?.url) {
            const videoPrompt = `梦境视频：${title} - ${content}`;
            await creationStorageService.saveCreation({
              id: `video_${Date.now()}`,
              type: 'video',
              title: `${title} - 梦境视频`,
              dreamTitle: title,
              dreamId: savedDreamId,
              prompt: videoPrompt,
              thumbnail: progress.result.coverUrl || progress.result.url,
              videoUrl: progress.result.url,
              coverUrl: progress.result.coverUrl,
              createdAt: new Date().toISOString(),
            });

            await loadCreations();
          }

          setTimeout(() => {
            setShowProgress(false);
            setIsGenerating(false);
            setGeneratingType(null);
            Alert.alert('生成完成', '梦境视频已生成完成！');
          }, 1000);
        }

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
      Alert.alert('生成失败', error instanceof Error ? error.message : '请检查配置和网络连接');
    }
  };

  // 生成长视频（梦境剧情）- 在当前页面直接生成，不跳转
  const handleGenerateLongVideo = async () => {
    if (!savedDreamId || !title || !content) {
      Alert.alert('提示', '请先保存梦境');
      return;
    }

    setIsGenerating(true);
    setGeneratingType('story');
    setShowProgress(true);
    setTaskProgress(null);

    try {
      const taskId = await startLongVideoGeneration({
        script: {
          title: title,
          scenes: [],
        },
        dreamId: savedDreamId,
        dreamTitle: title,
      });

      console.log('【RecordModule】长视频生成任务已启动，任务ID:', taskId);

      stopPollingRef.current = startPollingProgress(taskId, async (progress) => {
        setTaskProgress(progress);

        if (progress.status === 'completed') {
          if (stopPollingRef.current) {
            stopPollingRef.current();
            stopPollingRef.current = null;
          }

          if (progress.result?.url) {
            await creationStorageService.saveCreation({
              id: `video_long_${Date.now()}`,
              type: 'video_long',
              title: `${title} - 梦境剧情`,
              dreamTitle: title,
              dreamId: savedDreamId,
              thumbnail: progress.result.coverUrl || progress.result.url,
              videoUrl: progress.result.url,
              coverUrl: progress.result.coverUrl,
              createdAt: new Date().toISOString(),
            });

            await loadCreations();
          }

          setTimeout(() => {
            setShowProgress(false);
            setIsGenerating(false);
            setGeneratingType(null);
            Alert.alert('生成完成', '梦境剧情视频已生成完成！');
          }, 1000);
        }

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
      Alert.alert('生成失败', error instanceof Error ? error.message : '请检查配置和网络连接');
    }
  };

  // 生成梦境解读 - 在当前页面直接生成，不跳转，带进度条
  const handleGenerateInterpretation = async () => {
    if (!savedDreamId || !title || !content) {
      Alert.alert('提示', '请先保存梦境');
      return;
    }

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
    setShowProgress(true);
    setTaskProgress(null);

    // 模拟进度增长
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
      currentProgress += Math.random() * 15 + 5; // 每次增加5-20%
      if (currentProgress >= 90) {
        currentProgress = 90; // 最多到90%，等待实际完成
      }
      setTaskProgress({
        taskId: 'interpretation_task',
        type: 'interpretation',
        status: 'processing',
        progress: Math.floor(currentProgress),
        message: '正在生成梦境解读...',
      });
    }, 800);

    try {
      const response = await generateInterpretation({
        dreamContent: content,
        dreamTitle: title,
        dreamId: savedDreamId,
      });

      // 清除进度定时器
      clearInterval(progressInterval);

      if (response.success && response.data.interpretation) {
        const data = response.data;

        // 进度达到100%
        setTaskProgress({
          taskId: 'interpretation_task',
          type: 'interpretation',
          status: 'completed',
          progress: 100,
          message: '梦境解读生成完成',
        });

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
          await creationStorageService.saveCreation({
            id: `interp_${Date.now()}`,
            type: 'interpretation',
            title: `${title} - 梦境解读`,
            dreamTitle: title,
            dreamId: savedDreamId,
            interpretation: data.interpretation,
            symbols: data.symbols || [],
            emotions: data.emotions ? [data.emotions] : [],
            suggestions: data.suggestions || [],
            createdAt: new Date().toISOString(),
          });

          await loadCreations();

          // 自动展开解读详情
          setInterpretationExpanded(true);
        }, 1000);
      } else {
        throw new Error(response.message || '解读生成失败');
      }
    } catch (error) {
      clearInterval(progressInterval);
      console.error('生成解读失败:', error);

      // 使用默认解读
      const defaultInterpretation = `根据心理学理论，你的梦境「${title}」可能反映了内心深处的情感和想法。\n\n梦境中的意象往往与日常生活中的经历和情绪有关。建议你关注近期的生活状态，保持良好的作息习惯。`;

      setTaskProgress({
        taskId: 'interpretation_task',
        type: 'interpretation',
        status: 'completed',
        progress: 100,
        message: '梦境解读生成完成',
      });

      setTimeout(async () => {
        setShowProgress(false);
        setIsGenerating(false);
        setGeneratingType(null);

        // 设置默认解读数据
        setInterpretation(defaultInterpretation);
        setInterpretationData({
          symbols: [],
          emotions: { primary: '平静', intensity: 5, description: '梦境整体情绪较为平和' },
          suggestions: [
            '保持规律的作息时间，有助于提高睡眠质量',
            '尝试记录梦境日记，有助于更好地了解自己的潜意识',
          ],
          references: [],
        });

        await creationStorageService.saveCreation({
          id: `interp_${Date.now()}`,
          type: 'interpretation',
          title: `${title} - 梦境解读`,
          dreamTitle: title,
          dreamId: savedDreamId,
          interpretation: defaultInterpretation,
          symbols: [],
          emotions: [{ primary: '平静', intensity: 5, description: '梦境整体情绪较为平和' }],
          suggestions: [
            '保持规律的作息时间，有助于提高睡眠质量',
            '尝试记录梦境日记，有助于更好地了解自己的潜意识',
          ],
          createdAt: new Date().toISOString(),
        });

        await loadCreations();
        setInterpretationExpanded(true);
      }, 1000);
    }
  };

  // 查看创作作品
  const handleViewCreation = (creation: CreationItem) => {
    switch (creation.type) {
      case 'image':
        if (creation.imageUrl || creation.thumbnail) {
          navigation.navigate('ImageViewer', {
            imageUrl: creation.imageUrl || creation.thumbnail,
            title: creation.title
          });
        }
        break;
      case 'video':
      case 'video_long':
        if (creation.videoUrl) {
          navigation.navigate('VideoPlayer', {
            videoUrl: creation.videoUrl,
            coverUrl: creation.coverUrl,
            title: creation.title
          });
        }
        break;
      case 'interpretation':
        // 梦境解读展开详情
        setInterpretationExpanded(true);
        break;
    }
  };

  // 获取类型图标
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

  // 获取类型标签
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

  // 格式化录音时长
  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // 渲染日期选择器
  const renderDatePicker = () => (
    <Modal
      visible={showDatePicker}
      transparent={true}
      animationType="slide"
      onRequestClose={() => setShowDatePicker(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>选择日期</Text>
            <TouchableOpacity onPress={() => setShowDatePicker(false)}>
              <Text style={styles.modalClose}>✕</Text>
            </TouchableOpacity>
          </View>
          
          <View style={styles.pickerContainer}>
            {/* 年份选择 */}
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>年</Text>
              <FlatList
                data={generateYears()}
                keyExtractor={(item) => item.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.pickerItem,
                      selectedYear === item && styles.pickerItemSelected,
                    ]}
                    onPress={() => setSelectedYear(item)}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedYear === item && styles.pickerItemTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                style={styles.pickerList}
                initialScrollIndex={generateYears().indexOf(selectedYear)}
                getItemLayout={(data, index) => (
                  { length: 48, offset: 48 * index, index }
                )}
              />
            </View>
            
            {/* 月份选择 */}
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>月</Text>
              <FlatList
                data={generateMonths()}
                keyExtractor={(item) => item.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.pickerItem,
                      selectedMonth === item && styles.pickerItemSelected,
                    ]}
                    onPress={() => setSelectedMonth(item)}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedMonth === item && styles.pickerItemTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                style={styles.pickerList}
                initialScrollIndex={selectedMonth - 1}
                getItemLayout={(data, index) => (
                  { length: 48, offset: 48 * index, index }
                )}
              />
            </View>
            
            {/* 日期选择 */}
            <View style={styles.pickerColumn}>
              <Text style={styles.pickerLabel}>日</Text>
              <FlatList
                data={generateDays(selectedYear, selectedMonth)}
                keyExtractor={(item) => item.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity
                    style={[
                      styles.pickerItem,
                      selectedDay === item && styles.pickerItemSelected,
                    ]}
                    onPress={() => setSelectedDay(item)}
                  >
                    <Text
                      style={[
                        styles.pickerItemText,
                        selectedDay === item && styles.pickerItemTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                  </TouchableOpacity>
                )}
                showsVerticalScrollIndicator={false}
                style={styles.pickerList}
                initialScrollIndex={selectedDay - 1}
                getItemLayout={(data, index) => (
                  { length: 48, offset: 48 * index, index }
                )}
              />
            </View>
          </View>
          
          <TouchableOpacity style={styles.confirmButton} onPress={confirmDate}>
            <Text style={styles.confirmButtonText}>确定</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );



  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 生成进度遮罩层 - 支持任务轮询和模拟进度两种方式 */}
      {showProgress && (
        <GenerationProgress
          progress={taskProgress?.progress ?? 0}
          status={taskProgress?.status ?? (generatingType === 'interpretation' ? 'processing' : 'pending')}
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
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>记梦</Text>
        <TouchableOpacity
          style={[styles.closeButton, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={[styles.closeButtonText, { color: colors.text }]}>✕</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* 梦境时间 */}
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: colors.text }]}>梦境时间</Text>
          <TouchableOpacity style={[styles.datePickerButton, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={openDatePicker}>
            <Text style={[styles.datePickerText, { color: colors.text }]}>{dreamDate}</Text>
            <Text style={styles.datePickerIcon}>📅</Text>
          </TouchableOpacity>
        </View>

        {/* 梦境标题 */}
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: colors.text }]}>梦境标题</Text>
          <TextInput
            style={[styles.titleInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={title}
            onChangeText={setTitle}
            placeholder="给你的梦起个名字..."
            placeholderTextColor={colors.textDisabled}
          />
        </View>

        {/* 语音记录 */}
        <View style={styles.formGroup}>
          <View style={[styles.voiceRecordRow, { backgroundColor: colors.card, borderColor: colors.border }]}>
            {/* 左侧：录音按钮 */}
            <TouchableOpacity
              style={[
                styles.voiceRecordButton,
                isRecording && styles.voiceRecordButtonActive,
              ]}
              onPress={isRecording ? stopRecording : startRecording}
              activeOpacity={0.8}
            >
              <Animated.View
                style={[
                  styles.voiceRecordButtonInner,
                  isRecording && styles.voiceRecordButtonInnerActive,
                  { transform: [{ scale: isRecording ? pulseAnim : 1 }] },
                ]}
              >
                <Text style={styles.voiceRecordButtonIcon}>
                  {isRecording ? '⏹️' : '🎙️'}
                </Text>
              </Animated.View>
            </TouchableOpacity>

            {/* 右侧：文字说明 */}
            <View style={styles.voiceRecordInfo}>
              <Text style={[styles.voiceRecordTitle, { color: colors.text }]}>
                {isRecording ? '正在录音...' : '语音输入'}
              </Text>
              <Text style={[styles.voiceRecordDesc, { color: colors.textSecondary }]}>
                {isRecording ? formatDuration(recordingDuration) : '点击按钮语音转文字'}
              </Text>
              <Text style={[styles.voiceRecordHint, { color: colors.textLight }]}>
                🎤 自动记录音色用于声音克隆
              </Text>
            </View>
          </View>
        </View>

        {/* 梦境内容 */}
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: colors.text }]}>梦境内容</Text>
          <TextInput
            style={[styles.contentInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
            value={content}
            onChangeText={setContent}
            placeholder="描述你的梦境，或点击上方录音按钮语音输入..."
            placeholderTextColor={colors.textDisabled}
            multiline
            numberOfLines={6}
            textAlignVertical="top"
          />
        </View>

        {/* 情绪标签 */}
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: colors.text }]}>情绪感受（最多3个）</Text>
          <View style={styles.emotionsContainer}>
            {EMOTION_OPTIONS.map(emotion => (
              <TouchableOpacity
                key={emotion}
                style={[
                  styles.emotionTag,
                  { borderColor: colors.border },
                  selectedEmotions.includes(emotion) && [styles.emotionTagSelected, { backgroundColor: colors.primary }],
                ]}
                onPress={() => toggleEmotion(emotion)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.emotionTagText,
                    { color: colors.textSecondary },
                    selectedEmotions.includes(emotion) && styles.emotionTagTextSelected,
                  ]}
                >
                  {emotion}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* 自定义标签 */}
        <View style={styles.formGroup}>
          <Text style={[styles.formLabel, { color: colors.text }]}>自定义标签</Text>
          <View style={styles.tagInputContainer}>
            <TextInput
              style={[styles.tagInput, { backgroundColor: colors.card, borderColor: colors.border, color: colors.text }]}
              value={customTag}
              onChangeText={setCustomTag}
              placeholder="添加标签，按回车确认..."
              placeholderTextColor={colors.textDisabled}
              onSubmitEditing={addTag}
            />
            <TouchableOpacity style={[styles.tagAddButton, { backgroundColor: colors.primary }]} onPress={addTag}>
              <Text style={styles.tagAddButtonText}>+</Text>
            </TouchableOpacity>
          </View>

          {/* 标签列表 */}
          {tags.length > 0 && (
            <View style={styles.tagsList}>
              {tags.map(tag => (
                <View key={tag} style={[styles.tagItem, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.tagItemText, { color: colors.text }]}>{tag}</Text>
                  <TouchableOpacity onPress={() => removeTag(tag)}>
                    <Text style={[styles.tagRemoveText, { color: colors.textSecondary }]}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* 保存按钮 */}
        <TouchableOpacity
          style={[styles.saveButton, { backgroundColor: colors.primary }, isSaving && { opacity: 0.7 }]}
          onPress={handleSaveDream}
          disabled={isSaving}
          activeOpacity={0.8}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Text style={styles.saveButtonIcon}>💾</Text>
              <Text style={styles.saveButtonText}>保存梦境</Text>
            </>
          )}
        </TouchableOpacity>

        {/* 快捷创作区 */}
        {showQuickActions && (
          <Animated.View
            style={[
              styles.quickActionsContainer,
              {
                opacity: quickActionsAnim,
                transform: [
                  {
                    translateY: quickActionsAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [50, 0],
                    }),
                  },
                ],
              },
            ]}
          >
            <Text style={[styles.quickActionsTitle, { color: colors.text }]}>🎨 AI 创作</Text>

            {/* 风格选择 - 用于图片生成 */}
            <View style={styles.styleSelector}>
              <Text style={[styles.styleLabel, { color: colors.textSecondary }]}>艺术风格</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {ART_STYLES.map((style) => (
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
              {/* 梦生图片按钮 - 直接调用 handleGenerateImage */}
              <TouchableOpacity
                style={[
                  styles.quickActionButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
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
                <Text style={[styles.quickActionText, { color: colors.text }]}>梦生图片</Text>
                {!isGenerating && (
                  <Text style={[styles.quickActionQuota, { color: quota.image.unlimited ? colors.success : colors.textSecondary }]}>
                    {quota.image.unlimited ? '无限' : `${Math.max(0, quota.image.limit - quota.image.used)}/${quota.image.limit}`}
                  </Text>
                )}
              </TouchableOpacity>

              {/* 梦生视频按钮 */}
              <TouchableOpacity
                style={[
                  styles.quickActionButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
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
                <Text style={[styles.quickActionText, { color: colors.text }]}>梦生视频</Text>
                {!isGenerating && (
                  <Text style={[styles.quickActionQuota, { color: quota.video.unlimited ? colors.success : colors.textSecondary }]}>
                    {quota.video.unlimited ? '无限' : `${Math.max(0, quota.video.limit - quota.video.used)}/${quota.video.limit}`}
                  </Text>
                )}
              </TouchableOpacity>

              {/* 梦境剧情按钮 */}
              <TouchableOpacity
                style={[
                  styles.quickActionButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  isGenerating && styles.quickActionButtonDisabled,
                  generatingType === 'story' && styles.quickActionButtonActive
                ]}
                onPress={handleGenerateLongVideo}
                disabled={isGenerating}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)' }]}>
                  <Text style={{ fontSize: 24 }}>🎥</Text>
                </View>
                <Text style={[styles.quickActionText, { color: colors.text }]}>梦境剧情</Text>
                {!isGenerating && (
                  <Text style={[styles.quickActionQuota, { color: quota.story.unlimited ? colors.success : colors.textSecondary }]}>
                    {quota.story.unlimited ? '无限' : `${Math.max(0, quota.story.limit - quota.story.used)}/${quota.story.limit}`}
                  </Text>
                )}
              </TouchableOpacity>

              {/* 梦境解读按钮 */}
              <TouchableOpacity
                style={[
                  styles.quickActionButton,
                  { backgroundColor: colors.card, borderColor: colors.border },
                  isGenerating && styles.quickActionButtonDisabled,
                  generatingType === 'interpretation' && styles.quickActionButtonActive
                ]}
                onPress={handleGenerateInterpretation}
                disabled={isGenerating}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>🔮</Text>
                </View>
                <Text style={[styles.quickActionText, { color: colors.text }]}>梦境解读</Text>
                {!isGenerating && (
                  <Text style={[styles.quickActionQuota, { color: colors.textSecondary }]}>免费</Text>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* 生成的作品列表 - 显示最近2个 */}
        {savedDreamId && creations.length > 0 && (
          <View style={styles.creationsSection}>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>🎨 梦境作品</Text>
              <TouchableOpacity onPress={() => navigation.navigate('CreationCenter', { dreamId: savedDreamId })}>
                <Text style={[styles.viewAllText, { color: colors.secondary }]}>查看全部 →</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.creationsGrid}>
              {creations.slice(0, 2).map((creation) => (
                <TouchableOpacity
                  key={creation.id}
                  style={[styles.creationCard, { backgroundColor: colors.card, borderColor: colors.border }]}
                  onPress={() => handleViewCreation(creation)}
                  activeOpacity={0.8}
                >
                  {creation.thumbnail ? (
                    <View style={styles.thumbnailContainer}>
                      <Image
                        source={{ uri: creation.thumbnail, cache: 'reload' }}
                        style={styles.creationThumbnail}
                        resizeMode="cover"
                      />
                      {/* 视频类型显示播放按钮 */}
                      {(creation.type === 'video' || creation.type === 'video_long') && (
                        <View style={styles.playButtonOverlay}>
                          <View style={styles.playButton}>
                            <Text style={styles.playButtonIcon}>▶</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  ) : creation.type === 'interpretation' ? (
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
                    <View style={[styles.creationPlaceholder, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)' }]}>
                      <Text style={styles.creationIcon}>{getTypeIcon(creation.type)}</Text>
                      {/* 视频类型显示播放按钮 */}
                      {(creation.type === 'video' || creation.type === 'video_long') && (
                        <View style={styles.playButtonOverlay}>
                          <View style={styles.playButton}>
                            <Text style={styles.playButtonIcon}>▶</Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                  <View style={styles.creationInfo}>
                    <Text style={[styles.creationType, { color: colors.secondary }]}>{getTypeLabel(creation.type)}</Text>
                    <Text style={[styles.creationTitle, { color: colors.text }]} numberOfLines={1}>{creation.title}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* 梦境解读详情展示区域 - 与梦境详情页面保持一致 */}
            {(interpretation || isGenerating || interpretationExpanded) && (
              <View
                style={[
                  styles.interpretationCard,
                  { backgroundColor: colors.card, borderColor: colors.border }
                ]}
              >
                <TouchableOpacity
                  style={styles.interpretationHeader}
                  onPress={() => setInterpretationExpanded(!interpretationExpanded)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.cardTitle, { color: colors.text }]}>🔮 梦境解读</Text>
                  <Text style={[styles.expandIcon, { color: colors.textSecondary }]}>{interpretationExpanded ? '▼' : '▶'}</Text>
                </TouchableOpacity>

                {isGenerating && generatingType === 'interpretation' ? (
                  <View style={styles.generatingContainer}>
                    <ActivityIndicator size="small" color={colors.secondary} />
                    <Text style={[styles.generatingText, { color: colors.textSecondary }]}>正在生成解读...</Text>
                  </View>
                ) : interpretationExpanded ? (
                  <View style={styles.interpretationContent}>
                    {/* 整体解读 */}
                    <View style={[styles.interpretationSection, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', borderColor: colors.border }]}>
                      <Text style={[styles.interpretationSectionTitle, { color: colors.text }]}>📖 整体解读</Text>
                      {interpretation ? (
                        <Text style={[styles.interpretationText, { color: colors.textSecondary }]}>{interpretation}</Text>
                      ) : (
                        <Text style={[styles.interpretationText, { color: colors.textSecondary }]}>加载中...</Text>
                      )}
                    </View>

                    {/* 符号解读 */}
                    {interpretationData.symbols.length > 0 && (
                      <View style={[styles.interpretationSection, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', borderColor: colors.border }]}>
                        <Text style={[styles.interpretationSectionTitle, { color: colors.text }]}>🔍 符号解读</Text>
                        {interpretationData.symbols.map((symbol, index) => (
                          <View key={index} style={[styles.symbolItem, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)', borderLeftColor: colors.secondary }]}>
                            <Text style={[styles.symbolName, { color: colors.secondary }]}>{symbol.symbol}</Text>
                            <Text style={[styles.symbolMeaning, { color: colors.text }]}>{symbol.meaning}</Text>
                            <Text style={[styles.symbolContext, { color: colors.textSecondary }]}>{symbol.context}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* 情绪分析 */}
                    {interpretationData.emotions && (
                      <View style={[styles.interpretationSection, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', borderColor: colors.border }]}>
                        <Text style={[styles.interpretationSectionTitle, { color: colors.text }]}>💭 情绪分析</Text>
                        <View style={styles.emotionContainer}>
                          <View style={[styles.emotionBadge, { backgroundColor: isDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)' }]}>
                            <Text style={[styles.emotionPrimary, { color: colors.text }]}>{interpretationData.emotions.primary}</Text>
                            <View style={[styles.intensityBar, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)' }]}>
                              <View
                                style={[
                                  styles.intensityFill,
                                  { width: `${interpretationData.emotions.intensity * 10}%` }
                                ]}
                              />
                            </View>
                            <Text style={[styles.intensityText, { color: colors.textSecondary }]}>强度: {interpretationData.emotions.intensity}/10</Text>
                          </View>
                          <Text style={[styles.emotionDescription, { color: colors.textSecondary }]}>{interpretationData.emotions.description}</Text>
                        </View>
                      </View>
                    )}

                    {/* 实用建议 */}
                    {interpretationData.suggestions.length > 0 && (
                      <View style={[styles.interpretationSection, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', borderColor: colors.border }]}>
                        <Text style={[styles.interpretationSectionTitle, { color: colors.text }]}>💡 实用建议</Text>
                        {interpretationData.suggestions.map((suggestion, index) => (
                          <View key={index} style={styles.suggestionItem}>
                            <Text style={[styles.suggestionNumber, { backgroundColor: colors.primary }]}>{index + 1}</Text>
                            <Text style={[styles.suggestionText, { color: colors.text }]}>{suggestion}</Text>
                          </View>
                        ))}
                      </View>
                    )}

                    {/* 参考来源 */}
                    {interpretationData.references.length > 0 && (
                      <View style={[styles.interpretationSection, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)', borderColor: colors.border }]}>
                        <Text style={[styles.interpretationSectionTitle, { color: colors.text }]}>📚 参考来源</Text>
                        {interpretationData.references.map((ref, index) => (
                          <View key={index} style={styles.referenceItem}>
                            <Text style={[styles.referenceTitle, { color: colors.text }]}>• {ref.title}</Text>
                            <Text style={[styles.referenceSource, { color: colors.textSecondary }]}>{ref.source}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.interpretationPreview}>
                    <Text style={[styles.interpretationPreviewText, { color: colors.textSecondary }]} numberOfLines={2}>
                      {interpretation}
                    </Text>
                    <Text style={[styles.tapToExpand, { color: colors.secondary }]}>点击展开查看详情</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}

        {/* 提示 */}
        <View style={[styles.tipsContainer, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)', borderColor: colors.info }]}>
          <Text style={{ fontSize: 16 }}>💡</Text>
          <Text style={[styles.tipsText, { color: colors.textSecondary }]}>
            记录梦境的最佳时间是刚醒来时，尽量详细描述你的感受和细节
          </Text>
        </View>
      </ScrollView>

      {/* 日期选择器 */}
      {renderDatePicker()}
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
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    fontSize: 18,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  // 语音记录 - 紧凑横向布局
  voiceRecordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    gap: 16,
  },
  voiceRecordButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
  },
  voiceRecordButtonActive: {
    borderColor: '#ef4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  voiceRecordButtonInner: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6366f1',
  },
  voiceRecordButtonInnerActive: {
    backgroundColor: '#ef4444',
  },
  voiceRecordButtonIcon: {
    fontSize: 24,
  },
  voiceRecordInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  voiceRecordTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  voiceRecordDesc: {
    fontSize: 14,
    marginBottom: 4,
  },
  voiceRecordHint: {
    fontSize: 12,
  },
  // 表单样式
  formGroup: {
    marginBottom: 20,
  },
  formLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  datePickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  datePickerText: {
    fontSize: 16,
  },
  datePickerIcon: {
    fontSize: 20,
  },
  titleInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  contentInput: {
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
    minHeight: 120,
  },
  emotionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emotionTag: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
  },
  emotionTagSelected: {
    borderWidth: 0,
  },
  emotionTagText: {
    fontSize: 14,
  },
  emotionTagTextSelected: {
    fontWeight: '600',
  },
  tagInputContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  tagInput: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    fontSize: 16,
    borderWidth: 1,
  },
  tagAddButton: {
    width: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tagAddButtonText: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '600',
  },
  tagsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  tagItem: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
  },
  tagItemText: {
    fontSize: 14,
  },
  tagRemoveText: {
    fontSize: 12,
  },
  // 保存按钮
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
    paddingVertical: 16,
    gap: 8,
    marginBottom: 24,
  },
  saveButtonIcon: {
    fontSize: 20,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  // 快捷创作区
  quickActionsContainer: {
    marginBottom: 24,
  },
  quickActionsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  quickActionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  quickActionButton: {
    width: (SCREEN_WIDTH - 64) / 2,
    borderRadius: 16,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
  },
  quickActionIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  quickActionText: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  quickActionQuota: {
    fontSize: 12,
  },
  quickActionButtonDisabled: {
    opacity: 0.5,
  },
  quickActionButtonActive: {
    borderWidth: 2,
  },
  // 风格选择器样式
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
    borderWidth: 1,
    marginRight: 8,
  },
  activeStyle: {
    borderWidth: 0,
  },
  styleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  activeStyleText: {
    fontWeight: '600',
    color: '#fff',
  },
  // 作品展示区域样式
  creationsSection: {
    marginTop: 24,
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: '500',
  },
  creationsGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  creationCard: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
  },
  thumbnailContainer: {
    position: 'relative',
    width: '100%',
    height: 100,
  },
  creationThumbnail: {
    width: '100%',
    height: 100,
  },
  creationPlaceholder: {
    width: '100%',
    height: 100,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  creationIcon: {
    fontSize: 32,
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
  creationInfo: {
    padding: 8,
  },
  creationType: {
    fontSize: 10,
    fontWeight: '600',
    marginBottom: 2,
  },
  creationTitle: {
    fontSize: 12,
    fontWeight: '500',
  },
  // 梦境解读封面样式 - 与梦境详情页面保持一致
  interpretationCover: {
    width: '100%',
    height: 100,
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
    backgroundColor: 'transparent',
    borderRadius: 16,
    padding: 16,
    marginTop: 16,
    borderWidth: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
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
  },
  interpretationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  expandIcon: {
    fontSize: 16,
  },
  interpretationContent: {
    gap: 16,
  },
  interpretationPreview: {
    paddingVertical: 8,
  },
  interpretationPreviewText: {
    fontSize: 14,
    lineHeight: 22,
  },
  tapToExpand: {
    fontSize: 12,
    marginTop: 8,
    fontStyle: 'italic',
  },
  interpretationSection: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  interpretationSectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  interpretationText: {
    fontSize: 14,
    lineHeight: 22,
  },
  // 符号解读样式
  symbolItem: {
    borderRadius: 10,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
  },
  symbolName: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  symbolMeaning: {
    fontSize: 13,
    marginBottom: 4,
    lineHeight: 18,
  },
  symbolContext: {
    fontSize: 12,
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
    borderRadius: 10,
    padding: 12,
  },
  emotionPrimary: {
    fontSize: 16,
    fontWeight: '600',
    minWidth: 50,
  },
  intensityBar: {
    flex: 1,
    height: 6,
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
    minWidth: 60,
  },
  emotionDescription: {
    fontSize: 14,
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
    lineHeight: 20,
  },
  // 参考来源样式
  referenceItem: {
    marginBottom: 8,
  },
  referenceTitle: {
    fontSize: 13,
    marginBottom: 2,
  },
  referenceSource: {
    fontSize: 11,
    fontStyle: 'italic',
  },
  // 提示
  tipsContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  tipsText: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    lineHeight: 20,
  },
  // 日期选择器样式
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '50%',
    marginHorizontal: 20,
    marginBottom: 20,
    borderRadius: 24,
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
    color: '#ffffff',
  },
  modalClose: {
    fontSize: 20,
    padding: 8,
    color: '#ffffff',
  },
  pickerContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
    height: 200,
  },
  pickerColumn: {
    flex: 1,
    alignItems: 'center',
  },
  pickerLabel: {
    fontSize: 14,
    marginBottom: 8,
    color: '#ffffff',
  },
  pickerList: {
    width: '100%',
  },
  pickerItem: {
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
    marginHorizontal: 8,
  },
  pickerItemSelected: {
    backgroundColor: '#6366f1',
  },
  pickerItemText: {
    fontSize: 16,
    color: '#ffffff',
  },
  pickerItemTextSelected: {
    fontWeight: '600',
    color: '#ffffff',
  },
  confirmButton: {
    backgroundColor: '#6366f1',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
