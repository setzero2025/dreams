import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ViewStyle,
  TextStyle,
} from 'react-native';
import { colors } from '../theme/colors';

interface TagProps {
  label: string;
  color?: 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
  onPress?: () => void;
  selected?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export const Tag: React.FC<TagProps> = ({
  label,
  color = 'primary',
  onPress,
  selected = false,
  style,
  textStyle,
}) => {
  const colorMap = {
    primary: {
      background: 'rgba(99, 102, 241, 0.2)',
      border: colors.primary,
      text: colors.primary,
    },
    secondary: {
      background: 'rgba(139, 92, 246, 0.2)',
      border: colors.secondary,
      text: colors.secondary,
    },
    success: {
      background: 'rgba(16, 185, 129, 0.2)',
      border: colors.success,
      text: colors.success,
    },
    warning: {
      background: 'rgba(245, 158, 11, 0.2)',
      border: colors.warning,
      text: colors.warning,
    },
    error: {
      background: 'rgba(239, 68, 68, 0.2)',
      border: colors.error,
      text: colors.error,
    },
    info: {
      background: 'rgba(59, 130, 246, 0.2)',
      border: colors.info,
      text: colors.info,
    },
  };

  const currentColor = colorMap[color];
  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[
        styles.tag,
        {
          backgroundColor: selected ? currentColor.background : 'rgba(26, 26, 46, 0.8)',
          borderColor: selected ? currentColor.border : colors.border,
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text
        style={[
          styles.tagText,
          {
            color: selected ? currentColor.text : colors.textLight,
          },
          textStyle,
        ]}
      >
        {label}
      </Text>
    </Container>
  );
};

const styles = StyleSheet.create({
  tag: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    backdropFilter: 'blur(10px)',
  },
  tagText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
