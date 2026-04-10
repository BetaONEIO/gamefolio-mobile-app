import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import { Tv } from 'lucide-react-native';

interface StreamEmbedProps {
  twitchChannel?: string | null;
  kickChannel?: string | null;
  activePlatform?: string | null;
  activeChannel?: string | null;
  isLive?: boolean;
  accentColor?: string;
}

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PLAYER_HEIGHT = Math.round((SCREEN_WIDTH - 32) * (9 / 16));

export default function StreamEmbed({
  twitchChannel,
  kickChannel,
  activePlatform,
  activeChannel,
  isLive = false,
}: StreamEmbedProps) {
  const platform = activePlatform || (twitchChannel ? 'twitch' : kickChannel ? 'kick' : null);
  const channel = activeChannel || (platform === 'twitch' ? twitchChannel : kickChannel);

  if (!platform || !channel) return null;

  const isKick = platform === 'kick';
  const platformLabel = isKick ? 'Kick' : 'Twitch';
  const platformColor = isKick ? '#53FC18' : '#9146FF';
  const headerBg = isKick ? '#0a2a0a' : '#1a0f3a';

  return (
    <View style={styles.container}>
      <View style={[styles.header, { backgroundColor: headerBg }]}>
        <Tv size={14} color={platformColor} />
        <Text style={[styles.platformLabel, { color: platformColor }]}>{platformLabel}</Text>
        <Text style={styles.channelName}>{channel}</Text>
        {isLive ? (
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>LIVE</Text>
          </View>
        ) : (
          <View style={[styles.liveBadge, styles.offlineBadge]}>
            <Text style={[styles.liveBadgeText, styles.offlineBadgeText]}>OFFLINE</Text>
          </View>
        )}
      </View>
      <View style={[styles.playerContainer, { height: PLAYER_HEIGHT }]}>
        <Tv size={28} color="rgba(255,255,255,0.2)" />
        <Text style={styles.webFallback}>Open in Expo Go to watch the stream</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 0,
    marginBottom: 16,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 6,
  },
  platformLabel: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  channelName: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '500',
    flex: 1,
  },
  liveBadge: {
    backgroundColor: '#EF4444',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  liveBadgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
    letterSpacing: 1,
  },
  offlineBadge: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  offlineBadgeText: {
    color: 'rgba(255,255,255,0.5)',
  },
  playerContainer: {
    width: '100%',
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  webFallback: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 13,
    textAlign: 'center',
    padding: 20,
  },
});
