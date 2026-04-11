import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { UserKnowledgeFavorite } from './UserKnowledgeFavorite';

@Entity('knowledge_base')
export class KnowledgeBase {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200, nullable: false })
  title: string;

  @Column({ type: 'text', nullable: false })
  content: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  category: string;

  @Column({ type: 'text', array: true, nullable: false })
  tags: string[];

  @Column({ type: 'tsvector', nullable: true })
  searchVector?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @OneToMany(() => UserKnowledgeFavorite, favorite => favorite.knowledge, { cascade: true })
  favorites: UserKnowledgeFavorite[];
}
