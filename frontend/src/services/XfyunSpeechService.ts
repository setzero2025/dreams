import { XFYUN_CONFIG } from '../config/xfyun';
import CryptoJS from 'crypto-js';

interface XfyunSpeechServiceOptions {
  onTextResult: (text: string) => void;
  onError: (error: Error) => void;
  onClose?: () => void;
}

export class XfyunSpeechService {
  private ws: WebSocket | null = null;
  private isRecording = false;
  private options: XfyunSpeechServiceOptions;

  constructor(options: XfyunSpeechServiceOptions) {
    this.options = options;
  }

  // 创建WebSocket签名URL（标准版接口）
  private createSignatureUrl(): string {
    const { APPID, API_KEY, WSS_URL } = XFYUN_CONFIG;
    const ts = Math.floor(Date.now() / 1000).toString();
    
    // 步骤1: 生成baseString = appid + ts
    const baseString = APPID + ts;
    console.log('签名步骤1 - baseString:', baseString);
    
    // 步骤2: 对baseString进行MD5
    const md5 = CryptoJS.MD5(baseString).toString();
    console.log('签名步骤2 - MD5结果:', md5);
    
    // 步骤3: 使用apiKey作为key，对MD5结果进行HmacSHA1加密
    const sha1 = CryptoJS.HmacSHA1(md5, API_KEY);
    console.log('签名步骤3 - SHA1结果:', sha1.toString());
    
    // 步骤4: 对SHA1结果进行Base64编码（使用官方示例的方式）
    const signa = encodeURIComponent(CryptoJS.enc.Base64.stringify(sha1));
    console.log('签名步骤4 - signa结果:', signa);
    
    // 构建最终URL
    const url = `${WSS_URL}?appid=${APPID}&ts=${ts}&signa=${signa}`;
    console.log('最终URL:', url);
    
    return url;
  }

  // 初始化WebSocket连接
  private initWebSocket(): Promise<WebSocket> {
    return new Promise((resolve, reject) => {
      try {
        const url = this.createSignatureUrl();
        console.log('WebSocket连接URL:', url);
        this.ws = new WebSocket(url);

        this.ws.onopen = () => {
          console.log('WebSocket连接已建立');
          // 根据官方示例，连接建立后不需要发送开始消息
          // 等待服务器返回"started"消息后开始发送音频数据
          resolve(this.ws);
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.ws.onerror = (error) => {
          console.error('WebSocket错误:', error);
          const errorMessage = error instanceof Error ? error.message : 'WebSocket连接失败';
          this.options.onError(new Error(`WebSocket连接失败: ${errorMessage}`));
          reject(new Error(`WebSocket连接失败: ${errorMessage}`));
        };

        this.ws.onclose = (event) => {
          console.log('WebSocket连接已关闭:', event.code, event.reason);
          if (event.code !== 1000) {
            const errorMessage = event.reason || `连接关闭，错误码: ${event.code}`;
            this.options.onError(new Error(`WebSocket连接异常关闭: ${errorMessage}`));
          }
          if (this.options.onClose) {
            this.options.onClose();
          }
        };
      } catch (error) {
        console.error('初始化WebSocket失败:', error);
        const errorMessage = error instanceof Error ? error.message : '初始化WebSocket失败';
        reject(new Error(errorMessage));
      }
    });
  }

  // 处理WebSocket消息
  private handleMessage(data: string) {
    try {
      const result = JSON.parse(data);
      console.log('接收到消息:', result);
      
      // 根据action类型处理不同消息
      switch (result.action) {
        case 'started':
          // 连接建立成功
          console.log('讯飞API连接成功，sid:', result.sid);
          break;
          
        case 'result':
          // 处理转写结果
          console.log('【处理result消息】:', result.data);
          if (result.data) {
            try {
              const parsedData = JSON.parse(result.data);
              console.log('【解析后的数据】:', JSON.stringify(parsedData, null, 2));
              
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
                console.log('【提取的文本】:', text);
                if (text) {
                  console.log('【调用onTextResult】:', text);
                  this.options.onTextResult(text);
                }
              } else {
                console.log('【数据结构不符合预期】:', parsedData);
              }
            } catch (parseError) {
              console.error('【解析result.data失败】:', parseError);
            }
          } else {
            console.log('【result.data为空】');
          }
          break;
          
        case 'error':
          // 处理错误
          console.error('讯飞API错误:', result);
          this.options.onError(new Error(`讯飞API错误: ${result.code} - ${result.desc}`));
          break;
          
        default:
          console.log('未知消息类型:', result.action);
      }
    } catch (error) {
      console.error('解析消息失败:', error);
    }
  }

  // 发送音频数据（直接发送二进制数据）
  sendAudioData(audioData: ArrayBuffer) {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.log('WebSocket未连接，无法发送音频数据');
      return;
    }

    // 根据官方示例，直接发送二进制音频数据
    console.log('发送音频数据，大小:', audioData.byteLength);
    this.ws.send(audioData);
  }

  // 发送结束消息
  sendEndMessage() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    // 使用官方示例的结束标志格式
    this.ws.send('{"end": true}');
  }

  // 开始录音和转写
  async start(): Promise<void> {
    try {
      // 检查配置
      if (!XFYUN_CONFIG.APPID) {
        throw new Error('请配置APPID参数');
      }
      if (!XFYUN_CONFIG.API_KEY) {
        throw new Error('请配置API_KEY参数');
      }

      // 初始化WebSocket连接
      await this.initWebSocket();
      
      this.isRecording = true;
      console.log('开始录音和实时转写');
    } catch (error) {
      console.error('开始录音失败:', error);
      this.options.onError(error as Error);
      throw error;
    }
  }

  // 停止录音和转写
  async stop(): Promise<string> {
    if (this.isRecording) {
      try {
        // 发送结束消息
        this.sendEndMessage();

        // 关闭WebSocket
        if (this.ws) {
          setTimeout(() => {
            this.ws?.close();
            this.ws = null;
          }, 1000);
        }

        this.isRecording = false;
        console.log('停止录音和转写');
        
        return 'audio://recording.wav';
      } catch (error) {
        console.error('停止录音失败:', error);
        return '';
      }
    }
    return '';
  }

  // 检查是否正在录音
  isRecordingState(): boolean {
    return this.isRecording;
  }
}