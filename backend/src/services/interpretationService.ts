import axios from 'axios';
import { Pool } from 'pg';
import { InterpretationRepository } from '../repositories/interpretation.repository';
// 解读类型枚举
enum InterpretationType {
  INTERPRETATION = 'interpretation',
  EVALUATION = 'evaluation',
}

interface GenerateInterpretationOptions {
  dreamContent: string;
  dreamTitle?: string;
  dreamId?: string;
  userId?: string;
}

interface InterpretationResult {
  interpretation: string;
  symbols: SymbolInterpretation[];
  emotions: EmotionAnalysis;
  suggestions: string[];
  references: KnowledgeReference[];
}

interface SymbolInterpretation {
  symbol: string;
  meaning: string;
  context: string;
}

interface EmotionAnalysis {
  primary: string;
  intensity: number;
  description: string;
}

interface KnowledgeReference {
  id: string;
  title: string;
  source: string;
}

// 梦境解读提示词模板
const PROMPT_TEMPLATE = {
  system: `你是一位专业的梦境解读师，你的任务是根据用户的梦境内容，基于现代心理学、象征语义学、情绪认知理论进行解读，严禁封建迷信、不占卜吉凶、不预测运势 / 财运 / 姻缘，仅提供心理启发、情绪疏导与自我探索参考。

【解读要求】
1. 整体解读：对梦境进行整体分析，解释梦境可能反映的潜意识含义
2. 符号解读：识别梦境中的关键符号（如人物、动物、场景、物品等），解释每个符号的象征意义
3. 情绪分析：分析梦境中体现的情绪状态及其强度
4. 实用建议：基于梦境分析，给出对现实生活有指导意义的建议

【核心规则】
1. 严禁使用封建迷信、不占卜吉凶、不预测运势 / 财运 / 姻缘等不科学的解读方法
2. 仅提供心理启发、情绪疏导与自我探索参考，不提供任何其他类型的信息
3. 不恐吓、不贴标签、不做诊断，全程聚焦心理情绪与潜意识表达

【核心定位】
1. 专注：提取梦境人物、场景、物品、动作、情绪、结局六大要素
2. 视角：象征意义、情绪投射、潜意识诉求、现实关联
3. 输出：温和中立、有理有据、鼓励反思、不绝对化
4. 底线：全程免责提示，不替代心理咨询与专业诊断

【输出格式】
必须严格按照以下JSON格式输出：
{
  "interpretation": "整体解读内容（400字左右）",
  "symbols": [
    {
      "symbol": "符号名称",
      "meaning": "符号含义解释",
      "context": "在梦境中的具体语境"
    }
  ],
  "emotions": {
    "primary": "主要情绪（如：焦虑、喜悦、恐惧、平静等）",
    "intensity": 情绪强度（1-10的数字）,
    "description": "情绪分析描述"
  },
  "suggestions": [
    "建议1",
    "建议2",
    "建议3"
  ],
  "references": [
    {
      "id": "ref_1",
      "title": "参考知识标题",
      "source": "知识来源"
    }
  ]
}

【注意事项】
1. 解读要专业但易懂，避免过于学术化的术语
2. 符号解读要结合梦境的具体情境
3. 建议要实用、积极、有建设性
4. 引用知识库内容时要注明来源`,
};

// 模拟知识库引用数据
const MOCK_REFERENCES: KnowledgeReference[] = [
  {
    id: 'kb_001',
    title: '梦境中的水象征意义',
    source: '《梦的解析》- 弗洛伊德',
  },
  {
    id: 'kb_002',
    title: '飞翔梦境的心理解读',
    source: '《潜意识的语言》- 荣格学派',
  },
  {
    id: 'kb_003',
    title: '追逐梦境与焦虑情绪',
    source: '现代心理学研究',
  },
  {
    id: 'kb_004',
    title: '梦境符号与情绪健康',
    source: '《梦境心理学》- 认知心理学派',
  },
];

export class InterpretationService {
  private interpretationRepo: InterpretationRepository;

  constructor(private db: Pool) {
    this.interpretationRepo = new InterpretationRepository(db);
  }

