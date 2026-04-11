import { Router, Request, Response } from 'express';
import { query, TABLES } from '../config/database';
import { authenticate } from '../middleware/auth';

const router = Router();

// 获取所有创作（关联梦境信息）
router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    // 查询创作并关联梦境信息
    const result = await query(
      `SELECT g.*, 
              d.title as dream_title, 
              d.dream_date, 
              d.mood_rating
       FROM generations g
       LEFT JOIN dreams d ON g.dream_id = d.id
       WHERE g.user_id = $1
       ORDER BY g.created_at DESC`,
      [userId]
    );

    // 转换为前端期望的格式
    const creations = result.rows?.map((item: any) => ({
      id: item.id,
      dreamId: item.dream_id,
      dreamTitle: item.dream_title || '未知梦境',
      dreamDate: item.dream_date,
      dreamMood: item.mood_rating,
      type: item.generation_type,
      title: item.title || '未命名创作',
      thumbnail: item.thumbnail,
      imageUrl: item.generation_type === 'image' ? item.image_url : null,
      videoUrl: (item.generation_type === 'video' || item.generation_type === 'video_long') ? item.video_url : null,
      coverUrl: (item.generation_type === 'video' || item.generation_type === 'video_long') ? item.cover_url : null,
      script: item.generation_type === 'script' ? item.script_data : null,
      status: item.status,
      style: item.style,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })) || [];

    res.json({
      success: true,
      data: creations,
    });
  } catch (error) {
    console.error('获取创作列表失败:', error);
    res.status(500).json({
      success: false,
      message: '获取创作列表失败',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 根据梦境ID获取创作
router.get('/dream/:dreamId', authenticate, async (req: Request, res: Response) => {
  try {
    const { dreamId } = req.params;
    const userId = req.user?.userId;

    const result = await query(
      `SELECT g.*, 
              d.title as dream_title, 
              d.dream_date, 
              d.mood_rating
       FROM generations g
       LEFT JOIN dreams d ON g.dream_id = d.id
       WHERE g.dream_id = $1 AND g.user_id = $2
       ORDER BY g.created_at DESC`,
      [dreamId, userId]
    );

    const creations = result.rows?.map((item: any) => ({
      id: item.id,
      dreamId: item.dream_id,
      dreamTitle: item.dream_title || '未知梦境',
      dreamDate: item.dream_date,
      dreamMood: item.mood_rating,
      type: item.generation_type,
      title: item.title || '未命名创作',
      thumbnail: item.thumbnail,
      imageUrl: item.generation_type === 'image' ? item.image_url : null,
      videoUrl: (item.generation_type === 'video' || item.generation_type === 'video_long') ? item.video_url : null,
      coverUrl: (item.generation_type === 'video' || item.generation_type === 'video_long') ? item.cover_url : null,
      script: item.generation_type === 'script' ? item.script_data : null,
      status: item.status,
      style: item.style,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })) || [];

    res.json({
      success: true,
      data: creations,
    });
  } catch (error) {
    console.error('获取梦境创作失败:', error);
    res.status(500).json({
      success: false,
      message: '获取梦境创作失败',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 根据类型获取创作
router.get('/type/:type', authenticate, async (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const userId = req.user?.userId;

    // 将前端类型映射到数据库类型
    const typeMapping: Record<string, string> = {
      'image': 'image',
      'video': 'video',
      'video_long': 'video_long',
      'script': 'script',
    };

    const dbType = typeMapping[type] || type;

    const result = await query(
      `SELECT g.*, 
              d.title as dream_title, 
              d.dream_date, 
              d.mood_rating
       FROM generations g
       LEFT JOIN dreams d ON g.dream_id = d.id
       WHERE g.generation_type = $1 AND g.user_id = $2
       ORDER BY g.created_at DESC`,
      [dbType, userId]
    );

    const creations = result.rows?.map((item: any) => ({
      id: item.id,
      dreamId: item.dream_id,
      dreamTitle: item.dream_title || '未知梦境',
      dreamDate: item.dream_date,
      dreamMood: item.mood_rating,
      type: item.generation_type,
      title: item.title || '未命名创作',
      thumbnail: item.thumbnail,
      imageUrl: item.generation_type === 'image' ? item.image_url : null,
      videoUrl: (item.generation_type === 'video' || item.generation_type === 'video_long') ? item.video_url : null,
      coverUrl: (item.generation_type === 'video' || item.generation_type === 'video_long') ? item.cover_url : null,
      script: item.generation_type === 'script' ? item.script_data : null,
      status: item.status,
      style: item.style,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })) || [];

    res.json({
      success: true,
      data: creations,
    });
  } catch (error) {
    console.error('获取类型创作失败:', error);
    res.status(500).json({
      success: false,
      message: '获取类型创作失败',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 获取单个创作详情
router.get('/:id', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    const result = await query(
      `SELECT g.*, 
              d.title as dream_title, 
              d.content as dream_content,
              d.dream_date, 
              d.mood_rating
       FROM generations g
       LEFT JOIN dreams d ON g.dream_id = d.id
       WHERE g.id = $1 AND g.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      res.status(404).json({
        success: false,
        message: '创作不存在或无权访问',
      });
      return;
    }

    const item = result.rows[0];
    const creation = {
      id: item.id,
      dreamId: item.dream_id,
      dreamTitle: item.dream_title || '未知梦境',
      dreamDate: item.dream_date,
      dreamMood: item.mood_rating,
      dreamContent: item.dream_content,
      type: item.generation_type,
      title: item.title || '未命名创作',
      thumbnail: item.thumbnail,
      imageUrl: item.generation_type === 'image' ? item.image_url : null,
      videoUrl: (item.generation_type === 'video' || item.generation_type === 'video_long') ? item.video_url : null,
      coverUrl: (item.generation_type === 'video' || item.generation_type === 'video_long') ? item.cover_url : null,
      script: item.generation_type === 'script' ? item.script_data : null,
      status: item.status,
      style: item.style,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    };

    res.json({
      success: true,
      data: creation,
    });
  } catch (error) {
    console.error('获取创作详情失败:', error);
    res.status(500).json({
      success: false,
      message: '获取创作详情失败',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 保存创作
router.post('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const creation = req.body;

    console.log('[CreationRoutes] 接收到的创作数据:', JSON.stringify(creation, null, 2));
    console.log('[CreationRoutes] dreamId:', creation.dreamId);
    console.log('[CreationRoutes] prompt值:', creation.prompt);
    console.log('[CreationRoutes] title值:', creation.title);

    // 验证 dream_id 是否为有效的 UUID 格式
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const isValidDreamId = creation.dreamId && uuidRegex.test(creation.dreamId);

    if (!isValidDreamId) {
      console.log('[CreationRoutes] 无效的 dream_id，拒绝保存:', creation.dreamId);
      return res.status(400).json({
        success: false,
        message: '无效的梦境ID，只能为已同步到云端的梦境创建作品',
        error: 'Invalid dream_id format',
      });
    }

    // 检查梦境是否存在于数据库中
    const dreamCheck = await query(
      'SELECT id FROM dreams WHERE id = $1 AND user_id = $2',
      [creation.dreamId, userId]
    );

    if (dreamCheck.rows.length === 0) {
      console.log('[CreationRoutes] 梦境不存在于数据库:', creation.dreamId);
      return res.status(404).json({
        success: false,
        message: '梦境不存在，无法保存创作',
        error: 'Dream not found',
      });
    }

    // 将前端类型映射到数据库类型
    const typeMapping: Record<string, string> = {
      'image': 'image',
      'video': 'video',
      'video_long': 'video_long',
      'script': 'script',
    };

    // 确保 prompt 有值
    const promptValue = creation.prompt || creation.title || '未命名创作';
    console.log('[CreationRoutes] 最终prompt值:', promptValue);

    const result = await query(
      `INSERT INTO generations (dream_id, user_id, generation_type, prompt, title, thumbnail, image_url, video_url, cover_url, script_data, style, status, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), NOW())
       ON CONFLICT (id) DO UPDATE SET
         prompt = EXCLUDED.prompt,
         title = EXCLUDED.title,
         thumbnail = EXCLUDED.thumbnail,
         image_url = EXCLUDED.image_url,
         video_url = EXCLUDED.video_url,
         cover_url = EXCLUDED.cover_url,
         script_data = EXCLUDED.script_data,
         style = EXCLUDED.style,
         status = EXCLUDED.status,
         updated_at = NOW()
       RETURNING *`,
      [
        creation.dreamId,
        userId,
        typeMapping[creation.type] || creation.type,
        promptValue,  // prompt 不能为空
        creation.title || '未命名创作',
        creation.thumbnail || null,
        creation.imageUrl || null,
        creation.videoUrl || null,
        creation.coverUrl || null,
        creation.script || null,
        creation.style || null,
        creation.status || 'completed',
      ]
    );

    res.json({
      success: true,
      message: '创作保存成功',
      data: {
        id: result.rows[0].id,
        dreamId: result.rows[0].dream_id,
        type: result.rows[0].generation_type,
        title: result.rows[0].title,
        thumbnail: result.rows[0].thumbnail,
        createdAt: result.rows[0].created_at,
      },
    });
  } catch (error) {
    console.error('保存创作失败:', error);
    res.status(500).json({
      success: false,
      message: '保存创作失败',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 删除创作
router.delete('/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;

    await query(
      'DELETE FROM generations WHERE id = $1 AND user_id = $2',
      [id, userId]
    );

    res.json({
      success: true,
      message: '创作删除成功',
    });
  } catch (error) {
    console.error('删除创作失败:', error);
    res.status(500).json({
      success: false,
      message: '删除创作失败',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// 清空所有创作
router.delete('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    await query(
      'DELETE FROM generations WHERE user_id = $1',
      [userId]
    );

    res.json({
      success: true,
      message: '所有创作已清空',
    });
  } catch (error) {
    console.error('清空创作失败:', error);
    res.status(500).json({
      success: false,
      message: '清空创作失败',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
