import React, { useState, useEffect, useCallback } from 'react';
import { Image } from 'expo-image';
import { 
  StyleSheet, 
  Text, 
  View, 
  TouchableOpacity, 
  TextInput,
  ActivityIndicator,
  Modal,
} from 'react-native';
import ThemedScrollView from '@/components/ThemedScrollView';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Search, Check, Plus } from 'lucide-react-native';
import OnboardingProgress, { OnboardingStep } from '@/components/OnboardingProgress';
import { Env } from '@/constants/Env';
import { useUser, TwitchGame } from '@/context/UserContext';

export default function OnboardingGamesScreen() {
  const router = useRouter();
  const { favoriteGames, toggleFavoriteGame } = useUser();
  const selectedGames = favoriteGames;
  const [search, setSearch] = useState('');
  const [games, setGames] = useState<TwitchGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [showLimitAlert, setShowLimitAlert] = useState(false);
  const [showSelectionAlert, setShowSelectionAlert] = useState(false);

  const colors = {
    background: '#131F2A', 
    primary: '#4ADE80',    
    text: '#FFFFFF',
    textDim: '#94A3B8',
    surface: '#1E293B',
    surfaceHighlight: '#334155',
  };

  const steps: OnboardingStep[] = [
    { label: 'Welcome', status: 'completed', route: '/onboarding' },
    { label: 'Games', status: 'active', route: '/onboarding/games' },
    { label: 'Avatar', status: 'pending', route: '/onboarding/avatar' },
    { label: 'User Type', status: 'pending', route: '/onboarding/user-type' },
    { label: 'Wallet', status: 'pending', route: '/onboarding/wallet' },
    { label: 'Complete', status: 'pending', route: '/onboarding/complete' },
  ];

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(`https://id.twitch.tv/oauth2/token?client_id=${Env.TWITCH_CLIENT_ID}&client_secret=${Env.TWITCH_CLIENT_SECRET}&grant_type=client_credentials`, {
          method: 'POST'
        });
        const data = await response.json();
        if (data.access_token) {
          setToken(data.access_token);
        }
      } catch (error) {
        console.error('Error fetching Twitch token:', error);
      }
    };
    fetchToken();
  }, []);

  const fetchGames = useCallback(async (query: string, accessToken: string) => {
    setLoading(true);
    try {
      let url = 'https://api.twitch.tv/helix/games/top?first=20';
      if (query.trim().length > 0) {
        url = `https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(query)}&first=20`;
      }

      const response = await fetch(url, {
        headers: {
          'Client-Id': Env.TWITCH_CLIENT_ID,
          'Authorization': `Bearer ${accessToken}`
        }
      });
      const data = await response.json();
      
      if (data.data) {
        setGames(data.data);
      }
    } catch (error) {
      console.error('Error fetching games:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!token) return;

    const timer = setTimeout(() => {
      fetchGames(search, token);
    }, 500);

    return () => clearTimeout(timer);
  }, [search, token, fetchGames]);

  const toggleGame = (game: TwitchGame) => {
    const isSelected = selectedGames.some(g => g.id === game.id);
    
    if (isSelected) {
      toggleFavoriteGame(game);
    } else {
      if (selectedGames.length >= 5) {
        setShowLimitAlert(true);
        return;
      }
      toggleFavoriteGame(game);
    }
  };

  const getImageUrl = (url: string) => {
    return url.replace('{width}', '150').replace('{height}', '200');
  };

  const handleNext = () => {
    if (selectedGames.length === 0) {
      setShowSelectionAlert(true);
      return;
    }
    router.push('/onboarding/avatar');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      
      <View style={styles.content}>
        <View style={styles.progressWrapper}>
          <OnboardingProgress steps={steps} currentIndex={1} />
        </View>

        <ThemedScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent}>
          
          <Text style={styles.joystickEmoji}>🕹️</Text>
          
          <Text style={styles.title}>Which games do you enjoy?</Text>
          <Text style={styles.subtitle}>
            Choose your favorite games to play or watch
          </Text>

          {selectedGames.length > 0 && (
            <View style={styles.selectedBox}>
              <View style={styles.selectedGamesList}>
                {selectedGames.map((game) => (
                  <Image 
                    key={game.id}
                    source={{ uri: getImageUrl(game.box_art_url) }} 
                    style={styles.selectedGameThumb} 
                    contentFit="cover"
                    transition={200}
                  />
                ))}
              </View>
              <View style={styles.checkWrapper}>
                <Check size={24} color="#4ADE80" strokeWidth={3} />
              </View>
            </View>
          )}

          <View style={styles.searchContainer}>
            <Search size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for your favorite games"
              placeholderTextColor="#64748B"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <View style={styles.gamesList}>
            {loading ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              games.map((game) => {
                const isSelected = selectedGames.some(g => g.id === game.id);
                return (
                  <TouchableOpacity 
                    key={game.id} 
                    style={styles.gameItem}
                    onPress={() => toggleGame(game)}
                    activeOpacity={0.7}
                  >
                    <Image 
                      source={{ uri: getImageUrl(game.box_art_url) }} 
                      style={styles.gameThumb} 
                      contentFit="cover"
                      transition={200}
                    />
                    <View style={styles.gameInfo}>
                      <Text style={styles.gameTitle}>{game.name}</Text>
                    </View>
                    <View style={styles.actionIcon}>
                      {isSelected ? (
                        <Check size={24} color={colors.primary} strokeWidth={3} />
                      ) : (
                        <View style={styles.addCircle}>
                          <Plus size={16} color="#64748B" strokeWidth={2} />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </View>

        </ThemedScrollView>

        <Modal
          transparent
          visible={showLimitAlert}
          animationType="fade"
          onRequestClose={() => setShowLimitAlert(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.limitAlertBox}>
              <Text style={styles.limitAlertTitle}>Limit Reached</Text>
              <Text style={styles.limitAlertText}>You can only add 5 games</Text>
              <TouchableOpacity 
                style={styles.limitAlertButton}
                onPress={() => setShowLimitAlert(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.limitAlertButtonText}>Okay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <Modal
          transparent
          visible={showSelectionAlert}
          animationType="fade"
          onRequestClose={() => setShowSelectionAlert(false)}
        >
          <View style={styles.modalOverlay}>
            <View style={styles.limitAlertBox}>
              <Text style={styles.limitAlertTitle}>Select Your Games</Text>
              <Text style={styles.limitAlertText}>Please select your favorite games to continue</Text>
              <TouchableOpacity 
                style={styles.limitAlertButton}
                onPress={() => setShowSelectionAlert(false)}
                activeOpacity={0.8}
              >
                <Text style={styles.limitAlertButtonText}>Okay</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        <View style={styles.footer}>
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.backButton}
              activeOpacity={0.8}
              onPress={() => router.navigate('/onboarding')}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={styles.nextButton}
              activeOpacity={0.8}
              onPress={handleNext}
            >
              <Text style={styles.nextButtonText}>Next</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  progressWrapper: {
    paddingHorizontal: 20,
    marginBottom: -6,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
    paddingHorizontal: 20,
    paddingRight: 32,
  },
  joystickEmoji: {
    fontSize: 44,
    textAlign: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 6,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 22,
  },
  selectedBox: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  selectedGamesList: {
    flex: 1,
    flexDirection: 'row',
    gap: 8,
  },
  selectedGameThumb: {
    width: 50,
    height: 65,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  checkWrapper: {
    marginLeft: 12,
  },
  searchContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 48,
    marginBottom: 16,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  gamesList: {
    gap: 8,
  },
  gameItem: {
    backgroundColor: 'transparent',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  gameThumb: {
    width: 50,
    height: 65,
    borderRadius: 8,
    backgroundColor: '#334155',
  },
  gameInfo: {
    flex: 1,
    marginLeft: 16,
  },
  gameTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600' as const,
    marginBottom: 4,
  },
  actionIcon: {
    padding: 4,
  },
  addCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#64748B',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  backButton: {
    flex: 1,
    backgroundColor: '#334155',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#FFFFFF',
  },
  nextButton: {
    flex: 1,
    backgroundColor: '#4ADE80',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#002E15',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  limitAlertBox: {
    backgroundColor: '#1E293B',
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 320,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  limitAlertTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  limitAlertText: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  limitAlertButton: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 28,
    width: '100%',
    alignItems: 'center',
  },
  limitAlertButtonText: {
    color: '#002E15',
    fontWeight: '700' as const,
    fontSize: 16,
  },
});
