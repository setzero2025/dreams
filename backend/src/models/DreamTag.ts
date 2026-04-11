import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Dream } from './Dream';

@Entity('dream_tags')
export class DreamTag {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  dreamId: string;

  @Column({ type: 'varchar', length: 50, nullable: false })
  tagName: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => Dream, dream => dream.tags, { onDelete: 'CASCADE' })
  dream: Dream;
}
