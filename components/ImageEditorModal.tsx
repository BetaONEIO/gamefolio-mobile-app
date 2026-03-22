import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Image, Dimensions, PanResponder, Platform } from 'react-native';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react-native';
import Slider from '@react-native-community/slider';
import * as ImageManipulator from 'expo-image-manipulator';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const MAX_ZOOM = 3;
const MIN_ZOOM = 1;

interface ImageEditorModalProps {
  visible: boolean;
  imageUri: string | null;
  onClose: () => void;
  onSave: (uri: string, data: { scale: number; pan: { x: number; y: number } }) => void;
  maskType?: 'circle' | 'square' | 'rect';
  aspectRatio?: number;
  initialDimensions?: { width: number; height: number };
  initialScale?: number;
  initialPan?: { x: number; y: number };
}

export default function ImageEditorModal({ 
  visible, 
  imageUri, 
  onClose, 
  onSave, 
  maskType = 'circle',
  aspectRatio = 1,
  initialDimensions,
  initialScale = 1,
  initialPan = { x: 0, y: 0 }
}: ImageEditorModalProps) {
  const [imageSize, setImageSize] = useState(initialDimensions || { width: 0, height: 0 });
  const [scale, setScale] = useState(initialScale);
  const [pan, setPan] = useState(initialPan);
  
  const panRef = useRef(initialPan);
  const scaleRef = useRef(initialScale);
  const lastPan = useRef(initialPan);

  const resetState = useCallback(() => {
    setScale(initialScale);
    setPan(initialPan);
    panRef.current = initialPan;
    scaleRef.current = initialScale;
    lastPan.current = initialPan;
  }, [initialScale, initialPan]);

  // Load image size and reset state when uri changes
  useEffect(() => {
    if (imageUri) {
      if (initialDimensions && initialDimensions.width > 0 && initialDimensions.height > 0) {
        setImageSize(initialDimensions);
        // Only reset if we are opening a NEW image or explicitly resetting?
        // Actually, if imageUri changes or visibility changes to true, we might want to reset.
        // But if we are passing initialScale, we should respect it.
        resetState();
      } else {
        Image.getSize(imageUri, (w, h) => {
          setImageSize({ width: w, height: h });
          resetState();
        }, (err) => {
          console.error("Failed to get image size", err);
        });
      }
    }
  }, [imageUri, initialDimensions, initialScale, initialPan, visible, resetState]); // Added dependencies to ensure update


  // Calculate mask dimensions based on aspect ratio
  const getMaskDimensions = () => {
    const maxWidth = SCREEN_WIDTH * 0.9;
    const maxHeight = SCREEN_HEIGHT * 0.6;
    
    let maskWidth = maxWidth;
    let maskHeight = maskWidth / aspectRatio;

    if (maskHeight > maxHeight) {
      maskHeight = maxHeight;
      maskWidth = maskHeight * aspectRatio;
    }

    return { maskWidth, maskHeight };
  };

  const { maskWidth, maskHeight } = getMaskDimensions();

  // Proper PanResponder Implementation
  const customPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        lastPan.current = { x: panRef.current.x, y: panRef.current.y };
      },
      onPanResponderMove: (_, gestureState) => {
        let newX = lastPan.current.x + gestureState.dx;
        let newY = lastPan.current.y + gestureState.dy;

        // Calculate limits based on current scale
        // displayWidth is SCREEN_WIDTH
        // displayHeight is calculated below
        const displayScale = imageSize.width > 0 ? SCREEN_WIDTH / imageSize.width : 1;
        const displayHeight = imageSize.height * displayScale;
        const displayWidth = SCREEN_WIDTH;

        const maxPanX = (displayWidth * scaleRef.current - maskWidth) / 2;
        const maxPanY = (displayHeight * scaleRef.current - maskHeight) / 2;

        // Clamp
        if (maxPanX > 0) {
            newX = Math.max(-maxPanX, Math.min(newX, maxPanX));
        } else {
            newX = 0;
        }

        if (maxPanY > 0) {
            newY = Math.max(-maxPanY, Math.min(newY, maxPanY));
        } else {
             newY = 0;
        }
        
        // Update State
        setPan({ x: newX, y: newY });
        panRef.current = { x: newX, y: newY };
      },
    })
  ).current;

  const handleZoomChange = (value: number) => {
    console.log('[ImageEditor] Zoom changing to:', value);
    console.log('[ImageEditor] Current scale before change:', scale);
    const newValue = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
    console.log('[ImageEditor] Clamped value:', newValue);
    setScale(newValue);
    scaleRef.current = newValue;

    // Re-clamp pan if necessary when zooming out
    const displayScale = imageSize.width > 0 ? SCREEN_WIDTH / imageSize.width : 1;
    const displayHeight = imageSize.height * displayScale;
    const displayWidth = SCREEN_WIDTH;

    const maxPanX = (displayWidth * value - maskWidth) / 2;
    const maxPanY = (displayHeight * value - maskHeight) / 2;

    let newX = panRef.current.x;
    let newY = panRef.current.y;
    let changed = false;

    if (maxPanX > 0) {
        if (newX > maxPanX) { newX = maxPanX; changed = true; }
        if (newX < -maxPanX) { newX = -maxPanX; changed = true; }
    } else {
        if (newX !== 0) { newX = 0; changed = true; }
    }

    if (maxPanY > 0) {
        if (newY > maxPanY) { newY = maxPanY; changed = true; }
        if (newY < -maxPanY) { newY = -maxPanY; changed = true; }
    } else {
        if (newY !== 0) { newY = 0; changed = true; }
    }

    if (changed) {
        setPan({ x: newX, y: newY });
        panRef.current = { x: newX, y: newY };
    }
  };

  const handleSave = async () => {
    if (!imageUri || imageSize.width === 0) return;

    try {
      // Calculate crop logic
      console.log('[ImageEditor] Saving with:', { scale, pan, imageSize });

      const displayScale = SCREEN_WIDTH / imageSize.width;
      const displayHeight = imageSize.height * displayScale;
      const displayWidth = SCREEN_WIDTH;

      const factor = imageSize.width / displayWidth;
      
      const rectX_unscaled = (-maskWidth/2 - pan.x) / scale;
      const rectY_unscaled = (-maskHeight/2 - pan.y) / scale;
      
      const cropX_display = rectX_unscaled + displayWidth/2;
      const cropY_display = rectY_unscaled + displayHeight/2;
      
      const cropX = cropX_display * factor;
      const cropY = cropY_display * factor;
      const cropWidth = (maskWidth / scale) * factor;
      const cropHeight = (maskHeight / scale) * factor;

      console.log('[ImageEditor] Crop calculated:', { cropX, cropY, cropWidth, cropHeight });

      // Validate bounds
      const originX = Math.max(0, Math.min(cropX, imageSize.width - cropWidth));
      const originY = Math.max(0, Math.min(cropY, imageSize.height - cropHeight));
      
      const actions: ImageManipulator.Action[] = [
        {
          crop: {
            originX: originX,
            originY: originY,
            width: Math.min(cropWidth, imageSize.width - originX),
            height: Math.min(cropHeight, imageSize.height - originY),
          }
        }
      ];

      // Perform crop
      const result = await ImageManipulator.manipulateAsync(
        imageUri,
        actions,
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      onSave(result.uri, { scale: scaleRef.current, pan: panRef.current });
    } catch (error) {
      console.error("Crop failed", error);
    }
  };


  if (!visible || !imageUri) return null;

  // Calculate display dimensions
  const displayScale = imageSize.width > 0 ? SCREEN_WIDTH / imageSize.width : 1;
  const displayHeight = imageSize.height * displayScale;
  
  return (
    <Modal visible={visible} animationType="slide" transparent={true}>
      <View style={styles.container}>
        <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.iconButton}>
                <X color="#FFF" size={24} />
            </TouchableOpacity>
            <Text style={styles.title}>Adjust Photo</Text>
            <TouchableOpacity onPress={handleSave} style={styles.iconButton}>
                <Check color="#4ADE80" size={24} />
            </TouchableOpacity>
        </View>

        <View style={styles.editorContainer}>
            <View 
                style={styles.imageWrapper}
                {...customPanResponder.panHandlers}
            >
                <Image
                    source={{ uri: imageUri }}
                    style={{
                        width: SCREEN_WIDTH,
                        height: displayHeight,
                        transform: [
                            { scale: scale },
                            { translateX: pan.x },
                            { translateY: pan.y }
                        ]
                    }}
                    resizeMode="cover"
                />
            </View>

            {/* Overlay Mask */}
            <View style={styles.maskContainer} pointerEvents="none">
                 <View style={[
                   styles.maskWindow, 
                   { width: maskWidth, height: maskHeight },
                   maskType === 'circle' && styles.circleMask
                  ]} />
                 <View style={[
                   styles.maskOutline, 
                   { width: maskWidth, height: maskHeight },
                   maskType === 'circle' && styles.circleOutline
                  ]} />
            </View>
        </View>

        <View style={styles.footer}>
            <View style={styles.sliderContainer}>
                <ZoomOut size={20} color="#94A3B8" />
                <Slider
                    style={styles.slider}
                    minimumValue={MIN_ZOOM}
                    maximumValue={MAX_ZOOM}
                    value={scale}
                    onValueChange={handleZoomChange}
                    onSlidingStart={() => console.log('[ImageEditor] Sliding started')}
                    onSlidingComplete={(value) => console.log('[ImageEditor] Sliding completed:', value)}
                    minimumTrackTintColor="#3B82F6"
                    maximumTrackTintColor="#334155"
                    thumbTintColor="#FFF"
                    step={0.01}
                />
                <ZoomIn size={20} color="#94A3B8" />
            </View>
            <Text style={styles.instruction}>Pinch or use slider to zoom. Drag to move.</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingHorizontal: 20,
    paddingBottom: 20,
    zIndex: 10,
    backgroundColor: '#000',
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  iconButton: {
    padding: 8,
  },
  editorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT, // Full area to catch gestures
    justifyContent: 'center',
    alignItems: 'center',
  },
  maskContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  maskWindow: {
    borderColor: 'rgba(0,0,0,0.6)',
    borderWidth: 2000, // Very large border to cover the screen
    borderRadius: 0,
    position: 'absolute',
  },
  circleMask: {
    borderRadius: 9999, // Should be large enough
  },
  maskOutline: {
    borderWidth: 2,
    borderColor: '#FFFFFF',
    position: 'absolute',
  },
  circleOutline: {
    borderRadius: 9999,
  },
  footer: {
    padding: 30,
    paddingBottom: 50,
    backgroundColor: '#131F2A',
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 10,
  },
  slider: {
    flex: 1,
    height: 40,
  },
  instruction: {
    color: '#94A3B8',
    textAlign: 'center',
    fontSize: 14,
  },
});
