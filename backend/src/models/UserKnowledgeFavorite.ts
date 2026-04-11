import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from './User';
import { KnowledgeBase } from './KnowledgeBase';

@Entity('user_knowledge_favorites')
export class UserKnowledgeFavorite {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'uuid', nullable: false })
  knowledgeId: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => User, user => user.usageStats, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => KnowledgeBase, knowledge => knowledge.favorites, { onDelete: 'CASCADE' })
  knowledge: KnowledgeBase;
}
