-- Supabase Storage 存储桶访问策略配置
-- 在 Supabase Dashboard -> SQL Editor 中执行

-- 允许匿名用户读取 aiImage 存储桶中的文件
CREATE POLICY "Allow public read access for aiImage"
ON storage.objects FOR SELECT
USING (bucket_id = 'aiImage');

-- 允许匿名用户读取 aiVideo 存储桶中的文件
CREATE POLICY "Allow public read access for aiVideo"
ON storage.objects FOR SELECT
USING (bucket_id = 'aiVideo');

-- 允许匿名用户读取 audio 存储桶中的文件
CREATE POLICY "Allow public read access for audio"
ON storage.objects FOR SELECT
USING (bucket_id = 'audio');

-- 允许认证用户上传文件到 aiImage 存储桶
CREATE POLICY "Allow authenticated uploads for aiImage"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'aiImage' AND auth.role() = 'authenticated');

-- 允许认证用户上传文件到 aiVideo 存储桶
CREATE POLICY "Allow authenticated uploads for aiVideo"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'aiVideo' AND auth.role() = 'authenticated');

-- 允许认证用户上传文件到 audio 存储桶
CREATE POLICY "Allow authenticated uploads for audio"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'audio' AND auth.role() = 'authenticated');
