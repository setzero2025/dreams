import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Button } from '../components/Button';
import { BackButton } from '../components/BackButton';
import { useTheme } from '../theme/themeContext';
import { authApi } from '../services/api/authApi';

interface SubscriptionProps {
  navigation: any;
}

type PlanType = 'monthly' | 'yearly';

interface SubscriptionStatus {
  type: 'none' | 'monthly' | 'yearly';
  expiresAt?: string;
  isActive: boolean;
}

export const Subscription: React.FC<SubscriptionProps> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [selectedPlan, setSelectedPlan] = useState<PlanType>('monthly');
  const [loading, setLoading] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<SubscriptionStatus>({
    type: 'none',
    isActive: false,
  });

  useEffect(() => {
    loadSubscriptionStatus();
  }, []);

  const loadSubscriptionStatus = async () => {
    try {
      const result = await authApi.getSubscriptionStatus();
      if (result.success) {
        setCurrentStatus(result.data);
      }
    } catch (error) {
      console.error('获取订阅状态失败', error);
    }
  };

  const handleSubscribe = async () => {
    if (currentStatus.isActive) {
      Alert.alert('提示', '您已经是订阅用户，无需重复订阅');
      return;
    }

    setLoading(true);
    try {
      // 创建订阅订单
      const orderResult = await authApi.createSubscriptionOrder({
        planType: selectedPlan,
      });

      if (!orderResult.success) {
        Alert.alert('创建订单失败', orderResult.message || '请稍后重试');
        return;
      }

      // TODO: 调用支付宝支付（V2版本实现）
      // 目前模拟支付成功
      Alert.alert(
        '支付确认',
        `确认订阅${selectedPlan === 'monthly' ? '月度' : '年度'}会员？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '确认',
            onPress: async () => {
              // 模拟支付验证
              const verifyResult = await authApi.verifySubscriptionPayment({
                orderId: orderResult.data.orderId,
                // 支付宝返回的支付凭证
              });

              if (verifyResult.success) {
                Alert.alert('订阅成功', '您已成功订阅会员，现在可以无限使用所有功能！', [
                  {
                    text: '确定',
                    onPress: () => {
                      loadSubscriptionStatus();
                      navigation.goBack();
                    },
                  },
                ]);
              } else {
                Alert.alert('支付失败', verifyResult.message || '支付验证失败，请稍后重试');
              }
            },
          },
        ]
      );
    } catch (error) {
      console.error('订阅错误:', error);
      Alert.alert('订阅失败', '网络错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const renderCurrentStatus = () => {
    if (!currentStatus.isActive) {
      return (
        <View style={styles.statusCard}>
          <Text style={styles.statusIcon}>🆓</Text>
          <Text style={styles.statusTitle}>免费版</Text>
          <Text style={styles.statusDesc}>每月有限额度，升级解锁无限创作</Text>
        </View>
      );
    }

    return (
      <View style={[styles.statusCard, styles.statusCardActive]}>
        <Text style={styles.statusIcon}>👑</Text>
        <Text style={styles.statusTitle}>
          {currentStatus.type === 'monthly' ? '月度会员' : '年度会员'}
        </Text>
        <Text style={styles.statusDesc}>
          到期时间: {currentStatus.expiresAt}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部导航 */}
      <View style={styles.navHeader}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle}>升级会员</Text>
        </View>
        <View style={styles.navPlaceholder} />
      </View>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>升级会员</Text>
          <Text style={styles.subtitle}>解锁无限梦境创作</Text>
        </View>

        {/* Current Status */}
        {renderCurrentStatus()}

        {/* Benefits */}
        <View style={styles.benefitsCard}>
          <Text style={styles.benefitsTitle}>会员权益</Text>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🎨</Text>
            <View style={styles.benefitText}>
              <Text style={styles.benefitName}>无限图片生成</Text>
              <Text style={styles.benefitDesc}>免费版每月限5张</Text>
            </View>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🎬</Text>
            <View style={styles.benefitText}>
              <Text style={styles.benefitName}>无限视频生成</Text>
              <Text style={styles.benefitDesc}>免费版每月限2个短视频</Text>
            </View>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>🎭</Text>
            <View style={styles.benefitText}>
              <Text style={styles.benefitName}>无限长视频</Text>
              <Text style={styles.benefitDesc}>免费版每月限1个长视频</Text>
            </View>
          </View>
          <View style={styles.benefitItem}>
            <Text style={styles.benefitIcon}>☁️</Text>
            <View style={styles.benefitText}>
              <Text style={styles.benefitName}>云端永久保存</Text>
              <Text style={styles.benefitDesc}>所有创作自动备份</Text>
            </View>
          </View>
        </View>

        {/* Plan Selection */}
        <Text style={styles.planTitle}>选择订阅方案</Text>
        
        <TouchableOpacity
          style={[
            styles.planCard,
            selectedPlan === 'monthly' && styles.planCardSelected,
          ]}
          onPress={() => setSelectedPlan('monthly')}
        >
          <View style={styles.planHeader}>
            <Text style={styles.planName}>月度会员</Text>
            <View style={styles.radioButton}>
              {selectedPlan === 'monthly' && <View style={styles.radioButtonInner} />}
            </View>
          </View>
          <View style={styles.planPriceRow}>
            <Text style={styles.planPrice}>¥19.9</Text>
            <Text style={styles.planUnit}>/月</Text>
          </View>
          <Text style={styles.planDesc}>按月订阅，随时取消</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.planCard,
            selectedPlan === 'yearly' && styles.planCardSelected,
            styles.yearlyCard,
          ]}
          onPress={() => setSelectedPlan('yearly')}
        >
          <View style={styles.recommendBadge}>
            <Text style={styles.recommendText}>推荐</Text>
          </View>
          <View style={styles.planHeader}>
            <Text style={styles.planName}>年度会员</Text>
            <View style={styles.radioButton}>
              {selectedPlan === 'yearly' && <View style={styles.radioButtonInner} />}
            </View>
          </View>
          <View style={styles.planPriceRow}>
            <Text style={styles.planPrice}>¥99.9</Text>
            <Text style={styles.planUnit}>/年</Text>
          </View>
          <View style={styles.planSavings}>
            <Text style={styles.planSavingsText}>相当于¥8.3/月</Text>
            <Text style={styles.planSavingsHighlight}>省¥138.9</Text>
          </View>
          <Text style={styles.planDesc}>年度订阅，最划算的选择</Text>
        </TouchableOpacity>

        {/* Subscribe Button */}
        <Button
          title={loading ? '处理中...' : currentStatus.isActive ? '已是会员' : '立即订阅'}
          onPress={handleSubscribe}
          disabled={loading || currentStatus.isActive}
          style={styles.subscribeButton}
          size="large"
        />

        {loading && (
          <ActivityIndicator
            size="small"
            color={colors.primary}
            style={styles.loader}
          />
        )}

        {/* Terms */}
        <Text style={styles.terms}>
          订阅即表示同意《会员服务协议》和《自动续费协议》
        </Text>
        <Text style={styles.termsNote}>
          支持支付宝支付（V2版本实现）
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  navHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  navTitleContainer: {
    flex: 1,
    alignItems: 'center',
  },
  navTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
  },
  navPlaceholder: {
    width: 40,
  },
  scrollContent: {
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  statusCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.border,
  },
  statusCardActive: {
    borderColor: colors.success,
    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)',
  },
  statusIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  statusDesc: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  benefitsCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
  },
  benefitsTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  benefitItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  benefitText: {
    flex: 1,
  },
  benefitName: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 2,
  },
  benefitDesc: {
    fontSize: 13,
    color: colors.textLight,
  },
  planTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
  },
  planCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 20,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  planCardSelected: {
    borderColor: colors.primary,
  },
  yearlyCard: {
    position: 'relative',
  },
  recommendBadge: {
    position: 'absolute',
    top: -1,
    right: 20,
    backgroundColor: colors.accent,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
  },
  recommendText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  planHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  planName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
  },
  planPriceRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  planPrice: {
    fontSize: 32,
    fontWeight: 'bold',
    color: colors.text,
  },
  planUnit: {
    fontSize: 16,
    color: colors.textSecondary,
    marginLeft: 4,
  },
  planSavings: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  planSavingsText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 8,
  },
  planSavingsHighlight: {
    fontSize: 14,
    color: colors.success,
    fontWeight: 'bold',
  },
  planDesc: {
    fontSize: 14,
    color: colors.textLight,
  },
  subscribeButton: {
    marginTop: 24,
  },
  loader: {
    marginTop: 16,
  },
  terms: {
    fontSize: 12,
    color: colors.textLight,
    textAlign: 'center',
    marginTop: 24,
  },
  termsNote: {
    fontSize: 12,
    color: colors.textDisabled,
    textAlign: 'center',
    marginTop: 8,
  },
});
