import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from 'typeorm';
import { Generation } from './Generation';

@Entity('generation_metadata')
export class GenerationMetadata {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: false })
  generationId: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  metadataKey: string;

  @Column({ type: 'jsonb', nullable: false })
  metadataValue: any;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @ManyToOne(() => Generation, generation => generation.metadata, { onDelete: 'CASCADE' })
  generation: Generation;
}
