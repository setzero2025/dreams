/**
 * 检查数据库中保存的 Storage URL
 */
import { query } from './src/config/database';

async function checkStorageUrls() {
  try {
    console.log('【诊断】检查数据库中的 Storage URL...');

    // 获取所有创作记录
    const result = await query(
      `SELECT id, generation_type, title, thumbnail, image_url, video_url, cover_url, created_at
       FROM generations
       ORDER BY created_at DESC
       LIMIT 10`
    );

    console.log(`【诊断】找到 ${result.rows.length} 条记录`);

    for (const item of result.rows) {
      console.log('\n--- 记录 ---');
      console.log('ID:', item.id);
      console.log('类型:', item.generation_type);
      console.log('标题:', item.title);
      console.log('缩略图:', item.thumbnail);
      console.log('图片URL:', item.image_url);
      console.log('视频URL:', item.video_url);
      console.log('封面URL:', item.cover_url);
      console.log('创建时间:', item.created_at);

      // 检查 URL 格式
      const urls = [
        { name: 'thumbnail', url: item.thumbnail },
        { name: 'image_url', url: item.image_url },
        { name: 'video_url', url: item.video_url },
        { name: 'cover_url', url: item.cover_url },
      ];

      for (const { name, url } of urls) {
        if (url) {
          if (url.includes('supabase.co')) {
            console.log(`  ${name}: Supabase Storage URL ✓`);
            // 检查是否是签名 URL
            if (url.includes('token=')) {
              console.log(`    - 签名 URL（有 token）`);
            } else {
              console.log(`    - 公开 URL`);
            }
          } else if (url.startsWith('http')) {
            console.log(`  ${name}: 外部 URL`);
          } else {
            console.log(`  ${name}: 未知格式`);
          }
        }
      }
    }

    process.exit(0);
  } catch (error) {
    console.error('【诊断】检查失败:', error);
    process.exit(1);
  }
}

checkStorageUrls();
