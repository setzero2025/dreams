import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
  Animated,
  Easing,
  Alert,
} from 'react-native';
import { Card } from '../components/Card';
import { useTheme } from '../theme/themeContext';

interface DiscoverProps {
  navigation: any;
}

export const Discover: React.FC<DiscoverProps> = ({ navigation }) => {
  const { colors, isDark } = useTheme();
  const styles = createStyles(colors, isDark);
  const [searchQuery, setSearchQuery] = useState('');
  const [showChat, setShowChat] = useState(false);
  const [messages, setMessages] = useState<{text: string; isUser: boolean}[]>([
    { text: '你好！我是你的AI心理小伴，有什么想聊的梦境吗？', isUser: false },
  ]);
  const [inputText, setInputText] = useState('');
  const [knowledgeBase, setKnowledgeBase] = useState([
    {
      id: '1',
      title: '飞翔的梦境',
      description: '飞翔通常代表自由、解放和超越限制',
      category: '常见象征',
    },
    {
      id: '2',
      title: '坠落的梦境',
      description: '坠落可能表示焦虑、失控或压力',
      category: '常见象征',
    },
    {
      id: '3',
      title: '考试的梦境',
      description: '考试梦常常反映现实中的压力和焦虑',
      category: '常见象征',
    },
    {
      id: '4',
      title: '追逐的梦境',
      description: '被追逐的梦境通常与逃避现实问题有关',
      category: '常见象征',
    },
    {
      id: '5',
      title: '迟到的梦境',
      description: '迟到的梦可能反映时间压力或焦虑',
      category: '常见象征',
    },
  ]);
  const [analyticsData, setAnalyticsData] = useState([
    { label: '美梦', value: 65, color: colors.success },
    { label: '普通', value: 25, color: colors.info },
    { label: '噩梦', value: 10, color: colors.error },
  ]);

  const chartAnimations = useRef<Animated.Value[]>([]);
  const floatingAnimation = useRef(new Animated.Value(0)).current;

  const fetchAnalyticsData = async () => {
    try {
      const apiBaseUrl = 'http://192.168.1.10:3001';
      const response = await fetch(`${apiBaseUrl}/api/v1/dreams`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token-for-development',
        },
      });
      
      if (response.ok) {
        const dreams = await response.json();
        
        // 计算情绪分布
        if (dreams.length > 0) {
          const moodCounts = {
            5: 0, // 美梦
            3: 0, // 普通
            1: 0, // 噩梦
          };
          
          dreams.forEach((dream: any) => {
            if (dream.moodRating >= 4) {
              moodCounts[5]++;
            } else if (dream.moodRating >= 2) {
              moodCounts[3]++;
            } else {
              moodCounts[1]++;
            }
          });
          
          const total = dreams.length;
          const newAnalyticsData = [
            { label: '美梦', value: Math.round((moodCounts[5] / total) * 100), color: colors.success },
            { label: '普通', value: Math.round((moodCounts[3] / total) * 100), color: colors.info },
            { label: '噩梦', value: Math.round((moodCounts[1] / total) * 100), color: colors.error },
          ];
          
          setAnalyticsData(newAnalyticsData);
        }
      }
    } catch (error) {
      console.error('获取梦境分析数据失败:', error);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
    
    // 悬浮动画
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatingAnimation, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(floatingAnimation, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // 当analyticsData变化时更新动画
  useEffect(() => {
    // 初始化图表动画
    chartAnimations.current = analyticsData.map(() => new Animated.Value(0));
    
    // 图表动画
    setTimeout(() => {
      chartAnimations.current.forEach((anim, index) => {
        Animated.timing(anim, {
          toValue: analyticsData[index].value,
          duration: 1000,
          easing: Easing.out(Easing.ease),
          useNativeDriver: false,
        }).start();
      });
    }, 500);
  }, [analyticsData]);

  const handleSearch = () => {
    if (!searchQuery.trim()) {
      // 如果搜索框为空，恢复完整的知识库
      setKnowledgeBase([
        {
          id: '1',
          title: '飞翔的梦境',
          description: '飞翔通常代表自由、解放和超越限制',
          category: '常见象征',
        },
        {
          id: '2',
          title: '坠落的梦境',
          description: '坠落可能表示焦虑、失控或压力',
          category: '常见象征',
        },
        {
          id: '3',
          title: '考试的梦境',
          description: '考试梦常常反映现实中的压力和焦虑',
          category: '常见象征',
        },
        {
          id: '4',
          title: '追逐的梦境',
          description: '被追逐的梦境通常与逃避现实问题有关',
          category: '常见象征',
        },
        {
          id: '5',
          title: '迟到的梦境',
          description: '迟到的梦可能反映时间压力或焦虑',
          category: '常见象征',
        },
      ]);
      return;
    }

    // 根据搜索关键词过滤知识库
    const filtered = [
      {
        id: '1',
        title: '飞翔的梦境',
        description: '飞翔通常代表自由、解放和超越限制',
        category: '常见象征',
      },
      {
        id: '2',
        title: '坠落的梦境',
        description: '坠落可能表示焦虑、失控或压力',
        category: '常见象征',
      },
      {
        id: '3',
        title: '考试的梦境',
        description: '考试梦常常反映现实中的压力和焦虑',
        category: '常见象征',
      },
      {
        id: '4',
        title: '追逐的梦境',
        description: '被追逐的梦境通常与逃避现实问题有关',
        category: '常见象征',
      },
      {
        id: '5',
        title: '迟到的梦境',
        description: '迟到的梦可能反映时间压力或焦虑',
        category: '常见象征',
      },
    ].filter(item => 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
    
    setKnowledgeBase(filtered);
  };

  const handleSendMessage = () => {
    if (inputText.trim()) {
      const newMessage = { text: inputText, isUser: true };
      setMessages([...messages, newMessage]);
      setInputText('');
      
      // 模拟AI回复
      setTimeout(() => {
        setMessages(prev => [
          ...prev,
          { 
            text: `感谢分享你的梦境！根据心理学理论，你的梦境可能反映了${Math.random() > 0.5 ? '内心的渴望' : '潜意识的焦虑'}。这是很常见的梦境主题。`, 
            isUser: false 
          }
        ]);
      }, 1000);
    }
  };

  const renderChatInterface = () => {
    if (!showChat) return null;
    
    return (
      <View style={styles.chatContainer}>
        <View style={styles.chatHeader}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setShowChat(false)}
          >
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.chatTitle}>AI心理小伴</Text>
          <View style={styles.chatHeaderRight} />
        </View>
        
        <ScrollView style={styles.chatMessages}>
          {messages.map((message, index) => (
            <View
              key={index}
              style={[
                styles.message,
                message.isUser ? styles.userMessage : styles.aiMessage,
              ]}
            >
              <View
                style={[
                  styles.messageBubble,
                  message.isUser ? styles.userBubble : styles.aiBubble,
                ]}
              >
                <Text style={[
                  styles.messageText,
                  message.isUser ? styles.userMessageText : styles.aiMessageText,
                ]}>
                  {message.text}
                </Text>
              </View>
            </View>
          ))}
        </ScrollView>
        
        <View style={styles.chatInputContainer}>
          <TextInput
            style={styles.chatInput}
            placeholder="输入你的梦境..."
            placeholderTextColor={colors.textDisabled}
            value={inputText}
            onChangeText={setInputText}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              !inputText.trim() && styles.sendButtonDisabled,
            ]}
            onPress={handleSendMessage}
            disabled={!inputText.trim()}
          >
            <Text style={{ fontSize: 20, color: inputText.trim() ? colors.text : colors.textLight }}>➤</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderEmojiChart = () => {
    return (
      <View style={styles.emojiChart}>
        {analyticsData.map((item, index) => (
          <View key={index} style={styles.emojiItem}>
            <Text style={styles.emojiSymbol}>
              {item.label === '美梦' ? '😊' : item.label === '普通' ? '😐' : '😢'}
            </Text>
            <Text style={styles.emojiLabel}>{item.label}</Text>
            <Text style={styles.emojiValue}>{item.value}%</Text>
          </View>
        ))}
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Search */}
        <View style={styles.searchContainer}>
          <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={{ fontSize: 20, color: colors.textLight }}>🔍</Text>
            <TextInput
              style={[styles.searchInput, { color: colors.text }]}
              placeholder="搜索解梦知识..."
              placeholderTextColor={colors.textDisabled}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
          </View>
        </View>

        {/* Analytics */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            📈 梦境分析
          </Text>
          <Card style={[styles.analyticsCard, { backgroundColor: colors.card }]}>
            <View style={styles.analyticsHeader}>
              <Text style={{ fontSize: 24, color: colors.primary }}>📊</Text>
              <Text style={[styles.analyticsTitle, { color: colors.text }]}>情绪分布</Text>
            </View>
            {renderEmojiChart()}
            <View style={styles.chartContainer}>
              {analyticsData.map((item, index) => (
                <View key={index} style={styles.chartItem}>
                  <View style={styles.chartLabel}>
                    <Text style={[styles.chartLabelText, { color: colors.textSecondary }]}>{item.label}</Text>
                    <Text style={[styles.chartValue, { color: colors.text }]}>{item.value}%</Text>
                  </View>
                  <View style={[styles.chartBar, { backgroundColor: isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.05)' }]}>
                    <Animated.View
                      style={[
                        styles.chartProgress,
                        {
                          width: chartAnimations.current[index] || new Animated.Value(0),
                          backgroundColor: item.color,
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          </Card>
        </View>

        {/* Knowledge Base */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            📚 解梦知识库
          </Text>
          {knowledgeBase.map((item) => (
            <Card
              key={item.id}
              title={item.title}
              content={item.description}
              style={[styles.knowledgeCard, { backgroundColor: colors.card }]}
              onPress={() => {
                Alert.alert(
                  item.title,
                  `${item.description}\n\n💡 提示：同一个梦境象征对不同人可能有不同的含义，结合自己的生活经历来理解会更准确。`,
                  [{ text: '确定', style: 'default' }]
                );
              }}
            >
              <View style={styles.categoryTag}>
                <Text style={styles.categoryText}>{item.category}</Text>
              </View>
            </Card>
          ))}
        </View>

        {/* AI Assistant */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            🧠 AI心理小伴
          </Text>
          <TouchableOpacity
            style={[styles.aiCard, { backgroundColor: colors.card }]}
            onPress={() => setShowChat(true)}
            activeOpacity={0.8}
          >
            <Animated.View
              style={[
                styles.aiIcon,
                { backgroundColor: isDark ? 'rgba(99, 102, 241, 0.1)' : 'rgba(99, 102, 241, 0.05)' },
                {
                  transform: [
                    {
                      scale: floatingAnimation.interpolate({
                        inputRange: [0, 1],
                        outputRange: [1, 1.05],
                      }),
                    },
                  ],
                },
              ]}
            >
              <Text style={{ fontSize: 32, color: colors.primary }}>🧠</Text>
            </Animated.View>
            <View style={styles.aiContent}>
              <Text style={[styles.aiTitle, { color: colors.text }]}>开始对话</Text>
              <Text style={[styles.aiDescription, { color: colors.textSecondary }]}>
                与AI助手聊聊你的梦境和感受
              </Text>
            </View>
            <Text style={{ fontSize: 24, color: colors.textLight }}>💬</Text>
          </TouchableOpacity>
        </View>

        {/* Tips */}
        <View style={[styles.tips, { backgroundColor: isDark ? 'rgba(16, 185, 129, 0.1)' : 'rgba(16, 185, 129, 0.05)', borderColor: colors.success }]}>
          <Text style={{ fontSize: 16, color: colors.info }}>🌙</Text>
          <Text style={[styles.tipsText, { color: colors.textSecondary }]}>
            💡 梦境是潜意识的表达，同一个象征对不同人可能有不同含义
          </Text>
        </View>
      </ScrollView>

      {/* Chat Interface */}
      {renderChatInterface()}
    </SafeAreaView>
  );
};

const createStyles = (colors: any, isDark: boolean) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  searchContainer: {
    padding: 20,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  section: {
    marginHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sectionIcon: {
    marginRight: 8,
  },
  analyticsCard: {
    padding: 20,
  },
  analyticsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginLeft: 12,
  },
  emojiChart: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 20,
    paddingVertical: 16,
  },
  emojiItem: {
    alignItems: 'center',
  },
  emojiSymbol: {
    fontSize: 48,
    marginBottom: 8,
  },
  emojiLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  emojiValue: {
    fontSize: 18,
    fontWeight: 'bold',
  },
  chartContainer: {
    gap: 16,
  },
  chartItem: {
    gap: 8,
  },
  chartLabel: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartLabelText: {
    fontSize: 14,
  },
  chartValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  chartBar: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  chartProgress: {
    height: '100%',
    borderRadius: 4,
  },
  knowledgeCard: {
    marginBottom: 12,
  },
  categoryTag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    marginTop: 8,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  aiCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  aiIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  aiContent: {
    flex: 1,
  },
  aiTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  aiDescription: {
    fontSize: 14,
  },
  tips: {
    margin: 20,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipsText: {
    flex: 1,
    fontSize: 14,
    marginLeft: 8,
    lineHeight: 20,
  },
  chatContainer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(10, 10, 15, 0.95)',
    zIndex: 1000,
    justifyContent: 'flex-end',
  },
  chatHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  closeButton: {
    padding: 8,
  },
  closeButtonText: {
    fontSize: 24,
  },
  chatTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  chatHeaderRight: {
    width: 40,
  },
  chatMessages: {
    flex: 1,
    padding: 20,
  },
  message: {
    marginBottom: 16,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
  },
  aiMessage: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 16,
  },
  userBubble: {
    borderBottomRightRadius: 4,
  },
  aiBubble: {
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: '#fff',
  },
  aiMessageText: {
    fontSize: 14,
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: 20,
    borderTopWidth: 1,
  },
  chatInput: {
    flex: 1,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    maxHeight: 120,
  },
  sendButton: {
    marginLeft: 12,
    padding: 12,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
});
