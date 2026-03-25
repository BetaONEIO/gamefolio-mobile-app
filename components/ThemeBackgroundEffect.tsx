import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Text, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Stop, Ellipse } from 'react-native-svg';

function NeoMatrixEffect() {
  const COL_W = 38;
  const MAX_COLS = 20;
  const chars = '01アイウエカキクケコサタナハマヤラワ'.split('');

  const cols = useMemo(() =>
    Array.from({ length: MAX_COLS }, (_, i) => {
      const anim = new Animated.Value(0);
      return {
        anim,
        translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-100, 1200] }),
        delay: i * 350,
        duration: 2200 + i * 200,
        chars: Array.from({ length: 9 }, () => chars[Math.floor(Math.random() * chars.length)]),
        left: i * COL_W + 6,
      };
    }),
    []
  );

  const scanlineAnim = useRef(new Animated.Value(0)).current;
  const scanlineY = useMemo(
    () => scanlineAnim.interpolate({ inputRange: [0, 1], outputRange: [-4, 900] }),
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

    const scanLoop = Animated.loop(
      Animated.timing(scanlineAnim, { toValue: 1, duration: 6000, useNativeDriver: true })
    );
    scanLoop.start();

    return () => {
      anims.forEach(a => a.stop());
      scanLoop.stop();
    };
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {cols.map((col, i) => (
        <Animated.View key={i} style={[s.neoColumn, { left: col.left, transform: [{ translateY: col.translateY }] }]}>
          {col.chars.map((ch, j) => (
            <Text key={j} style={[s.neoChar, { opacity: 1 - j * 0.1 }]}>{ch}</Text>
          ))}
        </Animated.View>
      ))}

      <Animated.View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 2,
          backgroundColor: '#00ff41',
          opacity: 0.15,
          transform: [{ translateY: scanlineY }],
        }}
      />

      <LinearGradient
        colors={['rgba(0,0,0,0.65)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 70, pointerEvents: 'none' }}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.65)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 70, pointerEvents: 'none' }}
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 45, pointerEvents: 'none' }}
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.45)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 45, pointerEvents: 'none' }}
      />
    </View>
  );
}

function ZombieFogBlob({
  cx, cy, rx, ry, color, opacity, anim, dX, dY,
}: {
  cx: number; cy: number; rx: number; ry: number;
  color: string; opacity: number;
  anim: Animated.Value; dX: number; dY: number;
}) {
  const id = useMemo(() => `zfog_${Math.random().toString(36).slice(2)}`, []);
  const tx = useMemo(() => anim.interpolate({ inputRange: [0, 1], outputRange: [0, dX] }), [anim, dX]);
  const ty = useMemo(() => anim.interpolate({ inputRange: [0, 1], outputRange: [0, dY] }), [anim, dY]);

  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: cx - rx,
        top: cy - ry,
        width: rx * 2,
        height: ry * 2,
        opacity,
        transform: [{ translateX: tx }, { translateY: ty }],
        pointerEvents: 'none',
      }}
    >
      <Svg width={rx * 2} height={ry * 2}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <Stop offset="0%" stopColor={color} stopOpacity="1" />
            <Stop offset="60%" stopColor={color} stopOpacity="0.5" />
            <Stop offset="100%" stopColor={color} stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Ellipse cx={rx} cy={ry} rx={rx} ry={ry} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

