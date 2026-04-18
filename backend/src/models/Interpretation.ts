import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, OneToMany } from 'typeorm';
import { User } from './User';
import { Dream } from './Dream';
import { SymbolInterpretation } from './SymbolInterpretation';
import { EmotionAnalysis } from './EmotionAnalysis';

@Entity('interpretations')
export class Interpretation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  userId: string;

  @Column({ type: 'uuid', nullable: false })
  dreamId: string;

  @Column({ type: 'text', nullable: false })
  overallMeaning: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @ManyToOne(() => User, user => user.interpretations, { onDelete: 'CASCADE' })
  user: User;

  @ManyToOne(() => Dream, dream => dream.interpretations, { onDelete: 'CASCADE' })
  dream: Dream;

  @OneToMany(() => SymbolInterpretation, symbol => symbol.interpretation, { cascade: true })
  symbols: SymbolInterpretation[];

  @OneToMany(() => EmotionAnalysis, emotion => emotion.interpretation, { cascade: true })
  emotions: EmotionAnalysis[];
}
