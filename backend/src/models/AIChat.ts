import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from './User';

export enum MessageType {
  USER = 'user',
  ASSISTANT = 'assistant',
}

@Entity('ai_chats')
export class AIChat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'uuid', nullable: false })
  sessionId: string;

  @Column({ 
    type: 'varchar', 
    length: 20, 
    nullable: false,
    enum: MessageType
  })
  messageType: MessageType;

  @Column({ type: 'text', nullable: false })
  content: string;

  @Column({ type: 'jsonb', nullable: true })
  emotionAnalysis?: any;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => User, user => user.aiChats, { onDelete: 'CASCADE' })
  user: User;
}
