import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../theme/themeContext';
import { authApi } from '../services/api/authApi';

interface QuotaData {
  image: { used: number; limit: number; unlimited?: boolean };
  video: { used: number; limit: number; unlimited?: boolean };
  longVideo: { used: number; limit: number; unlimited?: boolean };
  interpretation?: { used: number; limit: number; unlimited?: boolean };
}

interface QuotaDisplayProps {
  type: 'image' | 'video' | 'longVideo' | 'interpretation';
  showLabel?: boolean;
  compact?: boolean;
}

export const QuotaDisplay: React.FC<QuotaDisplayProps> = ({ 
  type, 
  showLabel = true,
  compact = false 
}) => {
  const { colors } = useTheme();
  const [quota, setQuota] = useState<QuotaData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadQuota();
  }, []);

  const loadQuota = async () => {
    try {
      const response = await authApi.getUserQuota();
      if (response.success && response.data) {
        setQuota(response.data);
      }
    } catch (error) {
      console.error('加载额度失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getQuotaInfo = () => {
    if (!quota) return null;
    
    switch (type) {
      case 'image':
        return { ...quota.image, label: '图片' };
      case 'video':
        return { ...quota.video, label: '视频' };
      case 'longVideo':
        return { ...quota.longVideo, label: '长视频' };
      case 'interpretation':
        return quota.interpretation 
          ? { ...quota.interpretation, label: '解读' }
          : { used: 0, limit: -1, unlimited: true, label: '解读' };
      default:
        return null;
    }
  };

  const quotaInfo = getQuotaInfo();

  if (loading) {
    return (
      <View style={[styles.container, compact && styles.compact]}>
        <ActivityIndicator size="small" color={colors.secondary} />
      </View>
    );
  }

  if (!quotaInfo) {
    return null;
  }

  const { used, limit, unlimited, label } = quotaInfo;
  const remaining = unlimited ? '无限' : Math.max(0, limit - used);
  const total = unlimited ? '∞' : limit;
  const isLow = !unlimited && typeof remaining === 'number' && remaining <= 1;

  if (compact) {
    return (
      <View style={[styles.compactContainer, isLow && styles.lowQuota]}>
        <Text style={[styles.compactText, { color: isLow ? colors.error : colors.textSecondary }]}>
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
        <Text style={[styles.remaining, { color: isLow ? colors.error : colors.secondary }]}>
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
                backgroundColor: isLow ? colors.error : colors.secondary 
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
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
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