function ZombieEffect() {
  const { width: W, height: H } = useWindowDimensions();
  const fog1 = useRef(new Animated.Value(0)).current;
  const fog2 = useRef(new Animated.Value(0)).current;
  const fog3 = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const gridAnim = useRef(new Animated.Value(0)).current;

  const sweepRange = W + 600;

  useEffect(() => {
    const loops = [
      Animated.loop(Animated.sequence([
        Animated.timing(fog1, { toValue: 1, duration: 14000, useNativeDriver: true }),
        Animated.timing(fog1, { toValue: 0, duration: 14000, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(fog2, { toValue: 1, duration: 17500, useNativeDriver: true }),
        Animated.timing(fog2, { toValue: 0, duration: 17500, useNativeDriver: true }),
      ])),
      Animated.loop(Animated.sequence([
        Animated.timing(fog3, { toValue: 1, duration: 22000, useNativeDriver: true }),
        Animated.timing(fog3, { toValue: 0, duration: 22000, useNativeDriver: true }),
      ])),
      Animated.loop(
        Animated.sequence([
          Animated.timing(sweepAnim, { toValue: 1, duration: 5500, useNativeDriver: true }),
          Animated.timing(sweepAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay(2500),
        ])
      ),
      Animated.loop(Animated.sequence([
        Animated.timing(gridAnim, { toValue: 1, duration: 3500, useNativeDriver: true }),
        Animated.timing(gridAnim, { toValue: 0, duration: 3500, useNativeDriver: true }),
      ])),
    ];
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  const sweepTX = useMemo(
    () => sweepAnim.interpolate({ inputRange: [0, 1], outputRange: [-sweepRange, sweepRange] }),
    [sweepAnim, sweepRange]
  );
  const gridOpacity = useMemo(
    () => gridAnim.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0.85] }),
    [gridAnim]
  );
  const gridRows = Math.ceil(H / 48) + 1;
  const gridCols = Math.ceil(W / 48) + 1;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <ZombieFogBlob cx={W * 0.38} cy={H * 0.48} rx={W * 0.50} ry={H * 0.35} color="#1a4008" opacity={0.90} anim={fog1} dX={22} dY={-15} />
      <ZombieFogBlob cx={W * 0.78} cy={H * 0.72} rx={W * 0.36} ry={H * 0.26} color="#0d2505" opacity={0.80} anim={fog1} dX={22} dY={-15} />
      <ZombieFogBlob cx={W * 0.55} cy={H * 0.90} rx={W * 0.38} ry={H * 0.14} color="#9ae600" opacity={0.40} anim={fog1} dX={22} dY={-15} />

      <ZombieFogBlob cx={W * 0.78} cy={H * 0.36} rx={W * 0.40} ry={H * 0.32} color="#9ae600" opacity={0.30} anim={fog2} dX={-27} dY={18} />
      <ZombieFogBlob cx={W * 0.10} cy={H * 0.80} rx={W * 0.36} ry={H * 0.24} color="#1a4008" opacity={0.75} anim={fog2} dX={-27} dY={18} />
      <ZombieFogBlob cx={W * 0.50} cy={H * 0.55} rx={W * 0.48} ry={H * 0.16} color="#0d2505" opacity={0.60} anim={fog2} dX={-27} dY={18} />

      <ZombieFogBlob cx={W * 0.85} cy={H * 0.55} rx={W * 0.32} ry={H * 0.32} color="#9ae600" opacity={0.25} anim={fog3} dX={15} dY={20} />
      <ZombieFogBlob cx={W * 0.22} cy={H * 0.65} rx={W * 0.42} ry={H * 0.20} color="#1a4008" opacity={0.65} anim={fog3} dX={15} dY={20} />

      <Animated.View style={[StyleSheet.absoluteFill, { opacity: gridOpacity }]}>
        {Array.from({ length: gridRows }).map((_, i) => (
          <View key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: i * 48, height: 1.5, backgroundColor: '#9ae600' }} />
        ))}
        {Array.from({ length: gridCols }).map((_, i) => (
          <View key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: i * 48, width: 1.5, backgroundColor: '#9ae600' }} />
        ))}
      </Animated.View>

      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        <View style={{ position: 'absolute', top: -H, left: -W, width: W * 3, height: H * 3, transform: [{ rotate: '20deg' }] }}>
          <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: sweepTX }] }]}>
            <LinearGradient
              colors={[
                'transparent', 'transparent',
                'rgba(154,230,0,0.05)', 'rgba(154,230,0,0.45)', 'rgba(154,230,0,0.90)',
                'rgba(154,230,0,0.45)', 'rgba(154,230,0,0.05)',
                'transparent', 'transparent',
              ]}
              locations={[0, 0.40, 0.45, 0.48, 0.50, 0.52, 0.55, 0.60, 1.0]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
        </View>
      </View>

      <LinearGradient
        colors={['rgba(13,26,10,0.85)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 100, pointerEvents: 'none' }}
      />
      <LinearGradient
        colors={['transparent', 'rgba(13,26,10,0.85)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 100, pointerEvents: 'none' }}
      />
      <LinearGradient
        colors={['rgba(13,26,10,0.65)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 55, pointerEvents: 'none' }}
      />
      <LinearGradient
        colors={['transparent', 'rgba(13,26,10,0.65)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 55, pointerEvents: 'none' }}
      />
    </View>
  );
}

function CyberpunkEffect() {
  const { width: W, height: H } = useWindowDimensions();
  const meshAnim = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const glitchAnim = useRef(new Animated.Value(0)).current;

  const GRID = 40;
  const dots = useMemo(() => {
    const result: { left: number; top: number }[] = [];
    const cols = Math.ceil(W / GRID) + 2;
    const rows = Math.ceil(H / GRID) + 2;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        result.push({
          left: col * GRID + (row % 2 === 1 ? GRID / 2 : 0) - GRID,
          top: row * GRID - GRID,
        });
      }
    }
    return result;
  }, [W, H]);

  useEffect(() => {
    const meshLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(meshAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(meshAnim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    );

    const sweepLoop = Animated.loop(
      Animated.timing(sweepAnim, { toValue: 1, duration: 9000, useNativeDriver: true })
    );

    const glitchLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(glitchAnim, { toValue: 0, duration: 6200, useNativeDriver: true }),
        Animated.timing(glitchAnim, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(glitchAnim, { toValue: 0.6, duration: 60, useNativeDriver: true }),
        Animated.timing(glitchAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        Animated.timing(glitchAnim, { toValue: 0, duration: 620, useNativeDriver: true }),
        Animated.timing(glitchAnim, { toValue: 0.7, duration: 60, useNativeDriver: true }),
        Animated.timing(glitchAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
        Animated.timing(glitchAnim, { toValue: 0, duration: 640, useNativeDriver: true }),
      ])
    );

    meshLoop.start();
    sweepLoop.start();
    glitchLoop.start();

    return () => {
      meshLoop.stop();
      sweepLoop.stop();
      glitchLoop.stop();
    };
  }, []);

  const meshOpacity = useMemo(
    () => meshAnim.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.70] }),
    [meshAnim]
  );
  const meshScale = useMemo(
    () => meshAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }),
    [meshAnim]
  );
  const sweepTX = useMemo(
    () => sweepAnim.interpolate({ inputRange: [0, 1], outputRange: [-W * 1.5, W * 1.5] }),
    [sweepAnim, W]
  );
  const glitchOpacity = useMemo(
    () => glitchAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.30, 0.45] }),
    [glitchAnim]
  );
  const redTX = useMemo(
    () => glitchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 7] }),
    [glitchAnim]
  );
  const blueTX = useMemo(
    () => glitchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -7] }),
    [glitchAnim]
  );

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">

      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: meshOpacity, transform: [{ scale: meshScale }] }]}
      >
        {dots.map((d, i) => (
          <View
            key={i}
            style={{
              position: 'absolute',
              left: d.left - 1.5,
              top: d.top - 1.5,
              width: 3,
              height: 3,
              borderRadius: 1.5,
              backgroundColor: '#00d3f2',
            }}
          />
        ))}
        {Array.from({ length: Math.ceil(W / GRID) + 4 }).map((_, i) => (
          <View key={`c${i}`} style={{ position: 'absolute', left: i * GRID - GRID, top: -H, width: 1, height: H * 3, backgroundColor: '#00b8db', opacity: 0.25, transform: [{ rotate: '45deg' }] }} />
        ))}
        {Array.from({ length: Math.ceil(W / GRID) + 4 }).map((_, i) => (
          <View key={`m${i}`} style={{ position: 'absolute', left: i * GRID - GRID, top: -H, width: 1, height: H * 3, backgroundColor: '#e12afb', opacity: 0.18, transform: [{ rotate: '-45deg' }] }} />
        ))}
      </Animated.View>

      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        <View style={{ position: 'absolute', top: -H, left: -W, width: W * 3, height: H * 3, transform: [{ rotate: '15deg' }] }}>
          <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: sweepTX }] }]}>
            <LinearGradient
              colors={[
                'transparent', 'transparent',
                'rgba(0,211,242,0.02)', 'rgba(0,211,242,0.33)', 'rgba(225,42,251,0.80)',
                'rgba(0,211,242,0.33)', 'rgba(0,211,242,0.02)',
                'transparent', 'transparent',
              ]}
              locations={[0, 0.42, 0.45, 0.48, 0.50, 0.52, 0.55, 0.58, 1.0]}
              start={{ x: 0, y: 0.5 }}
              end={{ x: 1, y: 0.5 }}
              style={StyleSheet.absoluteFillObject}
            />
          </Animated.View>
        </View>
      </View>

      <View style={[StyleSheet.absoluteFill, { opacity: 0.12 }]}>
        {Array.from({ length: Math.ceil(H / 6) }).map((_, i) => (
          <View key={i} style={{ height: 1, borderBottomWidth: 0.5, borderBottomColor: '#000000', marginBottom: 5 }} />
        ))}
      </View>

      <Animated.View style={{ position: 'absolute', top: '15%', left: 0, right: 0, height: 1.5, backgroundColor: '#ff0044', opacity: glitchOpacity, transform: [{ translateX: redTX }] }} />
      <Animated.View style={{ position: 'absolute', top: '48%', left: 0, right: 0, height: 1.5, backgroundColor: '#ff0033', opacity: glitchOpacity, transform: [{ translateX: redTX }] }} />
      <Animated.View style={{ position: 'absolute', top: '72%', left: 0, right: 0, height: 1.5, backgroundColor: '#ff0055', opacity: glitchOpacity, transform: [{ translateX: redTX }] }} />
      <Animated.View style={{ position: 'absolute', top: '15%', left: 0, right: 0, height: 1.5, backgroundColor: '#0055ff', opacity: glitchOpacity, transform: [{ translateX: blueTX }] }} />
      <Animated.View style={{ position: 'absolute', top: '48%', left: 0, right: 0, height: 1.5, backgroundColor: '#0033ff', opacity: glitchOpacity, transform: [{ translateX: blueTX }] }} />
      <Animated.View style={{ position: 'absolute', top: '72%', left: 0, right: 0, height: 1.5, backgroundColor: '#0077ff', opacity: glitchOpacity, transform: [{ translateX: blueTX }] }} />
    </View>
  );
}

