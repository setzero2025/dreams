import axios from 'axios';
import { submitI2VTask, waitForI2VTask } from './wan27i2vService';
import { supabaseStorageService } from './supabaseStorage.service';
import { mergeVideos, checkFFmpeg } from './videoMerge.service';

interface Scene {
  sceneNumber: number;
  description: string;
  imageUrl?: string;
  videoUrl?: string;
  status: 'pending' | 'generating_image' | 'image_complete' | 'generating_video' | 'video_complete' | 'failed';
  error?: string;
}

interface Script {
  title: string;
  scenes: Array<{
    scene_number: number;
    description: string;
    camera?: string;
    narration?: string;
    mood?: string;
    duration?: number;
  }>;
}

interface LongVideoOptions {
  script: Script;
  dreamTitle?: string;
  testMode?: boolean;
  testSceneCount?: number;
}

interface LongVideoResult {
  taskId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  videoUrl?: string;
  coverUrl?: string;
  scenes: Scene[];
  errorMessage?: string;
}

// 提取主要角色描述
async function extractMainCharacter(scenes: Array<{ description: string }>): Promise<string> {
  if (!process.env.KIMI_API_KEY) {
    return '';
  }

  try {
    const response = await axios.post(
      'https://api.moonshot.cn/v1/chat/completions',
      {
        model: 'kimi-k2.5',
        messages: [
          {
            role: 'system',
            content: '你是一个剧本分析专家。请从剧本场景描述中提取主要角色的外貌特征、服装、年龄、性别等信息，用于保持图像生成的一致性。只返回角色描述，不要其他内容。',
          },
          {
            role: 'user',
            content: `请分析以下剧本场景，提取主要角色的详细描述（外貌、服装、年龄、性别等）：\n\n${scenes.map((s, i) => `场景${i + 1}: ${s.description}`).join('\n')}\n\n请用一句话描述这个角色，用于图像生成的角色一致性控制。`,
          },
        ],
        max_tokens: 200,
        temperature: 1,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.KIMI_API_KEY}`,
        },
        timeout: 30000,
      }
    );

    return response.data.choices?.[0]?.message?.content || '';
  } catch (error) {
    console.warn('【提取角色描述失败】:', error);
    return '';
  }
}

// 生成场景关键帧
async function generateSceneKeyframe(scene: Scene, index: number, mainCharacter: string): Promise<string> {
  if (!process.env.SEEDREAM_API_KEY) {
    throw new Error('请配置 SEEDREAM_API_KEY 环境变量');
  }

  const characterPrompt = mainCharacter ? ` featuring ${mainCharacter},` : '';
  const prompt = `Dream scene:${characterPrompt} ${scene.description}. Cinematic composition, high quality, detailed, dreamy atmosphere, soft lighting, ethereal visuals, film still, 4k resolution.`;

  const response = await axios.post(
    'https://ark.cn-beijing.volces.com/api/v3/images/generations',
    {
      model: 'seedream-3-pt',
      prompt: prompt,
      size: '1024x1024',
      n: 1,
      seed: 12345 + index,
    },
    {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${process.env.SEEDREAM_API_KEY}`,
      },
      timeout: 120000,
    }
  );

  const imageUrl = response.data.data?.[0]?.url;
  if (!imageUrl) {
    throw new Error('未获取到关键帧图片URL');
  }

  return imageUrl;
}

// 生成场景视频
async function generateSceneVideo(scene: Scene, index: number): Promise<string> {
  if (!scene.imageUrl) {
    throw new Error('场景缺少关键帧图片');
  }

  console.log(`【生成场景 ${index + 1} 视频】使用关键帧:`, scene.imageUrl);

  const prompt = `梦境场景${index + 1}：${scene.description}`;

  // 使用 wan2.7-i2v 模型生成视频
  const taskId = await submitI2VTask(scene.imageUrl, prompt);
  const result = await waitForI2VTask(taskId);

  if (result.status === 'SUCCEEDED' && result.videoUrl) {
    return result.videoUrl;
  } else {
    throw new Error(result.errorMessage || '视频生成失败');
  }
}

