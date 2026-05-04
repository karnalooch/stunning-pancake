import React, { useEffect, useState } from 'react';
import { Image, Text, View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing
} from 'react-native-reanimated';

interface PopUpDialogProps {
  visible: boolean;
  sprite: any;
  message: string;
  title?: string;
  onFinish?: () => void;
}

/**
 * HD-2D Character Pop-Up Dialog
 * Inspired by Dave the Diver and Octopath Traveler interaction systems.
 * Features spring-based entry and floating idle animation.
 */
export const PopUpDialog: React.FC<PopUpDialogProps> = ({
  visible,
  sprite,
  message,
  title = "SYSTEM_MSG",
  onFinish
}) => {
  const offset = useSharedValue(400);
  const float = useSharedValue(0);
  const [displayText, setDisplayText] = useState('');

  useEffect(() => {
    if (visible) {
      // Entrance animation
      offset.value = withSpring(0, { damping: 14, stiffness: 100 });

      // Floating idle animation
      float.value = withRepeat(
        withTiming(-8, { duration: 2000, easing: Easing.inOut(Easing.ease) }),
        -1,
        true
      );

      // Typewriter effect simulation
      let currentText = '';
      const interval = setInterval(() => {
        if (currentText.length < message.length) {
          currentText = message.slice(0, currentText.length + 1);
          setDisplayText(currentText);
        } else {
          clearInterval(interval);
          if (onFinish) onFinish();
        }
      }, 40);
      return () => clearInterval(interval);
    } else {
      offset.value = withSpring(400, { damping: 14, stiffness: 100 });
      setDisplayText('');
    }
  }, [visible, message]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: offset.value + float.value },
      { scale: 1.05 }
    ],
    opacity: offset.value > 350 ? 0 : 1
  }));

  return (
    <Animated.View style={[{ position: 'absolute', bottom: 40, right: 20, zIndex: 1000 }, animatedStyle]}>
      <View style={dialogStyles.row}>
        <View style={dialogStyles.column}>
          {/* Header/Title Plate */}
          <View style={dialogStyles.titlePlate}>
            <Text style={dialogStyles.titleText}>
              {title}
            </Text>
          </View>

          {/* Main Dialog Box */}
          <View style={dialogStyles.dialogBox}>
            <Text style={dialogStyles.messageText}>
              {displayText}
              <Text style={dialogStyles.cursor}>_</Text>
            </Text>

            {/* Accent Pixel Corners */}
            <View style={dialogStyles.cornerTopLeft} />
            <View style={dialogStyles.cornerBottomRight} />
          </View>

          {/* Dialog Tail */}
          <View style={dialogStyles.tail} />
        </View>

        {/* Character Sprite Container */}
        {sprite && (
          <View style={dialogStyles.spriteContainer}>
            <Image
              source={sprite}
              style={dialogStyles.spriteImage}
              resizeMode="contain"
            />
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const dialogStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  column: {
    maxWidth: 220,
    marginBottom: 48,
  },
  titlePlate: {
    backgroundColor: '#D4A373',
    paddingHorizontal: 8,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'black',
  },
  titleText: {
    color: 'black',
    fontWeight: '900',
    fontSize: 10,
    fontFamily: 'monospace',
  },
  dialogBox: {
    backgroundColor: '#0B1D33',
    padding: 16,
    borderWidth: 2,
    borderColor: '#D4A373',
    elevation: 10,
    shadowColor: 'black',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
  },
  messageText: {
    color: 'white',
    fontWeight: '900',
    fontSize: 14,
    fontFamily: 'monospace',
    lineHeight: 20,
  },
  cursor: {
    color: '#D4A373',
    fontWeight: '900',
  },
  cornerTopLeft: {
    position: 'absolute',
    top: -2,
    left: -2,
    width: 6,
    height: 6,
    backgroundColor: '#FF6B35',
  },
  cornerBottomRight: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 6,
    height: 6,
    backgroundColor: '#FF6B35',
  },
  tail: {
    position: 'absolute',
    bottom: -8,
    right: 30,
    width: 16,
    height: 16,
    backgroundColor: '#0B1D33',
    borderRightWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#D4A373',
    transform: [{ rotate: '45deg' }],
  },
  spriteContainer: {
    shadowColor: 'black',
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  spriteImage: {
    width: 130,
    height: 130,
  },
});
