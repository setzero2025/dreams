/**
 * 生成进度组件
 * 显示图片/视频/长视频生成的进度条和状态
 */
import React from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { TaskProgress } from '../services/generationTask.service';

interface GenerationProgressProps {
  progress: TaskProgress | null;
  visible: boolean;
}

export const GenerationProgress: React.FC<GenerationProgressProps> = ({
  progress,
  visible,
}) => {
  if (!visible || !progress) {
    return null;
  }

  const { status, progress: percent, message, error } = progress;

  // 根据状态确定颜色
  const getStatusColor = () => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'failed':
        return '#F44336';
      case 'processing':
        return '#2196F3';
      default:
        return '#9E9E9E';
    }
  };

  // 根据类型确定标题
  const getTypeLabel = () => {
    switch (progress.type) {
      case 'image':
        return '图片生成';
      case 'video':
        return '视频生成';
      case 'longvideo':
        return '长视频生成';
      default:
        return '生成中';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>{getTypeLabel()}</Text>
        
        {/* 进度条 */}
        <View style={styles.progressBarContainer}>
          <View
            style={[
              styles.progressBar,
              {
                width: `${percent}%`,
                backgroundColor: getStatusColor(),
              },
            ]}
          />
        </View>

        {/* 进度信息 */}
        <View style={styles.infoRow}>
          <Text style={styles.percentText}>{percent}%</Text>
          <Text style={styles.messageText}>{error || message}</Text>
        </View>

        {/* 状态指示器 */}
        {status === 'processing' && (
          <View style={styles.loadingIndicator}>
            <Text style={styles.loadingText}>生成中...</Text>
          </View>
        )}

        {status === 'completed' && (
          <View style={styles.successIndicator}>
            <Text style={styles.successText}>✓ 生成完成</Text>
          </View>
        )}

        {status === 'failed' && (
          <View style={styles.errorIndicator}>
            <Text style={styles.errorText}>✗ 生成失败</Text>
          </View>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  content: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 24,
    width: '80%',
    maxWidth: 400,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 16,
    textAlign: 'center',
    color: '#333',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 12,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  percentText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  messageText: {
    fontSize: 14,
    color: '#666',
    flex: 1,
    textAlign: 'right',
    marginLeft: 8,
  },
  loadingIndicator: {
    alignItems: 'center',
    marginTop: 8,
  },
  loadingText: {
    fontSize: 14,
    color: '#2196F3',
  },
  successIndicator: {
    alignItems: 'center',
    marginTop: 8,
  },
  successText: {
    fontSize: 14,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  errorIndicator: {
    alignItems: 'center',
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    color: '#F44336',
    fontWeight: 'bold',
  },
});