function GothicParticle({ anim, left, size }: { anim: Animated.Value; left: number; size: number }) {
  const translateY = useMemo(() => anim.interpolate({ inputRange: [0, 1], outputRange: [220, -20] }), [anim]);
  const opacity = useMemo(() => anim.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 0.6, 0.5, 0] }), [anim]);
  const scale = useMemo(() => anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1, 0.7] }), [anim]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#c27aff',
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    />
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
      {particles.map((p, i) => (
        <GothicParticle key={i} anim={p.anim} left={p.left} size={p.size} />
      ))}
    </View>
  );
}

function BlocksBlock({ anim, left, size, color }: { anim: Animated.Value; left: number; size: number; color: string }) {
  const translateY = useMemo(() => anim.interpolate({ inputRange: [0, 1], outputRange: [-20, 230] }), [anim]);
  const opacity = useMemo(() => anim.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 0.5, 0.4, 0] }), [anim]);
  const rotate = useMemo(() => anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }), [anim]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        width: size,
        height: size,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { rotate }],
      }}
    />
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
      {blocks.map((b, i) => (
        <BlocksBlock key={i} anim={b.anim} left={b.left} size={b.size} color={b.color} />
      ))}
    </View>
  );
}

function ForestLeaf({ anim, startX, driftX }: { anim: Animated.Value; startX: number; driftX: number }) {
  const translateY = useMemo(() => anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 230] }), [anim]);
  const translateX = useMemo(() => anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, driftX, driftX * 0.5] }), [anim, driftX]);
  const opacity = useMemo(() => anim.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 0.55, 0.45, 0] }), [anim]);
  const rotate = useMemo(() => anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }), [anim]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left: startX,
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
      {leaves.map((l, i) => (
        <ForestLeaf key={i} anim={l.anim} startX={l.startX} driftX={l.driftX} />
      ))}
    </View>
  );
}

