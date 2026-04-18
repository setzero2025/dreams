import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/themeContext';
import { authApi, User } from '../services/api/authApi';

// 用户角色类型
export type UserTier = 'guest' | 'registered' | 'subscribed';

// 额度配置 - 按用户角色和生成类型定义
export const QUOTA_CONFIG = {
  // 访客（未登录）- 每个梦境限制
  guest: {
    image: { limit: 1, unlimited: false },      // 每个梦境1张图
    video: { limit: 1, unlimited: false },      // 每个梦境1个视频预览
    longVideo: { limit: 0, unlimited: false },  // 访客不能生成长视频
    interpretation: { limit: 1, unlimited: false }, // 每个梦境1次解读
  },
  // 注册用户（未订阅）- 每个梦境限制
  registered: {
    image: { limit: 5, unlimited: false },      // 每个梦境最多5张图
    video: { limit: 2, unlimited: false },      // 每个梦境2个梦视频
    longVideo: { limit: 1, unlimited: false },  // 每个梦境1个长视频
    interpretation: { limit: -1, unlimited: true }, // 无限解读
  },
  // 订阅用户 - 无限制
  subscribed: {
    image: { limit: -1, unlimited: true },      // 无限
    video: { limit: -1, unlimited: true },      // 无限
    longVideo: { limit: -1, unlimited: true },  // 无限
    interpretation: { limit: -1, unlimited: true }, // 无限
  },
};

interface QuotaDisplayProps {
  type: 'image' | 'video' | 'longVideo' | 'interpretation';
  showLabel?: boolean;
  compact?: boolean;
  // 按梦境的额度检查参数
  dreamId?: string;
  currentCount?: number; // 当前梦境已生成的数量
}

export const QuotaDisplay: React.FC<QuotaDisplayProps> = ({ 
  type, 
  showLabel = true,
  compact = false,
  dreamId,
  currentCount = 0,
}) => {
  const { colors } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadUserInfo();
  }, []);

  const loadUserInfo = async () => {
    try {
      const userInfo = await authApi.getUserInfo();
      setUser(userInfo);
    } catch (error) {
      console.error('加载用户信息失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取用户角色
  const getUserTier = (): UserTier => {
    if (!user) return 'guest';
    return user.tier || 'guest';
  };

  // 获取额度配置
  const getQuotaConfig = () => {
    const tier = getUserTier();
    return QUOTA_CONFIG[tier][type];
  };

  // 获取类型标签
  const getTypeLabel = () => {
    switch (type) {
      case 'image': return '图片';
      case 'video': return '视频';
      case 'longVideo': return '长视频';
      case 'interpretation': return '解读';
      default: return '';
    }
  };

  const config = getQuotaConfig();
  const label = getTypeLabel();
  const unlimited = config.unlimited;
  const limit = config.limit;
  const used = currentCount;
  const remaining = unlimited ? '无限' : Math.max(0, limit - used);
  const total = unlimited ? '∞' : limit;
  const isLow = !unlimited && typeof remaining === 'number' && remaining <= 1;
  const isExhausted = !unlimited && typeof remaining === 'number' && remaining <= 0;

  if (loading) {
    return (
      <View style={[styles.container, compact && styles.compact]}>
        <ActivityIndicator size="small" color={colors.secondary} />
      </View>
    );
  }

  if (compact) {
    return (
      <View style={[
        styles.compactContainer, 
        isLow && styles.lowQuota,
        isExhausted && styles.exhaustedQuota
      ]}>
        <Text style={[
          styles.compactText, 
          { color: isExhausted ? colors.error : isLow ? colors.warning : colors.textSecondary }
        ]}>
          {unlimited ? '无限' : `${remaining}/${total}`}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {showLabel && (
        <Text style={[styles.label, { color: colors.textSecondary }]}>
          {label}额度
        </Text>
      )}
      <View style={styles.quotaRow}>
        <Text style={[
          styles.remaining, 
          { color: isExhausted ? colors.error : isLow ? colors.warning : colors.secondary }
        ]}>
          {unlimited ? '无限' : remaining}
        </Text>
        {!unlimited && (
          <Text style={[styles.total, { color: colors.textSecondary }]}>
            /{total}
          </Text>
        )}
      </View>
      {!unlimited && limit > 0 && (
        <View style={styles.progressBar}>
          <View 
            style={[
              styles.progressFill, 
              { 
                width: `${Math.min(100, (used / limit) * 100)}%`,
                backgroundColor: isExhausted ? colors.error : isLow ? colors.warning : colors.secondary 
              }
            ]} 
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    minWidth: 60,
  },
  compactContainer: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  compact: {
    minWidth: 40,
  },
  lowQuota: {
    backgroundColor: 'rgba(245, 158, 11, 0.15)', // 橙色警告背景
  },
  exhaustedQuota: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)', // 红色耗尽背景
  },
  label: {
    fontSize: 10,
    marginBottom: 2,
  },
  quotaRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  remaining: {
    fontSize: 14,
    fontWeight: '600',
  },
  total: {
    fontSize: 12,
    marginLeft: 2,
  },
  compactText: {
    fontSize: 11,
    fontWeight: '500',
  },
  progressBar: {
    width: 40,
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 1.5,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 1.5,
  },
});
