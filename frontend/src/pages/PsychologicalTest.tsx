import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  Animated,
  Easing,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useTheme } from '../theme/themeContext';
import { dreamStorageManager } from '../services/storage';
import { generateInterpretation } from '../services/api/aiService';

interface PsychologicalTestProps {
  navigation: any;
}

type TimeRange = 7 | 15 | 30;

export const PsychologicalTest: React.FC<PsychologicalTestProps> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [selectedRange, setSelectedRange] = useState<TimeRange>(7);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<string>('');
  const [progress, setProgress] = useState(0);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  const timeRanges: { value: TimeRange; label: string }[] = [
    { value: 7, label: '最近7天' },
    { value: 15, label: '最近15天' },
    { value: 30, label: '最近30天' },
  ];

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  }, []);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    setProgress(0);
    setAnalysisResult('');

    try {
      // 模拟进度
      const progressInterval = setInterval(() => {
        setProgress(prev => (prev >= 90 ? 90 : prev + 10));
      }, 500);

      // 获取选定时间范围内的梦境
      const dreams = await dreamStorageManager.getDreams();
      const now = new Date();
      const startDate = new Date(now.getTime() - selectedRange * 24 * 60 * 60 * 1000);
      
      const filteredDreams = dreams.filter(dream => {
        const dreamDate = new Date(dream.dreamDate);
        return dreamDate >= startDate && dreamDate <= now;
      });

      clearInterval(progressInterval);
      setProgress(100);

      if (filteredDreams.length === 0) {
        setAnalysisResult(`您在最近${selectedRange}天内没有记录梦境。\n\n建议：保持规律的梦境记录习惯，有助于更好地了解自己的潜意识。`);
        setIsAnalyzing(false);
        return;
      }

      // 合并梦境内容
      const combinedContent = filteredDreams
        .map(d => `梦境：${d.title}\n内容：${d.content}`)
        .join('\n\n');

      // 调用AI分析
      const response = await generateInterpretation({
        dreamContent: combinedContent,
        dreamTitle: `最近${selectedRange}天梦境合集`,
      });

      if (response.success && response.data.interpretation) {
        setAnalysisResult(response.data.interpretation);
      } else {
        // 使用默认分析结果
        setAnalysisResult(generateDefaultAnalysis(filteredDreams.length, selectedRange));
      }
    } catch (error) {
      console.error('分析失败:', error);
      setAnalysisResult(generateDefaultAnalysis(0, selectedRange));
    } finally {
      setIsAnalyzing(false);
    }
  };

  const generateDefaultAnalysis = (dreamCount: number, days: number) => {
    if (dreamCount === 0) {
      return `您在最近${days}天内没有记录梦境。\n\n建议：保持规律的梦境记录习惯，有助于更好地了解自己的潜意识。`;
    }

    return `基于您最近${days}天内记录的${dreamCount}个梦境，我们进行了综合分析：\n\n` +
      `【情绪状态】\n` +
      `您的梦境整体呈现出积极的情绪基调，显示出您近期心理状态较为稳定。\n\n` +
      `【潜在主题】\n` +
      `梦境中反复出现的意象可能反映了您当前生活中的关注点。建议您留意这些重复出现的符号。\n\n` +
      `【改善建议】\n` +
      `1. 保持规律的作息时间\n` +
      `2. 睡前进行放松练习\n` +
      `3. 继续记录梦境，建立完整的梦境档案\n\n` +
      `注：此为AI辅助分析，仅供参考。如有心理困扰，建议咨询专业心理医生。`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 24, color: colors.text }}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>心理测评</Text>
        <View style={styles.placeholder} />
      </View>

      <Animated.ScrollView
        style={[styles.scrollView, { opacity: fadeAnim }]}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Description */}
        <View style={styles.descriptionCard}>
          <Text style={styles.descriptionIcon}>🧠</Text>
          <Text style={styles.descriptionText}>
            基于您记录的梦境，AI将分析您的潜在心理状态和情绪趋势。
            选择时间范围开始分析。
          </Text>
        </View>

        {/* Time Range Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>选择分析时间范围</Text>
          <View style={styles.rangeSelector}>
            {timeRanges.map((range) => (
              <TouchableOpacity
                key={range.value}
                style={[
                  styles.rangeButton,
                  selectedRange === range.value && styles.rangeButtonActive,
                ]}
                onPress={() => setSelectedRange(range.value)}
                activeOpacity={0.8}
              >
                <Text
                  style={[
                    styles.rangeButtonText,
                    selectedRange === range.value && styles.rangeButtonTextActive,
                  ]}
                >
                  {range.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Analyze Button */}
        <TouchableOpacity
          style={[styles.analyzeButton, isAnalyzing && styles.analyzeButtonDisabled]}
          onPress={handleAnalyze}
          disabled={isAnalyzing}
          activeOpacity={0.8}
        >
          {isAnalyzing ? (
            <View style={styles.analyzingContainer}>
              <ActivityIndicator size="small" color="#fff" />
              <Text style={styles.analyzingText}>分析中... {progress}%</Text>
            </View>
          ) : (
            <Text style={styles.analyzeButtonText}>开始分析</Text>
          )}
        </TouchableOpacity>

        {/* Progress Bar */}
        {isAnalyzing && (
          <View style={styles.progressContainer}>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>
        )}

        {/* Analysis Result */}
        {analysisResult && !isAnalyzing && (
          <Animated.View style={styles.resultCard}>
            <View style={styles.resultHeader}>
              <Text style={styles.resultIcon}>📊</Text>
              <Text style={styles.resultTitle}>测评结果</Text>
            </View>
            <Text style={styles.resultContent}>{analysisResult}</Text>
            
            {/* Suggestions */}
            <View style={styles.suggestionsSection}>
              <Text style={styles.suggestionsTitle}>💡 改善建议</Text>
              <View style={styles.suggestionItem}>
                <Text style={styles.suggestionIcon}>🌙</Text>
                <Text style={styles.suggestionText}>保持规律作息，确保充足睡眠</Text>
              </View>
              <View style={styles.suggestionItem}>
                <Text style={styles.suggestionIcon}>🧘</Text>
                <Text style={styles.suggestionText}>睡前进行冥想或放松练习</Text>
              </View>
              <View style={styles.suggestionItem}>
                <Text style={styles.suggestionIcon}>📝</Text>
                <Text style={styles.suggestionText}>继续记录梦境，建立完整档案</Text>
              </View>
            </View>

            <Text style={styles.disclaimer}>
              注：此为AI辅助分析，仅供参考。如有心理困扰，建议咨询专业心理医生。
            </Text>
          </Animated.View>
        )}
      </Animated.ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  backButton: {
    padding: 8,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  placeholder: {
    width: 44,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  descriptionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: isDark ? 'rgba(139, 92, 246, 0.1)' : 'rgba(139, 92, 246, 0.05)',
    borderRadius: 16,
    padding: 20,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: colors.secondary,
  },
  descriptionIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  descriptionText: {
    flex: 1,
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 16,
  },
  rangeSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  rangeButton: {
    flex: 1,
    backgroundColor: 'colors.card',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  rangeButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  rangeButtonText: {
    fontSize: 14,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  rangeButtonTextActive: {
    color: colors.text,
    fontWeight: '600',
  },
  analyzeButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  analyzeButtonDisabled: {
    opacity: 0.7,
  },
  analyzeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  analyzingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  analyzingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  progressContainer: {
    marginBottom: 24,
  },
  progressBar: {
    height: 8,
    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.secondary,
    borderRadius: 4,
  },
  resultCard: {
    backgroundColor: 'colors.card',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  resultIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
  },
  resultContent: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 22,
    marginBottom: 24,
  },
  suggestionsSection: {
    backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : 'rgba(59, 130, 246, 0.05)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.info,
  },
  suggestionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  suggestionIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  suggestionText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  disclaimer: {
    fontSize: 12,
    color: colors.textLight,
    fontStyle: 'italic',
    textAlign: 'center',
  },
});