function WatermelonSeed({ anim, left }: { anim: Animated.Value; left: number }) {
  const translateY = useMemo(() => anim.interpolate({ inputRange: [0, 1], outputRange: [-10, 240] }), [anim]);
  const rotate = useMemo(() => anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }), [anim]);
  const opacity = useMemo(() => anim.interpolate({ inputRange: [0, 0.1, 0.8, 1], outputRange: [0, 0.6, 0.5, 0] }), [anim]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        width: 5,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#0d1a12',
        opacity,
        transform: [{ translateY }, { rotate }],
      }}
    />
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
      {seeds.map((s, i) => (
        <WatermelonSeed key={i} anim={s.anim} left={s.left} />
      ))}
    </View>
  );
}

function CartoonDot({ anim, left, size, color }: { anim: Animated.Value; left: number; size: number; color: string }) {
  const translateY = useMemo(() => anim.interpolate({ inputRange: [0, 1], outputRange: [230, -10] }), [anim]);
  const opacity = useMemo(() => anim.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 0.5, 0.45, 0] }), [anim]);
  const scale = useMemo(() => anim.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.5, 1.2, 0.8] }), [anim]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
        opacity,
        transform: [{ translateY }, { scale }],
      }}
    />
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
      {dots.map((d, i) => (
        <CartoonDot key={i} anim={d.anim} left={d.left} size={d.size} color={d.color} />
      ))}
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

  const opacity = glowAnim.interpolate({ inputRange: [0, 1], outputRange: [0.04, 0.10] });
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

function PinkSparkle({ anim, left, size }: { anim: Animated.Value; left: number; size: number }) {
  const translateY = useMemo(() => anim.interpolate({ inputRange: [0, 1], outputRange: [230, -10] }), [anim]);
  const opacity = useMemo(() => anim.interpolate({ inputRange: [0, 0.1, 0.7, 1], outputRange: [0, 0.8, 0.7, 0] }), [anim]);
  const scale = useMemo(() => anim.interpolate({ inputRange: [0, 0.4, 0.8, 1], outputRange: [0, 1.2, 0.9, 0] }), [anim]);
  const rotate = useMemo(() => anim.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }), [anim]);
  return (
    <Animated.View
      style={{
        position: 'absolute',
        left,
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: '#ff2056',
        opacity,
        transform: [{ translateY }, { scale }, { rotate }],
      }}
    />
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
      {sparkles.map((sp, i) => (
        <PinkSparkle key={i} anim={sp.anim} left={sp.left} size={sp.size} />
      ))}
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
      return <CyberpunkEffect />;
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
