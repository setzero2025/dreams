import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { User } from './User';
import { Dream } from './Dream';
import { GenerationMetadata } from './GenerationMetadata';

export enum GenerationType {
  IMAGE = 'image',
  VIDEO_5S = 'video_5s',
  VIDEO_10S = 'video_10s',
  VIDEO_LONG = 'video_long',
}

export enum GenerationStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

@Entity('generations')
export class Generation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'uuid', nullable: false })
  dreamId: string;

  @Column({ 
    type: 'varchar', 
    length: 20, 
    nullable: false,
    enum: GenerationType
  })
  generationType: GenerationType;

  @Column({ 
    type: 'varchar', 
    length: 20, 
    nullable: false,
    enum: GenerationStatus,
    default: GenerationStatus.PENDING
  })
  status: GenerationStatus;

  @Column({ type: 'text', nullable: false })
  prompt: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  resultUrl?: string;

  @Column({ type: 'varchar', length: 50, nullable: true })
  style?: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  resolution?: string;

  @Column({ type: 'integer', nullable: true })
  duration?: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  completedAt?: Date;

  @Column({ type: 'text', nullable: true })
  errorMessage?: string;

  @ManyToOne(() => User, user => user.generations, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Dream, dream => dream.generations, { onDelete: 'CASCADE' })
  dream: Dream;

  @OneToMany(() => GenerationMetadata, metadata => metadata.generation, { cascade: true })
  metadata: GenerationMetadata[];
}
