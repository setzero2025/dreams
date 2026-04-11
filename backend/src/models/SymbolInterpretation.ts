import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Interpretation } from './Interpretation';

@Entity('symbol_interpretations')
export class SymbolInterpretation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  interpretationId: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  symbol: string;

  @Column({ type: 'text', nullable: false })
  meaning: string;

  @Column({ type: 'decimal', precision: 3, scale: 2, nullable: true })
  confidence?: number;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => Interpretation, interpretation => interpretation.symbols, { onDelete: 'CASCADE' })
  interpretation: Interpretation;
}
