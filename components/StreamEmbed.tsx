import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator, Dimensions } from 'react-native';
import WebView from 'react-native-webview';
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

function buildTwitchHtml(channel: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<style>
* { margin: 0; padding: 0; box-sizing: border-box; background: #000; }
html, body { width: 100%; height: 100%; overflow: hidden; }
iframe { width: 100%; height: 100%; border: none; display: block; }
</style>
</head>
<body>
<iframe
  src="https://player.twitch.tv/?channel=${channel}&parent=localhost&autoplay=false&muted=true"
  allowfullscreen="true"
  allow="autoplay; fullscreen"
></iframe>
</body>
</html>`;
}

function buildKickHtml(channel: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
<style>
* { margin: 0; padding: 0; box-sizing: border-box; background: #000; }
html, body { width: 100%; height: 100%; overflow: hidden; }
iframe { width: 100%; height: 100%; border: none; display: block; }
</style>
</head>
<body>
<iframe
  src="https://player.kick.com/${channel}?autoplay=false&muted=true"
  allowfullscreen="true"
  allow="autoplay; fullscreen"
></iframe>
</body>
</html>`;
}

export default function StreamEmbed({
  twitchChannel,
  kickChannel,
  activePlatform,
  activeChannel,
  isLive = false,
}: StreamEmbedProps) {
  const [playerVisible, setPlayerVisible] = useState(false);
  const [loading, setLoading] = useState(true);

  const platform = activePlatform || (twitchChannel ? 'twitch' : kickChannel ? 'kick' : null);
  const channel = activeChannel || (platform === 'twitch' ? twitchChannel : kickChannel);

  if (!platform || !channel) return null;

  const isKick = platform === 'kick';
  const platformLabel = isKick ? 'Kick' : 'Twitch';
  const platformColor = isKick ? '#53FC18' : '#9146FF';
  const headerBg = isKick ? '#0a2a0a' : '#1a0f3a';

  const html = isKick ? buildKickHtml(channel) : buildTwitchHtml(channel);

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

      {!playerVisible ? (
        <TouchableOpacity
          style={[styles.playerContainer, styles.thumbnailContainer, { height: PLAYER_HEIGHT }]}
          onPress={() => { setLoading(true); setPlayerVisible(true); }}
          activeOpacity={0.85}
        >
          <View style={[styles.playButton, { borderColor: platformColor }]}>
            <Tv size={28} color={platformColor} />
          </View>
          <Text style={[styles.tapToWatch, { color: platformColor }]}>
            {isLive ? 'Tap to watch live' : 'Tap to load stream'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View style={[styles.playerContainer, { height: PLAYER_HEIGHT }]}>
          {loading ? (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={platformColor} />
            </View>
          ) : null}
          <WebView
            source={{ html }}
            style={styles.webview}
            allowsInlineMediaPlayback
            mediaPlaybackRequiresUserAction={false}
            javaScriptEnabled
            domStorageEnabled
            originWhitelist={['*']}
            onLoad={() => setLoading(false)}
            onError={() => setLoading(false)}
            scrollEnabled={false}
          />
        </View>
      )}
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
    position: 'relative',
  },
  thumbnailContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tapToWatch: {
    fontSize: 13,
    fontWeight: '600',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1,
  },
});
