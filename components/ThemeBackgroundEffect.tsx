import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { ProfileThemeName } from '@/constants/themes';

function NeoMatrixEffect() {
  const columns = 7;
  const chars = '01アイウエカキクケコサタナハマヤラワ'.split('');

  const cols = useMemo(() =>
    Array.from({ length: columns }, (_, i) => ({
      anim: new Animated.Value(0),
      delay: i * 350,
      duration: 2200 + i * 200,
      chars: Array.from({ length: 9 }, () => chars[Math.floor(Math.random() * chars.length)]),
      left: i * 38 + 6,
    })),
    []
  );

  useEffect(() => {
    const anims = cols.map(col =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(col.delay),
          Animated.timing(col.anim, { toValue: 1, duration: col.duration, useNativeDriver: true }),
          Animated.timing(col.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cols.map((col, i) => {
        const translateY = col.anim.interpolate({ inputRange: [0, 1], outputRange: [-100, 200] });
        return (
          <Animated.View key={i} style={[s.neoColumn, { left: col.left, transform: [{ translateY }] }]}>
            {col.chars.map((ch, j) => (
              <Text key={j} style={[s.neoChar, { opacity: 1 - j * 0.1 }]}>{ch}</Text>
            ))}
          </Animated.View>
        );
      })}
    </View>
  );
}

function ZombieEffect() {
  const drips = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      anim: new Animated.Value(0),
      delay: i * 280,
      duration: 1800 + i * 150,
      left: i * 36 + 8,
      width: 3 + (i % 3),
    })),
    []
  );

  useEffect(() => {
    const anims = drips.map(d =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(d.delay),
          Animated.timing(d.anim, { toValue: 1, duration: d.duration, useNativeDriver: true }),
          Animated.timing(d.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {drips.map((d, i) => {
        const height = d.anim.interpolate({ inputRange: [0, 1], outputRange: [0, 60 + (i % 4) * 14] });
        const opacity = d.anim.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 0.7, 0.6, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              top: 0,
              left: d.left,
              width: d.width,
              borderBottomLeftRadius: d.width * 2,
              borderBottomRightRadius: d.width * 2,
              backgroundColor: '#9ae600',
              height,
              opacity,
            }}
          />
        );
      })}
    </View>
  );
}

function CyberpunkScanlineEffect() {
  const lineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.timing(lineAnim, { toValue: 1, duration: 3000, useNativeDriver: true })
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const lines = Array.from({ length: 6 }, (_, i) => i);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {lines.map(i => {
        const translateY = lineAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [-220 + i * 20, 220 + i * 20],
        });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              height: 1.5,
              backgroundColor: '#00d3f2',
              opacity: 0.18,
              transform: [{ translateY }],
            }}
          />
        );
      })}
      <View style={[StyleSheet.absoluteFill, { opacity: 0.04 }]}>
        {Array.from({ length: 30 }).map((_, i) => (
          <View key={i} style={{ height: 1, borderBottomWidth: 0.5, borderBottomColor: '#00d3f2', marginBottom: 5 }} />
        ))}
      </View>
    </View>
  );
}

