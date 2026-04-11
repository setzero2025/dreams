import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Animated,
} from 'react-native';
import { colors } from '../theme/colors';

interface ProgressBarProps {
  progress: number; // 0-100
  color?: string;
  height?: number;
  showPercentage?: boolean;
  animated?: boolean;
  style?: ViewStyle;
  progressStyle?: ViewStyle;
  textStyle?: TextStyle;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  color = colors.primary,
  height = 8,
  showPercentage = false,
  animated = true,
  style,
  progressStyle,
  textStyle,
}) => {
  const progressAnimation = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (animated) {
      Animated.timing(progressAnimation, {
        toValue: progress,
        duration: 500,
        useNativeDriver: false,
      }).start();
    } else {
      progressAnimation.setValue(progress);
    }
  }, [progress, animated]);

  const displayProgress = animated ? progressAnimation : progress;

  return (
    <View style={[styles.container, style]}>
      <View
        style={[
          styles.progressBar,
          { height },
        ]}
      >
        <Animated.View
          style={[
            styles.progressFill,
            {
              backgroundColor: color,
              width: animated 
                ? displayProgress.interpolate({
                    inputRange: [0, 100],
                    outputRange: ['0%', '100%'],
                  })
                : `${progress}%`,
              height,
            },
            progressStyle,
          ]}
        />
      </View>
      {showPercentage && (
        <Text style={[styles.percentageText, textStyle]}>
          {Math.round(progress)}%
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  progressBar: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 4,
  },
  percentageText: {
    fontSize: 12,
    color: colors.textLight,
    marginTop: 4,
    textAlign: 'right',
  },
});
