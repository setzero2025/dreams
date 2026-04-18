# 记梦页面"梦生图片"功能优化计划

## 需求概述
在记梦页面（Record.tsx/RecordModule.tsx）点击"梦生图片"按钮时，直接在当前页面弹出生成进度，生成完成后进度消失，并将最近的两个作品展示在下方"梦境作品"区域，整个过程不跳转到梦境详情页面。

## 现状分析

### 当前实现（Record.tsx）
1. **已有功能**：
   - `handleGenerateImage` 函数已实现异步图片生成流程
   - `GenerationProgress` 组件已集成，以遮罩层形式显示在页面顶部
   - `generatedContents` 状态存储生成的作品列表
   - `latestCreations` 取最近3个作品展示

2. **当前问题**：
   - 代码逻辑已经符合需求，但 `RecordModule.tsx` 中点击"梦生图片"会跳转到 `DreamDetail` 页面
   - `RecordModule.tsx` 的 `handleQuickAction` 函数使用 `navigation.navigate('DreamDetail', ...)` 跳转

### RecordModule.tsx 现状
- 使用 `handleQuickAction` 函数处理所有AI创作按钮点击
- 点击后会跳转到 `DreamDetail` 页面并传递 `autoGenerate` 参数
- 没有在当前页面处理生成逻辑

## 实施方案

### 方案：修改 RecordModule.tsx，复用 Record.tsx 的生成逻辑

将 `RecordModule.tsx` 中的快捷创作按钮点击处理从跳转改为在当前页面直接生成。

### 具体步骤

#### 步骤1：添加必要的状态和引用
在 `RecordModule.tsx` 中添加以下状态：
```typescript
// 生成相关状态
const [isGenerating, setIsGenerating] = useState(false);
const [generatingType, setGeneratingType] = useState<'image' | 'video' | 'story' | 'interpretation' | null>(null);
const [taskProgress, setTaskProgress] = useState<TaskProgress | null>(null);
const [showProgress, setShowProgress] = useState(false);
const stopPollingRef = useRef<(() => void) | null>(null);

// 作品列表状态
const [creations, setCreations] = useState<CreationItem[]>([]);

// 艺术风格选择
const [selectedStyle, setSelectedStyle] = useState('写实');
const artStyles = ['写实', '油画', '水彩', '赛博朋克', '国潮', '动漫'];
```

#### 步骤2：导入必要的依赖
```typescript
import {
  startImageGeneration,
  startVideoGeneration,
  startLongVideoGeneration,
  startPollingProgress,
  stopAllPolling,
  TaskProgress,
} from '../services/generationTask.service';
import { GenerationProgress } from '../components/GenerationProgress';
```

#### 步骤3：添加作品加载函数
```typescript
// 加载该梦境的创作内容
const loadCreations = useCallback(async () => {
  if (savedDreamId) {
    const creations = await creationStorageService.getCreationsByDreamId(savedDreamId);
    const sortedCreations = creations.sort((a, b) => {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
    setCreations(sortedCreations);
  }
}, [savedDreamId]);

useEffect(() => {
  if (savedDreamId) {
    loadCreations();
  }
}, [savedDreamId, loadCreations]);
```

#### 步骤4：实现 handleGenerateImage 函数
参考 `Record.tsx` 中的实现，在 `RecordModule.tsx` 中添加：
```typescript
const handleGenerateImage = async () => {
  if (!savedDreamId || !title || !content) return;

  setIsGenerating(true);
  setGeneratingType('image');
  setShowProgress(true);
  setTaskProgress(null);

  try {
    const taskId = await startImageGeneration({
      prompt: content,
      style: selectedStyle,
      dreamId: savedDreamId,
      dreamTitle: title,
    });

    stopPollingRef.current = startPollingProgress(taskId, async (progress) => {
      setTaskProgress(progress);

      if (progress.status === 'completed') {
        if (stopPollingRef.current) {
          stopPollingRef.current();
          stopPollingRef.current = null;
        }

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

        setTimeout(() => {
          setShowProgress(false);
          setIsGenerating(false);
          setGeneratingType(null);
          Alert.alert('生成完成', '梦境画作已生成完成！');
        }, 1000);
      }

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
```

