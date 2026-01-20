import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Text } from 'react-native';

const TETRIS_SHAPES = [
  [[1, 1, 1, 1]],
  [[1, 1], [1, 1]],
  [[1, 1, 1], [0, 1, 0]],
  [[1, 1, 1], [1, 0, 0]],
  [[1, 1, 1], [0, 0, 1]],
  [[1, 1, 0], [0, 1, 1]],
  [[0, 1, 1], [1, 1, 0]],
];

const TETRIS_COLORS = ['#00F0F0', '#F0F000', '#A000F0', '#0000F0', '#F0A000', '#00F000', '#F00000'];

export function TetrisTheme() {
  const animValues = useRef(
    Array.from({ length: 4 }, () => ({
      y: new Animated.Value(-100),
      rotation: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    const animations = animValues.map((anim, index) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(index * 800),
          Animated.parallel([
            Animated.timing(anim.y, {
              toValue: 150,
              duration: 3000,
              useNativeDriver: true,
            }),
            Animated.timing(anim.rotation, {
              toValue: 1,
              duration: 3000,
              useNativeDriver: true,
            }),
          ]),
          Animated.timing(anim.y, {
            toValue: -100,
            duration: 0,
            useNativeDriver: true,
          }),
          Animated.timing(anim.rotation, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    });

    animations.forEach(anim => anim.start());

    return () => {
      animations.forEach(anim => anim.stop());
    };
  }, [animValues]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a1a2e' }]}>
      {animValues.map((anim, index) => {
        const shapeIndex = index % TETRIS_SHAPES.length;
        const colorIndex = index % TETRIS_COLORS.length;
        const rotate = anim.rotation.interpolate({
          inputRange: [0, 1],
          outputRange: ['0deg', '360deg'],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.tetrisPiece,
              {
                left: 10 + index * 25,
                transform: [{ translateY: anim.y }, { rotate }],
              },
            ]}
          >
            {TETRIS_SHAPES[shapeIndex].map((row, rowIndex) => (
              <View key={rowIndex} style={styles.tetrisRow}>
                {row.map((cell, cellIndex) => (
                  <View
                    key={cellIndex}
                    style={[
                      styles.tetrisCell,
                      {
                        backgroundColor: cell ? TETRIS_COLORS[colorIndex] : 'transparent',
                        borderColor: cell ? '#000' : 'transparent',
                      },
                    ]}
                  />
                ))}
              </View>
            ))}
          </Animated.View>
        );
      })}
    </View>
  );
}

export function PacmanTheme() {
  const pacmanX = useRef(new Animated.Value(-30)).current;
  const mouthAnim = useRef(new Animated.Value(0)).current;
  const ghostX = useRef(new Animated.Value(-80)).current;

  useEffect(() => {
    const pacmanAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(pacmanX, {
          toValue: 150,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(pacmanX, {
          toValue: -30,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    const mouthAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(mouthAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(mouthAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
      ])
    );

    const ghostAnimation = Animated.loop(
      Animated.sequence([
        Animated.delay(500),
        Animated.timing(ghostX, {
          toValue: 150,
          duration: 4000,
          useNativeDriver: true,
        }),
        Animated.timing(ghostX, {
          toValue: -80,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    pacmanAnimation.start();
    mouthAnimation.start();
    ghostAnimation.start();

    return () => {
      pacmanAnimation.stop();
      mouthAnimation.stop();
      ghostAnimation.stop();
    };
  }, [pacmanX, mouthAnim, ghostX]);

  const mouthRotation = mouthAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '20deg'],
  });

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
      <View style={styles.pacmanDots}>
        {Array.from({ length: 10 }).map((_, i) => (
          <View key={i} style={styles.dot} />
        ))}
      </View>

      <Animated.View
        style={[
          styles.pacman,
          {
            transform: [{ translateX: pacmanX }],
          },
        ]}
      >
        <View style={styles.pacmanBody}>
          <Animated.View
            style={[
              styles.pacmanMouth,
              {
                transform: [{ rotate: mouthRotation }],
              },
            ]}
          />
        </View>
      </Animated.View>

      <Animated.View
        style={[
          styles.ghost,
          {
            transform: [{ translateX: ghostX }],
          },
        ]}
      >
        <View style={[styles.ghostBody, { backgroundColor: '#FF0000' }]}>
          <View style={styles.ghostEyes}>
            <View style={styles.eye} />
            <View style={styles.eye} />
          </View>
        </View>
      </Animated.View>
    </View>
  );
}

export function MatrixTheme() {
  const columns = 8;
  const animValues = useRef(
    Array.from({ length: columns }, () => new Animated.Value(0))
  ).current;

  useEffect(() => {
    const animations = animValues.map((anim, index) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(index * 300),
          Animated.timing(anim, {
            toValue: 1,
            duration: 3000,
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: 0,
            duration: 0,
            useNativeDriver: true,
          }),
        ])
      );
    });

    animations.forEach(anim => anim.start());

    return () => {
      animations.forEach(anim => anim.stop());
    };
  }, [animValues]);

  const MATRIX_CHARS = '01アイウエオカキクケコ';

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
      {animValues.map((anim, index) => {
        const translateY = anim.interpolate({
          inputRange: [0, 1],
          outputRange: [-100, 150],
        });

        return (
          <Animated.View
            key={index}
            style={[
              styles.matrixColumn,
              {
                left: index * 14,
                transform: [{ translateY }],
              },
            ]}
          >
            {Array.from({ length: 10 }).map((_, charIndex) => (
              <Text
                key={charIndex}
                style={[
                  styles.matrixChar,
                  {
                    opacity: 1 - charIndex * 0.1,
                  },
                ]}
              >
                {MATRIX_CHARS[Math.floor(Math.random() * MATRIX_CHARS.length)]}
              </Text>
            ))}
          </Animated.View>
        );
      })}
    </View>
  );
}

