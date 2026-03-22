import { useState, useRef, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import { Zap, Coins, Star, Trophy } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface LootboxReward {
  id?: number;
  type: 'xp' | 'coins' | 'item' | 'asset';
  amount: number;
  name: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  imageUrl?: string | null;
}

interface LootboxSpinAnimationProps {
  rewards: LootboxReward[];
  wonReward: LootboxReward;
  onAnimationComplete: () => void;
}

const RARITY_COLORS = {
  common: '#94A3B8',
  rare: '#3B82F6',
  epic: '#A855F7',
  legendary: '#F59E0B',
};

const ITEM_WIDTH = 120;
const SCREEN_WIDTH = Dimensions.get('window').width;
const CENTER_OFFSET = (SCREEN_WIDTH / 2) - (ITEM_WIDTH / 2);

const getIcon = (type: string, rarity: string, imageUrl?: string | null) => {
  const color = RARITY_COLORS[rarity as keyof typeof RARITY_COLORS];
  const size = 40;
  
  if (type === 'asset' && imageUrl) {
    return <Image source={{ uri: imageUrl }} style={{ width: size, height: size, borderRadius: 8 }} />;
  }
  
  switch (type) {
    case 'xp':
      return <Zap size={size} color={color} fill={color} />;
    case 'coins':
      return <Coins size={size} color={color} fill={color} />;
    case 'item':
      return <Star size={size} color={color} fill={color} />;
    default:
      return <Trophy size={size} color={color} />;
  }
};

export default function LootboxSpinAnimation({ 
  rewards, 
  wonReward, 
  onAnimationComplete 
}: LootboxSpinAnimationProps) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const [hasStarted, setHasStarted] = useState(false);

  const generateItems = () => {
    const items: LootboxReward[] = [];
    const totalItems = 50;
    
    const wonIndex = Math.floor(totalItems * 0.8);
    
    for (let i = 0; i < totalItems; i++) {
      if (i === wonIndex) {
        items.push(wonReward);
      } else {
        items.push(rewards[Math.floor(Math.random() * rewards.length)]);
      }
    }
    
    return { items, wonIndex };
  };

  const { items, wonIndex } = generateItems();

  const startAnimation = useCallback(() => {
    if (hasStarted) return;
    setHasStarted(true);

    const finalPosition = -(wonIndex * ITEM_WIDTH - CENTER_OFFSET);
    
    Animated.sequence([
      Animated.timing(scrollX, {
        toValue: -SCREEN_WIDTH * 3,
        duration: 1000,
        useNativeDriver: true,
      }),
      Animated.timing(scrollX, {
        toValue: finalPosition,
        duration: 3000,
        useNativeDriver: true,
      }),
    ]).start(() => {
      setTimeout(() => {
        onAnimationComplete();
      }, 1500);
    });
  }, [hasStarted, wonIndex, scrollX, onAnimationComplete]);

  useEffect(() => {
    const timer = setTimeout(startAnimation, 500);
    return () => clearTimeout(timer);
  }, [startAnimation]);

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#131F2A', '#7C3AED', '#131F2A']}
        locations={[0, 0.5, 1]}
        style={StyleSheet.absoluteFillObject}
      />

      <View style={styles.content}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>Opening Lootbox...</Text>
          <Text style={styles.subtitle}>Good luck!</Text>
        </View>

        <View style={styles.spinContainer}>
          <View style={styles.selector}>
            <View style={styles.selectorLine} />
          </View>

          <View style={styles.itemsContainer}>
            <Animated.View 
              style={[
                styles.itemsRow,
                {
                  transform: [{ translateX: scrollX }],
                },
              ]}
            >
              {items.map((item, index) => (
                <View 
                  key={index} 
                  style={[
                    styles.itemCard,
                    { 
                      borderColor: RARITY_COLORS[item.rarity],
                      backgroundColor: `${RARITY_COLORS[item.rarity]}15`,
                    }
                  ]}
                >
                  <View style={styles.itemIcon}>
                    {getIcon(item.type, item.rarity, item.imageUrl)}
                  </View>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.itemAmount}>+{item.amount}</Text>
                  <View 
                    style={[
                      styles.rarityBadge,
                      { backgroundColor: RARITY_COLORS[item.rarity] }
                    ]}
                  >
                    <Text style={styles.rarityText}>
                      {item.rarity.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                </View>
              ))}
            </Animated.View>
          </View>

          <LinearGradient
            colors={['#131F2A', 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.leftFade}
            pointerEvents="none"
          />
          <LinearGradient
            colors={['transparent', '#131F2A']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.rightFade}
            pointerEvents="none"
          />
        </View>

        <View style={styles.instructions}>
          <View style={styles.glowDot} />
          <Text style={styles.instructionText}>Finding your reward...</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#131F2A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 18,
    color: '#94A3B8',
  },
  spinContainer: {
    height: 200,
    position: 'relative',
    marginBottom: 60,
  },
  selector: {
    position: 'absolute',
    left: SCREEN_WIDTH / 2,
    top: 0,
    bottom: 0,
    width: 4,
    zIndex: 10,
    justifyContent: 'center',
  },
  selectorLine: {
    width: 4,
    height: '100%',
    backgroundColor: '#F59E0B',
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
  },
  itemsContainer: {
    height: 200,
    overflow: 'hidden',
  },
  itemsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: SCREEN_WIDTH / 2,
  },
  itemCard: {
    width: ITEM_WIDTH,
    height: 180,
    borderRadius: 16,
    borderWidth: 3,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemIcon: {
    marginBottom: 12,
  },
  itemName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
    marginBottom: 4,
    textAlign: 'center',
  },
  itemAmount: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#4ADE80',
    marginBottom: 8,
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: 4,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  leftFade: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 100,
  },
  rightFade: {
    position: 'absolute',
    right: 0,
    top: 0,
    bottom: 0,
    width: 100,
  },
  instructions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  glowDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#A855F7',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
  },
  instructionText: {
    fontSize: 16,
    color: '#94A3B8',
  },
});
