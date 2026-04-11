import React, { useState, useRef, useEffect } from 'react';
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
} from 'react-native';
import { useTheme } from '../theme/themeContext';
import { dreamStorageManager } from '../services/storage';
import { generateImage, generateVideo, generateScript, generateInterpretation } from '../services/api/aiService';
import { creationStorageService, CreationItem } from '../services/CreationStorageService';
import { authApi } from '../services/api/authApi';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface RecordModuleProps {
  navigation: any;
  route: any;
}

type RecordMode = 'voice' | 'text';

// 情绪选项
const EMOTION_OPTIONS = ['开心', '难过', '焦虑', '恐惧', '惊讶', '愤怒', '平静', '兴奋', '困惑', '自由'];

// 艺术风格选项
const ART_STYLES = [
  { id: 'guochao', name: '国潮', icon: '🏮' },
  { id: 'cyberpunk', name: '赛博', icon: '🤖' },
  { id: 'oilpainting', name: '油画', icon: '🎨' },
  { id: 'anime', name: '动漫', icon: '🎭' },
  { id: 'sci-fi', name: '科幻', icon: '🚀' },
];

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
  
  // Tab 状态
  const [activeMode, setActiveMode] = useState<RecordMode>('voice');
  
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
  const [transcribedText, setTranscribedText] = useState('');
  
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
  
  // 日期选择器状态
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedDay, setSelectedDay] = useState(new Date().getDate());
  
  // 动画
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
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

  // Tab 切换动画
  const handleModeChange = (mode: RecordMode) => {
    if (mode === activeMode) return;
    
    Animated.sequence([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 150,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: mode === 'voice' ? 0 : 1,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 150,
        useNativeDriver: true,
      }),
    ]).start();
    
    setActiveMode(mode);
  };

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
    setTranscribedText('');
    
    const typeInterval = setInterval(() => {
      if (index < text.length) {
        setTranscribedText(prev => prev + text[index]);
        index++;
      } else {
        clearInterval(typeInterval);
        // 转写完成后自动填入内容
        setContent(text);
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

  // 快捷创作功能
  const handleQuickAction = (type: 'image' | 'video' | 'story' | 'interpretation') => {
    if (!savedDreamId) {
      Alert.alert('提示', '请先保存梦境');
      return;
    }

    const dream = {
      id: savedDreamId,
      title,
      content,
      dreamDate,
    };

    switch (type) {
      case 'image':
        navigation.navigate('DreamDetail', { dream, autoGenerate: 'image' });
        break;
      case 'video':
        navigation.navigate('DreamDetail', { dream, autoGenerate: 'video' });
        break;
      case 'story':
        navigation.navigate('DreamDetail', { dream, autoGenerate: 'story' });
        break;
      case 'interpretation':
        navigation.navigate('DreamDetail', { dream, autoGenerate: 'interpretation' });
        break;
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

  // 渲染表单字段（共用）
  const renderFormFields = () => (
    <>
      {/* 梦境时间 */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>梦境时间</Text>
        <TouchableOpacity style={styles.datePickerButton} onPress={openDatePicker}>
          <Text style={styles.datePickerText}>{dreamDate}</Text>
          <Text style={styles.datePickerIcon}>📅</Text>
        </TouchableOpacity>
      </View>

      {/* 标题 */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>梦境标题</Text>
        <TextInput
          style={styles.titleInput}
          value={title}
          onChangeText={setTitle}
          placeholder="给你的梦起个名字..."
          placeholderTextColor={colors.textDisabled}
        />
      </View>

      {/* 内容 */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>梦境内容</Text>
        <TextInput
          style={styles.contentInput}
          value={content}
          onChangeText={setContent}
          placeholder="描述你的梦境..."
          placeholderTextColor={colors.textDisabled}
          multiline
          numberOfLines={6}
          textAlignVertical="top"
        />
      </View>

      {/* 情绪标签 */}
      <View style={styles.formGroup}>
        <Text style={styles.formLabel}>情绪感受（最多3个）</Text>
        <View style={styles.emotionsContainer}>
          {EMOTION_OPTIONS.map(emotion => (
            <TouchableOpacity
              key={emotion}
              style={[
                styles.emotionTag,
                selectedEmotions.includes(emotion) && styles.emotionTagSelected,
              ]}
              onPress={() => toggleEmotion(emotion)}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.emotionTagText,
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
        <Text style={styles.formLabel}>自定义标签</Text>
        <View style={styles.tagInputContainer}>
          <TextInput
            style={styles.tagInput}
            value={customTag}
            onChangeText={setCustomTag}
            placeholder="添加标签，按回车确认..."
            placeholderTextColor={colors.textDisabled}
            onSubmitEditing={addTag}
          />
          <TouchableOpacity style={styles.tagAddButton} onPress={addTag}>
            <Text style={styles.tagAddButtonText}>+</Text>
          </TouchableOpacity>
        </View>
        
        {/* 标签列表 */}
        {tags.length > 0 && (
          <View style={styles.tagsList}>
            {tags.map(tag => (
              <View key={tag} style={styles.tagItem}>
                <Text style={styles.tagItemText}>{tag}</Text>
                <TouchableOpacity onPress={() => removeTag(tag)}>
                  <Text style={styles.tagRemoveText}>✕</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </>
  );

  // 渲染说梦Tab
  const renderVoiceMode = () => (
    <Animated.View style={[styles.modeContent, { opacity: fadeAnim }]}>
      {/* 音色提示 */}
      <View style={styles.toneNotice}>
        <Text style={{ fontSize: 16 }}>🎤</Text>
        <Text style={styles.toneNoticeText}>
          录音时会自动记录你的音色，用于后续声音克隆功能
        </Text>
      </View>

      {/* 录音按钮 */}
      <View style={styles.recordingContainer}>
        <TouchableOpacity
          style={[
            styles.recordButton,
            isRecording && styles.recordButtonActive,
          ]}
          onPress={isRecording ? stopRecording : startRecording}
          activeOpacity={0.8}
        >
          <Animated.View
            style={[
              styles.recordButtonInner,
              isRecording && styles.recordButtonInnerActive,
              { transform: [{ scale: isRecording ? pulseAnim : 1 }] },
            ]}
          >
            <Text style={styles.recordButtonIcon}>
              {isRecording ? '⏹️' : '🎙️'}
            </Text>
          </Animated.View>
        </TouchableOpacity>
        
        <Text style={styles.recordButtonText}>
          {isRecording ? '点击停止录音' : '点击开始录音'}
        </Text>
        
        {isRecording && (
          <Text style={styles.recordingDuration}>
            {formatDuration(recordingDuration)}
          </Text>
        )}
      </View>

      {/* 转写文本区 */}
      {transcribedText ? (
        <View style={styles.transcribedContainer}>
          <Text style={styles.transcribedLabel}>实时转写（已自动填入内容）</Text>
          <Text style={styles.transcribedText}>{transcribedText}</Text>
        </View>
      ) : null}

      {/* 说梦模式下的表单字段 */}
      {renderFormFields()}
    </Animated.View>
  );

  // 渲染写梦Tab
  const renderTextMode = () => (
    <Animated.View style={[styles.modeContent, { opacity: fadeAnim }]}>
      {renderFormFields()}
    </Animated.View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
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
        {/* Tab 切换 */}
        <View style={[styles.tabContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <TouchableOpacity
            style={[styles.tab, activeMode === 'voice' && { backgroundColor: colors.primary }]}
            onPress={() => handleModeChange('voice')}
            activeOpacity={0.8}
          >
            <Text style={styles.tabIcon}>🎤</Text>
            <Text style={[styles.tabText, { color: activeMode === 'voice' ? colors.text : colors.textSecondary }, activeMode === 'voice' && { fontWeight: '600' }]}>
              说梦
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, activeMode === 'text' && { backgroundColor: colors.primary }]}
            onPress={() => handleModeChange('text')}
            activeOpacity={0.8}
          >
            <Text style={styles.tabIcon}>✏️</Text>
            <Text style={[styles.tabText, { color: activeMode === 'text' ? colors.text : colors.textSecondary }, activeMode === 'text' && { fontWeight: '600' }]}>
              写梦
            </Text>
          </TouchableOpacity>
        </View>

        {/* 内容区域 */}
        {activeMode === 'voice' ? renderVoiceMode() : renderTextMode()}

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
            <View style={styles.quickActionsGrid}>
              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleQuickAction('image')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(236, 72, 153, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>🖼️</Text>
                </View>
                <Text style={[styles.quickActionText, { color: colors.text }]}>梦生图片</Text>
                <Text style={[styles.quickActionQuota, { color: quota.image.unlimited ? colors.success : colors.textSecondary }]}>
                  {quota.image.unlimited ? '无限' : `${Math.max(0, quota.image.limit - quota.image.used)}/${quota.image.limit}`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleQuickAction('video')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(59, 130, 246, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>🎬</Text>
                </View>
                <Text style={[styles.quickActionText, { color: colors.text }]}>梦生视频</Text>
                <Text style={[styles.quickActionQuota, { color: quota.video.unlimited ? colors.success : colors.textSecondary }]}>
                  {quota.video.unlimited ? '无限' : `${Math.max(0, quota.video.limit - quota.video.used)}/${quota.video.limit}`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleQuickAction('story')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)' }]}>
                  <Text style={{ fontSize: 24 }}>🎥</Text>
                </View>
                <Text style={[styles.quickActionText, { color: colors.text }]}>梦境剧情</Text>
                <Text style={[styles.quickActionQuota, { color: quota.story.unlimited ? colors.success : colors.textSecondary }]}>
                  {quota.story.unlimited ? '无限' : `${Math.max(0, quota.story.limit - quota.story.used)}/${quota.story.limit}`}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.quickActionButton, { backgroundColor: colors.card, borderColor: colors.border }]}
                onPress={() => handleQuickAction('interpretation')}
                activeOpacity={0.8}
              >
                <View style={[styles.quickActionIcon, { backgroundColor: 'rgba(245, 158, 11, 0.15)' }]}>
                  <Text style={{ fontSize: 24 }}>🔮</Text>
                </View>
                <Text style={[styles.quickActionText, { color: colors.text }]}>梦境解读</Text>
                <Text style={[styles.quickActionQuota, { color: colors.textSecondary }]}>免费</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
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
  tabContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 4,
    marginBottom: 24,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 8,
    gap: 8,
  },
  tabIcon: {
    fontSize: 16,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  modeContent: {
    marginBottom: 24,
  },
  // 说梦样式
  toneNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 12,
    marginBottom: 24,
    borderWidth: 1,
  },
  toneNoticeText: {
    flex: 1,
    fontSize: 13,
    marginLeft: 8,
  },
  recordingContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  recordButton: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 16,
  },
  recordButtonActive: {
    borderColor: '#ef4444',
  },
  recordButtonInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  recordButtonInnerActive: {
    backgroundColor: '#ef4444',
  },
  recordButtonIcon: {
    fontSize: 32,
  },
  recordButtonText: {
    fontSize: 16,
    marginBottom: 8,
  },
  recordingDuration: {
    fontSize: 24,
    fontWeight: '600',
  },
  transcribedContainer: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
  },
  transcribedLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  transcribedText: {
    fontSize: 16,
    lineHeight: 24,
  },
  // 写梦样式
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
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '70%',
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
  },
  modalClose: {
    fontSize: 20,
    padding: 8,
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
  },
  pickerItemTextSelected: {
    fontWeight: '600',
    color: '#fff',
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
