import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Interpretation } from './Interpretation';

export enum EmotionType {
  JOY = 'joy',
  SADNESS = 'sadness',
  FEAR = 'fear',
  ANGER = 'anger',
  SURPRISE = 'surprise',
  DISGUST = 'disgust',
}

@Entity('emotion_analysis')
export class EmotionAnalysis {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  interpretationId: string;

  @Column({ 
    type: 'varchar', 
    length: 50, 
    nullable: false,
    enum: EmotionType
  })
  emotionType: EmotionType;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: false })
  intensity: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => Interpretation, interpretation => interpretation.emotions, { onDelete: 'CASCADE' })
  interpretation: Interpretation;
}
