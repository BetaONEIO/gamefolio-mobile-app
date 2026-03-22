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
  Dimensions,
  Platform,
  ScrollView,
  KeyboardAvoidingView
} from 'react-native';
import { Search, Star, Plus, X } from 'lucide-react-native';
import { Env } from '@/constants/Env';
import { useUser, TwitchGame } from '@/context/UserContext';

interface AddGamesModalProps {
  visible: boolean;
  onClose: () => void;
}

const { width } = Dimensions.get('window');

export default function AddGamesModal({ visible, onClose }: AddGamesModalProps) {
  const { favoriteGames, setFavoriteGames } = useUser();
  const [search, setSearch] = useState('');
  const [games, setGames] = useState<TwitchGame[]>([]);
  const [loading, setLoading] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  
  // Local state for batch selection
  const [localFavorites, setLocalFavorites] = useState<TwitchGame[]>([]);

  // Sync local state when modal opens
  useEffect(() => {
    if (visible) {
      setLocalFavorites([...favoriteGames]);
    }
  }, [visible, favoriteGames]);

  const handleToggleLocal = (game: TwitchGame) => {
    setLocalFavorites(prev => {
      const isSelected = prev.some(g => g.id === game.id);
      if (isSelected) {
        return prev.filter(g => g.id !== game.id);
      } else {
        return [...prev, game];
      }
    });
  };

  const handleConfirm = () => {
    setFavoriteGames(localFavorites);
    onClose();
  };

  // Fetch Twitch Token
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

  // Fetch Games
  const fetchGames = useCallback(async (query: string, accessToken: string) => {
    setLoading(true);
    try {
      let url = 'https://api.twitch.tv/helix/games/top?first=30';
      if (query.trim().length > 0) {
        url = `https://api.twitch.tv/helix/search/categories?query=${encodeURIComponent(query)}&first=30`;
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

  // Initial fetch
  useEffect(() => {
    if (token && visible) {
      fetchGames('', token);
    }
  }, [token, visible, fetchGames]);

  // Debounce Search
  useEffect(() => {
    if (!token || !visible) return;

    const timer = setTimeout(() => {
      fetchGames(search, token);
    }, 500);

    return () => clearTimeout(timer);
  }, [search, token, visible, fetchGames]);

  const getImageUrl = (url: string) => {
    if (!url) return '';
    return url.replace('{width}', '300').replace('{height}', '400');
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}
      >
        <View style={styles.content}>
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.iconContainer}>
                <Star size={24} color="#4ADE80" fill="#4ADE80" />
              </View>
              <Text style={styles.headerTitle}>Add Games to Favorites</Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <X size={24} color="#94A3B8" />
            </TouchableOpacity>
          </View>

          <View style={styles.searchContainer}>
            <Search size={20} color="#94A3B8" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for games..."
              placeholderTextColor="#64748B"
              value={search}
              onChangeText={setSearch}
            />
          </View>

          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {search.length > 0 ? 'Search Results' : 'Trending Games'}
            </Text>
            
            <TouchableOpacity 
              style={[styles.confirmButton, localFavorites.length === 0 && styles.confirmButtonDisabled]}
              onPress={handleConfirm}
              disabled={localFavorites.length === 0}
            >
              <Text style={[styles.confirmButtonText, localFavorites.length === 0 && styles.confirmButtonTextDisabled]}>Confirm</Text>
            </TouchableOpacity>
          </View>

          <ScrollView 
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.gamesGrid}
          >
            {loading && games.length === 0 ? (
               <View style={styles.loadingContainer}>
                 <ActivityIndicator size="large" color="#4ADE80" />
               </View>
            ) : (
              games.map((game) => {
                const isSelected = localFavorites.some(g => g.id === game.id);
                return (
                  <TouchableOpacity
                    key={game.id}
                    style={[
                      styles.gameCard,
                      isSelected && styles.gameCardSelected
                    ]}
                    onPress={() => handleToggleLocal(game)}
                    activeOpacity={0.7}
                  >
                    <Image
                      source={{ uri: getImageUrl(game.box_art_url) }}
                      style={styles.gameImage}
                      contentFit="cover"
                      transition={200}
                    />
                    
                    {isSelected && (
                       <View style={styles.selectedOverlay}>
                          <Star size={20} color="#4ADE80" fill="#4ADE80" />
                       </View>
                    )}

                    {!isSelected && (
                      <View style={styles.unselectedOverlay}>
                         <Plus size={20} color="#FFF" />
                      </View>
                    )}

                    <View style={styles.gameInfo}>
                      <Text style={styles.gameName} numberOfLines={2}>
                        {game.name}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'flex-end',
  },
  content: {
    height: '90%',
    backgroundColor: '#131F2A',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    // Styling if needed
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    backgroundColor: '#1E293B',
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 50,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: '#4ADE80',
  },
  searchInput: {
    flex: 1,
    marginLeft: 12,
    color: '#FFFFFF',
    fontSize: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFF',
  },
  confirmButton: {
    backgroundColor: '#4ADE80',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  confirmButtonDisabled: {
    backgroundColor: 'rgba(74, 222, 128, 0.3)',
  },
  confirmButtonText: {
    color: '#131F2A',
    fontWeight: 'bold',
    fontSize: 14,
  },
  confirmButtonTextDisabled: {
    color: 'rgba(15, 21, 32, 0.5)',
  },
  gamesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    paddingBottom: 40,
  },
  loadingContainer: {
    width: '100%',
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameCard: {
    width: (width - 40 - 24) / 3, // 3 columns
    aspectRatio: 0.75,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#1E293B',
    position: 'relative',
    marginBottom: 8,
  },
  gameCardSelected: {
    borderWidth: 2,
    borderColor: '#4ADE80',
  },
  gameImage: {
    width: '100%',
    height: '100%',
  },
  selectedOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
    padding: 2,
  },
  unselectedOverlay: {
    position: 'absolute',
    top: 6,
    right: 6,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gameInfo: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 8,
    backgroundColor: 'rgba(0,0,0,0.8)',
  },
  gameName: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  }
});
