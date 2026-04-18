import React, { useState, useEffect } from 'react';
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
  Animated,
  TextInput,
  Dimensions,
} from 'react-native';
import { Button } from '../components/Button';
import { useTheme } from '../theme/themeContext';
import { useAuth } from '../context/AuthContext';

interface LoginProps {
  navigation: any;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');

export const Login: React.FC<LoginProps> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const { login } = useAuth();
  const styles = createStyles(colors, isDark);
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ phone?: string; password?: string }>({});
  const [loading, setLoading] = useState(false);
  
  // 输入框聚焦状态
  const [phoneFocused, setPhoneFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  
  // 提示信息状态
  const [toastMessage, setToastMessage] = useState('');
  const [toastType, setToastType] = useState<'error' | 'success'>('error');
  const [toastVisible, setToastVisible] = useState(false);
  const fadeAnim = useState(new Animated.Value(0))[0];

  // 显示提示信息
  const showToast = (message: string, type: 'error' | 'success' = 'error') => {
    setToastMessage(message);
    setToastType(type);
    setToastVisible(true);
    
    // 淡入动画
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    // 3秒后自动消失
    setTimeout(() => {
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setToastVisible(false);
        setToastMessage('');
      });
    }, 3000);
  };

  const validateForm = (): boolean => {
    const newErrors: { phone?: string; password?: string } = {};

    // 验证手机号
    if (!phone.trim()) {
      newErrors.phone = '请输入手机号';
    } else if (!/^1[3-9]\d{9}$/.test(phone.trim())) {
      newErrors.phone = '请输入有效的11位手机号';
    }

    // 验证密码（登录时只验证非空）
    if (!password) {
      newErrors.password = '请输入密码';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validateForm()) return;

    setLoading(true);
    try {
      const success = await login(phone.trim(), password);

      if (success) {
        // 登录成功，显示成功提示
        showToast('登录成功！', 'success');
        // 延迟导航到首页，让用户看到成功提示
        setTimeout(() => {
          navigation.navigate('Main');
        }, 500);
      } else {
        // 登录失败，显示错误提示（3秒后自动消失）
        showToast('手机号或密码错误', 'error');
      }
    } catch (error) {
      console.error('登录错误:', error);
      showToast('网络错误，请稍后重试', 'error');
    } finally {
      setLoading(false);
    }
  };

  const navigateToRegister = () => {
    navigation.navigate('Register');
  };

  const navigateToHome = () => {
    // 导航到主页面（MainNavigator）
    navigation.navigate('Main');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
        >
          {/* 背景装饰 */}
          <View style={styles.backgroundDecorations}>
            <View style={[styles.circle1, isDark && styles.circle1Dark]} />
            <View style={[styles.circle2, isDark && styles.circle2Dark]} />
          </View>

          {/* 返回首页按钮 */}
          <TouchableOpacity
            style={styles.backButton}
            onPress={navigateToHome}
            activeOpacity={0.7}
          >
            <View style={styles.backButtonInner}>
              <Text style={styles.backButtonIcon}>←</Text>
              <Text style={styles.backButtonText}>返回首页</Text>
            </View>
          </TouchableOpacity>

          {/* Header */}
          <View style={styles.header}>
            <View style={[styles.logoContainer, isDark && styles.logoContainerDark]}>
              <Text style={styles.logo}>🌙</Text>
            </View>
            <Text style={styles.title}>梦境探索者</Text>
            <Text style={styles.subtitle}>记录你的每一个梦境</Text>
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
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  maxLength={11}
                  editable={!loading}
                  onFocus={() => setPhoneFocused(true)}
                  onBlur={() => setPhoneFocused(false)}
                />
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
                  placeholder="请输入密码"
                  placeholderTextColor={isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  editable={!loading}
                  onFocus={() => setPasswordFocused(true)}
                  onBlur={() => setPasswordFocused(false)}
                />
              </View>
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            <TouchableOpacity style={styles.forgotPassword}>
              <Text style={styles.forgotPasswordText}>忘记密码？</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.loginButton,
                loading && styles.loginButtonDisabled
              ]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              <Text style={styles.loginButtonText}>
                {loading ? '登录中...' : '登录'}
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
            <Text style={styles.footerText}>还没有账号？</Text>
            <TouchableOpacity onPress={navigateToRegister} disabled={loading}>
              <Text style={styles.registerText}>立即注册</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* Toast 提示 */}
        {toastVisible && (
          <Animated.View 
            style={[
              styles.toastContainer,
              { 
                opacity: fadeAnim,
                backgroundColor: toastType === 'error' ? '#ff4444' : '#4CAF50',
              }
            ]}
          >
            <Text style={styles.toastText}>{toastMessage}</Text>
          </Animated.View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
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
  // 返回按钮
  backButton: {
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  backButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 20,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
  },
  backButtonIcon: {
    fontSize: 16,
    color: colors.textSecondary,
    marginRight: 4,
  },
  backButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
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
  errorText: {
    fontSize: 12,
    color: colors.error,
    marginTop: 6,
    marginLeft: 4,
  },
  forgotPassword: {
    alignSelf: 'flex-end',
    marginBottom: 24,
    marginTop: -8,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '500',
  },
  loginButton: {
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
  },
  loginButtonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
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
  registerText: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  // Toast
  toastContainer: {
    position: 'absolute',
    top: 100,
    left: 24,
    right: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  toastText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
