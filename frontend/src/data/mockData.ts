import { Dream, Generation, User } from '../types';

export const mockUser: User = {
  id: '1',
  nickname: '梦境探索者',
  avatar: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=peaceful%20dreamer%20avatar%20with%20starry%20background&image_size=square',
  subscription: 'free',
  streak: 3,
};

export const mockDreams: Dream[] = [
  {
    id: '1',
    title: '星空下的飞翔',
    content: '我梦到自己在星空下自由飞翔，周围是璀璨的星星和银河，感觉非常自由和宁静。',
    content_type: 'text',
    mood_rating: 5,
    tags: ['美梦', '飞翔', '星空'],
    dream_date: '2026-03-27',
    created_at: '2026-03-27T08:30:00',
  },
  {
    id: '2',
    title: '神秘的森林',
    content: '在一片古老的森林中，我遇到了会说话的动物，它们带我探索了森林的秘密。',
    content_type: 'text',
    mood_rating: 4,
    tags: ['奇幻', '森林', '冒险'],
    dream_date: '2026-03-26',
    created_at: '2026-03-26T07:45:00',
  },
  {
    id: '3',
    title: '未来城市',
    content: '我来到了一个高科技的未来城市，到处都是飞行汽车和全息投影，非常震撼。',
    content_type: 'text',
    mood_rating: 4,
    tags: ['未来', '科技', '城市'],
    dream_date: '2026-03-25',
    created_at: '2026-03-25T09:15:00',
  },
];

export const mockGenerations: Generation[] = [
  {
    id: '1',
    dream_id: '1',
    type: 'image',
    status: 'completed',
    prompt: '星空下飞翔的人，周围环绕着璀璨的星星',
    result_url: 'https://trae-api-cn.mchost.guru/api/ide/v1/text_to_image?prompt=person%20flying%20under%20starry%20sky%20with%20galaxy%20background&image_size=landscape_16_9',
    style: '写实',
    created_at: '2026-03-27T09:00:00',
  },
];
