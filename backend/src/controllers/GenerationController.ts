import { Request, Response } from 'express';
import { GenerationService, GenerationType, GenerationStatus } from '../services/GenerationService';

export class GenerationController {
  private generationService = new GenerationService();

  async createGeneration(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const { dreamId, generationType, prompt, style, resolution, duration, metadata } = req.body;

      if (!dreamId || !generationType || !prompt) {
        return res.status(400).json({ error: '缺少必要参数' });
      }

      const generation = await this.generationService.createGeneration(userId, dreamId, {
        generationType: generationType as GenerationType,
        prompt,
        style,
        resolution,
        duration,
        metadata,
      });

      res.status(201).json(generation);
    } catch (error) {
      console.error('创建生成任务失败:', error);
      res.status(500).json({ error: '创建生成任务失败' });
    }
  }

  async getGenerationById(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const generationId = req.params.id;

      const generation = await this.generationService.getGenerationById(userId, generationId);
      res.json(generation);
    } catch (error) {
      console.error('获取生成内容失败:', error);
      res.status(404).json({ error: error instanceof Error ? error.message : '生成内容不存在' });
    }
  }

  async getGenerations(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const filters = {
        dreamId: req.query.dreamId as string,
        generationType: req.query.generationType as GenerationType,
        status: req.query.status as GenerationStatus,
      };

      const generations = await this.generationService.getGenerations(userId, filters);
      res.json(generations);
    } catch (error) {
      console.error('获取生成内容列表失败:', error);
      res.status(500).json({ error: '获取生成内容列表失败' });
    }
  }

  async cancelGeneration(req: Request, res: Response) {
    try {
      const userId = req.user!.userId;
      const generationId = req.params.id;

      const result = await this.generationService.cancelGeneration(userId, generationId);
      res.json(result);
    } catch (error) {
      console.error('取消生成任务失败:', error);
      res.status(404).json({ error: error instanceof Error ? error.message : '生成内容不存在或无权访问' });
    }
  }
}
