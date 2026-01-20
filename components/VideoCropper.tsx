import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  StyleSheet, 
  View, 
  Modal, 
  Text, 
  TouchableOpacity, 
  PanResponder, 
  Animated, 
  Dimensions
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import Slider from '@react-native-community/slider';
import { X, Check, ZoomIn, ZoomOut } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface VideoCropperProps {
  visible: boolean;
  videoUri: string;
  videoWidth: number;
  videoHeight: number;
  onCancel: () => void;
  onComplete: (cropData: { scale: number; x: number; y: number; frameWidth: number }) => void;
}

export default function VideoCropper({
  visible,
  videoUri,
  videoWidth,
  videoHeight,
  onCancel,
  onComplete,
}: VideoCropperProps) {
  const insets = useSafeAreaInsets();
  
  // Frame dimensions (9:16)
  const frameWidth = useMemo(() => {
    const availableHeight = SCREEN_HEIGHT - insets.top - insets.bottom - 150; 
    const wFromH = availableHeight * (9 / 16);
    const wMax = SCREEN_WIDTH - 40;
    return Math.min(wFromH, wMax);
  }, [insets.top, insets.bottom]);
  
  const frameHeight = frameWidth * (16 / 9);

  const { minScale, fillScale } = useMemo(() => {
    if (!videoWidth || !videoHeight) return { minScale: 1, fillScale: 1 };
    const scaleW = frameWidth / videoWidth;
    const scaleH = frameHeight / videoHeight;
    return {
      minScale: Math.min(scaleW, scaleH),
      fillScale: Math.max(scaleW, scaleH)
    };
  }, [frameWidth, frameHeight, videoWidth, videoHeight]);

  const [scale, setScale] = useState(minScale);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  
  const initialDistRef = useRef(0);
  const initialScaleRef = useRef(minScale);
  
  const scaleRef = useRef(minScale);
  const panRef = useRef({ x: 0, y: 0 });
  const frameWidthRef = useRef(frameWidth);
  const frameHeightRef = useRef(frameHeight);

  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { panRef.current = pan; }, [pan]);
  useEffect(() => { frameWidthRef.current = frameWidth; }, [frameWidth]);
  useEffect(() => { frameHeightRef.current = frameHeight; }, [frameHeight]);

  // Animation values
  const panX = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(minScale)).current;

  const player = useVideoPlayer(videoUri, player => {
    player.loop = true;
    player.play();
    player.muted = true; 
  });

  useEffect(() => {
    if (visible) {
      setScale(minScale);
      setPan({ x: 0, y: 0 });
      panX.setValue(0);
      panY.setValue(0);
      scaleAnim.setValue(minScale);
      if (player) {
          player.play();
      }
    } else {
        if (player) {
            player.pause();
        }
    }
  }, [visible, minScale, videoUri, player, panX, panY, scaleAnim]);

  useEffect(() => {
    const scaledWidth = videoWidth * scale;
    const scaledHeight = videoHeight * scale;
    
    const maxDX = Math.max(0, (scaledWidth - frameWidth) / 2);
    const maxDY = Math.max(0, (scaledHeight - frameHeight) / 2);
    
    let newX = pan.x;
    let newY = pan.y;
    
    // Clamp
    if (newX > maxDX) newX = maxDX;
    if (newX < -maxDX) newX = -maxDX;
    if (newY > maxDY) newY = maxDY;
    if (newY < -maxDY) newY = -maxDY;
    
    if (newX !== pan.x || newY !== pan.y) {
      setPan({ x: newX, y: newY });
      panX.setValue(newX);
      panY.setValue(newY);
    }
    
    scaleAnim.setValue(scale);
  }, [scale, videoWidth, videoHeight, frameWidth, frameHeight, pan.x, pan.y, panX, panY, scaleAnim]);

  const getDistance = (touches: any[]) => {
    const [t1, t2] = touches;
    const dx = t1.pageX - t2.pageX;
    const dy = t1.pageY - t2.pageY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const panResponder = useMemo(() => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e, gestureState) => {
        panX.setOffset(panRef.current.x);
        panY.setOffset(panRef.current.y);
        panX.setValue(0);
        panY.setValue(0);

        const touches = e.nativeEvent.touches;
        if (touches.length === 2) {
             initialDistRef.current = getDistance(touches);
             initialScaleRef.current = scaleRef.current;
        }
      },
      onPanResponderMove: (e, gestureState) => {
        const touches = e.nativeEvent.touches;
        if (touches.length === 1 && initialDistRef.current === 0) {
            // Pan
            panX.setValue(gestureState.dx);
            panY.setValue(gestureState.dy);
        } else if (touches.length === 2) {
             const dist = getDistance(touches);
             if (initialDistRef.current > 0) {
                 const scaleFactor = dist / initialDistRef.current;
                 const newScale = Math.max(minScale, Math.min(fillScale * 3, initialScaleRef.current * scaleFactor));
                 
                 scaleAnim.setValue(newScale);
                 scaleRef.current = newScale;
             }
        }
      },
      onPanResponderRelease: (e, gestureState) => {
        panX.flattenOffset();
        panY.flattenOffset();
        
        if (initialDistRef.current > 0) {
             setScale(scaleRef.current);
             initialDistRef.current = 0;
        }
        
        const currentScale = scaleRef.current;
        const currentPanX = panRef.current.x + gestureState.dx;
        const currentPanY = panRef.current.y + gestureState.dy;
        
        const scaledWidth = videoWidth * currentScale;
        const scaledHeight = videoHeight * currentScale;
        const fw = frameWidthRef.current;
        const fh = frameHeightRef.current;
        
        const maxDX = Math.max(0, (scaledWidth - fw) / 2);
        const maxDY = Math.max(0, (scaledHeight - fh) / 2);
        
        let finalX = currentPanX;
        let finalY = currentPanY;
        
        // If we pinched, the gestureState.dx/dy might be from the last move of one finger or 0
        // But since we flattened offset, panX/panY Value is added to Offset.
        // Wait, if we pinched, panX value is 0 (we didn't set it in move).
        // So currentPanX = panRef.current.x + 0.
        // This effectively keeps the center where it was (ignoring pinch center shift for now).
        // To handle pinch center shift, we would need to adjust panX/panY during pinch.
        // For now, let's keep it simple: pinch zooms around center, then you pan.
        // But we need to ensure we use the updated pan position if we didn't move it.
        
        // If we were pinching, we shouldn't use gestureState.dx because it might be weird.
        if (initialDistRef.current === 0) {
             // We were panning
             finalX = currentPanX; 
             finalY = currentPanY;
        } else {
             // We were pinching. Position hasn't changed (we didn't update panX/Y).
             finalX = panRef.current.x;
             finalY = panRef.current.y;
        }
        
        // Clamp
        if (finalX > maxDX) finalX = maxDX;
        if (finalX < -maxDX) finalX = -maxDX;
        if (finalY > maxDY) finalY = maxDY;
        if (finalY < -maxDY) finalY = -maxDY;
        
        Animated.parallel([
          Animated.spring(panX, {
            toValue: finalX,
            useNativeDriver: false,
          }),
          Animated.spring(panY, {
            toValue: finalY,
            useNativeDriver: false,
          })
        ]).start();
        
        setPan({ x: finalX, y: finalY });
      }
    }), [panX, panY, videoWidth, videoHeight, minScale, fillScale, scaleAnim]);

  const handleComplete = () => {
    onComplete({
      scale,
      x: pan.x,
      y: pan.y,
      frameWidth: frameWidthRef.current
    });
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.container}>
        <View style={[styles.header, { marginTop: insets.top }]}>
           <TouchableOpacity onPress={onCancel} style={styles.iconButton}>
             <X color="#FFF" size={24} />
           </TouchableOpacity>
           <Text style={styles.title}>Adjust Reel</Text>
           <TouchableOpacity onPress={handleComplete} style={styles.iconButton}>
             <Check color="#4ADE80" size={24} />
           </TouchableOpacity>
        </View>
        
        <View style={styles.content}>
           <View 
             style={[
               styles.cropFrame, 
               { width: frameWidth, height: frameHeight }
             ]}
           >
             <Animated.View
               style={{
                 width: videoWidth,
                 height: videoHeight,
                 transform: [
                   { scale: scaleAnim },
                   { translateX: panX },
                   { translateY: panY }
                 ]
               }}
               {...panResponder.panHandlers}
             >
                <VideoView
                  player={player}
                  style={{ width: '100%', height: '100%' }}
                  nativeControls={false}
                  contentFit="contain" 
                />
                <View style={StyleSheet.absoluteFill} />
             </Animated.View>
           </View>
           
           <Text style={styles.instruction}>
             Pinch or drag to adjust
           </Text>
        </View>
        
        <View style={[styles.footer, { paddingBottom: insets.bottom + 20 }]}>
            <View style={styles.sliderContainer}>
                <ZoomOut size={20} color="#94A3B8" />
                <Slider
                    style={styles.slider}
                    minimumValue={minScale}
                    maximumValue={fillScale * 3}
                    value={scale}
                    onValueChange={setScale}
                    minimumTrackTintColor="#4ADE80"
                    maximumTrackTintColor="#334155"
                    thumbTintColor="#FFF"
                />
                <ZoomIn size={20} color="#94A3B8" />
            </View>
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
    paddingHorizontal: 20,
    paddingVertical: 10,
    zIndex: 10,
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '600',
  },
  iconButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cropFrame: {
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  instruction: {
    color: '#94A3B8',
    marginTop: 20,
    fontSize: 14,
  },
  footer: {
    paddingHorizontal: 40,
  },
  sliderContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  slider: {
    flex: 1,
    height: 40,
  },
});
