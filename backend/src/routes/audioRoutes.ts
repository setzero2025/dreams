/**
 * 音频路由配置
 * 定义音频相关的API端点，包括录音上传和语音转文字
 */

import { Router } from 'express';
import { audioController } from '../controllers/audio.controller';
import { authenticate } from '../middleware/auth';
import multer from 'multer';

const router = Router();

// 配置multer用于处理文件上传
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024, // 限制50MB
  },
});

/**
 * @route   POST /api/audio/upload
 * @desc    上传音频文件到Supabase Storage并返回URL
 * @body    multipart/form-data 音频文件
 * @access  Private
 */
router.post('/upload', authenticate, upload.single('audio'), audioController.uploadAudio);

/**
 * @route   POST /api/audio/transcribe
 * @desc    上传音频并调用科大讯飞转文字
 * @body    multipart/form-data 音频文件
 * @access  Private
 */
router.post('/transcribe', authenticate, upload.single('audio'), audioController.transcribeAudio);

/**
 * @route   POST /api/audio/dream/:dreamId/upload
 * @desc    上传梦境关联的音频文件
 * @param   dreamId - 梦境ID
 * @body    multipart/form-data 音频文件
 * @access  Private
 */
router.post('/dream/:dreamId/upload', authenticate, upload.single('audio'), audioController.uploadDreamAudio);

/**
 * @route   GET /api/audio/dream/:dreamId
 * @desc    获取梦境关联的音频
 * @param   dreamId - 梦境ID
 * @access  Private
 */
router.get('/dream/:dreamId', authenticate, audioController.getDreamAudio);

export default router;
