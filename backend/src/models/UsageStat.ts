import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { User } from './User';

@Entity('usage_stats')
export class UsageStat {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'date', nullable: false })
  statDate: Date;

  @Column({ type: 'integer', nullable: false, default: 0 })
  dreamCount: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  imageGenerationCount: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  videoGenerationCount: number;

  @Column({ type: 'integer', nullable: false, default: 0 })
  interpretationCount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, nullable: false, default: 0 })
  voiceRecordingMinutes: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => User, user => user.usageStats, { onDelete: 'CASCADE' })
  user: User;
}