export async function generateLongVideo(options: LongVideoOptions): Promise<LongVideoResult> {
  const { script, dreamTitle, testMode = true, testSceneCount = 4 } = options;

  console.log('【开始生成长视频】:', dreamTitle || '未命名梦境');
  console.log('【场景数量】:', script.scenes.length);
  console.log('【测试模式】:', testMode ? `是（${testSceneCount}个场景）` : '否（12个场景）');

  // 测试环境下只处理指定数量的场景
  const scenesToProcess = testMode ? script.scenes.slice(0, testSceneCount) : script.scenes;

  // 初始化场景状态
  const scenes: Scene[] = scenesToProcess.map((scene, index) => ({
    sceneNumber: index + 1,
    description: scene.description,
    status: 'pending',
  }));

  try {
    // 提取主要角色描述
    const mainCharacter = await extractMainCharacter(scenesToProcess);
    console.log('【提取的角色描述】:', mainCharacter);

    // 第一阶段：为每个场景生成关键帧图片
    console.log('【阶段1】开始生成场景关键帧...');
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];
      console.log(`【生成场景 ${i + 1} 关键帧】`);

      try {
        scene.status = 'generating_image';
        const imageUrl = await generateSceneKeyframe(scene, i, mainCharacter);
        scene.imageUrl = imageUrl;
        scene.status = 'image_complete';
        console.log(`【场景 ${i + 1} 关键帧生成成功】`);
      } catch (error) {
        console.error(`【场景 ${i + 1} 关键帧生成失败】:`, error);
        scene.status = 'failed';
        scene.error = '关键帧生成失败';
      }
    }

    // 第二阶段：为每个场景生成视频
    console.log('【阶段2】开始生成场景视频...');
    for (let i = 0; i < scenes.length; i++) {
      const scene = scenes[i];

      if (scene.status === 'failed' || !scene.imageUrl) {
        continue;
      }

      console.log(`【生成场景 ${i + 1} 视频】`);

      try {
        scene.status = 'generating_video';
        const videoUrl = await generateSceneVideo(scene, i);
        scene.videoUrl = videoUrl;
        scene.status = 'video_complete';
        console.log(`【场景 ${i + 1} 视频生成成功】`);
      } catch (error) {
        console.error(`【场景 ${i + 1} 视频生成失败】:`, error);
        scene.status = 'failed';
        scene.error = '视频生成失败';
      }
    }

    // 第三阶段：合并视频
    const completedScenes = scenes.filter(s => s.status === 'video_complete');

    if (completedScenes.length === 0) {
      throw new Error('没有成功生成的视频片段');
    }

    console.log('【阶段3】开始合并视频片段...');
    console.log('【视频合成】成功生成的场景数:', completedScenes.length);

    let finalVideoUrl: string;
    let finalCoverUrl: string = completedScenes[0]?.imageUrl || '';

    // 如果只有一个场景，直接返回该场景的视频
    if (completedScenes.length === 1) {
      finalVideoUrl = completedScenes[0].videoUrl!;
      console.log('【视频合成】只有一个场景，直接返回');
    } else {
      // 检查 FFmpeg 是否已安装
      const hasFFmpeg = await checkFFmpeg();
      
      if (hasFFmpeg) {
        try {
          // 使用 FFmpeg 合并多个视频片段
          const segments = completedScenes.map(scene => ({
            url: scene.videoUrl!,
            sceneNumber: scene.sceneNumber,
          }));

          finalVideoUrl = await mergeVideos(segments);
          console.log('【视频合成】FFmpeg 合并成功');
        } catch (mergeError) {
          console.error('【视频合成】FFmpeg 合并失败:', mergeError);
          console.log('【视频合成】回退到返回第一个视频');
          finalVideoUrl = completedScenes[0].videoUrl!;
        }
      } else {
        console.log('【视频合成】FFmpeg 未安装，返回第一个视频');
        finalVideoUrl = completedScenes[0].videoUrl!;
      }
    }

    console.log('【长视频生成完成】');

    return {
      taskId: `longvideo_${Date.now()}`,
      status: 'SUCCEEDED',
      videoUrl: finalVideoUrl,
      coverUrl: finalCoverUrl,
      scenes,
    };
  } catch (error) {
    console.error('【长视频生成失败】:', error);
    return {
      taskId: `longvideo_${Date.now()}`,
      status: 'FAILED',
      scenes,
      errorMessage: error instanceof Error ? error.message : '长视频生成失败',
    };
  }
}
