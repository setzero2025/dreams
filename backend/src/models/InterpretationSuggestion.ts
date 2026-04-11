import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Interpretation } from './Interpretation';

@Entity('interpretation_suggestions')
export class InterpretationSuggestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  interpretationId: string;

  @Column({ type: 'text', nullable: false })
  suggestion: string;

  @Column({ type: 'integer', nullable: false, default: 1 })
  priority: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => Interpretation, interpretation => interpretation.suggestions, { onDelete: 'CASCADE' })
  interpretation: Interpretation;
}
