export interface Dream {
  id: string;
  title: string;
  content: string;
  contentType: 'text' | 'voice' | 'mixed';
  voiceUrl?: string;
  voiceDuration?: number;
  moodRating: 1 | 2 | 3 | 4 | 5;
  emotions?: string[];  // 情绪感受标签（如：开心、难过、焦虑等）
  tags: string[];
  dreamDate: string;
  createdAt: string;
}

export interface Generation {
  id: string;
  dream_id: string;
  type: 'image' | 'video_5s' | 'video_10s' | 'video_long';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  prompt: string;
  result_url?: string;
  style?: string;
  created_at: string;
}

export interface User {
  id: string;
  nickname: string;
  avatar?: string;
  subscription: 'free' | 'monthly' | 'yearly';
  streak: number;
}