function GothicParticleEffect() {
  const particles = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => ({
      anim: new Animated.Value(0),
      delay: i * 300,
      duration: 2500 + i * 200,
      left: 10 + i * 28,
      size: 3 + (i % 3),
    })),
    []
  );

  useEffect(() => {
    const anims = particles.map(p =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(p.delay),
          Animated.timing(p.anim, { toValue: 1, duration: p.duration, useNativeDriver: true }),
          Animated.timing(p.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {particles.map((p, i) => {
        const translateY = p.anim.interpolate({ inputRange: [0, 1], outputRange: [220, -20] });
        const opacity = p.anim.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 0.6, 0.5, 0] });
        const scale = p.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1, 0.7] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.left,
              width: p.size,
              height: p.size,
              borderRadius: p.size / 2,
              backgroundColor: '#c27aff',
              opacity,
              transform: [{ translateY }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}

function BlocksPixelEffect() {
  const blocks = useMemo(() =>
    Array.from({ length: 9 }, (_, i) => ({
      anim: new Animated.Value(0),
      delay: i * 220,
      duration: 1600 + i * 180,
      left: i * 32 + 4,
      size: 8 + (i % 3) * 4,
      color: ['#4ade80', '#22c55e', '#86efac', '#16a34a'][i % 4],
    })),
    []
  );

  useEffect(() => {
    const anims = blocks.map(b =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(b.delay),
          Animated.timing(b.anim, { toValue: 1, duration: b.duration, useNativeDriver: true }),
          Animated.timing(b.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {blocks.map((b, i) => {
        const translateY = b.anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 230] });
        const opacity = b.anim.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.5, 0.4, 0] });
        const rotate = b.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: b.left,
              width: b.size,
              height: b.size,
              backgroundColor: b.color,
              opacity,
              transform: [{ translateY }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

function ForestLeafEffect() {
  const leaves = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => ({
      anim: new Animated.Value(0),
      delay: i * 250,
      duration: 2800 + i * 200,
      startX: 10 + i * 28,
      driftX: (i % 2 === 0 ? 1 : -1) * (10 + (i % 3) * 6),
    })),
    []
  );

  useEffect(() => {
    const anims = leaves.map(l =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(l.delay),
          Animated.timing(l.anim, { toValue: 1, duration: l.duration, useNativeDriver: true }),
          Animated.timing(l.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {leaves.map((l, i) => {
        const translateY = l.anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 230] });
        const translateX = l.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, l.driftX, l.driftX * 0.5] });
        const opacity = l.anim.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 0.55, 0.45, 0] });
        const rotate = l.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: l.startX,
              width: 7,
              height: 10,
              borderRadius: 7,
              borderTopRightRadius: 0,
              backgroundColor: '#4ade80',
              opacity,
              transform: [{ translateY }, { translateX }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

function WatermelonSeedEffect() {
  const seeds = useMemo(() =>
    Array.from({ length: 10 }, (_, i) => ({
      anim: new Animated.Value(0),
      delay: i * 280,
      duration: 1800 + i * 150,
      left: 8 + i * 28,
    })),
    []
  );

  useEffect(() => {
    const anims = seeds.map(s =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(s.delay),
          Animated.timing(s.anim, { toValue: 1, duration: s.duration, useNativeDriver: true }),
          Animated.timing(s.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {seeds.map((s, i) => {
        const translateY = s.anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 240] });
        const rotate = s.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
        const opacity = s.anim.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 0.6, 0.5, 0] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: s.left,
              width: 5,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#0d1a12',
              opacity,
              transform: [{ translateY }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

function CartoonDotEffect() {
  const dots = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      anim: new Animated.Value(0),
      delay: i * 180,
      duration: 2000 + i * 100,
      left: 6 + i * 24,
      size: 4 + (i % 4) * 2,
      color: ['#ff5e5e', '#facc15', '#3498db', '#ff9f43'][i % 4],
    })),
    []
  );

  useEffect(() => {
    const anims = dots.map(d =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(d.delay),
          Animated.timing(d.anim, { toValue: 1, duration: d.duration, useNativeDriver: true }),
          Animated.timing(d.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {dots.map((d, i) => {
        const translateY = d.anim.interpolate({ inputRange: [0, 1], outputRange: [230, -10] });
        const opacity = d.anim.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.5, 0.45, 0] });
        const scale = d.anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1.2, 0.8] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: d.left,
              width: d.size,
              height: d.size,
              borderRadius: d.size / 2,
              backgroundColor: d.color,
              opacity,
              transform: [{ translateY }, { scale }],
            }}
          />
        );
      })}
    </View>
  );
}

function MacGlowEffect() {
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, { toValue: 1, duration: 3000, useNativeDriver: true }),
        Animated.timing(glowAnim, { toValue: 0, duration: 3000, useNativeDriver: true }),
      ])
    );
    anim.start();
    return () => anim.stop();
  }, []);

  const opacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.04, 0.1] });
  const scale = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1.1] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View
        style={{
          position: 'absolute',
          top: -60,
          left: -60,
          width: 180,
          height: 180,
          borderRadius: 90,
          backgroundColor: '#0066ff',
          opacity,
          transform: [{ scale }],
        }}
      />
      <Animated.View
        style={{
          position: 'absolute',
          bottom: -40,
          right: -40,
          width: 140,
          height: 140,
          borderRadius: 70,
          backgroundColor: '#0066ff',
          opacity,
          transform: [{ scale }],
        }}
      />
    </View>
  );
}

function PinkSparkleEffect() {
  const sparkles = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      anim: new Animated.Value(0),
      delay: i * 220,
      duration: 2200 + i * 150,
      left: 6 + i * 24,
      size: 3 + (i % 3) * 2,
    })),
    []
  );

  useEffect(() => {
    const anims = sparkles.map(sp =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(sp.delay),
          Animated.timing(sp.anim, { toValue: 1, duration: sp.duration, useNativeDriver: true }),
          Animated.timing(sp.anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      )
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {sparkles.map((sp, i) => {
        const translateY = sp.anim.interpolate({ inputRange: [0, 1], outputRange: [230, -10] });
        const opacity = sp.anim.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 0.8, 0.7, 0] });
        const scale = sp.anim.interpolate({ inputRange: [0, 0.4, 0.8, 1], outputRange: [0, 1.2, 0.9, 0] });
        const rotate = sp.anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: sp.left,
              width: sp.size,
              height: sp.size,
              borderRadius: sp.size / 2,
              backgroundColor: '#ff2056',
              opacity,
              transform: [{ translateY }, { scale }, { rotate }],
            }}
          />
        );
      })}
    </View>
  );
}

interface ThemeBackgroundEffectProps {
  themeId: string | null | undefined;
}

export function ThemeBackgroundEffect({ themeId }: ThemeBackgroundEffectProps) {
  switch (themeId) {
    case 'neo':
      return <NeoMatrixEffect />;
    case 'zombie':
      return <ZombieEffect />;
    case 'cyberpunk':
      return <CyberpunkScanlineEffect />;
    case 'gothic':
      return <GothicParticleEffect />;
    case 'blocks':
      return <BlocksPixelEffect />;
    case 'forest':
      return <ForestLeafEffect />;
    case 'watermelon':
      return <WatermelonSeedEffect />;
    case 'cartoon':
      return <CartoonDotEffect />;
    case 'mac':
      return <MacGlowEffect />;
    case 'pink':
      return <PinkSparkleEffect />;
    default:
      return null;
  }
}

const s = StyleSheet.create({
  neoColumn: {
    position: 'absolute',
    top: 0,
  },
  neoChar: {
    color: '#00ff41',
    fontSize: 11,
    fontWeight: 'bold',
    lineHeight: 15,
  },
});
