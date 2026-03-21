import React, { useState, useRef, useMemo } from 'react';
import { ScrollView, ScrollViewProps, View, Animated, StyleSheet, FlatList, FlatListProps, Platform } from 'react-native';
import { Colors } from '@/constants/colors';

export default function ThemedScrollView({ style, contentContainerStyle, children, ...props }: ScrollViewProps) {
  const [completeScrollBarHeight, setCompleteScrollBarHeight] = useState(1);
  const [visibleScrollBarHeight, setVisibleScrollBarHeight] = useState(0);
  
  const scrollIndicator = useRef(new Animated.Value(0)).current;

  const scrollIndicatorSize = useMemo(() => {
    return completeScrollBarHeight > visibleScrollBarHeight
      ? (visibleScrollBarHeight * visibleScrollBarHeight) / completeScrollBarHeight
      : visibleScrollBarHeight;
  }, [completeScrollBarHeight, visibleScrollBarHeight]);

  const difference = useMemo(() => {
    return visibleScrollBarHeight > scrollIndicatorSize
      ? visibleScrollBarHeight - scrollIndicatorSize
      : 1;
  }, [visibleScrollBarHeight, scrollIndicatorSize]);

  const scrollIndicatorPosition = useMemo(() => {
    const multiplier = completeScrollBarHeight > 0 
      ? visibleScrollBarHeight / completeScrollBarHeight 
      : 0;
    return Animated.multiply(
      scrollIndicator,
      multiplier
    ).interpolate({
      inputRange: [0, Math.max(difference, 1)],
      outputRange: [0, Math.max(difference, 1)],
      extrapolate: 'clamp',
    });
  }, [scrollIndicator, visibleScrollBarHeight, completeScrollBarHeight, difference]);

  const showScrollbar = props.showsVerticalScrollIndicator === true && completeScrollBarHeight > visibleScrollBarHeight;

  if (props.horizontal) {
    return (
      <ScrollView
        {...props}
        style={style}
        contentContainerStyle={contentContainerStyle}
        showsHorizontalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <ScrollView
        {...props}
        style={styles.scrollView}
        contentContainerStyle={contentContainerStyle}
        onContentSizeChange={(w, h) => {
          setCompleteScrollBarHeight(h);
          props.onContentSizeChange?.(w, h);
        }}
        onLayout={(e) => {
          setVisibleScrollBarHeight(e.nativeEvent.layout.height);
          props.onLayout?.(e);
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollIndicator } } }],
          { useNativeDriver: false, listener: props.onScroll as any }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
      
      {showScrollbar && (
        <View style={styles.scrollBarTrack}>
          <Animated.View
            style={[
              styles.scrollBarThumb,
              {
                height: scrollIndicatorSize,
                transform: [{ translateY: scrollIndicatorPosition }],
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    overflow: Platform.OS === 'web' ? 'visible' : 'hidden',
  } as any,
  scrollView: {
    flex: 1,
  },
  scrollBarTrack: {
    width: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    position: 'absolute',
    right: 4,
    top: 8,
    bottom: 8,
    borderRadius: 2,
    zIndex: 10,
    justifyContent: 'flex-start',
  },
  scrollBarThumb: {
    width: 4,
    backgroundColor: Colors.scrollbar,
    borderRadius: 2,
  },
});

export function ThemedFlatList<T>(props: FlatListProps<T>) {
  const [completeScrollBarHeight, setCompleteScrollBarHeight] = useState(1);
  const [visibleScrollBarHeight, setVisibleScrollBarHeight] = useState(0);
  
  const scrollIndicator = useRef(new Animated.Value(0)).current;

  const scrollIndicatorSize = useMemo(() => {
    return completeScrollBarHeight > visibleScrollBarHeight
      ? (visibleScrollBarHeight * visibleScrollBarHeight) / completeScrollBarHeight
      : visibleScrollBarHeight;
  }, [completeScrollBarHeight, visibleScrollBarHeight]);

  const difference = useMemo(() => {
    return visibleScrollBarHeight > scrollIndicatorSize
      ? visibleScrollBarHeight - scrollIndicatorSize
      : 1;
  }, [visibleScrollBarHeight, scrollIndicatorSize]);

  const scrollIndicatorPosition = useMemo(() => {
    const multiplier = completeScrollBarHeight > 0 
      ? visibleScrollBarHeight / completeScrollBarHeight 
      : 0;
    return Animated.multiply(
      scrollIndicator,
      multiplier
    ).interpolate({
      inputRange: [0, Math.max(difference, 1)],
      outputRange: [0, Math.max(difference, 1)],
      extrapolate: 'clamp',
    });
  }, [scrollIndicator, visibleScrollBarHeight, completeScrollBarHeight, difference]);

  const showScrollbar = props.showsVerticalScrollIndicator === true && completeScrollBarHeight > visibleScrollBarHeight;

  if (props.horizontal) {
     return <FlatList {...props} showsHorizontalScrollIndicator={false} />;
  }

  return (
    <View style={[styles.container, props.style]}>
      <FlatList
        {...props}
        style={styles.scrollView}
        onContentSizeChange={(w, h) => {
          setCompleteScrollBarHeight(h);
          props.onContentSizeChange?.(w, h);
        }}
        onLayout={(e) => {
          setVisibleScrollBarHeight(e.nativeEvent.layout.height);
          props.onLayout?.(e);
        }}
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollIndicator } } }],
          { useNativeDriver: false, listener: props.onScroll as any }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
      
      {showScrollbar && (
        <View style={styles.scrollBarTrack}>
          <Animated.View
            style={[
              styles.scrollBarThumb,
              {
                height: scrollIndicatorSize,
                transform: [{ translateY: scrollIndicatorPosition }],
              },
            ]}
          />
        </View>
      )}
    </View>
  );
}
