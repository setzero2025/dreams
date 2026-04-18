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
  TextInput,
} from 'react-native';
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

  // 输入框聚焦状态
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [confirmPasswordFocused, setConfirmPasswordFocused] = useState(false);

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
    setPhoneFocused(false);
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
      {/* 背景装饰 */}
      <View style={styles.backgroundDecorations}>
        <View style={[styles.circle1, isDark && styles.circle1Dark]} />
        <View style={[styles.circle2, isDark && styles.circle2Dark]} />
      </View>

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
            <View style={[styles.logoContainer, isDark && styles.logoContainerDark]}>
              <Text style={styles.logo}>✨</Text>
            </View>
            <Text style={styles.title}>创建账号</Text>
            <Text style={styles.subtitle}>开始你的梦境之旅</Text>
          </View>

          {/* Form */}
          <View style={styles.form}>
            {/* 手机号输入框 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>手机号</Text>
              <View style={[
                styles.inputWrapper,
                phoneFocused && styles.inputWrapperFocused,
                errors.phone && styles.inputWrapperError,
                isDark ? styles.inputWrapperDark : styles.inputWrapperLight
              ]}>
                <TextInput
                  style={[
                    styles.input,
                    isDark ? styles.inputDark : styles.inputLight
                  ]}
                  placeholder="请输入11位手机号"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                  value={phone}
                  onChangeText={handlePhoneChange}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={handlePhoneBlur}
                  keyboardType="phone-pad"
                  maxLength={11}
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
              {errors.phone && (
                <Text style={styles.errorText}>{errors.phone}</Text>
              )}
            </View>

            {/* 密码输入框 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>密码</Text>
              <View style={[
                styles.inputWrapper,
                passwordFocused && styles.inputWrapperFocused,
                errors.password && styles.inputWrapperError,
                isDark ? styles.inputWrapperDark : styles.inputWrapperLight
              ]}>
                <TextInput
                  style={[
                    styles.input,
                    isDark ? styles.inputDark : styles.inputLight
                  ]}
                  placeholder="请输入密码（至少8位，包含字母和数字）"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                  value={password}
                  onChangeText={setPassword}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                  secureTextEntry
                  editable={!loading}
                />
              </View>
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            {/* 确认密码输入框 */}
            <View style={styles.inputContainer}>
              <Text style={styles.inputLabel}>确认密码</Text>
              <View style={[
                styles.inputWrapper,
                confirmPasswordFocused && styles.inputWrapperFocused,
                errors.confirmPassword && styles.inputWrapperError,
                isDark ? styles.inputWrapperDark : styles.inputWrapperLight
              ]}>
                <TextInput
                  style={[
                    styles.input,
                    isDark ? styles.inputDark : styles.inputLight
                  ]}
                  placeholder="请再次输入密码"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  onFocus={() => setConfirmPasswordFocused(true)}
                  onBlur={() => setConfirmPasswordFocused(false)}
                  secureTextEntry
                  editable={!loading}
                />
              </View>
              {errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            <TouchableOpacity
              style={[
                styles.registerButton,
                loading && styles.registerButtonDisabled
              ]}
              onPress={handleRegister}
              disabled={loading || checkingPhone}
              activeOpacity={0.8}
            >
              <Text style={styles.registerButtonText}>
                {loading ? '注册中...' : '注册'}
              </Text>
            </TouchableOpacity>

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
  // 背景装饰
  backgroundDecorations: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    overflow: 'hidden',
    pointerEvents: 'none',
  },
  circle1: {
    position: 'absolute',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(99, 102, 241, 0.08)',
    top: -100,
    right: -100,
  },
  circle1Dark: {
    backgroundColor: 'rgba(99, 102, 241, 0.15)',
  },
  circle2: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: 'rgba(139, 92, 246, 0.06)',
    bottom: 100,
    left: -50,
  },
  circle2Dark: {
    backgroundColor: 'rgba(139, 92, 246, 0.12)',
  },
  // 导航栏
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
  // Header
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(99, 102, 241, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
  },
  logoContainerDark: {
    backgroundColor: 'rgba(99, 102, 241, 0.2)',
    shadowOpacity: 0.3,
  },
  logo: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  subtitle: {
    fontSize: 15,
    color: colors.textSecondary,
    letterSpacing: 0.3,
  },
  // Form
  form: {
    width: '100%',
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
    marginLeft: 4,
  },
  inputWrapper: {
    borderRadius: 12,
    borderWidth: 1.5,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'center',
  },
  inputWrapperLight: {
    backgroundColor: '#ffffff',
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  inputWrapperDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  inputWrapperFocused: {
    borderColor: colors.primary,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  inputWrapperError: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    minHeight: 52,
  },
  inputLight: {
    color: '#1a1a2e',
  },
  inputDark: {
    color: '#ffffff',
  },
  checkingIndicator: {
    marginRight: 12,
  },
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 6,
    marginLeft: 4,
  },
  registerButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    marginTop: 8,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  loader: {
    marginTop: 16,
  },
  // Footer
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
