import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  StyleSheet,
  Alert,
  Share,
  ActivityIndicator,
  Dimensions,
  AppState,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import supabase from '../../supabase/client';
import { FeedVideo } from '../hooks/useFeed';

// ─── Constants ────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');
const MUTE_KEY = 'ubuzz_mute_preference';

// Design tokens (Nocturnal Pulse)
const COLORS = {
  like:         '#FF2D55',  // Youthful Pink
  likeOutline:  '#FFFFFF',
  action:       '#FFFFFF',
  countText:    '#FFFFFF',
  overlay:      'rgba(0,0,0,0.35)',
  username:     '#FFFFFF',
  caption:      'rgba(255,255,255,0.92)',
  muteBtn:      'rgba(0,0,0,0.45)',
  spinnerBg:    'rgba(0,0,0,0.5)',
  error:        '#FFFFFF',
  avatarBorder: '#FFFFFF',
};

// ─── Props ────────────────────────────────────────────────────────────────────

export interface VideoCardProps {
  video: FeedVideo;
  isActive: boolean;
  currentUserId: string | null;
  toggleLike: (videoId: string, currentIsLiked: boolean) => Promise<void>;
  onComment: (video: FeedVideo) => void;
  onProfile: (userId: string) => void;
  onDelete: (videoId: string) => void;
  singleVideoMode?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function VideoCard({
  video,
  isActive,
  currentUserId,
  toggleLike,
  onComment,
  onProfile,
  onDelete,
  singleVideoMode = false,
}: VideoCardProps) {
  // Playback UI state
  const [isPaused, setIsPaused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  // Caption expand
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [captionTruncated, setCaptionTruncated] = useState(false);

  // ── expo-video player ───────────────────────────────────────────────────────
  const player = useVideoPlayer({ uri: video.video_url }, (p) => {
    p.loop = true;
    p.muted = false; // will be synced by effect once AsyncStorage loads
  });

  // Status event — drives buffering spinner and error state
  const { status: playerStatus } = useEvent(player, 'statusChange', {
    status: player.status,
  });
  const isBuffering = playerStatus === 'loading';
  const hasError    = playerStatus === 'error';

  // ── Load mute preference from storage on mount ──────────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(MUTE_KEY).then((val) => {
      if (val !== null) setIsMuted(val === 'true');
    });
  }, []);

  // ── Play / pause controlled by isActive + user tap ─────────────────────────
  useEffect(() => {
    if (singleVideoMode) {
      if (!isPaused) {
        player.play();
      } else {
        player.pause();
      }
    } else {
      if (isActive && !isPaused) {
        player.play();
      } else {
        player.pause();
      }
    }
  }, [isActive, isPaused, player, singleVideoMode]);

  // ── AppState handling for singleVideoMode ──────────────────────────────────
  useEffect(() => {
    if (!singleVideoMode) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState.match(/inactive|background/)) {
        player.pause();
      } else if (nextAppState === 'active' && !isPaused) {
        player.play();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [singleVideoMode, isPaused, player]);

  // ── Mute sync ──────────────────────────────────────────────────────────────
  useEffect(() => {
    player.muted = isMuted;
  }, [isMuted, player]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleVideoPress = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const handleMuteToggle = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      AsyncStorage.setItem(MUTE_KEY, String(next));
      return next;
    });
  }, []);

  const handleShare = useCallback(async () => {
    try {
      await Share.share({
        message: `Watch this on U-Buzz: ${video.caption ?? ''} by @${video.username}`,
      });
    } catch (e: unknown) {
      console.error('[VideoCard] share error:', e);
    }
  }, [video.caption, video.username]);

  const handleLongPress = useCallback(() => {
    const isOwn = currentUserId === video.user_id;

    if (isOwn) {
      Alert.alert('Video Options', undefined, [
        {
          text: 'Delete Video',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete Video',
              'Are you sure? This cannot be undone.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      const { error } = await supabase
                        .from('videos')
                        .delete()
                        .eq('id', video.id)
                        .eq('user_id', currentUserId!);
                      if (error) throw error;
                      onDelete(video.id);
                    } catch (e: unknown) {
                      const msg =
                        e instanceof Error ? e.message : 'Could not delete video.';
                      Alert.alert('Error', msg);
                    }
                  },
                },
              ],
            );
          },
        },
        {
          text: 'Report Video',
          onPress: () => {
            // Placeholder — wired in Phase 7
            Alert.alert('Report', 'Reporting coming in a future update.');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    } else {
      Alert.alert('Video Options', undefined, [
        {
          text: 'Report Video',
          onPress: () => {
            Alert.alert('Report', 'Reporting coming in a future update.');
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ]);
    }
  }, [currentUserId, video.id, video.user_id, onDelete]);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <View style={styles.container}>
      {/* ── Video Player ── */}
      <TouchableWithoutFeedback onPress={handleVideoPress} onLongPress={handleLongPress}>
        <View style={styles.videoWrapper}>
          {/* Thumbnail shown as background while video loads (replaces expo-av usePoster) */}
          {video.thumbnail_url && (
            <Image
              source={{ uri: video.thumbnail_url }}
              style={StyleSheet.absoluteFill}
              contentFit="cover"
            />
          )}

          <VideoView
            player={player}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            nativeControls={false}
            fullscreenOptions={{ enable: false }}
          />

          {/* Buffering spinner */}
          {isBuffering && !hasError && (
            <View style={styles.centeredOverlay}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          )}

          {/* Error state */}
          {hasError && (
            <View style={styles.centeredOverlay}>
              <Ionicons name="alert-circle-outline" size={40} color="#FFFFFF" />
              <Text style={styles.errorText}>Could not load video.</Text>
            </View>
          )}

          {/* Paused indicator */}
          {isPaused && !isBuffering && !hasError && (
            <View style={styles.centeredOverlay} pointerEvents="none">
              <Ionicons name="play" size={64} color="rgba(255,255,255,0.7)" />
            </View>
          )}
        </View>
      </TouchableWithoutFeedback>

      {/* ── Bottom gradient scrim ── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={styles.gradientScrim}
        pointerEvents="none"
      />

      {/* ── Mute button — top right ── */}
      <TouchableOpacity style={styles.muteButton} onPress={handleMuteToggle}>
        <Ionicons
          name={isMuted ? 'volume-mute' : 'volume-high'}
          size={20}
          color="#FFFFFF"
        />
      </TouchableOpacity>

      {/* ── Action buttons — bottom right ── */}
      <View style={styles.actionsColumn}>
        {/* Like */}
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => toggleLike(video.id, video.is_liked)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={video.is_liked ? 'heart' : 'heart-outline'}
            size={30}
            color={video.is_liked ? COLORS.like : COLORS.likeOutline}
          />
          <Text style={styles.actionCount}>{formatCount(video.like_count)}</Text>
        </TouchableOpacity>

        {/* Comment */}
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => onComment(video)}
          activeOpacity={0.7}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={28} color={COLORS.action} />
          <Text style={styles.actionCount}>{formatCount(video.comment_count)}</Text>
        </TouchableOpacity>

        {/* Share */}
        <TouchableOpacity
          style={styles.actionItem}
          onPress={handleShare}
          activeOpacity={0.7}
        >
          <Ionicons name="arrow-redo-outline" size={28} color={COLORS.action} />
        </TouchableOpacity>
      </View>

      {/* ── Info overlay — bottom left ── */}
      <View style={styles.infoArea}>
        {/* Avatar + username row */}
        <TouchableOpacity
          style={styles.userRow}
          onPress={() => onProfile(video.user_id)}
          activeOpacity={0.8}
        >
          {video.avatar_url ? (
            <Image
              source={{ uri: video.avatar_url }}
              style={styles.avatar}
              contentFit="cover"
            />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
          )}
          <Text style={styles.username}>@{video.username}</Text>
        </TouchableOpacity>

        {/* Caption */}
        {video.caption ? (
          <View style={styles.captionRow}>
            <Text
              style={styles.captionText}
              numberOfLines={captionExpanded ? undefined : 2}
              onTextLayout={(e) => {
                if (!captionExpanded) {
                  setCaptionTruncated(e.nativeEvent.lines.length > 2);
                }
              }}
            >
              {video.caption}
            </Text>
            {captionTruncated && !captionExpanded && (
              <TouchableOpacity onPress={() => setCaptionExpanded(true)}>
                <Text style={styles.moreLink}>...more</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : null}
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#000000',
  },
  videoWrapper: {
    ...StyleSheet.absoluteFillObject,
  },
  centeredOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.35)',
    gap: 8,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  gradientScrim: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: SCREEN_HEIGHT * 0.45,
  },
  // ── Mute ──
  muteButton: {
    position: 'absolute',
    top: 56,
    right: 16,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.muteBtn,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // ── Actions column ──
  actionsColumn: {
    position: 'absolute',
    right: 12,
    bottom: 110,
    alignItems: 'center',
    gap: 24,
  },
  actionItem: {
    alignItems: 'center',
    gap: 4,
  },
  actionCount: {
    color: COLORS.countText,
    fontSize: 12,
    fontWeight: '700',
  },
  // ── Info area ──
  infoArea: {
    position: 'absolute',
    bottom: 90,
    left: 12,
    right: 80,
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: COLORS.avatarBorder,
  },
  avatarFallback: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    color: COLORS.username,
    fontSize: 15,
    fontWeight: '700',
  },
  captionRow: {
    marginLeft: 2,
  },
  captionText: {
    color: COLORS.caption,
    fontSize: 14,
    lineHeight: 20,
  },
  moreLink: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
});
