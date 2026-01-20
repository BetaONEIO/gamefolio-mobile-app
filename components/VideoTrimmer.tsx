import React, { useState, useRef, useEffect } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  PanResponder,
  LayoutChangeEvent,
  Platform,
  Image
} from 'react-native';
import * as VideoThumbnails from 'expo-video-thumbnails';
import { GripVertical, ChevronLeft, ChevronRight } from 'lucide-react-native';

const HANDLE_WIDTH = 28;
const MIN_GAP = 20; // Minimum pixel gap between handles

interface VideoTrimmerProps {
  duration: number;
  videoUri?: string;
  currentTime?: number;
  onTrimChange: (start: number, end: number) => void;
  onScrub?: (time: number) => void;
  onInteractionStart?: () => void;
  onInteractionEnd?: () => void;
  style?: any;
}

export default function VideoTrimmer({ 
  duration, 
  videoUri,
  currentTime = 0,
  onTrimChange, 
  onScrub,
  onInteractionStart,
  onInteractionEnd,
  style 
}: VideoTrimmerProps) {
  const [containerWidth, setContainerWidth] = useState(0);
  const [leftPos, setLeftPos] = useState(0);
  const [rightPos, setRightPos] = useState(0);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  
  const [isScrubbing, setIsScrubbing] = useState(false);
  const [scrubTime, setScrubTime] = useState(0);
  
  const leftPosRef = useRef(0);
  const rightPosRef = useRef(0);
  const containerWidthRef = useRef(0);
  const durationRef = useRef(duration);
  const onTrimChangeRef = useRef(onTrimChange);
  const onScrubRef = useRef(onScrub);
  const onInteractionStartRef = useRef(onInteractionStart);
  const onInteractionEndRef = useRef(onInteractionEnd);

  useEffect(() => {
    durationRef.current = duration;
    onTrimChangeRef.current = onTrimChange;
    onScrubRef.current = onScrub;
    onInteractionStartRef.current = onInteractionStart;
    onInteractionEndRef.current = onInteractionEnd;
  }, [duration, onTrimChange, onScrub, onInteractionStart, onInteractionEnd]);

  useEffect(() => {
    containerWidthRef.current = containerWidth;
  }, [containerWidth]);

  useEffect(() => {
    if (containerWidth > 0 && duration > 0) {
      // If rightPos is 0 (initial), set it to end
      if (rightPos === 0 && rightPosRef.current === 0) {
        setRightPos(containerWidth);
        rightPosRef.current = containerWidth;
        onTrimChange(0, duration);
      }
    }
  }, [containerWidth, duration, onTrimChange, rightPos]);

  useEffect(() => {
    let isMounted = true;
    
    const generateThumbnails = async () => {
      if (!videoUri || containerWidth === 0 || duration === 0 || Platform.OS === 'web') return;
      
      // Calculate how many thumbnails we can fit
      // Let's say each thumbnail is roughly 40px wide (matching height)
      const thumbnailWidth = 40;
      const count = Math.ceil(containerWidth / thumbnailWidth);
      const interval = duration / count;
      
      const thumbs: string[] = [];
      
      try {
        for (let i = 0; i < count; i++) {
          if (!isMounted) return;
          const time = i * interval * 1000; // time in ms
          try {
            const { uri } = await VideoThumbnails.getThumbnailAsync(videoUri, {
              time,
              quality: 0.5,
            });
            thumbs.push(uri);
          } catch (e) {
            console.warn('Error generating thumbnail', e);
          }
        }
        
        if (isMounted) {
          setThumbnails(thumbs);
        }
      } catch (e) {
        console.warn('Error in thumbnail generation loop', e);
      }
    };

    generateThumbnails();
    
    return () => {
      isMounted = false;
    };
  }, [videoUri, containerWidth, duration]);

  const updateTrim = (left: number, right: number) => {
    const d = durationRef.current;
    const w = containerWidthRef.current;
    if (d <= 0 || w <= 0) return;
    
    const startTime = (left / w) * d;
    const endTime = (right / w) * d;
    if (onTrimChangeRef.current) {
        onTrimChangeRef.current(startTime, endTime);
    }
  };

  const leftPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        if (onInteractionStartRef.current) onInteractionStartRef.current();
      },
      onPanResponderMove: (_, gestureState) => {
        let newLeft = leftPosRef.current + gestureState.dx;
        
        // Constrain
        if (newLeft < 0) newLeft = 0;
        if (newLeft > rightPosRef.current - MIN_GAP) newLeft = rightPosRef.current - MIN_GAP;
        
        setLeftPos(newLeft);
        updateTrim(newLeft, rightPosRef.current);
      },
      onPanResponderRelease: (_, gestureState) => {
        leftPosRef.current = leftPosRef.current + gestureState.dx;
        // Clamp and save final
        if (leftPosRef.current < 0) leftPosRef.current = 0;
        if (leftPosRef.current > rightPosRef.current - MIN_GAP) leftPosRef.current = rightPosRef.current - MIN_GAP;
        
        setLeftPos(leftPosRef.current);
        updateTrim(leftPosRef.current, rightPosRef.current);
        if (onInteractionEndRef.current) onInteractionEndRef.current();
      },
      onPanResponderTerminate: (_, gestureState) => {
        // Commit the gesture on termination to avoid jumping
        leftPosRef.current = leftPosRef.current + gestureState.dx;
        if (leftPosRef.current < 0) leftPosRef.current = 0;
        if (leftPosRef.current > rightPosRef.current - MIN_GAP) leftPosRef.current = rightPosRef.current - MIN_GAP;
        
        setLeftPos(leftPosRef.current);
        updateTrim(leftPosRef.current, rightPosRef.current);
        if (onInteractionEndRef.current) onInteractionEndRef.current();
      }
    })
  ).current;

  const rightPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onShouldBlockNativeResponder: () => true,
      onPanResponderGrant: () => {
        if (onInteractionStartRef.current) onInteractionStartRef.current();
      },
      onPanResponderMove: (_, gestureState) => {
        const width = containerWidthRef.current;
        let newRight = rightPosRef.current + gestureState.dx;
        
        // Constrain
        if (newRight > width) newRight = width;
        if (newRight < leftPosRef.current + MIN_GAP) newRight = leftPosRef.current + MIN_GAP;
        
        setRightPos(newRight);
        updateTrim(leftPosRef.current, newRight);
      },
      onPanResponderRelease: (_, gestureState) => {
        rightPosRef.current = rightPosRef.current + gestureState.dx;
        
        if (rightPosRef.current > containerWidthRef.current) rightPosRef.current = containerWidthRef.current;
        if (rightPosRef.current < leftPosRef.current + MIN_GAP) rightPosRef.current = leftPosRef.current + MIN_GAP;
        
        setRightPos(rightPosRef.current);
        updateTrim(leftPosRef.current, rightPosRef.current);
        if (onInteractionEndRef.current) onInteractionEndRef.current();
      },
      onPanResponderTerminate: (_, gestureState) => {
        rightPosRef.current = rightPosRef.current + gestureState.dx;
        
        if (rightPosRef.current > containerWidthRef.current) rightPosRef.current = containerWidthRef.current;
        if (rightPosRef.current < leftPosRef.current + MIN_GAP) rightPosRef.current = leftPosRef.current + MIN_GAP;
        
        setRightPos(rightPosRef.current);
        updateTrim(leftPosRef.current, rightPosRef.current);
        if (onInteractionEndRef.current) onInteractionEndRef.current();
      }
    })
  ).current;


  
  // We need to capture the start X for scrubbing
  const scrubStartX = useRef(0);
  
  const scrubResponder = useRef(
      PanResponder.create({
          onStartShouldSetPanResponder: () => true,
          onMoveShouldSetPanResponder: () => true,
          onPanResponderGrant: (evt) => {
              scrubStartX.current = evt.nativeEvent.locationX;
              setIsScrubbing(true);
              if (onInteractionStartRef.current) onInteractionStartRef.current();
              
              const w = containerWidthRef.current;
              const d = durationRef.current;
              if (w > 0 && d > 0 && onScrubRef.current) {
                  const time = Math.max(0, Math.min(d, (scrubStartX.current / w) * d));
                  setScrubTime(time);
                  onScrubRef.current(time);
              }
          },
          onPanResponderMove: (evt, gestureState) => {
              const w = containerWidthRef.current;
              const d = durationRef.current;
              const currentX = scrubStartX.current + gestureState.dx;
              
              if (w > 0 && d > 0 && onScrubRef.current) {
                  const time = Math.max(0, Math.min(d, (currentX / w) * d));
                  setScrubTime(time);
                  onScrubRef.current(time);
              }
          },
          onPanResponderRelease: () => {
              setIsScrubbing(false);
              if (onInteractionEndRef.current) onInteractionEndRef.current();
          },
          onPanResponderTerminate: () => {
              setIsScrubbing(false);
              if (onInteractionEndRef.current) onInteractionEndRef.current();
          }
      })
  ).current;

  const formatTime = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const currentStart = containerWidth > 0 ? (leftPos / containerWidth) * duration : 0;
  const currentEnd = containerWidth > 0 ? (rightPos / containerWidth) * duration : duration;
  const currentDuration = Math.max(0, currentEnd - currentStart);

  const displayTime = isScrubbing ? scrubTime : currentTime;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.timeInfo}>
        <Text style={styles.timeText}>{formatTime(currentStart)}</Text>
        <View style={styles.durationContainer}>
          <Text style={styles.durationLabel}>Clip Length</Text>
          <Text style={styles.durationText}>{formatTime(currentDuration)}</Text>
        </View>
        <Text style={styles.timeText}>{formatTime(currentEnd)}</Text>
      </View>
      
      <View 
        style={styles.trackContainer} 
        onLayout={(e: LayoutChangeEvent) => setContainerWidth(e.nativeEvent.layout.width)}
        {...scrubResponder.panHandlers}
      >
        {/* Background Track with Thumbnails */}
        <View style={styles.trackBackground}>
          {thumbnails.map((uri, index) => (
            <Image
              key={index}
              source={{ uri }}
              style={{ width: containerWidth / thumbnails.length, height: '100%' }}
              resizeMode="cover"
            />
          ))}
        </View>
        
        {/* Unselected Overlay Left */}
        <View 
           style={[
             styles.overlay, 
             { left: 0, width: leftPos }
           ]} 
        />
        
        {/* Unselected Overlay Right */}
        <View 
           style={[
             styles.overlay, 
             { left: rightPos, right: 0 }
           ]} 
        />
        
        {/* Selected Range */}
        <View 
          style={[
            styles.selectedRange, 
            { 
              left: leftPos, 
              width: Math.max(0, rightPos - leftPos) 
            }
          ]} 
        />
        
        {/* Playhead */}
        {displayTime >= 0 && (
            <View 
                style={[
                    styles.playhead,
                    { 
                        left: containerWidth > 0 && duration > 0 
                            ? (displayTime / duration) * containerWidth 
                            : 0 
                    }
                ]}
            />
        )}

        {/* Left Handle */}
        <View 
          style={[styles.handle, { left: leftPos - HANDLE_WIDTH / 2 }]}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          {...leftPanResponder.panHandlers}
        >
          <ChevronLeft size={16} color="#0F1520" />
        </View>

        {/* Right Handle */}
        <View 
          style={[styles.handle, { left: rightPos - HANDLE_WIDTH / 2 }]}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          {...rightPanResponder.panHandlers}
        >
          <ChevronRight size={16} color="#0F1520" />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: 10,
  },
  timeInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 4,
  },
  timeText: {
    color: '#94A3B8',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
    fontWeight: '500',
  },
  durationContainer: {
    alignItems: 'center',
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  durationLabel: {
    color: '#94A3B8',
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  durationText: {
    color: '#4ADE80',
    fontWeight: '700',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  trackContainer: {
    height: 40,
    justifyContent: 'center',
  },
  trackBackground: {
    height: 40,
    backgroundColor: '#1E293B',
    borderRadius: 8,
    width: '100%',
    position: 'absolute',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  overlay: {
    position: 'absolute',
    height: 40,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    top: 0,
    bottom: 0,
    borderRadius: 8, // To match track radius on edges
  },
  selectedRange: {
    height: 40,
    // backgroundColor: 'rgba(74, 222, 128, 0.1)', // Even lighter
    position: 'absolute',
    borderTopWidth: 2,
    borderBottomWidth: 2,
    borderColor: '#4ADE80',
    zIndex: 5,
  },
  playhead: {
    width: 2,
    height: '120%',
    backgroundColor: '#FFF',
    position: 'absolute',
    zIndex: 15,
    top: '-10%',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.5,
    shadowRadius: 2,
    elevation: 5,
  },
  handle: {
    width: HANDLE_WIDTH,
    height: 48, // Slightly taller than track
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    zIndex: 10,
    top: -4,
    backgroundColor: '#FFF',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  // handleBar removed as we use icon now
});
