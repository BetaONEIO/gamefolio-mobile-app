import React, { useEffect, useRef, useMemo } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileThemeName } from '@/constants/themes';

// ─── NEO / MATRIX ─────────────────────────────────────────────────────────────
// Web-app reference: canvas matrix rain + vignette + sweeping scanline

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

  const scanlineAnim = useRef(new Animated.Value(0)).current;

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

  const scanlineY = scanlineAnim.interpolate({ inputRange: [0, 1], outputRange: [-4, 320] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Character rain */}
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

      {/* Sweeping scanline */}
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

      {/* Vignette — dark edges matching web app's radial-gradient vignette */}
      <LinearGradient
        colors={['rgba(0,0,0,0.65)', 'transparent']}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 70 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.65)']}
        style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 70 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['rgba(0,0,0,0.45)', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: 'absolute', top: 0, left: 0, bottom: 0, width: 45 }}
        pointerEvents="none"
      />
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.45)']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, width: 45 }}
        pointerEvents="none"
      />
    </View>
  );
}

// ─── ZOMBIE ───────────────────────────────────────────────────────────────────
// Web-app reference: 3 fog radial-gradient layers + green grid pulse + diagonal sweep beam

function ZombieEffect() {
  const fog1 = useRef(new Animated.Value(0)).current;
  const fog2 = useRef(new Animated.Value(0)).current;
  const fog3 = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;

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
        Animated.timing(sweepAnim, { toValue: 1, duration: 7000, useNativeDriver: true })
      ),
    ];
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);

  const f1TX = fog1.interpolate({ inputRange: [0, 1], outputRange: [0, 22] });
  const f1TY = fog1.interpolate({ inputRange: [0, 1], outputRange: [0, -15] });
  const f2TX = fog2.interpolate({ inputRange: [0, 1], outputRange: [0, -27] });
  const f2TY = fog2.interpolate({ inputRange: [0, 1], outputRange: [0, 18] });
  const f3TX = fog3.interpolate({ inputRange: [0, 1], outputRange: [0, 15] });
  const f3TY = fog3.interpolate({ inputRange: [0, 1], outputRange: [0, 20] });
  const sweepTX = sweepAnim.interpolate({ inputRange: [0, 1], outputRange: [-500, 500] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Fog layer 1 — dark green blobs (zombieFogDrift1: 28s in web) */}
      <Animated.View style={{ position: 'absolute', left: '5%', top: '25%', width: '70%', height: '50%', borderRadius: 999, backgroundColor: '#1a2e0a', opacity: 0.55, transform: [{ translateX: f1TX }, { translateY: f1TY }] }} />
      <Animated.View style={{ position: 'absolute', left: '60%', top: '58%', width: '45%', height: '52%', borderRadius: 999, backgroundColor: '#0d1a05', opacity: 0.47, transform: [{ translateX: f1TX }, { translateY: f1TY }] }} />
      <Animated.View style={{ position: 'absolute', left: '30%', top: '82%', width: '58%', height: '28%', borderRadius: 999, backgroundColor: '#9ae600', opacity: 0.07, transform: [{ translateX: f1TX }, { translateY: f1TY }] }} />

      {/* Fog layer 2 — (zombieFogDrift2: 35s in web) */}
      <Animated.View style={{ position: 'absolute', left: '54%', top: '5%', width: '52%', height: '62%', borderRadius: 999, backgroundColor: '#9ae600', opacity: 0.055, transform: [{ translateX: f2TX }, { translateY: f2TY }] }} />
      <Animated.View style={{ position: 'absolute', left: '-15%', top: '66%', width: '45%', height: '48%', borderRadius: 999, backgroundColor: '#1a2e0a', opacity: 0.40, transform: [{ translateX: f2TX }, { translateY: f2TY }] }} />
      <Animated.View style={{ position: 'absolute', left: '20%', top: '43%', width: '72%', height: '28%', borderRadius: 999, backgroundColor: '#0d1a05', opacity: 0.27, transform: [{ translateX: f2TX }, { translateY: f2TY }] }} />

      {/* Fog layer 3 — (zombieFogDrift3: 44s in web) */}
      <Animated.View style={{ position: 'absolute', left: '70%', top: '30%', width: '40%', height: '65%', borderRadius: 999, backgroundColor: '#9ae600', opacity: 0.04, transform: [{ translateX: f3TX }, { translateY: f3TY }] }} />
      <Animated.View style={{ position: 'absolute', left: '-5%', top: '50%', width: '63%', height: '36%', borderRadius: 999, backgroundColor: '#1a2e0a', opacity: 0.33, transform: [{ translateX: f3TX }, { translateY: f3TY }] }} />

      {/* Green grid pulse — zombie-bg-pulse */}
      <View style={[StyleSheet.absoluteFill, { opacity: 0.22 }]}>
        {Array.from({ length: 20 }).map((_, i) => (
          <View key={`h${i}`} style={{ position: 'absolute', left: 0, right: 0, top: i * 48, height: 1, backgroundColor: '#9ae600' }} />
        ))}
        {Array.from({ length: 12 }).map((_, i) => (
          <View key={`v${i}`} style={{ position: 'absolute', top: 0, bottom: 0, left: i * 48, width: 1, backgroundColor: '#9ae600' }} />
        ))}
      </View>

      {/* Diagonal green sweep beam — zombieMeshSweep */}
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        <View style={{ position: 'absolute', top: -300, left: -300, width: 1000, height: 1000, transform: [{ rotate: '20deg' }] }}>
          <Animated.View style={[StyleSheet.absoluteFillObject, { transform: [{ translateX: sweepTX }] }]}>
            <LinearGradient
              colors={[
                'transparent', 'transparent',
                'rgba(154,230,0,0.03)', 'rgba(154,230,0,0.33)', 'rgba(154,230,0,0.73)',
                'rgba(154,230,0,0.33)', 'rgba(154,230,0,0.03)',
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
    </View>
  );
}

// ─── CYBERPUNK ────────────────────────────────────────────────────────────────
// Web-app reference: pulsing diamond mesh + diagonal cyan→magenta scan sweep +
//                    static scanlines + sporadic RGB chromatic-aberration glitch

function CyberpunkEffect() {
  const meshAnim = useRef(new Animated.Value(0)).current;
  const sweepAnim = useRef(new Animated.Value(0)).current;
  const glitchAnim = useRef(new Animated.Value(0)).current;

  // Diamond mesh dots at 40px intervals (offset every other row for diamond pattern)
  const dots = useMemo(() => {
    const result: { left: number; top: number }[] = [];
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 10; col++) {
        result.push({
          left: col * 40 + (row % 2 === 1 ? 20 : 0),
          top: row * 40,
        });
      }
    }
    return result;
  }, []);

  useEffect(() => {
    // Mesh pulse: 0.18→0.32 opacity + 1.012 scale, 4s loop (cyberNodePulse in web)
    const meshLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(meshAnim, { toValue: 1, duration: 4000, useNativeDriver: true }),
        Animated.timing(meshAnim, { toValue: 0, duration: 4000, useNativeDriver: true }),
      ])
    );

    // Diagonal sweep: 9s linear loop (cyberScanSweep in web)
    const sweepLoop = Animated.loop(
      Animated.timing(sweepAnim, { toValue: 1, duration: 9000, useNativeDriver: true })
    );

    // RGB glitch: ~8s cycle — off for 6.2s, two quick bursts (cyberRGBR/B in web)
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

  const meshOpacity = meshAnim.interpolate({ inputRange: [0, 1], outputRange: [0.18, 0.32] });
  const meshScale = meshAnim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] });
  const sweepTX = sweepAnim.interpolate({ inputRange: [0, 1], outputRange: [-500, 500] });
  const glitchOpacity = glitchAnim.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 0.30, 0.45] });
  const redTX = glitchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 7] });
  const blueTX = glitchAnim.interpolate({ inputRange: [0, 1], outputRange: [0, -7] });

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">

      {/* ── Diamond mesh: dots + 45°/−45° crosshatch (cyber-bg-mesh) ── */}
      <Animated.View
        style={[StyleSheet.absoluteFill, { opacity: meshOpacity, transform: [{ scale: meshScale }] }]}
      >
        {/* Dot grid */}
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
        {/* 45° cyan diagonals */}
        {Array.from({ length: 13 }).map((_, i) => (
          <View key={`c${i}`} style={{ position: 'absolute', left: i * 40 - 20, top: -200, width: 1, height: 700, backgroundColor: '#00b8db', opacity: 0.10, transform: [{ rotate: '45deg' }] }} />
        ))}
        {/* −45° magenta diagonals */}
        {Array.from({ length: 13 }).map((_, i) => (
          <View key={`m${i}`} style={{ position: 'absolute', left: i * 40 - 20, top: -200, width: 1, height: 700, backgroundColor: '#e12afb', opacity: 0.07, transform: [{ rotate: '-45deg' }] }} />
        ))}
      </Animated.View>

      {/* ── Diagonal scan sweep: cyan → magenta beam (cyberScanSweep) ── */}
      <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]}>
        <View style={{ position: 'absolute', top: -300, left: -300, width: 1000, height: 1000, transform: [{ rotate: '15deg' }] }}>
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

      {/* ── Static horizontal scanlines (cyber-scanlines) ── */}
      <View style={[StyleSheet.absoluteFill, { opacity: 0.05 }]}>
        {Array.from({ length: 30 }).map((_, i) => (
          <View key={i} style={{ height: 1, borderBottomWidth: 0.5, borderBottomColor: '#000000', marginBottom: 5 }} />
        ))}
      </View>

      {/* ── RGB chromatic aberration — red channel (cyberRGBR) ── */}
      <Animated.View style={{ position: 'absolute', top: '15%', left: 0, right: 0, height: 1.5, backgroundColor: '#ff0044', opacity: glitchOpacity, transform: [{ translateX: redTX }] }} />
      <Animated.View style={{ position: 'absolute', top: '48%', left: 0, right: 0, height: 1.5, backgroundColor: '#ff0033', opacity: glitchOpacity, transform: [{ translateX: redTX }] }} />
      <Animated.View style={{ position: 'absolute', top: '72%', left: 0, right: 0, height: 1.5, backgroundColor: '#ff0055', opacity: glitchOpacity, transform: [{ translateX: redTX }] }} />

      {/* ── RGB chromatic aberration — blue channel (cyberRGBB) ── */}
      <Animated.View style={{ position: 'absolute', top: '15%', left: 0, right: 0, height: 1.5, backgroundColor: '#0055ff', opacity: glitchOpacity, transform: [{ translateX: blueTX }] }} />
      <Animated.View style={{ position: 'absolute', top: '48%', left: 0, right: 0, height: 1.5, backgroundColor: '#0033ff', opacity: glitchOpacity, transform: [{ translateX: blueTX }] }} />
      <Animated.View style={{ position: 'absolute', top: '72%', left: 0, right: 0, height: 1.5, backgroundColor: '#0077ff', opacity: glitchOpacity, transform: [{ translateX: blueTX }] }} />
    </View>
  );
}

// ─── GOTHIC ───────────────────────────────────────────────────────────────────
// Floating purple particles rising upward

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

// ─── BLOCKS / MINECRAFT ───────────────────────────────────────────────────────
// Rotating pixel blocks falling downward

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

// ─── FOREST ───────────────────────────────────────────────────────────────────
// Falling leaves with lateral drift

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

// ─── WATERMELON ───────────────────────────────────────────────────────────────
// Falling and spinning watermelon seeds

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

// ─── CARTOON ──────────────────────────────────────────────────────────────────
// Colourful dots that bob upward and scale

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

// ─── MAC ──────────────────────────────────────────────────────────────────────
// Soft blue glow orbs pulsing at corners

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

// ─── PINK ─────────────────────────────────────────────────────────────────────
// Pink sparkles rising with rotation and scale pop

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

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────

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

// ─── SHARED STYLES ────────────────────────────────────────────────────────────

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
