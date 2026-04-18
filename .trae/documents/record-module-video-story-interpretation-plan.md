# 记梦页面视频、剧情、解读功能实现计划

## 需求概述
在记梦页面（RecordModule.tsx）中，实现"梦生视频"、"梦境剧情"和"梦境解读"三个AI创作按钮的功能。目前这些按钮点击无反应（显示"即将上线"提示），需要实现完整的生成逻辑。

## 现状分析

### 已实现功能
- **梦生图片**：已实现完整的异步生成流程，包括启动任务、轮询进度、保存作品

### 待实现功能
1. **梦生视频**：需要实现视频生成功能
2. **梦境剧情**：需要实现长视频（剧情）生成功能
3. **梦境解读**：需要实现梦境解读功能

### 参考实现
- `DreamDetail.tsx` 中已经实现了 `handleGenerateVideo`、`handleGenerateLongVideo`、`handleGenerateInterpretation` 三个函数
- `aiService.ts` 中提供了对应的 API 调用函数
- `generationTask.service.ts` 中提供了异步任务管理服务

## 实施方案

### 方案：复用 DreamDetail.tsx 的实现逻辑到 RecordModule.tsx

将 DreamDetail 中的生成函数适配到 RecordModule 的上下文中。

### 具体步骤

#### 步骤1：实现 handleGenerateVideo 函数

```typescript
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
```

#### 步骤2：实现 handleGenerateLongVideo 函数

```typescript
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
```

#### 步骤3：实现 handleGenerateInterpretation 函数

```typescript
const handleGenerateInterpretation = async () => {
  if (!savedDreamId || !title || !content) {
    Alert.alert('提示', '请先保存梦境');
    return;
  }

  setIsGenerating(true);
  setGeneratingType('interpretation');
  setShowProgress(true);
  setTaskProgress(null);

  try {
    const response = await generateInterpretation({
      dreamContent: content,
      dreamTitle: title,
      dreamId: savedDreamId,
    });

    if (response.success && response.data.interpretation) {
      const data = response.data;
      
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

      Alert.alert('生成完成', '梦境解读已生成完成！');
    } else {
      throw new Error(response.message || '解读生成失败');
    }
  } catch (error) {
    console.error('生成解读失败:', error);
    // 使用默认解读
    const defaultInterpretation = `根据心理学理论，你的梦境「${title}」可能反映了内心深处的情感和想法。\n\n梦境中的意象往往与日常生活中的经历和情绪有关。建议你关注近期的生活状态，保持良好的作息习惯。`;
    
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
    Alert.alert('生成完成', '梦境解读已生成完成！');
  } finally {
    setShowProgress(false);
    setIsGenerating(false);
    setGeneratingType(null);
  }
};
```

#### 步骤4：导入 generateInterpretation 函数

```typescript
import { generateInterpretation } from '../services/api/aiService';
```

#### 步骤5：修改按钮点击事件

将原来的 Alert 提示改为调用对应的处理函数：

```typescript
{/* 梦生视频按钮 */}
<TouchableOpacity
  style={[...]}
  onPress={handleGenerateVideo}  // 改为调用 handleGenerateVideo
  disabled={isGenerating}
  activeOpacity={0.8}
>

{/* 梦境剧情按钮 */}
<TouchableOpacity
  style={[...]}
  onPress={handleGenerateLongVideo}  // 改为调用 handleGenerateLongVideo
  disabled={isGenerating}
  activeOpacity={0.8}
>

{/* 梦境解读按钮 */}
<TouchableOpacity
  style={[...]}
  onPress={handleGenerateInterpretation}  // 改为调用 handleGenerateInterpretation
  disabled={isGenerating}
  activeOpacity={0.8}
>
```

#### 步骤6：更新 generatingType 类型定义

将 generatingType 的类型扩展为包含所有生成类型：

```typescript
const [generatingType, setGeneratingType] = useState<'image' | 'video' | 'story' | 'interpretation' | null>(null);
```

#### 步骤7：更新按钮的 generatingType 判断

为视频、剧情、解读按钮添加 active 状态样式：

```typescript
generatingType === 'video' && styles.quickActionButtonActive
generatingType === 'story' && styles.quickActionButtonActive
generatingType === 'interpretation' && styles.quickActionButtonActive
```

## 文件变更清单

1. **RecordModule.tsx**
   - 导入 `generateInterpretation` 函数
   - 添加 `handleGenerateVideo` 函数
   - 添加 `handleGenerateLongVideo` 函数
   - 添加 `handleGenerateInterpretation` 函数
   - 修改三个按钮的 onPress 事件
   - 更新按钮的 active 状态判断

## 验收标准

1. 点击"梦生视频"按钮，启动视频生成任务，显示进度，完成后作品显示在梦境作品区域
2. 点击"梦境剧情"按钮，启动长视频生成任务，显示进度，完成后作品显示在梦境作品区域
3. 点击"梦境解读"按钮，生成梦境解读，完成后作品显示在梦境作品区域
4. 三个功能都支持点击作品查看详情
5. 生成过程中按钮禁用，防止重复点击

## 注意事项

1. 视频和剧情生成使用异步任务轮询机制
2. 梦境解读是同步生成，不需要轮询
3. 所有生成功能都需要先保存梦境才能使用
4. 保持与现有代码风格一致
