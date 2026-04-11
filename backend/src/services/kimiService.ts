import axios from 'axios';

interface ScriptScene {
  scene_number: number;
  duration: number;
  description: string;
  camera: string;
  narration: string;
  mood: string;
}

interface ExpandedScript {
  title: string;
  total_duration: number;
  scenes: ScriptScene[];
}

interface ExpandScriptOptions {
  dreamContent: string;
  dreamTitle?: string;
}

// 剧本扩写提示词模板
const PROMPT_TEMPLATE = {
  system: `你是一位专业的梦境剧本编剧，擅长将简短的梦境描述扩写成完整的视频剧本。
你的任务是根据用户的梦境内容，创作一个恰好1分钟（60秒）长的视频剧本。

【重要】剧本必须严格遵循以下要求：
1. 总时长必须恰好60秒
2. 必须分为恰好12个分镜场景，不能多也不能少
3. 每个分镜必须恰好5秒时长
4. 每个分镜必须包含：场景描述、镜头语言、旁白/对白、情绪氛围
5. 剧本要有起承转合，有梦境的奇幻感和叙事性
6. 语言优美，画面感强，适合视频呈现
7. 保持主要角色的一致性（外貌、服装等）

输出格式（必须严格按此格式输出12个场景）：
{
  "title": "剧本标题",
  "total_duration": 60,
  "scenes": [
    {
      "scene_number": 1,
      "duration": 5,
      "description": "场景描述",
      "camera": "镜头语言",
      "narration": "旁白内容",
      "mood": "情绪氛围"
    }
    // ... 必须输出到场景12
  ]
}`,
};

export async function expandScript(options: ExpandScriptOptions): Promise<ExpandedScript> {
  const { dreamContent, dreamTitle } = options;

  // 检查配置
  if (!process.env.KIMI_API_KEY) {
    throw new Error('请配置 KIMI_API_KEY 环境变量');
  }

  console.log('【开始扩写剧本】:', dreamTitle || '未命名梦境');

  try {
    const response = await axios.post(
      'https://api.moonshot.cn/v1/chat/completions',
      {
        model: 'kimi-k2.5',
        messages: [
          {
            role: 'system',
            content: PROMPT_TEMPLATE.system,
          },
          {
            role: 'user',
            content: `请将以下梦境扩写成1分钟的视频剧本（必须包含恰好12个场景，每个场景5秒）：\n\n${dreamContent}\n\n请严格按照上述格式输出完整的剧本，必须包含恰好12个场景，每个场景5秒，总时长60秒。确保内容丰富、画面感强。`,
          },
        ],
        max_tokens: 4000,
        temperature: 1,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.KIMI_API_KEY}`,
        },
        timeout: 120000, // 2分钟超时
      }
    );

    const content = response.data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('API 返回内容为空');
    }

    // 解析 JSON
    let script: ExpandedScript;
    try {
      // 尝试直接解析
      script = JSON.parse(content);
    } catch {
      // 尝试从文本中提取 JSON
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        script = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('无法解析剧本 JSON');
      }
    }

    // 验证场景数量
    if (!script.scenes || script.scenes.length !== 12) {
      console.warn(`【警告】剧本场景数量不正确: ${script.scenes?.length || 0}，期望 12`);
    }

    console.log('【剧本扩写完成】:', script.title);
    return script;
  } catch (error) {
    console.error('【剧本扩写失败】:', error);
    if (axios.isAxiosError(error)) {
      throw new Error(error.response?.data?.message || error.message);
    }
    throw error;
  }
}
