/**
 * 音频控制器
 * 处理音频相关的HTTP请求，包括上传和语音转文字
 */

import { Request, Response, NextFunction } from 'express';
import { AudioService } from '../services/audio.service';
import { XfyunSpeechService } from '../services/xfyunSpeech.service';
import { DreamService } from '../services/DreamService';
import { pool } from '../config/database';
import {
  successResponse,
  errorResponse,
} from '../utils/api-response';

export class AudioController {
  private audioService: AudioService;
  private xfyunService: XfyunSpeechService;
  private dreamService: DreamService;

  constructor() {
    this.audioService = new AudioService(pool);
    this.xfyunService = new XfyunSpeechService();
    this.dreamService = new DreamService(pool);
  }

  /**
   * 上传音频文件
   * POST /api/audio/upload
   */
  uploadAudio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json(errorResponse(401, '未授权'));
      }

      if (!req.file) {
        return res.status(400).json(errorResponse(400, '缺少音频文件'));
      }

      const { buffer, mimetype } = req.file;
      const duration = req.body.duration ? parseInt(req.body.duration, 10) : undefined;

      console.log(`[AudioController] 上传音频，用户: ${userId}, 类型: ${mimetype}, 大小: ${buffer.length} bytes`);

      // 上传音频到Supabase Storage
      const result = await this.audioService.uploadAudio(
        buffer,
        mimetype,
        userId,
        undefined,
        duration
      );

      return res.json(
        successResponse(
          {
            audioId: result.id,
            url: result.url,
            duration: result.duration,
          },
          '音频上传成功'
        )
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * 上传音频并转文字
   * POST /api/audio/transcribe
   */
  transcribeAudio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json(errorResponse(401, '未授权'));
      }

      if (!req.file) {
        return res.status(400).json(errorResponse(400, '缺少音频文件'));
      }

      const { buffer, mimetype } = req.file;
      const dreamId = req.body.dreamId as string | undefined;
      const duration = req.body.duration ? parseInt(req.body.duration, 10) : undefined;

      console.log(`[AudioController] 转写音频，用户: ${userId}, 类型: ${mimetype}, 大小: ${buffer.length} bytes`);

      // 1. 上传音频到Supabase Storage
      const uploadResult = await this.audioService.uploadAudio(
        buffer,
        mimetype,
        userId,
        dreamId,
        duration
      );

      // 2. 调用科大讯飞语音转文字
      let transcribedText = '';
      try {
        transcribedText = await this.xfyunService.transcribe(buffer);
        console.log(`[AudioController] 转写结果: ${transcribedText}`);
      } catch (transcribeError) {
        console.error('[AudioController] 语音转写失败:', transcribeError);
        // 转写失败不影响上传结果，但会返回空文本
      }

      // 3. 如果提供了dreamId，更新梦境的音频ID
      if (dreamId) {
        try {
          await this.dreamService.updateDreamAudio(dreamId, userId, uploadResult.id);
        } catch (updateError) {
          console.error('[AudioController] 更新梦境音频ID失败:', updateError);
        }
      }

      return res.json(
        successResponse(
          {
            audioId: uploadResult.id,
            url: uploadResult.url,
            duration: uploadResult.duration,
            text: transcribedText,
          },
          transcribedText ? '音频上传并转写成功' : '音频上传成功，但转写失败'
        )
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * 上传梦境关联的音频
   * POST /api/audio/dream/:dreamId/upload
   */
  uploadDreamAudio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json(errorResponse(401, '未授权'));
      }

      const { dreamId } = req.params;
      if (!dreamId) {
        return res.status(400).json(errorResponse(400, '梦境ID不能为空'));
      }

      if (!req.file) {
        return res.status(400).json(errorResponse(400, '缺少音频文件'));
      }

      const { buffer, mimetype } = req.file;
      const duration = req.body.duration ? parseInt(req.body.duration, 10) : undefined;

      console.log(`[AudioController] 上传梦境音频，梦境: ${dreamId}, 用户: ${userId}`);

      // 1. 上传音频到Supabase Storage
      const result = await this.audioService.uploadAudio(
        buffer,
        mimetype,
        userId,
        dreamId,
        duration
      );

      // 2. 更新梦境的音频ID
      await this.dreamService.updateDreamAudio(dreamId, userId, result.id);

      // 3. 调用科大讯飞语音转文字
      let transcribedText = '';
      try {
        transcribedText = await this.xfyunService.transcribe(buffer);
        console.log(`[AudioController] 转写结果: ${transcribedText}`);
      } catch (transcribeError) {
        console.error('[AudioController] 语音转写失败:', transcribeError);
      }

      return res.json(
        successResponse(
          {
            audioId: result.id,
            url: result.url,
            duration: result.duration,
            text: transcribedText,
          },
          transcribedText ? '音频上传并转写成功' : '音频上传成功，但转写失败'
        )
      );
    } catch (error) {
      next(error);
    }
  };

  /**
   * 获取梦境关联的音频
   * GET /api/audio/dream/:dreamId
   */
  getDreamAudio = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json(errorResponse(401, '未授权'));
      }

      const { dreamId } = req.params;
      if (!dreamId) {
        return res.status(400).json(errorResponse(400, '梦境ID不能为空'));
      }

      console.log(`[AudioController] 获取梦境音频，梦境: ${dreamId}, 用户: ${userId}`);

      // 获取梦境详情（包含音频信息）
      const dreamDetail = await this.dreamService.getDreamDetail(userId, dreamId);

      if (!dreamDetail.audio) {
        return res.status(404).json(errorResponse(404, '该梦境没有关联的音频'));
      }

      return res.json(
        successResponse(
          {
            audioId: dreamDetail.audio.id,
            url: dreamDetail.audio.url,
            duration: dreamDetail.audio.duration,
            isToneExtracted: dreamDetail.audio.isToneExtracted,
          },
          '获取音频成功'
        )
      );
    } catch (error) {
      next(error);
    }
  };
}

// 导出单例实例
export const audioController = new AudioController();
