// 科大讯飞实时语音转写配置
// 请根据科大讯飞控制台获取以下参数
export const XFYUN_CONFIG = {
  // 应用ID
  APPID: 'f4530107',
  
  // API密钥
  API_KEY: 'd03d430a915695317ee40e3eb80e18c5',
  
  // API密钥的密钥（标准版接口不需要）
  API_SECRET: '',
  
  // 实时语音转写服务地址（标准版）
  WSS_URL: 'wss://rtasr.xfyun.cn/v1/ws',
  
  // 语音参数配置
  AUDIO_CONFIG: {
    // 音频采样率，支持8000/16000
    sample_rate: 16000,
    
    // 音频格式，支持pcm/wav
    format: 'pcm',
    
    // 音频通道数，支持1/2
    channel: 1,
    
    // 语言，支持zh_cn/en_us
    language: 'zh_cn',
    
    // 是否开启标点符号
    enable_punctuation: true,
    
    // 是否开启数字格式转换
    enable_number: true,
    
    // 是否开启语音检测
    vad_eos: 10000,
    
    // 是否开启方言，0为不开启，1为开启
    accent: 0
  }
};