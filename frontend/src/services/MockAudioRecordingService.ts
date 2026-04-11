interface AudioRecordingOptions {
  onAudioData: (audioData: ArrayBuffer) => void;
  onError: (error: Error) => void;
}

export class MockAudioRecordingService {
  private isRecording = false;
  private options: AudioRecordingOptions;
  private mockDataInterval: NodeJS.Timeout | null = null;

  constructor(options: AudioRecordingOptions) {
    this.options = options;
  }

  // 请求录音权限（模拟）
  async requestPermissions(): Promise<boolean> {
    console.log('模拟请求录音权限');
    return true;
  }

  // 开始录音（模拟）
  async start(): Promise<void> {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('没有录音权限');
      }

      this.isRecording = true;
      console.log('模拟录音已开始');

      // 模拟发送音频数据
      this.mockDataInterval = setInterval(() => {
        // 生成模拟音频数据（1280字节，符合科大讯飞要求）
        const mockAudioData = new ArrayBuffer(1280);
        const view = new Uint8Array(mockAudioData);
        for (let i = 0; i < view.length; i++) {
          view[i] = Math.floor(Math.random() * 256);
        }
        this.options.onAudioData(mockAudioData);
      }, 40); // 每40ms发送一次，符合科大讯飞要求

    } catch (error) {
      console.error('开始录音失败:', error);
      this.options.onError(error as Error);
      throw error;
    }
  }

  // 停止录音（模拟）
  async stop(): Promise<string | null> {
    if (!this.isRecording) {
      return null;
    }

    // 停止模拟数据发送
    if (this.mockDataInterval) {
      clearInterval(this.mockDataInterval);
      this.mockDataInterval = null;
    }

    this.isRecording = false;
    console.log('模拟录音已停止');

    // 返回模拟的音频文件URI
    return 'mock://recording.wav';
  }

  // 读取音频文件（模拟）
  async readAudioFile(uri: string): Promise<ArrayBuffer | null> {
    console.log('模拟读取音频文件:', uri);
    // 返回模拟的音频数据
    const mockAudioData = new ArrayBuffer(10240);
    const view = new Uint8Array(mockAudioData);
    for (let i = 0; i < view.length; i++) {
      view[i] = Math.floor(Math.random() * 256);
    }
    return mockAudioData;
  }

  // 获取录音状态
  isRecordingState(): boolean {
    return this.isRecording;
  }
}