  /**
   * 生成梦境解读
   */
  async generateInterpretation(
    options: GenerateInterpretationOptions
  ): Promise<InterpretationResult> {
    const { dreamContent, dreamTitle, dreamId, userId } = options;

    // 检查配置
    if (!process.env.KIMI_API_KEY) {
      console.warn('【梦境解读】未配置 KIMI_API_KEY，使用默认解读');
      return this.getDefaultInterpretation(dreamTitle || '未命名梦境');
    }

    console.log('【开始梦境解读】:', dreamTitle || '未命名梦境');
    console.log('【梦境解读】API Key 存在:', !!process.env.KIMI_API_KEY);
    console.log('【梦境解读】API Key 前10位:', process.env.KIMI_API_KEY?.substring(0, 10) + '...');
    console.log('【梦境解读】梦境内容长度:', dreamContent?.length);

    const requestBody = {
      model: 'kimi-k2.5',
      messages: [
        {
          role: 'system',
          content: PROMPT_TEMPLATE.system,
        },
        {
          role: 'user',
          content: `请为以下梦境提供专业解读：\n\n梦境标题：${dreamTitle || '未命名梦境'}\n\n梦境内容：\n${dreamContent}\n\n请严格按照JSON格式输出解读结果。`,
        },
      ],
      max_tokens: 2000,
          temperature: 1,
    };
    console.log('【梦境解读】请求体:', JSON.stringify(requestBody, null, 2)?.substring(0, 500));

    try {
      const response = await axios.post(
        'https://api.moonshot.cn/v1/chat/completions',
        requestBody,
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.KIMI_API_KEY}`,
          },
          timeout: 120000, // 2分钟超时
        }
      );

      console.log('【梦境解读】API 响应状态:', response.status);
      console.log('【梦境解读】API 响应数据:', JSON.stringify(response.data, null, 2)?.substring(0, 500));
      
      const content = response.data.choices?.[0]?.message?.content;

      if (!content) {
        console.error('【梦境解读】API 返回内容为空, 完整响应:', response.data);
        throw new Error('API 返回内容为空');
      }
      console.log('【梦境解读】API 返回内容长度:', content.length);

      // 解析 JSON
      let result: InterpretationResult;
      try {
        // 尝试直接解析
        result = JSON.parse(content);
      } catch {
        // 尝试从文本中提取 JSON
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          result = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('无法解析解读结果 JSON');
        }
      }

      // 如果没有引用，添加默认引用
      if (!result.references || result.references.length === 0) {
        result.references = this.selectRelevantReferences(dreamContent);
      }

      // 保存到数据库（如果提供了 dreamId 和 userId）
      console.log('【梦境解读】检查保存条件:', { dreamId, userId, hasDreamId: !!dreamId, hasUserId: !!userId });
      if (dreamId && userId) {
        console.log('【梦境解读】准备保存AI解读到数据库');
        await this.saveInterpretation(userId, dreamId, result, false);
      } else {
        console.log('【梦境解读】缺少dreamId或userId，跳过保存');
      }

      console.log('【梦境解读完成】');
      return result;
    } catch (error: any) {
      console.error('【梦境解读失败】:', error.message);
      // 详细记录错误信息
      if (error.response) {
        console.error('【梦境解读】API 响应错误:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: JSON.stringify(error.response.data, null, 2),
        });
      } else if (error.request) {
        console.error('【梦境解读】API 请求未收到响应:', error.request);
      } else {
        console.error('【梦境解读】请求配置错误:', error.message);
      }
      // 返回默认解读（也保存到数据库，但标记为默认）
      const defaultResult = this.getDefaultInterpretation(dreamTitle || '未命名梦境');
      // 保存默认解读到数据库
      if (dreamId && userId) {
        await this.saveInterpretation(userId, dreamId, defaultResult, true);
      }
      return defaultResult;
    }
  }

  /**
   * 获取默认解读（当API调用失败时使用）
   */
  private getDefaultInterpretation(dreamTitle: string): InterpretationResult {
    return {
      interpretation: `根据心理学理论，你的梦境「${dreamTitle}」可能反映了内心深处的情感和想法。梦境中的意象往往与日常生活中的经历和情绪有关。建议你关注近期的生活状态，保持良好的作息习惯。`,
      symbols: [
        {
          symbol: '梦境意象',
          meaning: '代表潜意识中的情感投射',
          context: '整体梦境氛围',
        },
      ],
      emotions: {
        primary: '平静',
        intensity: 5,
        description: '梦境整体情绪较为平和，没有强烈的情绪波动',
      },
      suggestions: [
        '保持规律的作息时间，有助于提高睡眠质量',
        '尝试记录梦境日记，有助于更好地了解自己的潜意识',
        '如果梦境反复出现，可以考虑与心理咨询师交流',
      ],
      references: [
        {
          id: 'kb_default',
          title: '梦境分析基础理论',
          source: '《梦的解析》- 弗洛伊德',
        },
      ],
    };
  }

  /**
   * 根据梦境内容选择相关的知识库引用
   */
  private selectRelevantReferences(dreamContent: string): KnowledgeReference[] {
    const keywords = [
      { keyword: '水', refs: ['kb_001'] },
      { keyword: '飞', refs: ['kb_002'] },
      { keyword: '追', refs: ['kb_003'] },
      { keyword: '跑', refs: ['kb_003'] },
    ];

    const selectedIds = new Set<string>();
    keywords.forEach(({ keyword, refs }) => {
      if (dreamContent.includes(keyword)) {
        refs.forEach((id) => selectedIds.add(id));
      }
    });

    // 如果没有匹配到，返回默认引用
    if (selectedIds.size === 0) {
      return [MOCK_REFERENCES[3]];
    }

    return MOCK_REFERENCES.filter((ref) => selectedIds.has(ref.id));
  }

  /**
   * 保存解读到数据库
   */
  private async saveInterpretation(
    userId: string,
    dreamId: string,
    result: InterpretationResult,
    isDefault: boolean = false
  ): Promise<void> {
    console.log('【saveInterpretation】开始保存:', { userId, dreamId, isDefault, interpretationLength: result.interpretation?.length });
    try {
      const createData = {
        dreamId,
        type: InterpretationType.INTERPRETATION,
        content: result.interpretation,
        symbols: result.symbols,
        emotionsAnalysis: result.emotions,
        suggestions: result.suggestions,
        references: result.references,
        modelSource: isDefault ? 'default' : 'kimi-k2.5',
      };
      console.log('【saveInterpretation】准备插入数据:', JSON.stringify(createData, null, 2));
      const created = await this.interpretationRepo.create(userId, createData);
      console.log(`【梦境解读已保存到数据库】${isDefault ? '(默认解读)' : '(AI解读)'}`, '返回ID:', created?.id);
    } catch (error) {
      console.error('【保存梦境解读失败】:', error);
      // 保存失败不影响返回结果
    }
  }

  /**
   * 查询梦境的解读
   */
  async getInterpretationByDreamId(
    dreamId: string,
    userId: string
  ): Promise<InterpretationResult | null> {
    try {
      const interpretation = await this.interpretationRepo.findByDreamId(
        dreamId,
        userId
      );

      if (!interpretation) {
        return null;
      }

      // 转换符号解读格式
      const symbols: SymbolInterpretation[] = (interpretation.symbols || []).map(
        (s: any) => ({
          symbol: s.name || s.symbol || '',
          meaning: s.meaning || '',
          context: s.description || s.context || '',
        })
      );

      // 转换情绪分析格式
      let emotions: EmotionAnalysis;
      if (interpretation.emotionsAnalysis) {
        const ea = interpretation.emotionsAnalysis as any;
        emotions = {
          primary: ea.primary || (ea.detected && ea.detected[0]) || '未知',
          intensity: ea.intensity || 5,
          description: ea.description || ea.suggestions || '暂无详细情绪分析',
        };
      } else {
        emotions = {
          primary: '未知',
          intensity: 0,
          description: '暂无情绪分析',
        };
      }

      // 从 metadata 中读取引用信息
      let references: KnowledgeReference[] = [];
      if (interpretation.metadata && interpretation.metadata.references) {
        references = interpretation.metadata.references;
      } else if (interpretation.suggestions) {
        // 如果没有引用信息，返回空数组
        references = [];
      }

      // 处理 suggestions：如果是字符串则按换行分割，如果是数组则直接使用
      let suggestionList: string[] = [];
      if (interpretation.suggestions) {
        if (typeof interpretation.suggestions === 'string') {
          suggestionList = interpretation.suggestions.split('\n').filter((s: string) => s.trim());
        } else if (Array.isArray(interpretation.suggestions)) {
          suggestionList = interpretation.suggestions;
        }
      }

      return {
        interpretation: interpretation.content,
        symbols,
        emotions,
        suggestions: suggestionList,
        references,
      };
    } catch (error) {
      console.error('【查询梦境解读失败】:', error);
      return null;
    }
  }
}

// 导出单例实例
export const interpretationService = new InterpretationService(
  // 这里会在路由中传入实际的 db 实例
  null as any
);
