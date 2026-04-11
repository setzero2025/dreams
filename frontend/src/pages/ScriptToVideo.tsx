import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
  Image,
  Dimensions,
} from 'react-native';
import { useTheme } from '../theme/themeContext';
import { generateLongVideo } from '../services/api/aiService';
import { creationStorageService } from '../services/CreationStorageService';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ScriptScene {
  scene_number: number;
  duration: number;
  description: string;
  camera: string;
  narration: string;
  mood: string;
}

interface Script {
  title: string;
  total_duration: number;
  scenes: ScriptScene[];
}

interface ScriptToVideoProps {
  navigation: any;
  route: {
    params: {
      script?: Script;
      dream?: {
        id: string;
        title: string;
        content?: string;
      };
    };
  };
}

// 场景状态组件
const SceneStatusItem: React.FC<{
  sceneNumber: number;
  description: string;
  status: string;
  imageUrl?: string;
}> = ({ sceneNumber, description, status, imageUrl }) => {
  const getStatusIcon = () => {
    switch (status) {
      case 'pending':
        return '⏳';
      case 'generating_image':
        return '🎨';
      case 'image_complete':
        return '🖼️';
      case 'generating_video':
        return '🎬';
      case 'video_complete':
        return '✅';
      case 'failed':
        return '❌';
      default:
        return '⏳';
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'pending':
        return '等待中';
      case 'generating_image':
        return '生成关键帧...';
      case 'image_complete':
        return '关键帧完成';
      case 'generating_video':
        return '生成视频...';
      case 'video_complete':
        return '视频完成';
      case 'failed':
        return '生成失败';
      default:
        return '等待中';
    }
  };

  return (
    <View style={styles.sceneItem}>
      <View style={styles.sceneHeader}>
        <Text style={styles.sceneNumber}>场景 {sceneNumber}</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusIcon}>{getStatusIcon()}</Text>
          <Text style={styles.statusLabel}>{getStatusText()}</Text>
        </View>
      </View>
      
      {imageUrl && (
        <Image source={{ uri: imageUrl }} style={styles.sceneImage} resizeMode="cover" />
      )}
      
      <Text style={styles.sceneDescription} numberOfLines={2}>
        {description}
      </Text>
    </View>
  );
};