export function RetroArcadeTheme() {
  const pixelAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pixelAnimation = Animated.loop(
      Animated.timing(pixelAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: false,
      })
    );

    const glowAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: false,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: false,
        }),
      ])
    );

    pixelAnimation.start();
    glowAnimation.start();

    return () => {
      pixelAnimation.stop();
      glowAnimation.stop();
    };
  }, [pixelAnim, glowAnim]);

  const backgroundColor = pixelAnim.interpolate({
    inputRange: [0, 0.33, 0.66, 1],
    outputRange: ['#FF00FF', '#00FFFF', '#FFFF00', '#FF00FF'],
  });

  const glowOpacity = glowAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 1],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor }]}>
      <View style={styles.arcadeGrid}>
        {Array.from({ length: 48 }).map((_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.arcadePixel,
              {
                opacity: glowOpacity,
                backgroundColor: index % 3 === 0 ? '#FFF' : 'transparent',
              },
            ]}
          />
        ))}
      </View>
      <View style={styles.scanlines} />
    </Animated.View>
  );
}

export function SpaceInvadersTheme() {
  const invaderY = useRef(new Animated.Value(0)).current;
  const bulletY = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    const invaderAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(invaderY, {
          toValue: 20,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(invaderY, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    const bulletAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(bulletY, {
          toValue: -50,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(bulletY, {
          toValue: 100,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    );

    invaderAnimation.start();
    bulletAnimation.start();

    return () => {
      invaderAnimation.stop();
      bulletAnimation.stop();
    };
  }, [invaderY, bulletY]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
      <View style={styles.invadersContainer}>
        {Array.from({ length: 5 }).map((_, index) => (
          <Animated.View
            key={index}
            style={[
              styles.invader,
              {
                left: 10 + index * 20,
                transform: [{ translateY: invaderY }],
              },
            ]}
          >
            <View style={styles.invaderBody}>
              <View style={styles.invaderRow}>
                <View style={styles.invaderPixel} />
                <View style={styles.invaderPixel} />
              </View>
              <View style={styles.invaderRow}>
                <View style={styles.invaderPixel} />
                <View style={styles.invaderPixel} />
              </View>
            </View>
          </Animated.View>
        ))}
      </View>

      <Animated.View
        style={[
          styles.bullet,
          {
            transform: [{ translateY: bulletY }],
          },
        ]}
      />
    </View>
  );
}

export function PixelStarsTheme() {
  const starAnims = useRef(
    Array.from({ length: 20 }, () => ({
      opacity: new Animated.Value(0),
      scale: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    const animations = starAnims.map((anim, index) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(index * 200),
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(anim.scale, {
              toValue: 1,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(anim.opacity, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
            Animated.timing(anim.scale, {
              toValue: 0,
              duration: 1000,
              useNativeDriver: true,
            }),
          ]),
        ])
      );
    });

    animations.forEach(anim => anim.start());

    return () => {
      animations.forEach(anim => anim.stop());
    };
  }, [starAnims]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0a1a' }]}>
      {starAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.pixelStar,
            {
              left: (index * 37) % 100,
              top: (index * 23) % 100,
              opacity: anim.opacity,
              transform: [{ scale: anim.scale }],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function NeonCityTheme() {
  const neonAnim = useRef(new Animated.Value(0)).current;
  const buildingAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const neonAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(neonAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: false,
        }),
        Animated.timing(neonAnim, {
          toValue: 0,
          duration: 800,
          useNativeDriver: false,
        }),
      ])
    );

    const buildingAnimation = Animated.loop(
      Animated.timing(buildingAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );

    neonAnimation.start();
    buildingAnimation.start();

    return () => {
      neonAnimation.stop();
      buildingAnimation.stop();
    };
  }, [neonAnim, buildingAnim]);

  const neonColor = neonAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ['#FF00FF', '#00FFFF', '#FF00FF'],
  });

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0015' }]}>
      <View style={styles.cityContainer}>
        {Array.from({ length: 6 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.building,
              {
                height: 40 + (index % 3) * 20,
                width: 15,
                marginHorizontal: 2,
              },
            ]}
          >
            <Animated.View
              style={[
                styles.buildingWindow,
                { backgroundColor: neonColor },
              ]}
            />
          </View>
        ))}
      </View>
    </View>
  );
}

