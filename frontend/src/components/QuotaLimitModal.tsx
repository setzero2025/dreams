import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Dimensions,
} from 'react-native';
import { Button } from './Button';
import { colors } from '../theme/colors';

interface QuotaLimitModalProps {
  visible: boolean;
  onClose: () => void;
  onSubscribe: () => void;
  type: 'image' | 'video' | 'longVideo' | 'guest';
  used: number;
  limit: number;
}

const { width } = Dimensions.get('window');

export const QuotaLimitModal: React.FC<QuotaLimitModalProps> = ({
  visible,
  onClose,
  onSubscribe,
  type,
  used,
  limit,
}) => {
  const getContent = () => {
    switch (type) {
      case 'image':
        return {
          icon: '🎨',
          title: '图片额度已用完',
          message: `您已使用 ${used}/${limit} 张免费图片额度`,
          description: '订阅会员后可无限生成梦境图片',
        };
      case 'video':
        return {
          icon: '🎬',
          title: '视频额度已用完',
          message: `您已使用 ${used}/${limit} 个免费视频额度`,
          description: '订阅会员后可无限生成梦境视频',
        };
      case 'longVideo':
        return {
          icon: '🎭',
          title: '长视频额度已用完',
          message: `您已使用 ${used}/${limit} 个免费长视频额度`,
          description: '订阅会员后可无限生成梦境长视频',
        };
      case 'guest':
        return {
          icon: '🔒',
          title: '需要登录',
          message: '登录后可保存数据到云端',
          description: '注册登录后享受更多免费额度',
        };
      default:
        return {
          icon: '⚠️',
          title: '额度不足',
          message: '您的免费额度已用完',
          description: '订阅会员后可继续使用',
        };
    }
  };

  const content = getContent();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Close Button */}
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Text style={styles.closeText}>✕</Text>
          </TouchableOpacity>

          {/* Icon */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{content.icon}</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>{content.title}</Text>

          {/* Message */}
          <Text style={styles.message}>{content.message}</Text>

          {/* Description */}
          <Text style={styles.description}>{content.description}</Text>

          {/* Progress Bar (for non-guest types) */}
          {type !== 'guest' && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBar}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(used / limit) * 100}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                已用 {used}/{limit}
              </Text>
            </View>
          )}

          {/* Benefits */}
          <View style={styles.benefits}>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>无限图片生成</Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>无限视频生成</Text>
            </View>
            <View style={styles.benefitItem}>
              <Text style={styles.benefitIcon}>✓</Text>
              <Text style={styles.benefitText}>云端永久保存</Text>
            </View>
          </View>

          {/* Action Buttons */}
          <View style={styles.buttonContainer}>
            {type === 'guest' ? (
              <>
                <Button
                  title="立即登录"
                  onPress={onSubscribe}
                  style={styles.primaryButton}
                />
                <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
                  <Text style={styles.secondaryButtonText}>暂不登录</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Button
                  title="订阅会员"
                  onPress={onSubscribe}
                  style={styles.primaryButton}
                />
                <TouchableOpacity style={styles.secondaryButton} onPress={onClose}>
                  <Text style={styles.secondaryButtonText}>稍后再说</Text>
                </TouchableOpacity>
              </>
            )}
          </View>

          {/* Pricing Hint */}
          {type !== 'guest' && (
            <Text style={styles.pricingHint}>
              月度 ¥19.9 / 年度 ¥99.9（省¥138.9）
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    width: width - 40,
    maxWidth: 400,
    alignItems: 'center',
    position: 'relative',
  },
  closeButton: {
    position: 'absolute',
    top: 16,
    right: 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: colors.textSecondary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  message: {
    fontSize: 16,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: colors.textLight,
    marginBottom: 20,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 20,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.accent,
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: 8,
  },
  benefits: {
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  benefitIcon: {
    color: colors.success,
    fontSize: 16,
    fontWeight: 'bold',
    marginRight: 8,
  },
  benefitText: {
    fontSize: 14,
    color: colors.text,
  },
  buttonContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    width: '100%',
  },
  secondaryButton: {
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  pricingHint: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 16,
  },
});
