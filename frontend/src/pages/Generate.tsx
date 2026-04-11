import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Image,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Button } from '../components/Button';
import { mockGenerations } from '../data/mockData';
import { Dream } from '../types';
import { useTheme } from '../theme/themeContext';
import { creationStorageService } from '../services/CreationStorageService';
import { generateImage, generateVideo } from '../services/api/aiService';
import { API_BASE_URL } from '../config/api';

interface GenerateProps {
  navigation: any;
}

export const Generate: React.FC<GenerateProps> = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const initialDreamId = route.params?.dreamId;
  const initialGenerateType = route.params?.generateType as 'image' | 'video' | 'script' | 'video_long' || 'image';
  
  const [dreams, setDreams] = useState<Dream[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDream, setSelectedDream] = useState<Dream | null>(null);
  const [generateType, setGenerateType] = useState<'image' | 'video' | 'video_long'>(initialGenerateType);
  const [style, setStyle] = useState('写实');
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [showImageModal, setShowImageModal] = useState(false);
  const [generationHistory, setGenerationHistory] = useState<Array<{url: string, style: string, dreamTitle: string, date: Date}>>([]);
  const [scriptHistory, setScriptHistory] = useState<Array<{id: string, type: 'script', title: string, dreamTitle: string, script: any, date: Date}>>([]);

  const fetchDreams = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/dreams`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token-for-development',
        },
      });
      
      if (response.ok) {
        const data = await response.json();
        setDreams(data);
        
        // 如果有初始梦境ID，选择对应的梦境
        if (initialDreamId) {
          const initialDream = data.find((dream: Dream) => dream.id === initialDreamId);
          if (initialDream) {
            setSelectedDream(initialDream);
          }
        }
      }
    } catch (error) {
      console.error('获取梦境列表失败:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDreams();
  }, []);

  // 监听路由参数变化，处理刷�?
  useEffect(() => {
    if (route.params?.refresh) {
      fetchDreams();
      // 清除刷新参数，避免重复刷�?
      navigation.setParams({ refresh: false });
    }
  }, [route.params?.refresh]);

  const stylesList = ['写实', '油画', '水彩', '赛博朋克'];

  const handleGenerate = async () => {
    if (!selectedDream) {
      Alert.alert('提示', '请选择一个梦境');
      return;
    }

    setIsGenerating(true);
    setProgress(0);

    try {
      if (generateType === 'image') {
        // 梦境画作 - 调用豆包 Seedream
        await generateDreamImage();
      } else if (generateType === 'script') {
        // 梦境剧本 - 调用 Kimi
        await generateDreamScript();
      } else if (generateType === 'video') {
        // 短视频 - 调用阿里 Wan2.6-T2V
        await generateDreamVideo();
      } else if (generateType === 'video_long') {
        // 长视频 - 先生成剧本，再生成视频
        await generateLongVideoWithScript();
      }
    } catch (error) {
      console.error('生成失败:', error);
      Alert.alert('生成失败', error instanceof Error ? error.message : '请检查配置和网络连接');
    } finally {
      setIsGenerating(false);
      setProgress(0);
    }
  };

  // 生成梦境画作
  const generateDreamImage = async () => {
    try {
      // 模拟进度
      const progressInterval = setInterval(() => {
        setProgress(prev => (prev >= 90 ? 90 : prev + 10));
      }, 500);

      // 调用后端 API
      const response = await generateImage({
        prompt: selectedDream!.content,
        style: style,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.success || !response.data.url) {
        throw new Error(response.message || '图片生成失败');
      }

      // 保存生成的图片
      setGeneratedImage(response.data.url);
      
      // 添加到历史记录
      const newHistoryItem = {
        url: response.data.url,
        style: style,
        dreamTitle: selectedDream!.title,
        date: new Date(),
      };
      setGenerationHistory(prev => [newHistoryItem, ...prev]);

      // 构建AI图片生成使用的完整提示词
      const imagePrompt = `梦境场景：${selectedDream!.content}，风格：${style}`;

      // 保存到创作中心存储
      await creationStorageService.saveCreation({
        id: `img_${Date.now()}`,
        type: 'image',
        title: `${selectedDream!.title} - 梦境画作`,
        dreamTitle: selectedDream!.title,
        dreamId: selectedDream!.id,
        // 存储AI生成时使用的原始提示词
        prompt: imagePrompt,
        thumbnail: response.data.url,
        imageUrl: response.data.url,
        createdAt: new Date().toISOString(),
      });

      // 显示生成结果
      Alert.alert(
        '梦境画作生成完成',
        '你的梦境画作已经生成完成',
        [
          { 
            text: '查看画作', 
            onPress: () => {
              setShowImageModal(true);
            } 
          }
        ]
      );

    } catch (error) {
      console.error('生成梦境画作失败:', error);
      throw error;
    }
  };

  // 生成梦境剧本
  const generateDreamScript = async () => {
    try {
      // 模拟进度
      const progressInterval = setInterval(() => {
        setProgress(prev => (prev >= 90 ? 90 : prev + 5));
      }, 800);

      // 调用后端 API
      const { generateScript } = await import('../services/api/aiService');
      const response = await generateScript({
        dreamContent: selectedDream!.content,
        dreamTitle: selectedDream!.title,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (!response.success || !response.data.scenes) {
        throw new Error(response.message || '剧本生成失败');
      }

      const expandedScript = response.data;

      // 转换为应用内使用的剧本格式
      const formattedScript = {
        title: expandedScript.title,
        scenes: expandedScript.scenes.map((scene: any) => ({
          id: `scene${scene.scene_number}`,
          title: `场景 ${scene.scene_number}`,
          description: scene.description,
          duration: scene.duration,
          visual: scene.camera,
          narration: scene.narration,
          mood: scene.mood,
        })),
      };

      // 计算总时长
      const totalDuration = expandedScript.scenes.reduce((sum: number, scene: any) => sum + scene.duration, 0);

      // 保存生成的剧本到历史记录
      const newScriptHistoryItem = {
        id: Date.now().toString(),
        type: 'script' as const,
        title: expandedScript.title,
        dreamTitle: selectedDream!.title,
        script: formattedScript,
        date: new Date(),
      };
      setScriptHistory(prev => [newScriptHistoryItem, ...prev]);

      // 保存到创作中心存储
      const scriptId = `script_${Date.now()}`;
      await creationStorageService.saveCreation({
        id: scriptId,
        type: 'script',
        title: expandedScript.title,
        dreamTitle: selectedDream!.title,
        dreamId: selectedDream!.id,
        script: formattedScript,
        createdAt: new Date().toISOString(),
      });

      Alert.alert(
        '剧本生成完成',
        `你的梦境剧本已经生成完成！\n总时长: ${totalDuration}秒\n分镜数: ${expandedScript.scenes.length}个`,
        [
          { 
            text: '查看剧本', 
            onPress: () => navigation.navigate('ScriptViewer', { 
              dream: selectedDream,
              script: formattedScript
            }) 
          },
          { 
            text: '生成视频', 
            onPress: () => navigation.navigate('ScriptToVideo', { 
              dream: selectedDream,
              script: formattedScript
            }) 
          }
        ]
      );

    } catch (error) {
      console.error('生成剧本失败:', error);
      throw error;
    }
  };

  // 生成长视频（先生成剧本，再生成视频）
  const generateLongVideoWithScript = async () => {
    try {
      // 第一步：生成剧本
      setProgress(10);
      setStatusText('正在生成剧本...');

      const { generateScript } = await import('../services/api/aiService');
      const response = await generateScript({
        dreamContent: selectedDream!.content,
        dreamTitle: selectedDream!.title,
      });

      if (!response.success || !response.data.scenes) {
        throw new Error(response.message || '剧本生成失败');
      }

      const expandedScript = response.data;

      // 检查场景数量（测试环境：至少4个场景）
      const TEST_SCENE_COUNT = 4;
      if (expandedScript.scenes.length < TEST_SCENE_COUNT) {
        throw new Error(`剧本场景数量不足：${expandedScript.scenes.length}个，需要至少${TEST_SCENE_COUNT}个`);
      }

      // 转换为应用内使用的剧本格式
      const formattedScript = {
        title: expandedScript.title,
        scenes: expandedScript.scenes.map((scene: any) => ({
          id: `scene${scene.scene_number}`,
          title: `场景 ${scene.scene_number}`,
          description: scene.description,
          duration: scene.duration,
          visual: scene.camera,
          narration: scene.narration,
          mood: scene.mood,
        })),
      };

      // 保存剧本到创作中心
      const scriptId = `script_${Date.now()}`;
      await creationStorageService.saveCreation({
        id: scriptId,
        type: 'script',
        title: expandedScript.title,
        dreamTitle: selectedDream!.title,
        dreamId: selectedDream!.id,
        script: formattedScript,
        createdAt: new Date().toISOString(),
      });

      setIsGenerating(false);

      // 剧本生成完成，自动跳转到长视频生成页面
      navigation.navigate('ScriptToVideo', {
        dream: selectedDream,
        script: formattedScript
      });

    } catch (error) {
      console.error('生成长视频剧本失败:', error);
      throw error;
    }
  };

  // 生成梦境视频（调用后端API）
  const generateDreamVideo = async () => {
    try {
      // 模拟进度
      const progressInterval = setInterval(() => {
        setProgress(prev => (prev >= 90 ? 90 : prev + 5));
      }, 1000);

      const response = await generateVideo({
        dreamContent: selectedDream!.content,
        dreamTitle: selectedDream!.title,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.success && response.data.videoUrl) {
        // 构建AI视频生成使用的完整提示词
        const videoPrompt = `梦境视频：${selectedDream!.title} - ${selectedDream!.content}`;

        // 保存到创作中心存储
        await creationStorageService.saveCreation({
          id: `video_${Date.now()}`,
          type: 'video',
          title: `${selectedDream!.title} - 梦境视频`,
          dreamTitle: selectedDream!.title,
          dreamId: selectedDream!.id,
          // 存储AI生成时使用的原始提示词
          prompt: videoPrompt,
          thumbnail: response.data.coverUrl || response.data.videoUrl,
          videoUrl: response.data.videoUrl,
          coverUrl: response.data.coverUrl,
          createdAt: new Date().toISOString(),
        });

        Alert.alert(
          '视频生成完成',
          '你的梦境视频已经生成完成',
          [
            { 
              text: '播放视频', 
              onPress: () => navigation.navigate('VideoPlayer', { 
                videoUrl: response.data.videoUrl,
                coverUrl: response.data.coverUrl,
                title: `${selectedDream!.title} - 梦境视频`
              }) 
            },
            { text: '确定', style: 'cancel' }
          ]
        );
      } else {
        throw new Error(response.message || '视频生成失败');
      }

    } catch (error) {
      console.error('生成视频失败:', error);
      Alert.alert('生成失败', error instanceof Error ? error.message : '请检查配置和网络连接');
      throw error;
    }
  };

  // 模拟生成
  const mockGenerate = async () => {
    return new Promise<void>((resolve) => {
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) {
            clearInterval(progressInterval);
            
            Alert.alert(
              '生成完成',
              `你的${generateType === 'video' ? '动态梦境' : '长视频'}已生成完成`,
              [
                { text: '查看结果', onPress: () => {} }
              ]
            );
            
            resolve();
            return 100;
          }
          return prev + Math.random() * 15 + 5;
        });
      }, 300);
    });
  };

  const handleDreamSelect = (dream: Dream) => {
    setSelectedDream(dream);
  };

  const renderProgressOverlay = () => {
    if (!isGenerating) return null;
    
    return (
      <View style={styles.progressOverlay}>
        <View style={styles.progressContainer}>
          <Text style={{ fontSize: 56, color: colors.secondary }}>🌌</Text>
          <Text style={styles.progressText}>梦境生成中...</Text>
          <Text style={styles.progressPercentage}>{Math.floor(progress)}%</Text>
          <View style={styles.progressBar}>
            <View
              style={[
                styles.progressFill,
                {
                  width: `${progress}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressHint}>
            正在编织你的梦境...
          </Text>
        </View>
      </View>
    );
  };

  const renderStylePreview = (styleName: string) => {
    const previews = {
      '写实': '逼真光影，细腻细节',
      '油画': '厚重笔触，浓郁色彩',
      '水彩': '柔和过渡，梦幻氛围',
      '赛博朋克': '霓虹闪烁，未来科技',
    };
    
    return previews[styleName as keyof typeof previews] || '';
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 28, color: '#ffffff', fontWeight: '300' }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>梦境生成</Text>
        <Button
          title="生成"
          onPress={handleGenerate}
          variant="primary"
          size="small"
          loading={isGenerating}
          disabled={!selectedDream}
        />
      </View>

      <ScrollView 
        style={styles.scrollView} 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            选择你的梦境
          </Text>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.secondary} />
              <Text style={styles.loadingText}>加载梦境中...</Text>
            </View>
          ) : dreams.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyIcon}>🌙</Text>
              <Text style={styles.emptyText}>还没有梦境记录</Text>
              <Text style={styles.emptySubtext}>请先记录你的梦境，然后再来生成</Text>
            </View>
          ) : (
            dreams.map((dream) => (
              <TouchableOpacity
                key={dream.id}
                style={[
                  styles.dreamOption,
                  selectedDream?.id === dream.id && styles.selectedDream
                ]}
                onPress={() => handleDreamSelect(dream)}
                activeOpacity={0.8}
              >
                <View style={styles.dreamInfo}>
                  <Text style={styles.dreamTitle}>{dream.title}</Text>
                  <Text style={styles.dreamDate}>{new Date(dream.dreamDate).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}</Text>
                  <Text style={styles.dreamContentPreview} numberOfLines={2}>
                    {dream.content}
                  </Text>
                </View>
                {selectedDream?.id === dream.id && (
                  <View style={styles.checkmark}>
                <Text style={{ fontSize: 24, color: colors.secondary }}>✓</Text>
              </View>
                )}
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>创作形式</Text>
          <View style={styles.typeSelector}>
            <TouchableOpacity
              style={[
                styles.typeButton,
                generateType === 'image' && styles.activeType
              ]}
              onPress={() => setGenerateType('image')}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 32, color: generateType === 'image' ? colors.text : colors.textLight }}>🖼️</Text>
              <Text style={[
                styles.typeText,
                generateType === 'image' && styles.activeTypeText
              ]}>
                图片
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                generateType === 'video' && styles.activeType
              ]}
              onPress={() => setGenerateType('video')}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 32, color: generateType === 'video' ? colors.text : colors.textLight }}>🎬</Text>
              <Text style={[
                styles.typeText,
                generateType === 'video' && styles.activeTypeText
              ]}>
                视频
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.typeButton,
                generateType === 'video_long' && styles.activeType
              ]}
              onPress={() => setGenerateType('video_long')}
              activeOpacity={0.8}
            >
              <Text style={{ fontSize: 32, color: generateType === 'video_long' ? colors.text : colors.textLight }}>🎥</Text>
              <Text style={[
                styles.typeText,
                generateType === 'video_long' && styles.activeTypeText
              ]}>
                长视频
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {generateType === 'image' && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>艺术风格</Text>
            <View style={styles.styleSelector}>
              {stylesList.map((styleOption) => (
                <TouchableOpacity
                  key={styleOption}
                  style={[
                    styles.styleButton,
                    style === styleOption && styles.activeStyle
                  ]}
                  onPress={() => setStyle(styleOption)}
                  activeOpacity={0.8}
                >
                  <Text style={[
                    styles.styleText,
                    style === styleOption && styles.activeStyleText
                  ]}>
                    {styleOption}
                  </Text>
                  {style === styleOption && (
                    <Text style={styles.stylePreview}>{renderStylePreview(styleOption)}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {(generateType === 'video' || generateType === 'video_long') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>视频设置</Text>
            <View style={styles.videoSettings}>
              <TouchableOpacity
                style={[
                  styles.settingButton,
                  style === '写实' && styles.activeStyle
                ]}
                onPress={() => setStyle('写实')}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.styleText,
                  style === '写实' && styles.activeStyleText
                ]}>
                  写实风格
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.settingButton,
                  style === '奇幻' && styles.activeStyle
                ]}
                onPress={() => setStyle('奇幻')}
                activeOpacity={0.8}
              >
                <Text style={[
                  styles.styleText,
                  style === '奇幻' && styles.activeStyleText
                ]}>
                  奇幻风格
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* 创作历史 */}
        {(generationHistory.length > 0 || mockGenerations.length > 0) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>创作历史</Text>
            {/* 显示新生成的历史记录 */}
            {generationHistory.map((item, index) => (
              <View key={index} style={[styles.previewCard, { marginBottom: 16 }]}>
                <TouchableOpacity onPress={() => { setGeneratedImage(item.url); setShowImageModal(true); }}>
                  <Image
                    source={{ uri: item.url }}
                    style={styles.previewImage}
                    resizeMode="cover"
                  />
                </TouchableOpacity>
                <View style={styles.previewInfo}>
                  <Text style={styles.previewTitle}>{item.dreamTitle}</Text>
                  <Text style={styles.previewStyle}>风格: {item.style} · {item.date.toLocaleDateString('zh-CN')}</Text>
                  <View style={styles.previewActions}>
                    <TouchableOpacity 
                      style={styles.previewActionButton}
                      onPress={() => { setGeneratedImage(item.url); setShowImageModal(true); }}
                    >
                      <Text style={styles.previewActionText}>查看</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.previewActionButton}>
                      <Text style={styles.previewActionText}>分享</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            ))}
            {/* 显示模拟数据 */}
            {mockGenerations.length > 0 && generationHistory.length === 0 && (
              <View style={styles.previewCard}>
                <Image
                  source={{ uri: mockGenerations[0].result_url }}
                  style={styles.previewImage}
                  resizeMode="cover"
                />
                <View style={styles.previewInfo}>
                  <Text style={styles.previewTitle}>梦境再现</Text>
                  <Text style={styles.previewStyle}>风格: {mockGenerations[0].style}</Text>
                  <View style={styles.previewActions}>
                    <TouchableOpacity style={styles.previewActionButton}>
                      <Text style={styles.previewActionText}>查看</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.previewActionButton}>
                      <Text style={styles.previewActionText}>分享</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            )}
          </View>
        )}

        <View style={styles.tips}>
          <Text style={styles.tipsTitle}>💫 创作提示</Text>
          <Text style={styles.tipsText}>• 梦境描述越详细，生成效果越精美</Text>
          <Text style={styles.tipsText}>• 图片：将梦境转为艺术画作</Text>
          <Text style={styles.tipsText}>• 视频：AI生成10秒短视频</Text>
          <Text style={styles.tipsText}>• 长视频：先生成剧本，再生成1分钟长视频</Text>
          <Text style={styles.tipsText}>• 长视频生成需要更多时间，请耐心等待</Text>
        </View>
      </ScrollView>

      {renderProgressOverlay()}
      
      {/* 图片预览模态框 */}
      {showImageModal && generatedImage && (
        <View style={styles.imageModalOverlay}>
          <TouchableOpacity 
            style={styles.imageModalBackground}
            onPress={() => setShowImageModal(false)}
          >
            <View style={styles.imageModalContent}>
              <Image
                source={{ uri: generatedImage }}
                style={styles.imageModalImage}
                resizeMode="contain"
              />
              <TouchableOpacity 
                style={styles.imageModalCloseButton}
                onPress={() => setShowImageModal(false)}
              >
                <Text style={styles.imageModalCloseText}>✕ 关闭</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </View>
      )}
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
    paddingHorizontal: 24,
    paddingVertical: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(139, 92, 246, 0.2)',
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
  },
  backButton: {
    padding: 12,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 24,
    letterSpacing: 0.5,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 40,
  },
  section: {
    marginHorizontal: 24,
    marginVertical: 20,
  },
  sectionTitle: {
    fontSize: 22,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 20,
    letterSpacing: 0.3,
  },
  dreamOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'colors.card',
    padding: 20,
    borderRadius: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.25,
    shadowRadius: 16,
    elevation: 8,
  },
  selectedDream: {
    borderColor: colors.secondary,
    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
    shadowColor: colors.secondary,
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.35,
    shadowRadius: 20,
    elevation: 12,
  },
  dreamInfo: {
    flex: 1,
    marginRight: 16,
  },
  dreamTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  dreamDate: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 8,
    fontWeight: '400',
  },
  dreamContentPreview: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    opacity: 0.9,
  },
  checkmark: {
    padding: 12,
    backgroundColor: colors.secondary,
    borderRadius: 12,
    shadowColor: colors.secondary,
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
  },
  typeSelector: {
    flexDirection: 'row',
    gap: 16,
  },
  typeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'colors.card',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  activeType: {
    borderColor: colors.secondary,
    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
    shadowColor: colors.secondary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  typeText: {
    fontSize: 16,
    color: colors.textLight,
    marginLeft: 12,
    fontWeight: '500',
  },
  activeTypeText: {
    color: colors.text,
    fontWeight: '600',
  },
  styleSelector: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  styleButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'colors.card',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 120,
    alignItems: 'center',
  },
  videoSettings: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  settingButton: {
    paddingHorizontal: 24,
    paddingVertical: 16,
    backgroundColor: 'colors.card',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
    minWidth: 120,
    alignItems: 'center',
  },
  activeStyle: {
    backgroundColor: colors.secondary,
    borderColor: colors.secondary,
    shadowColor: colors.secondary,
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 8,
  },
  styleText: {
    fontSize: 16,
    color: colors.textLight,
    fontWeight: '500',
  },
  activeStyleText: {
    color: colors.text,
    fontWeight: '600',
  },
  stylePreview: {
    fontSize: 12,
    color: colors.text,
    marginTop: 6,
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: 16,
  },
  previewCard: {
    backgroundColor: 'colors.card',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 12,
    },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
    overflow: 'hidden',
  },
  previewImage: {
    width: '100%',
    height: 220,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
  },
  previewInfo: {
    padding: 20,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 6,
    letterSpacing: 0.2,
  },
  previewStyle: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 16,
  },
  previewActions: {
    flexDirection: 'row',
    gap: 12,
  },
  previewActionButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.15)' : 'rgba(139, 92, 246, 0.1)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  previewActionText: {
    fontSize: 14,
    color: colors.secondary,
    fontWeight: '500',
  },
  tips: {
    marginHorizontal: 24,
    marginVertical: 20,
    padding: 20,
    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.secondary,
    shadowColor: colors.secondary,
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 6,
  },
  tipsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    letterSpacing: 0.2,
  },
  tipsText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
    lineHeight: 22,
    fontWeight: '400',
  },
  progressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 15, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  progressContainer: {
    backgroundColor: 'rgba(26, 26, 46, 0.95)',
    borderRadius: 24,
    padding: 40,
    alignItems: 'center',
    minWidth: 320,
    borderWidth: 2,
    borderColor: 'rgba(139, 92, 246, 0.3)',
    shadowColor: colors.secondary,
    shadowOffset: {
      width: 0,
      height: 20,
    },
    shadowOpacity: 0.4,
    shadowRadius: 30,
    elevation: 15,
  },
  progressText: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
    letterSpacing: 0.3,
  },
  progressPercentage: {
    fontSize: 48,
    fontWeight: '700',
    color: colors.secondary,
    marginBottom: 20,
    letterSpacing: 1,
  },
  progressBar: {
    width: '100%',
    height: 10,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 20,
    borderWidth: 1,
    borderColor: isDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.1)',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: 20,
  },
  progressHint: {
    fontSize: 14,
    color: colors.textSecondary,
    fontStyle: 'italic',
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
  imageModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2000,
  },
  imageModalBackground: {
    flex: 1,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalContent: {
    width: '90%',
    height: '80%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageModalImage: {
    width: '100%',
    height: '90%',
    borderRadius: 16,
  },
  imageModalCloseButton: {
    marginTop: 20,
    paddingHorizontal: 30,
    paddingVertical: 12,
    backgroundColor: 'rgba(139, 92, 246, 0.3)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  imageModalCloseText: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '600',
  },
});
