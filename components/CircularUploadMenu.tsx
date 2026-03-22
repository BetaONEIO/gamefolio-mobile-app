import React, { useEffect, useState, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Modal, 
  TouchableWithoutFeedback, 
  Pressable,
  Animated,
  Dimensions,
  Text,
  Easing
} from 'react-native';
import { Video, Film, Image as ImageIcon } from 'lucide-react-native';
import { useRouter } from 'expo-router';

const SCREEN_WIDTH = Dimensions.get('window').width;
const BUTTON_SIZE = 110; // Bigger button size
const BOTTOM_ORIGIN = 40; 
// FAN_RADIUS removed as it is hardcoded in interpolations

interface CircularUploadMenuProps {
  visible: boolean;
  onClose: () => void;
}

export default function CircularUploadMenu({ visible, onClose }: CircularUploadMenuProps) {
  const router = useRouter();
  const [showModal, setShowModal] = useState(visible);
  
  const animValue = useRef(new Animated.Value(0)).current;
  
  const shakeLeftAnim = useRef(new Animated.Value(0)).current;
  const shakeCenterAnim = useRef(new Animated.Value(0)).current;
  const shakeRightAnim = useRef(new Animated.Value(0)).current;
  
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setShowModal(true);
      // Intro: Deck of cards fan out
      Animated.spring(animValue, {
        toValue: 1,
        friction: 6,
        tension: 50,
        useNativeDriver: true,
      }).start();
    } else {
      // Outro: Cards go back in
      Animated.timing(animValue, {
        toValue: 0,
        duration: 250,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        setShowModal(false);
        setSelectedItem(null);
      });
    }
  }, [visible, animValue]);

  const handleClose = () => {
    onClose();
  };

  const handleSelect = (type: 'clips' | 'reels' | 'screenshots', shakeAnim: Animated.Value) => {
    setSelectedItem(type);
    
    // Tiny shake animation
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -5, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 3, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -3, duration: 40, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 40, useNativeDriver: true }),
    ]).start(() => {
        // Wait a bit to show green selection state
        setTimeout(() => {
            onClose(); 
            // Navigate to the create tab with the selected type
            router.push(`/create?type=${type}`);
        }, 200);
    });
  };

  if (!showModal) return null;

  const centerX = (SCREEN_WIDTH - BUTTON_SIZE) / 2;
  
  // -- Interpolations for Fan Out --

  // Left Item (Reels): Moves Left, Up, Rotate -20
  const leftTranslateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -105] // More spread for better readability
  });
  const leftTranslateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -55] // Closer to + icon
  });
  // leftRotate removed as unused

  const leftRotateStrict = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '-20deg']
  });


  // Right Item (Screenshots): Moves Right, Up, Rotate 20
  const rightTranslateX = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 105] // More spread for better readability
  });
  const rightTranslateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -55] // Closer to + icon
  });
  const rightRotateStrict = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '20deg']
  });

  // Center Item (Clips): Moves Up
  const centerTranslateY = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -75] // Closer to + icon
  });

  const globalScale = animValue.interpolate({
    inputRange: [0, 1],
    outputRange: [0.2, 1]
  });

  const globalOpacity = animValue.interpolate({
    inputRange: [0, 0.2, 1],
    outputRange: [0, 1, 1]
  });

  return (
    <Modal
      transparent
      visible={showModal}
      animationType="none"
      onRequestClose={handleClose}
    >
      <TouchableWithoutFeedback onPress={handleClose}>
        <View style={styles.overlay}>
          {/* Backdrop */}
          <Animated.View style={[
            styles.backdrop, 
            { opacity: animValue }
          ]} />
          
          <View style={[styles.container, { bottom: BOTTOM_ORIGIN, left: centerX }]}>
            
            {/* Left Item: Reels */}
            <Animated.View 
              style={[
                styles.menuButtonWrapper,
                {
                  opacity: globalOpacity,
                  zIndex: 2,
                  transform: [
                    { translateX: leftTranslateX },
                    { translateY: leftTranslateY },
                    { rotate: leftRotateStrict },
                    { scale: globalScale },
                    { translateX: shakeLeftAnim }
                  ]
                }
              ]}
            >
              <Pressable 
                style={[
                  styles.button,
                  selectedItem === 'reels' && styles.buttonSelected
                ]}
                onPress={() => handleSelect('reels', shakeLeftAnim)}
              >
                <View style={styles.iconContainer}>
                  <Film size={28} color={selectedItem === 'reels' ? "#4ADE80" : "#FFF"} />
                </View>
                <Text style={styles.buttonText}>Upload{"\n"}Reel</Text>
              </Pressable>
            </Animated.View>

            {/* Center Item: Clips */}
            <Animated.View 
              style={[
                styles.menuButtonWrapper,
                {
                    opacity: globalOpacity,
                    zIndex: 3, // On top
                  transform: [
                    { translateY: centerTranslateY },
                    { scale: globalScale },
                    { translateX: shakeCenterAnim }
                  ]
                }
              ]}
            >
              <Pressable 
                style={[
                  styles.button,
                  selectedItem === 'clips' && styles.buttonSelected
                ]}
                onPress={() => handleSelect('clips', shakeCenterAnim)}
              >
                <View style={styles.iconContainer}>
                  <Video size={28} color={selectedItem === 'clips' ? "#4ADE80" : "#FFF"} />
                </View>
                <Text style={styles.buttonText}>Upload{"\n"}Clip</Text>
              </Pressable>
            </Animated.View>

            {/* Right Item: Screenshots */}
            <Animated.View 
              style={[
                styles.menuButtonWrapper,
                {
                    opacity: globalOpacity,
                    zIndex: 1,
                  transform: [
                    { translateX: rightTranslateX },
                    { translateY: rightTranslateY },
                    { rotate: rightRotateStrict },
                    { scale: globalScale },
                    { translateX: shakeRightAnim }
                  ]
                }
              ]}
            >
              <Pressable 
                style={[
                  styles.button,
                  selectedItem === 'screenshots' && styles.buttonSelected
                ]}
                onPress={() => handleSelect('screenshots', shakeRightAnim)}
              >
                <View style={styles.iconContainer}>
                  <ImageIcon size={28} color={selectedItem === 'screenshots' ? "#4ADE80" : "#FFF"} />
                </View>
                <Text style={styles.buttonText}>Upload{"\n"}Screenshots</Text>
              </Pressable>
            </Animated.View>

          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.4)', // Slightly lighter backdrop
  },
  container: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    // We don't clip overflow here so buttons can fan out
  },
  menuButtonWrapper: {
    position: 'absolute',
    width: BUTTON_SIZE,
    height: BUTTON_SIZE,
    left: 0,
    top: 0,
  },
  button: {
    width: '100%',
    height: '100%',
    borderRadius: 24, // Slightly rounder
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#131F2A',
    borderWidth: 1,
    borderColor: '#334155', // Subtle border
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.35,
    shadowRadius: 5,
    elevation: 8,
    paddingVertical: 8,
  },
  iconContainer: {
    marginBottom: 6,
  },
  buttonText: {
    color: '#F1F5F9',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 15,
  },
  buttonSelected: {
    backgroundColor: '#1A3D2E', // Solid dark green background
    borderColor: '#4ADE80',
    borderWidth: 2,
  },
});
