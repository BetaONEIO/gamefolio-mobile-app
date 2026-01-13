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
import { Search, Check, Plus, CheckCircle2, X } from 'lucide-react-native';
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

  const colors = {
    background: '#0F1520', 
    primary: '#4ADE80',    
    text: '#FFFFFF',
    textDim: '#94A3B8',
    surface: '#1E293B',
    surfaceHighlight: '#334155',
  };

  const steps = [
    { label: 'Welcome', status: 'completed' },
    { label: 'Games', status: 'active' },
    { label: 'Avatar', status: 'pending' },
    { label: 'User Type', status: 'pending' },
    { label: 'Age', status: 'pending' },
    { label: 'Wallet', status: 'pending' },
    { label: 'Complete', status: 'pending' },
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
    router.push('/onboarding/avatar');
  };

  const handleSkip = () => {
    router.push('/onboarding/avatar');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="light" />
      
      <View style={styles.content}>
        <View style={styles.progressContainer}>
          <View style={styles.stepsRow}>
            {steps.map((step, index) => (
              <React.Fragment key={index}>
                <View style={styles.stepWrapper}>
                  <View style={[
                    styles.stepCircle, 
                    step.status === 'active' && { backgroundColor: colors.primary, borderColor: colors.primary },
                    step.status === 'completed' && { backgroundColor: colors.primary, borderColor: colors.primary },
                    step.status === 'pending' && { backgroundColor: 'transparent', borderColor: '#334155' }
                  ]}>
                    {step.status === 'completed' ? (
                      <Check size={16} color="#002E15" strokeWidth={3} />
                    ) : (
                      <Text style={[
                        styles.stepNumber,
                        step.status === 'active' ? { color: '#002E15' } : { color: '#64748B' }
                      ]}>
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  <Text style={[
                    styles.stepLabel,
                    step.status === 'active' || step.status === 'completed' ? { color: '#FFFFFF' } : { color: '#64748B' }
                  ]} numberOfLines={1}>
                    {step.label}
                  </Text>
                </View>
                
                {index < steps.length - 1 && (
                  <View style={[
                    styles.stepLine,
                    (steps[index].status === 'completed' && steps[index+1].status !== 'pending') && { backgroundColor: colors.primary }
                  ]} />
                )}
              </React.Fragment>
            ))}
          </View>
        </View>

        <ThemedScrollView contentContainerStyle={styles.scrollContent}>
          
          <Text style={styles.title}>Which games do you enjoy?</Text>
          <Text style={styles.subtitle}>
            Choose your favorite games to play or watch
          </Text>

          <View style={styles.optionalBadge}>
            <Text style={styles.optionalText}>Optional - Select up to 5</Text>
          </View>

          <View style={styles.selectedBox}>
            <View style={styles.selectedGamesList}>
              {selectedGames.length === 0 ? (
                <Text style={styles.emptySelectionText}>No games selected yet</Text>
              ) : (
                selectedGames.map((game) => (
                  <View key={game.id} style={styles.selectedGameWrapper}>
                    <Image 
                      source={{ uri: getImageUrl(game.box_art_url) }} 
                      style={styles.selectedGameThumb} 
                      contentFit="contain"
                      transition={200}
                    />
                    <TouchableOpacity 
                      style={styles.removeGameButton} 
                      onPress={() => toggleGame(game)}
                      activeOpacity={0.7}
                    >
                      <X size={12} color="#FFFFFF" strokeWidth={3} />
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </View>
            {selectedGames.length > 0 && (
              <View style={styles.checkWrapper}>
                <Check size={20} color="#4ADE80" />
              </View>
            )}
          </View>

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
                    style={[
                      styles.gameItem,
                      isSelected && styles.gameItemSelected
                    ]}
                    onPress={() => toggleGame(game)}
                    activeOpacity={0.7}
                  >
                    <Image 
                      source={{ uri: getImageUrl(game.box_art_url) }} 
                      style={styles.gameThumb} 
                      contentFit="contain"
                      transition={200}
                    />
                    <View style={styles.gameInfo}>
                      <Text style={styles.gameTitle}>{game.name}</Text>
                    </View>
                    <View style={styles.actionIcon}>
                      {isSelected ? (
                        <CheckCircle2 size={24} color={colors.primary} fill="transparent" />
                      ) : (
                        <Plus size={24} color="#FFFFFF" />
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

        <View style={styles.footer}>
          <View style={styles.buttonRow}>
            <TouchableOpacity 
              style={styles.backButton}
              activeOpacity={0.8}
              onPress={() => router.back()}
            >
              <Text style={styles.backButtonText}>Back</Text>
            </TouchableOpacity>

            {selectedGames.length === 0 ? (
              <TouchableOpacity 
                style={styles.skipButton}
                activeOpacity={0.8}
                onPress={handleSkip}
              >
                <Text style={styles.skipButtonText}>Skip</Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity 
                style={styles.nextButton}
                activeOpacity={0.8}
                onPress={handleNext}
              >
                <Text style={styles.nextButtonText}>Next</Text>
              </TouchableOpacity>
            )}
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
    paddingHorizontal: 24,
  },
  progressContainer: {
    marginTop: 20,
    marginBottom: 30,
  },
  stepsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  stepWrapper: {
    alignItems: 'center',
    zIndex: 1,
    width: 40,
  },
  stepCircle: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
    backgroundColor: '#0F1520',
  },
  stepNumber: {
    fontSize: 12,
    fontWeight: '600' as const,
  },
  stepLabel: {
    fontSize: 10,
    textAlign: 'center',
  },
  stepLine: {
    flex: 1,
    height: 2,
    backgroundColor: '#334155',
    marginTop: 13,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700' as const,
    color: '#FFFFFF',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#94A3B8',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 24,
  },
  optionalBadge: {
    alignSelf: 'center',
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: 20,
  },
  optionalText: {
    color: '#94A3B8',
    fontSize: 12,
    fontWeight: '600' as const,
  },
  selectedBox: {
    backgroundColor: '#161F2E',
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    minHeight: 80,
    borderWidth: 1,
    borderColor: '#1E293B',
  },
  selectedGamesList: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  emptySelectionText: {
    color: '#64748B',
    fontSize: 14,
    fontStyle: 'italic',
  },
  selectedGameWrapper: {
    position: 'relative',
    marginRight: 8,
    marginBottom: 8,
  },
  selectedGameThumb: {
    width: 45,
    height: 60,
    borderRadius: 6,
    backgroundColor: '#334155',
  },
  removeGameButton: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#161F2E',
    zIndex: 10,
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
    height: 50,
    marginBottom: 24,
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  gamesList: {
    gap: 12,
  },
  gameItem: {
    backgroundColor: '#1E293B',
    borderRadius: 16,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  gameItemSelected: {
    borderWidth: 1,
    borderColor: '#4ADE80',
    backgroundColor: '#162221',
  },
  gameThumb: {
    width: 45,
    height: 60,
    borderRadius: 6,
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
  footer: {
    paddingTop: 20,
    paddingBottom: 20,
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
  skipButton: {
    flex: 1,
    backgroundColor: 'transparent',
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  skipButtonText: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: '#94A3B8',
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
