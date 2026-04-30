import React, { useEffect, useState } from 'react';
import Animated, { 
  useSharedValue, 
  useAnimatedStyle, 
  withSpring, 
  withRepeat, 
  withTiming,
  Easing
} from 'react-native-reanimated';
import { Image, XStack, YStack, Text, View } from 'tamagui';

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
      <XStack alignItems="flex-end" gap="$2">
        <YStack maxWidth={220} marginBottom="$12">
          {/* Header/Title Plate */}
          <View 
            backgroundColor="#D4A373" 
            paddingHorizontal="$2" 
            alignSelf="flex-start"
            borderWidth={1}
            borderColor="black"
          >
            <Text color="black" fontWeight="900" fontSize={10} ff="monospace">
              {title}
            </Text>
          </View>

          {/* Main Dialog Box */}
          <YStack 
            backgroundColor="#0B1D33" 
            padding="$4" 
            borderWidth={2} 
            borderColor="#D4A373"
            elevation={10}
            shadowColor="black"
            shadowOffset={{ width: 4, height: 4 }}
            shadowOpacity={1}
            shadowRadius={0}
          >
            <Text color="white" fontWeight="900" fontSize={14} ff="monospace" lineHeight={20}>
              {displayText}
              <Text color="#D4A373" fontWeight="900">_</Text>
            </Text>

            {/* Accent Pixel Corners */}
            <View position="absolute" top={-2} left={-2} width={6} height={6} backgroundColor="#FF6B35" />
            <View position="absolute" bottom={-2} right={-2} width={6} height={6} backgroundColor="#FF6B35" />
          </YStack>

          {/* Dialog Tail */}
          <View 
            position="absolute" 
            bottom={-8} 
            right={30} 
            width={16} 
            height={16} 
            backgroundColor="#0B1D33" 
            borderRightWidth={2}
            borderBottomWidth={2}
            borderColor="#D4A373"
            rotate="45deg"
          />
        </YStack>

        {/* Character Sprite Container */}
        {sprite && (
          <View style={{ shadowColor: 'black', shadowOffset: { width: 4, height: 4 }, shadowOpacity: 1, shadowRadius: 0, elevation: 4 }}>
            <Image 
              source={sprite} 
              width={130} 
              height={130} 
              resizeMode="contain"
            />
          </View>
        )}
      </XStack>
    </Animated.View>
  );
};
