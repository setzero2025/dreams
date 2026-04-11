/**
 * 视频合成服务
 * 使用 FFmpeg 将多个视频片段合并成一个长视频
 */
import { exec } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';
import { supabaseStorageService } from './supabaseStorage.service';

const execAsync = promisify(exec);

interface VideoSegment {
  url: string;
  sceneNumber: number;
}

/**
 * 下载视频片段到本地
 * @param url 视频URL
 * @param outputPath 输出路径
 */
async function downloadVideo(url: string, outputPath: string): Promise<void> {
  console.log('【视频合成】下载视频:', url);
  
  const response = await axios({
    method: 'GET',
    url: url,
    responseType: 'stream',
    timeout: 60000,
  });

  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', resolve);
    writer.on('error', reject);
  });
}

/**
 * 合并多个视频片段
 * @param segments 视频片段列表
 * @returns 合并后的视频URL
 */
export async function mergeVideos(segments: VideoSegment[]): Promise<string> {
  console.log('【视频合成】开始合并', segments.length, '个视频片段');

  // 创建临时目录
  const tempDir = path.join(process.cwd(), 'temp', `merge_${Date.now()}`);
  fs.mkdirSync(tempDir, { recursive: true });

  try {
    // 下载所有视频片段
    const segmentFiles: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];
      const segmentPath = path.join(tempDir, `segment_${i}.mp4`);
      
      try {
        await downloadVideo(segment.url, segmentPath);
        segmentFiles.push(segmentPath);
        console.log(`【视频合成】下载片段 ${i + 1}/${segments.length} 完成`);
      } catch (error) {
        console.error(`【视频合成】下载片段 ${i + 1} 失败:`, error);
        throw new Error(`下载视频片段 ${segment.sceneNumber} 失败`);
      }
    }

    // 创建 FFmpeg 输入列表文件
    const listFile = path.join(tempDir, 'input.txt');
    const listContent = segmentFiles.map(file => `file '${file}'`).join('\n');
    fs.writeFileSync(listFile, listContent);

    // 输出文件路径
    const outputFile = path.join(tempDir, 'merged_video.mp4');

    // 使用 FFmpeg 合并视频
    // -f concat: 使用 concat 协议
    // -safe 0: 允许不安全的文件路径
    // -c copy: 直接复制流，不重新编码（保持质量，加快速度）
    const ffmpegCommand = `ffmpeg -f concat -safe 0 -i "${listFile}" -c copy "${outputFile}"`;
    
    console.log('【视频合成】执行 FFmpeg 命令:', ffmpegCommand);
    
    try {
      await execAsync(ffmpegCommand);
      console.log('【视频合成】FFmpeg 执行成功');
    } catch (error) {
      console.error('【视频合成】FFmpeg 执行失败:', error);
      
      // 如果直接复制失败，尝试重新编码
      console.log('【视频合成】尝试重新编码合并...');
      const reencodeCommand = `ffmpeg -f concat -safe 0 -i "${listFile}" -c:v libx264 -preset fast -crf 23 -c:a aac -b:a 128k "${outputFile}"`;
      await execAsync(reencodeCommand);
      console.log('【视频合成】重新编码合并成功');
    }

    // 检查输出文件是否存在
    if (!fs.existsSync(outputFile)) {
      throw new Error('合并后的视频文件不存在');
    }

    // 上传到 Supabase Storage
    const fileBuffer = fs.readFileSync(outputFile);

    // 使用 supabaseStorageService 的 uploadAIVideo 方法上传
    const videoUrl = await supabaseStorageService.uploadAIVideo(
      fileBuffer,
      'video/mp4',
      'system',
      'merged_video'
    );

    console.log('【视频合成】合并完成，视频URL:', videoUrl);
    return videoUrl;

  } finally {
    // 清理临时文件
    try {
      if (fs.existsSync(tempDir)) {
        fs.rmSync(tempDir, { recursive: true, force: true });
        console.log('【视频合成】清理临时文件完成');
      }
    } catch (cleanupError) {
      console.error('【视频合成】清理临时文件失败:', cleanupError);
    }
  }
}

/**
 * 检查 FFmpeg 是否已安装
 */
export async function checkFFmpeg(): Promise<boolean> {
  try {
    await execAsync('ffmpeg -version');
    return true;
  } catch {
    return false;
  }
}
