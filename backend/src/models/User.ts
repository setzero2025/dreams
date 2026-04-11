import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm';
import { WechatAuth } from './WechatAuth';
import { Dream } from './Dream';
import { Generation } from './Generation';
import { Interpretation } from './Interpretation';
import { UserPhoto } from './UserPhoto';
import { AIChat } from './AIChat';
import { UserSetting } from './UserSetting';
import { UsageStat } from './UsageStat';
import { VoiceProfile } from './VoiceProfile';

export enum SubscriptionType {
  FREE = 'free',
  MONTHLY = 'monthly',
  YEARLY = 'yearly',
}

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, nullable: true, unique: true })
  phone?: string;

  @Column({ type: 'varchar', length: 100, nullable: false })
  nickname: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  avatarUrl?: string;

  @Column({ 
    type: 'varchar', 
    length: 20, 
    nullable: false, 
    default: SubscriptionType.FREE,
    enum: SubscriptionType
  })
  subscriptionType: SubscriptionType;

  @Column({ type: 'timestamp', nullable: true })
  subscriptionExpiresAt?: Date;

  @Column({ type: 'uuid', nullable: true })
  voiceProfileId?: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updatedAt: Date;

  @Column({ type: 'timestamp with time zone', nullable: true })
  lastLoginAt?: Date;

  @OneToMany(() => WechatAuth, wechatAuth => wechatAuth.user, { cascade: true })
  wechatAuths: WechatAuth[];

  @OneToMany(() => Dream, dream => dream.user, { cascade: true })
  dreams: Dream[];

  @OneToMany(() => Generation, generation => generation.user, { cascade: true })
  generations: Generation[];

  @OneToMany(() => Interpretation, interpretation => interpretation.user, { cascade: true })
  interpretations: Interpretation[];

  @OneToMany(() => UserPhoto, userPhoto => userPhoto.user, { cascade: true })
  photos: UserPhoto[];

  @OneToMany(() => AIChat, aiChat => aiChat.user, { cascade: true })
  aiChats: AIChat[];

  @OneToMany(() => UserSetting, userSetting => userSetting.user, { cascade: true })
  settings: UserSetting[];

  @OneToMany(() => UsageStat, usageStat => usageStat.user, { cascade: true })
  usageStats: UsageStat[];

  @OneToMany(() => VoiceProfile, voiceProfile => voiceProfile.user, { cascade: true })
  voiceProfiles: VoiceProfile[];
}
