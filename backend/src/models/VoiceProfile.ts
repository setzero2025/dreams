import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne } from 'typeorm';
import { User } from './User';

@Entity('voice_profiles')
export class VoiceProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  profileName: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  audioSampleUrl?: string;

  @Column({ type: 'jsonb', nullable: true })
  featuresData?: any;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  qualityScore?: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => User, user => user.voiceProfiles, { onDelete: 'CASCADE' })
  user: User;
}
