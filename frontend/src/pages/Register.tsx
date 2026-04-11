import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Input } from '../components/Input';
import { Button } from '../components/Button';
import { BackButton } from '../components/BackButton';
import { useTheme } from '../theme/themeContext';
import { authApi } from '../services/api/authApi';

interface RegisterProps {
  navigation: any;
}

export const Register: React.FC<RegisterProps> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState<{
    phone?: string;
    password?: string;
    confirmPassword?: string;
  }>({});
  const [loading, setLoading] = useState(false);
  const [checkingPhone, setCheckingPhone] = useState(false);

  // 验证手机号格式
  const validatePhoneFormat = (phone: string): boolean => {
    return /^1[3-9]\d{9}$/.test(phone.trim());
  };

  // 检查手机号是否已注册
  const checkPhoneExists = useCallback(async (phoneNumber: string) => {
    if (!validatePhoneFormat(phoneNumber)) return;
    
    setCheckingPhone(true);
    try {
      const result = await authApi.checkPhoneExists(phoneNumber.trim());
      if (result.exists) {
        setErrors(prev => ({ ...prev, phone: '该手机号已被注册' }));
      }
    } catch (error) {
      console.error('检查手机号失败:', error);
    } finally {
      setCheckingPhone(false);
    }
  }, []);

  // 手机号输入框失焦处理
  const handlePhoneBlur = () => {
    if (phone.trim() && validatePhoneFormat(phone)) {
      checkPhoneExists(phone);
    }
  };

  // 手机号变化时清除错误
  const handlePhoneChange = (text: string) => {
    setPhone(text);
    if (errors.phone) {
      setErrors(prev => ({ ...prev, phone: undefined }));
    }
  };

  const validateForm = (): boolean => {
    const newErrors: {
      phone?: string;
      password?: string;
      confirmPassword?: string;
    } = {};

    // 验证手机号
    if (!phone.trim()) {
      newErrors.phone = '请输入手机号';
    } else if (!validatePhoneFormat(phone)) {
      newErrors.phone = '请输入有效的11位手机号';
    }

    // 验证密码（与后端保持一致）
    if (!password) {
      newErrors.password = '请输入密码';
    } else {
      if (password.length < 8) {
        newErrors.password = '密码长度至少8位';
      } else if (!/[a-zA-Z]/.test(password)) {
        newErrors.password = '密码必须包含字母';
      } else if (!/\d/.test(password)) {
        newErrors.password = '密码必须包含数字';
      } else if (!/^[a-zA-Z0-9]+$/.test(password)) {
        newErrors.password = '密码只能包含字母和数字';
      }
    }

    // 验证确认密码
    if (!confirmPassword) {
      newErrors.confirmPassword = '请确认密码';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = '两次输入的密码不一致';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    // 再次检查手机号是否已注册
    const checkResult = await authApi.checkPhoneExists(phone.trim());
    if (checkResult.exists) {
      setErrors(prev => ({ ...prev, phone: '该手机号已被注册' }));
      return;
    }

    setLoading(true);
    try {
      const result = await authApi.register({
        phone: phone.trim(),
        password,
        confirmPassword,
      });

      if (result.success) {
        // 注册成功，自动跳转到登录页面
        navigation.navigate('Login');
      } else {
        // 显示后端返回的错误信息
        if (result.message?.includes('手机号') || result.message?.includes('已注册')) {
          setErrors(prev => ({ ...prev, phone: result.message || '该手机号已被注册' }));
        } else {
          setErrors(prev => ({ ...prev, phone: result.message || '注册失败，请稍后重试' }));
        }
      }
    } catch (error) {
      console.error('注册错误:', error);
      setErrors(prev => ({ ...prev, phone: '网络错误，请稍后重试' }));
    } finally {
      setLoading(false);
    }
  };

  const navigateToLogin = () => {
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* 顶部导航 */}
      <View style={styles.navHeader}>
        <BackButton onPress={() => navigation.goBack()} />
        <View style={styles.navTitleContainer}>
          <Text style={styles.navTitle}>注册</Text>
        </View>
        <View style={styles.navPlaceholder} />
      </View>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.logo}>✨</Text>
            <Text style={styles.title}>创建账号</Text>
            <Text style={styles.subtitle}>开始你的梦境之旅</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            <View style={styles.inputContainer}>
              <Input
                label="手机号"
                placeholder="请输入11位手机号"
                value={phone}
                onChangeText={handlePhoneChange}
                onBlur={handlePhoneBlur}
                keyboardType="phone-pad"
                maxLength={11}
                error={errors.phone}
                editable={!loading}
              />
              {checkingPhone && (
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                  style={styles.checkingIndicator}
                />
              )}
            </View>

            <Input
              label="密码"
              placeholder="请输入密码（至少8位，包含字母和数字）"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              error={errors.password}
              editable={!loading}
            />

            <Input
              label="确认密码"
              placeholder="请再次输入密码"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              secureTextEntry
              error={errors.confirmPassword}
              editable={!loading}
            />

            <Button
              title={loading ? '注册中...' : '注册'}
              onPress={handleRegister}
              disabled={loading || checkingPhone}
              style={styles.registerButton}
            />

            {loading && (
              <ActivityIndicator
                size="small"
                color={colors.primary}
                style={styles.loader}
              />
            )}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>已有账号？</Text>
            <TouchableOpacity onPress={navigateToLogin} disabled={loading}>
              <Text style={styles.loginText}>立即登录</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
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
  form: {
    width: '100%',
  },
  inputContainer: {
    position: 'relative',
  },
  checkingIndicator: {
    position: 'absolute',
    right: 12,
    top: 40,
  },
  registerButton: {
    marginTop: 16,
  },
  loader: {
    marginTop: 16,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 32,
  },
  footerText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  loginText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
});
