/**
 * 梦境路由配置
 * 定义梦境相关的API端点
 */

import { Router } from 'express';
import { dreamController } from '../controllers/DreamController';
import { authenticate } from '../middleware/auth';

const router = Router();

/**
 * @route   GET /api/dreams
 * @desc    获取梦境列表
 * @query   period - 时间范围 (today/weekly/all)
 * @query   search - 搜索关键词
 * @query   page - 页码
 * @query   pageSize - 每页数量
 * @access  Private
 */
router.get('/', authenticate, dreamController.getDreams);

/**
 * @route   GET /api/dreams/search
 * @desc    搜索梦境
 * @query   q - 搜索关键词
 * @query   page - 页码
 * @query   pageSize - 每页数量
 * @access  Private
 */
router.get('/search', authenticate, dreamController.searchDreams);

/**
 * @route   POST /api/dreams
 * @desc    创建梦境
 * @body    { title, content, dreamDate, emotions, tags, audioId }
 * @access  Private
 */
router.post('/', authenticate, dreamController.createDream);

/**
 * @route   GET /api/dreams/:id
 * @desc    获取梦境详情
 * @param   id - 梦境ID
 * @access  Private
 */
router.get('/:id', authenticate, dreamController.getDreamById);

/**
 * @route   PUT /api/dreams/:id
 * @desc    更新梦境
 * @param   id - 梦境ID
 * @body    { title, content, dreamDate, emotions, tags, audioId }
 * @access  Private
 */
router.put('/:id', authenticate, dreamController.updateDream);

/**
 * @route   DELETE /api/dreams/:id
 * @desc    删除梦境
 * @param   id - 梦境ID
 * @access  Private
 */
router.delete('/:id', authenticate, dreamController.deleteDream);

/**
 * @route   GET /api/dreams/:id/works
 * @desc    获取梦境作品
 * @param   id - 梦境ID
 * @access  Private
 */
router.get('/:id/works', authenticate, dreamController.getDreamWorks);

/**
 * @route   POST /api/dreams/:id/audio
 * @desc    上传梦境音频（说梦功能）
 * @param   id - 梦境ID
 * @body    { audioUrl, duration } 或 multipart/form-data 文件
 * @access  Private
 */
router.post('/:id/audio', authenticate, dreamController.uploadDreamAudio);

export default router;
