import axios from 'axios';

interface VideoGenerationOptions {
  dreamContent: string;
  dreamTitle?: string;
}

interface VideoGenerationResult {
  taskId: string;
  status: 'PENDING' | 'RUNNING' | 'SUCCEEDED' | 'FAILED';
  videoUrl?: string;
  coverUrl?: string;
  errorMessage?: string;
}

// 优化视频提示词
async function optimizePrompt(dreamContent: string, dreamTitle?: string): Promise<{ prompt: string; description: string }> {
  if (!process.env.KIMI_API_KEY) {
    // 如果没有 Kimi API Key，直接使用原始内容
    return {
      prompt: `Dream scene: ${dreamContent}. Cinematic, dreamy atmosphere, soft lighting, ethereal visuals, smooth camera movement, high quality.`,
      description: dreamContent,
    };
  }

  try {
    const response = await axios.post(
      'https://api.moonshot.cn/v1/chat/completions',
      {
        model: 'kimi-k2.5',
        messages: [
          {
            role: 'system',
            content: 'You are a video prompt optimization expert. Convert dream descriptions into high-quality video generation prompts.',
          },
          {
            role: 'user',
            content: `Convert this dream into a video generation prompt (in English, 50-100 words):\n\n${dreamContent}`,
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

    const optimizedPrompt = response.data.choices?.[0]?.message?.content || dreamContent;
    return {
      prompt: optimizedPrompt,
      description: dreamContent,
    };
  } catch (error) {
    console.warn('【提示词优化失败，使用原始内容】:', error);
    return {
      prompt: `Dream scene: ${dreamContent}. Cinematic, dreamy atmosphere, soft lighting, ethereal visuals, smooth camera movement, high quality.`,
      description: dreamContent,
    };
  }
}

// 提交视频生成任务
export async function submitT2VTask(prompt: string): Promise<{ taskId: string }> {
  const taskId = await submitVideoTask(prompt);
  return { taskId };
}

// 等待视频生成完成
export async function waitForT2VTask(taskId: string): Promise<{ status: string; videoUrl?: string; coverUrl?: string; errorMessage?: string }> {
  const videoUrl = await pollVideoTask(taskId);
  const coverUrl = videoUrl ? `${videoUrl}?x-oss-process=video/snapshot,t_1000,f_jpg,w_720,h_405,m_fast` : undefined;
  return {
    status: 'SUCCEEDED',
    videoUrl,
    coverUrl,
  };
}

// 内部实现：提交视频生成任务
async function submitVideoTask(prompt: string): Promise<string> {
  if (!process.env.WAN26T2V_API_KEY) {
    throw new Error('请配置 WAN26T2V_API_KEY 环境变量');
  }

  console.log('[WAN26T2V] 提交视频生成任务，API Key:', process.env.WAN26T2V_API_KEY.substring(0, 10) + '...');
  console.log('[WAN26T2V] 提示词:', prompt.substring(0, 50));

  try {
    const response = await axios.post(
      'https://dashscope.aliyuncs.com/api/v1/services/aigc/video-generation/video-synthesis',
      {
        model: 'wan2.7-t2v',
        input: {
          prompt: prompt,
        },
        parameters: {
          duration: 5,
          resolution: '720P',
          aspect_ratio: '16:9',
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.WAN26T2V_API_KEY}`,
          'X-DashScope-Async': 'enable',
        },
        timeout: 30000,
      }
    );

    console.log('[WAN26T2V] 响应:', JSON.stringify(response.data, null, 2));

    const taskId = response.data.output?.task_id;
    if (!taskId) {
      throw new Error('未获取到视频生成任务ID');
    }

    return taskId;
  } catch (error: any) {
    console.error('[WAN26T2V] 提交任务失败:', error.message);
    if (error.response) {
      console.error('[WAN26T2V] 错误响应:', JSON.stringify(error.response.data, null, 2));
      console.error('[WAN26T2V] 状态码:', error.response.status);
    }
    throw error;
  }
}

// 轮询视频生成状态
async function pollVideoTask(taskId: string): Promise<string> {
  if (!process.env.WAN26T2V_API_KEY) {
    throw new Error('请配置 WAN26T2V_API_KEY 环境变量');
  }

  const maxAttempts = 60;
  const interval = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise(resolve => setTimeout(resolve, interval));

    const response = await axios.get(
      `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.WAN26T2V_API_KEY}`,
        },
        timeout: 10000,
      }
    );

    const status = response.data.output?.task_status;

    if (status === 'SUCCEEDED') {
      return response.data.output?.video_url;
    } else if (status === 'FAILED') {
      throw new Error(response.data.output?.message || '视频生成失败');
    }
  }

  throw new Error('视频生成超时');
}

export async function generateVideo(options: VideoGenerationOptions): Promise<VideoGenerationResult> {
  const { dreamContent, dreamTitle } = options;

  console.log('【开始视频生成】:', dreamTitle || '未命名梦境');

  try {
    // 1. 优化提示词
    const { prompt } = await optimizePrompt(dreamContent, dreamTitle);
    console.log('【优化视频提示词】:', prompt.substring(0, 100));

    // 2. 提交视频生成任务
    const taskId = await submitVideoTask(prompt);
    console.log('【视频任务已提交】:', taskId);

    // 3. 轮询等待视频生成完成
    const videoUrl = await pollVideoTask(taskId);
    console.log('【视频生成完成】:', videoUrl.substring(0, 50));

    // 4. 生成封面图 URL（使用阿里云 OSS 视频截图功能）
    const coverUrl = videoUrl ? `${videoUrl}?x-oss-process=video/snapshot,t_1000,f_jpg,w_720,h_405,m_fast` : undefined;

    return {
      taskId,
      status: 'SUCCEEDED',
      videoUrl,
      coverUrl,
    };
  } catch (error) {
    console.error('【视频生成失败】:', error);
    
    // 检查是否是模型访问权限问题
    const errorMessage = error instanceof Error ? error.message : '';
    if (errorMessage.includes('Model access denied') || errorMessage.includes('模型访问被拒绝')) {
      throw new Error('模型访问被拒绝，请检查阿里云百炼控制台是否已开通模型权限');
    }
    
    throw error;
  }
}
