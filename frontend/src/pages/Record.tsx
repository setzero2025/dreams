import React, { useState, useEffect, useRef } from 'react';
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
} from 'react-native';
// import { Mic, Edit3, Save, ArrowLeft, Clock, Moon } from 'lucide-react-native';
import { Button } from '../components/Button';
import { useTheme } from '../theme/themeContext';
import { dreamStorageManager } from '../services/storage';
// 动态导入语音转写服务和录音服务
let XfyunSpeechService: any = null;
let AudioRecordingService: any = null;
let MockAudioRecordingService: any = null;

// 检测是否在 Expo Go 环境中
const isExpoGo = true; // 默认为true，打包时改为 false

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
  
  // 语音转写服务实例
  const speechServiceRef = useRef<XfyunSpeechService | null>(null);
  // 录音服务实例
  const audioRecordingRef = useRef<any>(null);

  const tags = ['噩梦', '美梦', '奇幻', '冒险', '未来', '科技', '森林', '星空'];
  
  const waveformAnimations = useRef<Animated.Value[]>([]);
  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const moodAnimations = useRef<Animated.Value[]>([]);

  useEffect(() => {
    // 初始化波形动画
    waveformAnimations.current = Array(8).fill(0).map(() => new Animated.Value(1));
    moodAnimations.current = Array(5).fill(0).map(() => new Animated.Value(1));

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
      // 使用存储管理器保存梦境（自动根据登录状态选择本地或云端存储）
      await dreamStorageManager.saveDream({
        title: title.trim(),
        content: content.trim(),
        contentType: mode,
        moodRating,
        dreamDate: new Date().toISOString(),
        tags: selectedTags,
      });

      // 获取存储模式信息
      const storageMode = await dreamStorageManager.getStorageMode();
      const successMessage = storageMode.isLoggedIn 
        ? '梦境已保存到云端' 
        : '梦境已保存到本地（登录后可永久保存）';

      Alert.alert('成功', successMessage, [
        { 
          text: '确定', 
          onPress: () => {
            // 使用 reset 重置导航栈，确保首页和生成页都能刷新
            navigation.reset({
              index: 0,
              routes: [
                { 
                  name: 'Home', 
                  params: { refresh: true }
                }
              ],
            });
          } 
        }
      ]);
    } catch (error) {
      console.error('保存梦境失败:', error);
      Alert.alert('保存失败', error instanceof Error ? error.message : '保存梦境时发生错误');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      // 停止录音
      setIsRecording(false);
      setIsTranscribing(true);
      
      // 停止录音服务
      if (audioRecordingRef.current) {
        try {
          const audioUri = await audioRecordingRef.current.stop();
          console.log('录音文件URI:', audioUri);
          
          // 读取音频文件并发送到科大讯飞
          if (audioUri && speechServiceRef.current) {
            const audioData = await audioRecordingRef.current.readAudioFile(audioUri);
            if (audioData) {
              console.log('读取音频文件成功，大小:', audioData.byteLength);
              // 发送音频数据到科大讯飞
              speechServiceRef.current.sendAudioData(audioData);
              // 发送结束标志
              setTimeout(() => {
                speechServiceRef.current?.sendEndMessage();
              }, 1000);
            }
          }
          
          audioRecordingRef.current = null;
        } catch (error) {
          console.error('停止录音失败:', error);
        }
      }
      
      // 停止语音转写服务
      if (speechServiceRef.current) {
        try {
          await speechServiceRef.current.stop();
          speechServiceRef.current = null;
        } catch (error) {
          console.error('停止语音转写失败:', error);
        }
      }
      
      setIsTranscribing(false);
      setRecordingTime(0);
    } else {
      // 开始录音和转写
      setIsRecording(true);
      setIsTranscribing(true);
      setContent('');
      
      try {
        // 动态导入服务
        if (!XfyunSpeechService) {
          const xfyunModule = await import('../services/XfyunSpeechService');
          XfyunSpeechService = xfyunModule.XfyunSpeechService;
        }
        
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
        
        // 初始化语音转写服务
        speechServiceRef.current = new XfyunSpeechService({
          onTextResult: (text: string) => {
            console.log('【语音转写结果】', text);
            setContent(prev => prev + text);
          },
          onError: (error: Error) => {
            console.error('语音转写错误:', error);
            Alert.alert('转写失败', error.message || '语音转写过程中发生错误');
            setIsRecording(false);
            setIsTranscribing(false);
          },
          onClose: () => {
            console.log('语音转写连接已关闭');
          }
        });
        
        // 初始化录音服务
        const RecordingService = isExpoGo ? MockAudioRecordingService : AudioRecordingService;
        audioRecordingRef.current = new RecordingService({
          onAudioData: (audioData: ArrayBuffer) => {
            // 实时发送音频数据（如果需要）
            console.log('实时音频数据:', audioData.byteLength);
          },
          onError: (error: Error) => {
            console.error('录音错误:', error);
            Alert.alert('录音失败', error.message);
            setIsRecording(false);
            setIsTranscribing(false);
          }
        });
        
        // 先启动语音转写服务（建立WebSocket连接）
        await speechServiceRef.current.start();
        
        // 再开始录音
        await audioRecordingRef.current.start();
        
        console.log('录音和转写服务已启动');
      } catch (error) {
        console.error('开始录音失败:', error);
        Alert.alert('录音失败', error instanceof Error ? error.message : '无法开始录音，请检查配置和网络连接');
        setIsRecording(false);
        setIsTranscribing(false);
      }
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

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 24, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>记录梦境</Text>
        <Button
          title="保存"
          onPress={handleSave}
          variant="primary"
          size="small"
          loading={isSaving}
          disabled={isSaving}
        />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Mode Selector */}
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

        {/* Title Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>梦境标题</Text>
          <TextInput
            style={styles.titleInput}
            placeholder="给你的梦境起个名字..."
            placeholderTextColor={colors.textDisabled}
            value={title}
            onChangeText={setTitle}
            autoFocus={mode === 'text'}
            maxLength={50}
          />
          <Text style={styles.charCount}>{title.length}/50</Text>
        </View>

        {/* Content Input */}
        <View style={styles.inputSection}>
          <Text style={styles.label}>梦境内容</Text>
          {mode === 'voice' ? (
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
                style={styles.contentInput}
                placeholder="描述你的梦境..."
                placeholderTextColor={colors.textDisabled}
                value={content}
                onChangeText={setContent}
                multiline
                textAlignVertical="top"
                maxLength={1000}
              />
              <Text style={styles.charCount}>{content.length}/1000</Text>
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

        {/* Voice Tone Notice */}
        {mode === 'voice' && (
          <View style={styles.toneNotice}>
            <Text style={{ fontSize: 16 }}>🎤</Text>
            <Text style={styles.toneNoticeText}>
              录音时会自动记录你的音色，用于后续声音克隆功能
            </Text>
          </View>
        )}

        {/* Tips */}
        <View style={styles.tips}>
          <Text style={{ fontSize: 16, color: colors.info }}>🌙</Text>
          <Text style={styles.tipsText}>
            💡 记录梦境的最佳时间是刚醒来时，尽量详细描述你的感受和细节
          </Text>
        </View>
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
});
