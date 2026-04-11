import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { User } from './User';
import { DreamTag } from './DreamTag';
import { Generation } from './Generation';
import { Interpretation } from './Interpretation';

export enum ContentType {
  TEXT = 'text',
  VOICE = 'voice',
  MIXED = 'mixed',
}

@Entity('dreams')
export class Dream {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'varchar', length: 200, nullable: false })
  title: string;

  @Column({ type: 'text', nullable: false })
  content: string;

  @Column({ 
    type: 'varchar', 
    length: 20, 
    nullable: false,
    enum: ContentType
  })
  contentType: ContentType;

  @Column({ type: 'varchar', length: 500, nullable: true })
  voiceUrl?: string;

  @Column({ type: 'integer', nullable: true })
  voiceDuration?: number;

  @Column({ type: 'integer', nullable: false })
  moodRating: number;

  @Column({ type: 'timestamp with time zone', nullable: false })
  dreamDate: Date;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => User, user => user.dreams, { onDelete: 'CASCADE' })
  user: User;

  @OneToMany(() => DreamTag, dreamTag => dreamTag.dream, { cascade: true })
  tags: DreamTag[];

  @OneToMany(() => Generation, generation => generation.dream, { cascade: true })
  generations: Generation[];

  @OneToMany(() => Interpretation, interpretation => interpretation.dream, { cascade: true })
  interpretations: Interpretation[];
}