export function SnakeTheme() {
  const snakeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(snakeAnim, {
        toValue: 1,
        duration: 3000,
        useNativeDriver: true,
      })
    );

    animation.start();

    return () => {
      animation.stop();
    };
  }, [snakeAnim]);

  const translateX = snakeAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, 50, 50, 0, 0],
  });

  const translateY = snakeAnim.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [0, 0, 50, 50, 0],
  });

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#1a3a1a' }]}>
      <View style={styles.snakeGrid}>
        <Animated.View
          style={[
            styles.snakeBody,
            {
              transform: [{ translateX }, { translateY }],
            },
          ]}
        >
          {Array.from({ length: 5 }).map((_, index) => (
            <View
              key={index}
              style={[
                styles.snakeSegment,
                { left: -index * 12 },
              ]}
            />
          ))}
        </Animated.View>
        <View style={styles.snakeFood} />
      </View>
    </View>
  );
}

export function BreakoutTheme() {
  const ballY = useRef(new Animated.Value(0)).current;
  const ballX = useRef(new Animated.Value(0)).current;
  const paddleX = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ballAnimationY = Animated.loop(
      Animated.sequence([
        Animated.timing(ballY, {
          toValue: 60,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(ballY, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    const ballAnimationX = Animated.loop(
      Animated.sequence([
        Animated.timing(ballX, {
          toValue: 40,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(ballX, {
          toValue: -40,
          duration: 1600,
          useNativeDriver: true,
        }),
        Animated.timing(ballX, {
          toValue: 0,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );

    const paddleAnimation = Animated.loop(
      Animated.sequence([
        Animated.timing(paddleX, {
          toValue: 30,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(paddleX, {
          toValue: -30,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(paddleX, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    ballAnimationY.start();
    ballAnimationX.start();
    paddleAnimation.start();

    return () => {
      ballAnimationY.stop();
      ballAnimationX.stop();
      paddleAnimation.stop();
    };
  }, [ballY, ballX, paddleX]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
      <View style={styles.breakoutBricks}>
        {Array.from({ length: 12 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.brick,
              {
                backgroundColor: ['#FF0000', '#FF7700', '#FFFF00', '#00FF00'][
                  Math.floor(index / 3) % 4
                ],
              },
            ]}
          />
        ))}
      </View>
      <Animated.View
        style={[
          styles.ball,
          {
            transform: [{ translateX: ballX }, { translateY: ballY }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.paddle,
          {
            transform: [{ translateX: paddleX }],
          },
        ]}
      />
    </View>
  );
}

export function GalaxianTheme() {
  const enemyAnims = useRef(
    Array.from({ length: 6 }, () => ({
      x: new Animated.Value(0),
      y: new Animated.Value(0),
    }))
  ).current;

  useEffect(() => {
    const animations = enemyAnims.map((anim, index) => {
      return Animated.loop(
        Animated.sequence([
          Animated.delay(index * 400),
          Animated.parallel([
            Animated.sequence([
              Animated.timing(anim.x, {
                toValue: 30,
                duration: 800,
                useNativeDriver: true,
              }),
              Animated.timing(anim.x, {
                toValue: -30,
                duration: 1600,
                useNativeDriver: true,
              }),
              Animated.timing(anim.x, {
                toValue: 0,
                duration: 800,
                useNativeDriver: true,
              }),
            ]),
            Animated.sequence([
              Animated.timing(anim.y, {
                toValue: 20,
                duration: 1600,
                useNativeDriver: true,
              }),
              Animated.timing(anim.y, {
                toValue: 0,
                duration: 1600,
                useNativeDriver: true,
              }),
            ]),
          ]),
        ])
      );
    });

    animations.forEach(anim => anim.start());

    return () => {
      animations.forEach(anim => anim.stop());
    };
  }, [enemyAnims]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
      <View style={styles.starsBackground}>
        {Array.from({ length: 15 }).map((_, index) => (
          <View
            key={index}
            style={[
              styles.miniStar,
              {
                left: (index * 27) % 100,
                top: (index * 19) % 100,
              },
            ]}
          />
        ))}
      </View>
      {enemyAnims.map((anim, index) => (
        <Animated.View
          key={index}
          style={[
            styles.enemy,
            {
              left: 10 + (index % 3) * 30,
              top: 10 + Math.floor(index / 3) * 20,
              transform: [{ translateX: anim.x }, { translateY: anim.y }],
            },
          ]}
        />
      ))}
    </View>
  );
}

export function CyberpunkGridTheme() {
  const gridAnim = useRef(new Animated.Value(0)).current;
  const scanlineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const gridAnimation = Animated.loop(
      Animated.timing(gridAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    );

    const scanlineAnimation = Animated.loop(
      Animated.timing(scanlineAnim, {
        toValue: 1,
        duration: 1500,
        useNativeDriver: true,
      })
    );

    gridAnimation.start();
    scanlineAnimation.start();

    return () => {
      gridAnimation.stop();
      scanlineAnimation.stop();
    };
  }, [gridAnim, scanlineAnim]);

  const gridY = gridAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 20],
  });

  const scanlineY = scanlineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 100],
  });

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0a0015' }]}>
      <Animated.View
        style={[
          styles.cyberpunkGrid,
          {
            transform: [{ translateY: gridY }],
          },
        ]}
      >
        {Array.from({ length: 10 }).map((_, index) => (
          <View key={index} style={styles.gridLine} />
        ))}
      </Animated.View>
      <Animated.View
        style={[
          styles.scanline,
          {
            transform: [{ translateY: scanlineY }],
          },
        ]}
      />
    </View>
  );
}

export function PongTheme() {
  const ballX = useRef(new Animated.Value(0)).current;
  const ballY = useRef(new Animated.Value(0)).current;
  const paddle1Y = useRef(new Animated.Value(0)).current;
  const paddle2Y = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const ballAnimX = Animated.loop(
      Animated.sequence([
        Animated.timing(ballX, {
          toValue: 80,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(ballX, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    );

    const ballAnimY = Animated.loop(
      Animated.sequence([
        Animated.timing(ballY, {
          toValue: 40,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(ballY, {
          toValue: -40,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(ballY, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );

    const paddle1Anim = Animated.loop(
      Animated.sequence([
        Animated.timing(paddle1Y, {
          toValue: 30,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(paddle1Y, {
          toValue: -30,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    const paddle2Anim = Animated.loop(
      Animated.sequence([
        Animated.timing(paddle2Y, {
          toValue: -30,
          duration: 1200,
          useNativeDriver: true,
        }),
        Animated.timing(paddle2Y, {
          toValue: 30,
          duration: 1200,
          useNativeDriver: true,
        }),
      ])
    );

    ballAnimX.start();
    ballAnimY.start();
    paddle1Anim.start();
    paddle2Anim.start();

    return () => {
      ballAnimX.stop();
      ballAnimY.stop();
      paddle1Anim.stop();
      paddle2Anim.stop();
    };
  }, [ballX, ballY, paddle1Y, paddle2Y]);

  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }]}>
      <View style={styles.pongCenter} />
      <Animated.View
        style={[
          styles.pongPaddle,
          { left: 5, transform: [{ translateY: paddle1Y }] },
        ]}
      />
      <Animated.View
        style={[
          styles.pongPaddle,
          { right: 5, transform: [{ translateY: paddle2Y }] },
        ]}
      />
      <Animated.View
        style={[
          styles.pongBall,
          {
            transform: [{ translateX: ballX }, { translateY: ballY }],
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  tetrisPiece: {
    position: 'absolute',
    top: -50,
  },
  tetrisRow: {
    flexDirection: 'row',
  },
  tetrisCell: {
    width: 8,
    height: 8,
    borderWidth: 1,
  },
  pacmanDots: {
    position: 'absolute',
    top: '50%',
    left: 10,
    right: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFF',
  },
  pacman: {
    position: 'absolute',
    top: '45%',
  },
  pacmanBody: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFF00',
    overflow: 'hidden',
  },
  pacmanMouth: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 0,
    height: 0,
    borderLeftWidth: 10,
    borderBottomWidth: 10,
    borderLeftColor: 'transparent',
    borderBottomColor: '#000',
  },
  ghost: {
    position: 'absolute',
    top: '45%',
  },
  ghostBody: {
    width: 18,
    height: 22,
    borderTopLeftRadius: 9,
    borderTopRightRadius: 9,
  },
  ghostEyes: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 5,
    paddingHorizontal: 3,
  },
  eye: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#FFF',
  },
  matrixColumn: {
    position: 'absolute',
    top: 0,
  },
  matrixChar: {
    color: '#00FF00',
    fontSize: 10,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  arcadeGrid: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  arcadePixel: {
    width: '12.5%',
    aspectRatio: 1,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  scanlines: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'transparent',
  },
  invadersContainer: {
    position: 'relative',
    height: '100%',
  },
  invader: {
    position: 'absolute',
    top: 20,
  },
  invaderBody: {
    width: 16,
    height: 14,
  },
  invaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 2,
  },
  invaderPixel: {
    width: 6,
    height: 6,
    backgroundColor: '#00FF00',
  },
  bullet: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    width: 3,
    height: 8,
    backgroundColor: '#FFFF00',
  },
  pixelStar: {
    position: 'absolute',
    width: 6,
    height: 6,
    backgroundColor: '#FFF',
  },
  cityContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  building: {
    backgroundColor: '#1a1a2e',
    borderWidth: 1,
    borderColor: '#FF00FF',
  },
  buildingWindow: {
    width: 6,
    height: 6,
    margin: 2,
  },
  snakeGrid: {
    flex: 1,
    position: 'relative',
    padding: 20,
  },
  snakeBody: {
    position: 'absolute',
    top: 30,
    left: 30,
  },
  snakeSegment: {
    position: 'absolute',
    width: 10,
    height: 10,
    backgroundColor: '#00FF00',
  },
  snakeFood: {
    position: 'absolute',
    top: 60,
    right: 30,
    width: 8,
    height: 8,
    backgroundColor: '#FF0000',
  },
  breakoutBricks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: 10,
  },
  brick: {
    width: '23%',
    height: 10,
    margin: '1%',
  },
  ball: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFF',
  },
  paddle: {
    position: 'absolute',
    bottom: 20,
    left: '50%',
    width: 30,
    height: 6,
    backgroundColor: '#FFF',
    marginLeft: -15,
  },
  starsBackground: {
    ...StyleSheet.absoluteFillObject,
  },
  miniStar: {
    position: 'absolute',
    width: 2,
    height: 2,
    backgroundColor: '#FFF',
  },
  enemy: {
    position: 'absolute',
    width: 14,
    height: 14,
    backgroundColor: '#FF0000',
    borderRadius: 3,
  },
  cyberpunkGrid: {
    flex: 1,
    justifyContent: 'space-around',
  },
  gridLine: {
    height: 1,
    backgroundColor: '#00FFFF',
    opacity: 0.3,
  },
  scanline: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#FF00FF',
    opacity: 0.5,
  },
  pongCenter: {
    position: 'absolute',
    left: '50%',
    top: 0,
    bottom: 0,
    width: 2,
    backgroundColor: '#FFF',
    opacity: 0.3,
  },
  pongPaddle: {
    position: 'absolute',
    top: '50%',
    width: 4,
    height: 25,
    backgroundColor: '#FFF',
    marginTop: -12.5,
  },
  pongBall: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 6,
    height: 6,
    backgroundColor: '#FFF',
    marginTop: -3,
    marginLeft: -3,
  },
});
