import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';

interface AudioRecordingOptions {
  onAudioData: (audioData: ArrayBuffer) => void;
  onError: (error: Error) => void;
}

export class AudioRecordingService {
  private recording: Audio.Recording | null = null;
  private isRecording = false;
  private options: AudioRecordingOptions;
  private audioDataInterval: NodeJS.Timeout | null = null;

  constructor(options: AudioRecordingOptions) {
    this.options = options;
  }

  // 请求录音权限
  async requestPermissions(): Promise<boolean> {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('请求录音权限失败:', error);
      return false;
    }
  }

  // 开始录音
  async start(): Promise<void> {
    try {
      // 检查权限
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('没有录音权限，请在设置中开启录音权限');
      }

      // 设置音频模式
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        staysActiveInBackground: true,
        shouldDuckAndroid: true,
      });

      // 创建录音实例
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      
      this.recording = recording;
      this.isRecording = true;

      console.log('录音已开始');

      // 开始定时读取音频数据
      this.startAudioDataStreaming();

    } catch (error) {
      console.error('开始录音失败:', error);
      this.options.onError(error as Error);
      throw error;
    }
  }

  // 停止录音
  async stop(): Promise<string | null> {
    if (!this.isRecording || !this.recording) {
      return null;
    }

    try {
      // 停止音频数据流
      this.stopAudioDataStreaming();

      // 停止录音
      await this.recording.stopAndUnloadAsync();
      
      // 获取录音文件URI
      const uri = this.recording.getURI();
      
      this.isRecording = false;
      this.recording = null;

      console.log('录音已停止，文件URI:', uri);

      return uri;
    } catch (error) {
      console.error('停止录音失败:', error);
      this.options.onError(error as Error);
      return null;
    }
  }

  // 开始音频数据流（模拟实时发送）
  private startAudioDataStreaming(): void {
    // 由于expo-av不支持实时获取音频数据，
    // 我们需要在停止录音后一次性发送所有音频数据
    // 这里仅作为占位，实际实现需要在stop时处理
    console.log('音频数据流开始（将在停止时发送）');
  }

  // 停止音频数据流
  private stopAudioDataStreaming(): void {
    if (this.audioDataInterval) {
      clearInterval(this.audioDataInterval);
      this.audioDataInterval = null;
    }
  }

  // 获取录音状态
  isRecordingState(): boolean {
    return this.isRecording;
  }

  // 读取音频文件并转换为ArrayBuffer
  async readAudioFile(uri: string): Promise<ArrayBuffer | null> {
    try {
      // 读取文件为base64
      const base64Audio = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      // 将base64转换为ArrayBuffer
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      return bytes.buffer;
    } catch (error) {
      console.error('读取音频文件失败:', error);
      return null;
    }
  }
}