export const ScriptToVideo: React.FC<ScriptToVideoProps> = ({ navigation, route }) => {
  const { colors, isDark } = useTheme();
  const { script, dream } = route.params || {};

  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [sceneStatuses, setSceneStatuses] = useState<Map<number, { status: string; imageUrl?: string }>>(new Map());

  // 检查是否有剧本
  const hasScript = script && script.scenes && script.scenes.length > 0;

  // 处理返回按钮 - 生成中时提示确认
  const handleGoBack = () => {
    if (isGenerating) {
      Alert.alert(
        '确认返回',
        '视频正在生成中，返回将中断生成。是否确认返回？',
        [
          { text: '继续生成', style: 'cancel' },
          {
            text: '确认返回',
            style: 'destructive',
            onPress: () => navigation.goBack()
          }
        ]
      );
    } else {
      navigation.goBack();
    }
  };

  // 开始生成长视频
  const handleGenerateLongVideo = async () => {
    if (!hasScript) {
      Alert.alert('提示', '请先选择或生成一个剧本');
      return;
    }

    // 测试环境：只处理4个场景
    const TEST_SCENE_COUNT = 4;
    const isTestMode = true; // 测试模式开启
    
    // 检查场景数量（测试环境下只要求至少4个场景）
    if (script.scenes.length < TEST_SCENE_COUNT) {
      Alert.alert(
        '场景数量不足',
        `当前剧本有${script.scenes.length} 个场景，测试环境需要至少${TEST_SCENE_COUNT} 个场景。`
      );
      return;
    }

    setIsGenerating(true);
    setProgress(0);
    setStatusText('准备生成...');

    try {
      // 模拟进度更新
      const progressInterval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 1000);

      const response = await generateLongVideo({
        script: {
          title: script.title,
          scenes: script.scenes.map(s => ({
            scene_number: s.scene_number,
            description: s.description,
            camera: s.camera,
            narration: s.narration,
            mood: s.mood,
            duration: s.duration,
          })),
        },
        dreamTitle: dream?.title || script.title,
        testMode: isTestMode,
        testSceneCount: TEST_SCENE_COUNT,
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (response.success && response.data.videoUrl) {
        // 更新场景状态（包含图片URL）
        response.data.scenes.forEach((scene: any) => {
          setSceneStatuses(prev => {
            const newMap = new Map(prev);
            newMap.set(scene.sceneNumber, { 
              status: scene.status, 
              imageUrl: scene.imageUrl 
            });
            return newMap;
          });
        });

        // 构建AI长视频生成使用的完整提示词（包含剧本标题和所有场景描述）
        const sceneDescriptions = script.scenes.slice(0, 4).map(s => s.description).join('；');
        const longVideoPrompt = `梦境长视频：${dream?.title || script.title} - 场景：${sceneDescriptions}`;

        // 保存到创作中心
        await creationStorageService.saveCreation({
          id: `longvideo_${Date.now()}`,
          type: 'video_long',
          title: `${dream?.title || script.title} - 长视频`,
          dreamTitle: dream?.title || script.title,
          dreamId: dream?.id || 'unknown',
          // 存储AI生成时使用的原始提示词
          prompt: longVideoPrompt,
          thumbnail: response.data.coverUrl || response.data.videoUrl,
          videoUrl: response.data.videoUrl,
          coverUrl: response.data.coverUrl,
          createdAt: new Date().toISOString(),
        });

        Alert.alert(
          '长视频生成完成！',
          '您的梦境长视频已经生成完成！',
          [
            { 
              text: '播放视频', 
              onPress: () => navigation.navigate('VideoPlayer', { 
                videoUrl: response.data.videoUrl,
                coverUrl: response.data.coverUrl,
                title: `${dream?.title || script.title} - 长视频`
              }) 
            },
            { text: '确定', style: 'cancel' }
          ]
        );
      } else {
        throw new Error(response.message || '长视频生成失败');
      }
    } catch (error) {
      console.error('生成长视频失败', error);
      Alert.alert('生成失败', error instanceof Error ? error.message : '长视频生成失败');
    } finally {
      setIsGenerating(false);
    }
  };

  // 如果没有剧本，显示提示
  if (!hasScript) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' }]}
            onPress={handleGoBack}
            activeOpacity={0.7}
          >
            <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>长视频生成</Text>
          <View style={styles.placeholder} />
        </View>

        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>🎬</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>暂无剧本</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            请先选择或生成一个梦境剧本{'\n'}
            长视频需要基于剧本的 12 个场景生成
          </Text>
          <TouchableOpacity
            style={[styles.emptyButton, { backgroundColor: colors.secondary }]}
            onPress={handleGoBack}
            activeOpacity={0.8}
          >
            <Text style={styles.emptyButtonText}>返回选择剧本</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      {/* 顶部导航 */}
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' }]}
          onPress={handleGoBack}
          activeOpacity={0.7}
        >
          <Text style={[styles.backButtonText, { color: colors.text }]}>←</Text>
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          {dream?.title || script.title} - 长视频
        </Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* 剧本信息卡片 */}
        <View style={[styles.scriptCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.scriptTitle, { color: colors.text }]}>📖 剧本信息</Text>
          <View style={styles.scriptInfo}>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>场景数量</Text>
              <Text style={[styles.infoValue, { color: colors.text }, styles.validValue]}>
                4 / {script.scenes.length}
              </Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>预计时长</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>20 秒</Text>
            </View>
            <View style={styles.infoItem}>
              <Text style={[styles.infoLabel, { color: colors.textSecondary }]}>每个场景</Text>
              <Text style={[styles.infoValue, { color: colors.text }]}>5 秒</Text>
            </View>
          </View>
          
          <View style={[styles.testModeBox, { backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)' }]}>
            <Text style={styles.testModeText}>
              🧪 测试模式：将生成前4个场景（约20秒）
            </Text>
          </View>
        </View>

        {/* 生成按钮 */}
        {!isGenerating && (
          <TouchableOpacity
            style={[styles.generateButton, { backgroundColor: colors.secondary }]}
            onPress={handleGenerateLongVideo}
            activeOpacity={0.8}
          >
            <Text style={styles.generateIcon}>🎬</Text>
            <Text style={styles.generateButtonText}>开始生成长视频</Text>
            <Text style={styles.generateSubtext}>将为4个场景生成关键帧和视频（测试模式）</Text>
          </TouchableOpacity>
        )}

        {/* 进度显示 */}
        {isGenerating && (
          <View style={[styles.progressCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.progressHeader}>
              <ActivityIndicator size="small" color={colors.secondary} />
              <Text style={[styles.progressTitle, { color: colors.text }]}>正在生成长视频...</Text>
            </View>
            
            <View style={[styles.progressBarContainer, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}>
              <View style={[styles.progressBar, { width: `${progress}%`, backgroundColor: colors.secondary }]} />
            </View>
            
            <Text style={[styles.progressText, { color: colors.secondary }]}>{progress}%</Text>
            <Text style={[styles.statusText, { color: colors.textSecondary }]}>{statusText}</Text>
          </View>
        )}

        {/* 场景列表 - 只显示前4个 */}
        <View style={styles.scenesSection}>
          <Text style={[styles.scenesTitle, { color: colors.text }]}>场景列表（测试模式：4个）</Text>
          
          {script.scenes.slice(0, 4).map((scene) => {
            const sceneStatus = sceneStatuses.get(scene.scene_number);
            return (
              <SceneStatusItem
                key={scene.scene_number}
                sceneNumber={scene.scene_number}
                description={scene.description}
                status={sceneStatus?.status || 'pending'}
                imageUrl={sceneStatus?.imageUrl}
              />
            );
          })}
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
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
    borderBottomColor: 'rgba(139, 92, 246, 0.2)',
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '300',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  placeholder: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 22,
    fontWeight: '600',
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  emptyButton: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 12,
  },
  emptyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  scriptCard: {
    borderRadius: 16,
    padding: 20,
    margin: 20,
    borderWidth: 1,
  },
  scriptTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  scriptInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  infoItem: {
    alignItems: 'center',
  },
  infoLabel: {
    fontSize: 13,
    marginBottom: 4,
  },
  infoValue: {
    fontSize: 18,
    fontWeight: '600',
  },
  validValue: {
    color: '#10b981',
  },
  invalidValue: {
    color: '#ef4444',
  },
  warningBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
  },
  warningText: {
    fontSize: 13,
    color: '#ef4444',
    lineHeight: 18,
  },
  testModeBox: {
    borderRadius: 12,
    padding: 12,
    marginTop: 16,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.3)',
  },
  testModeText: {
    fontSize: 13,
    color: '#3b82f6',
    lineHeight: 18,
  },
  generateButton: {
    borderRadius: 16,
    padding: 24,
    marginHorizontal: 20,
    marginBottom: 20,
    alignItems: 'center',
  },
  generateIcon: {
    fontSize: 40,
    marginBottom: 12,
  },
  generateButtonText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  generateSubtext: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.7)',
  },
  progressCard: {
    borderRadius: 16,
    padding: 20,
    marginHorizontal: 20,
    marginBottom: 20,
    borderWidth: 1,
  },
  progressHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  progressTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 12,
  },
  progressBarContainer: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    textAlign: 'center',
  },
  scenesSection: {
    paddingHorizontal: 20,
  },
  scenesTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  sceneItem: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
  },
  sceneHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sceneNumber: {
    fontSize: 16,
    fontWeight: '600',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  statusIcon: {
    fontSize: 14,
    marginRight: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  sceneImage: {
    width: '100%',
    height: 150,
    borderRadius: 8,
    marginBottom: 12,
  },
  sceneDescription: {
    fontSize: 14,
    lineHeight: 20,
  },
  bottomSpace: {
    height: 40,
  },
});
