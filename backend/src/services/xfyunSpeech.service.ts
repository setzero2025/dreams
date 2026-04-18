/**
 * 科大讯飞语音转写服务（后端版）
 * 使用科大讯飞实时语音转写API将音频转换为文字
 */

import CryptoJS from 'crypto-js';
import WebSocket from 'ws';

// 科大讯飞配置（从环境变量读取）
const XFYUN_CONFIG = {
  APPID: process.env.XFYUN_APP_ID || '',
  API_KEY: process.env.XFYUN_API_KEY || '',
  API_SECRET: process.env.XFYUN_API_SECRET || '',
  WSS_URL: 'wss://rtasr.xfyun.cn/v1/ws',
};

export class XfyunSpeechService {
  /**
   * 创建WebSocket签名URL（标准版接口）
   */
  private createSignatureUrl(): string {
    const { APPID, API_KEY, WSS_URL } = XFYUN_CONFIG;
    const ts = Math.floor(Date.now() / 1000).toString();

    // 步骤1: 生成baseString = appid + ts
    const baseString = APPID + ts;

    // 步骤2: 对baseString进行MD5
    const md5 = CryptoJS.MD5(baseString).toString();

    // 步骤3: 使用apiKey作为key，对MD5结果进行HmacSHA1加密
    const sha1 = CryptoJS.HmacSHA1(md5, API_KEY);

    // 步骤4: 对SHA1结果进行Base64编码
    const signa = encodeURIComponent(CryptoJS.enc.Base64.stringify(sha1));

    // 构建最终URL
    const url = `${WSS_URL}?appid=${APPID}&ts=${ts}&signa=${signa}`;

    return url;
  }

  /**
   * 将音频Buffer转换为PCM格式（如果需要）
   * 目前直接发送原始音频数据
   */
  private prepareAudioData(audioBuffer: Buffer): Buffer {
    // 科大讯飞支持多种音频格式，直接发送原始数据
    // 支持的格式：pcm, wav, mp3, speex, opus
    return audioBuffer;
  }

  /**
   * 语音转文字
   * @param audioBuffer 音频文件Buffer
   * @returns 转写后的文字
   */
  async transcribe(audioBuffer: Buffer): Promise<string> {
    // 检查配置
    if (!XFYUN_CONFIG.APPID || !XFYUN_CONFIG.API_KEY) {
      throw new Error('科大讯飞配置缺失，请检查环境变量 XFYUN_APPID 和 XFYUN_API_KEY');
    }

    return new Promise((resolve, reject) => {
      try {
        const url = this.createSignatureUrl();
        console.log('[XfyunSpeechService] 连接科大讯飞WebSocket...');

        const ws = new WebSocket(url);
        let transcribedText = '';
        let isCompleted = false;

        // 设置超时
        const timeout = setTimeout(() => {
          if (!isCompleted) {
            ws.close();
            reject(new Error('语音转写超时'));
          }
        }, 60000); // 60秒超时

        ws.on('open', () => {
          console.log('[XfyunSpeechService] WebSocket连接已建立');

          // 准备音频数据
          const audioData = this.prepareAudioData(audioBuffer);

          // 分段发送音频数据（每段约1280字节）
          const chunkSize = 1280;
          let offset = 0;

          const sendChunk = () => {
            if (offset >= audioData.length) {
              // 发送结束标志
              ws.send('{"end": true}');
              console.log('[XfyunSpeechService] 音频数据发送完成');
              return;
            }

            const chunk = audioData.slice(offset, offset + chunkSize);
            ws.send(chunk);
            offset += chunkSize;

            // 每40ms发送一段（模拟实时流）
            setTimeout(sendChunk, 40);
          };

          // 开始发送音频数据
          sendChunk();
        });

        ws.on('message', (data: WebSocket.Data) => {
          try {
            const message = data.toString();
            const result = JSON.parse(message);

            switch (result.action) {
              case 'started':
                console.log('[XfyunSpeechService] 转写服务已启动，sid:', result.sid);
                break;

              case 'result':
                // 处理转写结果
                if (result.data) {
                  const parsedData = JSON.parse(result.data);
                  if (parsedData.cn && parsedData.cn.st && parsedData.cn.st.rt) {
                    let text = '';
                    parsedData.cn.st.rt.forEach((rt: any) => {
                      if (rt.ws) {
                        rt.ws.forEach((ws: any) => {
                          if (ws.cw) {
                            ws.cw.forEach((cw: any) => {
                              text += cw.w;
                            });
                          }
                        });
                      }
                    });
                    if (text) {
                      transcribedText += text;
                      console.log('[XfyunSpeechService] 实时转写:', text);
                    }
                  }
                }
                break;

              case 'error':
                console.error('[XfyunSpeechService] 转写错误:', result);
                clearTimeout(timeout);
                ws.close();
                reject(new Error(`转写错误: ${result.desc || '未知错误'}`));
                break;

              default:
                console.log('[XfyunSpeechService] 未知消息类型:', result.action);
            }
          } catch (error) {
            console.error('[XfyunSpeechService] 解析消息失败:', error);
          }
        });

        ws.on('error', (error) => {
          console.error('[XfyunSpeechService] WebSocket错误:', error);
          clearTimeout(timeout);
          reject(new Error(`WebSocket错误: ${error.message}`));
        });

        ws.on('close', (code, reason) => {
          console.log('[XfyunSpeechService] WebSocket连接已关闭:', code, reason);
          clearTimeout(timeout);
          isCompleted = true;

          if (code === 1000 || code === 1005) {
            // 正常关闭
            resolve(transcribedText);
          } else {
            // 异常关闭，但如果有转写结果则返回
            if (transcribedText) {
              resolve(transcribedText);
            } else {
              reject(new Error(`连接异常关闭: ${reason || code}`));
            }
          }
        });
      } catch (error) {
        console.error('[XfyunSpeechService] 转写过程错误:', error);
        reject(error);
      }
    });
  }
}