#### 步骤5：添加风格选择器UI
在快捷创作区上方添加艺术风格选择：
```typescript
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
```

#### 步骤6：修改快捷创作按钮点击事件
将原来的 `handleQuickAction` 调用改为直接调用生成函数：
```typescript
{/* 梦生图片按钮 */}
<TouchableOpacity
  style={[styles.quickActionButton, ...]}
  onPress={handleGenerateImage}  // 改为直接调用
  disabled={isGenerating}
  activeOpacity={0.8}
>
```

#### 步骤7：添加生成进度组件
在页面最外层添加 `GenerationProgress` 组件：
```typescript
<SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
  {/* 生成进度遮罩层 */}
  <GenerationProgress progress={taskProgress} visible={showProgress} />
  
  {/* 原有内容 */}
</SafeAreaView>
```

#### 步骤8：添加梦境作品展示区域
在快捷创作区下方添加作品展示区域，显示最近2个作品：
```typescript
{/* 生成的作品列表 */}
{savedDreamId && creations.length > 0 && (
  <View style={styles.creationsSection}>
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>🎨 梦境作品</Text>
      <TouchableOpacity onPress={() => navigation.navigate('CreationCenter', { dreamId: savedDreamId })}>
        <Text style={styles.viewAllText}>查看全部 →</Text>
      </TouchableOpacity>
    </View>
    
    <View style={styles.creationsGrid}>
      {creations.slice(0, 2).map((creation) => (
        <TouchableOpacity
          key={creation.id}
          style={styles.creationCard}
          onPress={() => handleViewCreation(creation)}
          activeOpacity={0.8}
        >
          {/* 作品缩略图 */}
        </TouchableOpacity>
      ))}
    </View>
  </View>
)}
```

#### 步骤9：添加作品查看处理函数
```typescript
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
  }
};
```

#### 步骤10：添加必要的样式
添加以下样式定义：
```typescript
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
// 作品展示区域样式
creationsSection: {
  marginTop: 24,
},
creationsGrid: {
  flexDirection: 'row',
  gap: 12,
},
creationCard: {
  flex: 1,
  backgroundColor: colors.card,
  borderRadius: 12,
  overflow: 'hidden',
  borderWidth: 1,
  borderColor: colors.border,
},
```

#### 步骤11：组件卸载时清理
在 `useEffect` 返回函数中添加清理逻辑：
```typescript
useEffect(() => {
  return () => {
    if (stopPollingRef.current) {
      stopPollingRef.current();
      stopPollingRef.current = null;
    }
    stopAllPolling();
  };
}, []);
```

## 文件变更清单

1. **RecordModule.tsx** - 主要修改文件
   - 添加生成相关状态和引用
   - 导入必要的依赖
   - 实现 `handleGenerateImage` 函数
   - 添加风格选择器UI
   - 修改快捷创作按钮点击事件
   - 添加 `GenerationProgress` 组件
   - 添加梦境作品展示区域
   - 添加 `handleViewCreation` 函数
   - 添加必要的样式

## 验收标准

1. 在记梦页面保存梦境后，点击"梦生图片"按钮
2. 页面弹出生成进度遮罩层，显示生成进度
3. 生成完成后进度自动消失
4. 生成的图片作品显示在"梦境作品"区域（最多显示2个）
5. 整个过程不跳转到梦境详情页面
6. 点击作品可以查看大图

## 注意事项

1. 确保 `CreationStorageService` 已正确导入和使用
2. 生成进度组件 `GenerationProgress` 已存在，直接复用
3. 作品展示样式参考 `Record.tsx` 中的 `worksSection` 实现
4. 保持与现有代码风格一致
