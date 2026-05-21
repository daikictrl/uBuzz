import React, { useCallback, useEffect, useRef, useState } from 'react';
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
  Animated,
  GestureResponderEvent,
  ScrollView,
} from 'react-native';
import { VideoView, useVideoPlayer } from 'expo-video';
import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import supabase from '../../supabase/client';
import { FeedVideo } from '../hooks/useFeed';

// ─── Constants ────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

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
  toggleLike: (videoId: string, currentIsLiked: boolean, videoOwnerId: string) => Promise<void>;
  onComment: (video: FeedVideo) => void;
  onProfile: (userId: string) => void;
  onDelete: (videoId: string) => void;
  isMuted: boolean;
  onMuteToggle: () => void;
  singleVideoMode?: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000)     return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

interface HeartBurstProps {
  x: number;
  y: number;
  onFinish: () => void;
}

function HeartBurst({ x, y, onFinish }: HeartBurstProps) {
  const scaleAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const animation = Animated.parallel([
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.3,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1.0,
          duration: 100,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(opacityAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]);

    animation.start(() => {
      onFinish();
    });

    return () => {
      animation.stop();
    };
  }, [scaleAnim, opacityAnim, onFinish]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.heartOverlay,
        {
          left: x - 30,
          top: y - 30,
          transform: [{ scale: scaleAnim }],
          opacity: opacityAnim,
        },
      ]}
    >
      <Ionicons name="heart" size={60} color="#EF4444" />
    </Animated.View>
  );
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
  isMuted,
  onMuteToggle,
  singleVideoMode = false,
}: VideoCardProps) {
  // Playback UI state
  const [isPaused, setIsPaused] = useState(false);

  // Caption expand
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [canExpand, setCanExpand] = useState(false);
  const canExpandRef = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);

  // Track previous video ID to reset state synchronously on change (avoiding layout race conditions)
  const [prevVideoId, setPrevVideoId] = useState(video.id);
  
  // Local mute override
  const [localMuted, setLocalMuted] = useState(isMuted);
  const userToggledRef = useRef(false);

  // Sync with global isMuted prop only if the user hasn't manually toggled it on this card
  useEffect(() => {
    if (!userToggledRef.current) {
      setLocalMuted(isMuted);
    }
  }, [isMuted]);

  const handleMute = useCallback(() => {
    userToggledRef.current = true;
    setLocalMuted((prev) => !prev);
  }, []);

  if (video.id !== prevVideoId) {
    setPrevVideoId(video.id);
    setCaptionExpanded(false);
    setCanExpand(false);
    canExpandRef.current = false;
    userToggledRef.current = false;
    setLocalMuted(isMuted);
  }

  // Reset caption expansion when cell scrolls out of active view
  useEffect(() => {
    if (!isActive) {
      setCaptionExpanded(false);
    }
  }, [isActive]);

  // Programmatic scroll-to-top reset when caption expands
  useEffect(() => {
    if (captionExpanded) {
      const timer = setTimeout(() => {
        scrollViewRef.current?.scrollTo({ y: 0, animated: false });
      }, 10);
      return () => clearTimeout(timer);
    }
  }, [captionExpanded]);

  // Double tap to like state & refs
  const [hearts, setHearts] = useState<{ id: string; x: number; y: number }[]>([]);
  const lastTapRef = useRef<number>(0);
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isLikeMutatingRef = useRef<boolean>(false);

  // Track local liked state synchronously to guard against rapid tapping
  const localIsLikedRef = useRef(video.is_liked);
  useEffect(() => {
    localIsLikedRef.current = video.is_liked;
  }, [video.is_liked]);

  // Clean up single tap timeout on unmount
  useEffect(() => {
    return () => {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
    };
  }, []);

  // ── expo-video player ───────────────────────────────────────────────────────
  const player = useVideoPlayer({ uri: video.video_url }, (p) => {
    p.loop = true;
    p.muted = localMuted;
  });

  // Status event — drives buffering spinner and error state
  const { status: playerStatus } = useEvent(player, 'statusChange', {
    status: player.status,
  });
  const isBuffering = playerStatus === 'loading';
  const hasError    = playerStatus === 'error';

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
    player.muted = localMuted;
  }, [localMuted, player]);

  // ── Handlers ───────────────────────────────────────────────────────────────

  const handleVideoPress = useCallback(() => {
    setIsPaused((p) => !p);
  }, []);

  const handlePress = useCallback((e: GestureResponderEvent) => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;

    if (now - lastTapRef.current < DOUBLE_TAP_DELAY) {
      // Clear pending single-tap play/pause timeout
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }

      // Check synchronous ref to prevent duplicate/accidental actions
      if (localIsLikedRef.current) {
        lastTapRef.current = now;
        return;
      }

      // Optimistically lock the like action synchronously
      localIsLikedRef.current = true;

      // Normalize touch coordinates relative to the tapped VideoCard container
      const { locationX, locationY } = e.nativeEvent;

      // Add a heart burst
      const heartId = `${now}-${Math.random()}`;
      setHearts((prev) => [...prev, { id: heartId, x: locationX, y: locationY }]);

      // Trigger toggleLike if not already mutating
      if (!isLikeMutatingRef.current) {
        isLikeMutatingRef.current = true;
        toggleLike(video.id, false, video.user_id).finally(() => {
          isLikeMutatingRef.current = false;
        });
      }
    } else {
      // Potential single tap: wait 250ms before play/pause toggle
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
      }
      singleTapTimeoutRef.current = setTimeout(() => {
        singleTapTimeoutRef.current = null;
        handleVideoPress();
      }, 250);
    }
    lastTapRef.current = now;
  }, [video.id, toggleLike, handleVideoPress]);

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
      <TouchableWithoutFeedback onPress={handlePress} onLongPress={handleLongPress}>
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

          {/* Double Tap Hearts Overlay */}
          {hearts.map((h) => (
            <HeartBurst
              key={h.id}
              x={h.x}
              y={h.y}
              onFinish={() => {
                setHearts((prev) => prev.filter((item) => item.id !== h.id));
              }}
            />
          ))}
        </View>
      </TouchableWithoutFeedback>

      {/* ── Bottom gradient scrim ── */}
      <LinearGradient
        colors={['transparent', 'rgba(0,0,0,0.75)']}
        style={styles.gradientScrim}
        pointerEvents="none"
      />

      {/* ── Mute button — top right ── */}
      {/* ── Mute button — top right ── */}
      {isActive && (
        <TouchableOpacity style={styles.muteButton} onPress={handleMute}>
          <Ionicons
            name={localMuted ? 'volume-mute' : 'volume-high'}
            size={20}
            color="#FFFFFF"
          />
        </TouchableOpacity>
      )}

      {/* ── Action buttons — bottom right ── */}
      <View style={styles.actionsColumn}>
        {/* Like */}
        <TouchableOpacity
          style={styles.actionItem}
          onPress={() => toggleLike(video.id, video.is_liked, video.user_id)}
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
        {/* Hidden text node to measure lines for expansion (only when collapsed) */}
        {video.caption && !captionExpanded && (
          <Text
            key={`hidden-${video.id}`}
            style={[styles.captionText, styles.hiddenText]}
            pointerEvents="none"
            onTextLayout={(e) => {
              const nextCanExpand = e.nativeEvent.lines.length > 1;
              if (nextCanExpand !== canExpandRef.current) {
                canExpandRef.current = nextCanExpand;
                setCanExpand(nextCanExpand);
              }
            }}
          >
            {video.caption}
          </Text>
        )}

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
          <View style={styles.captionContainer}>
            {captionExpanded ? (
              <ScrollView
                ref={scrollViewRef}
                style={styles.captionScrollView}
                contentContainerStyle={styles.captionScrollContent}
                showsVerticalScrollIndicator={true}
                nestedScrollEnabled={true}
                bounces={false}
                overScrollMode="never"
              >
                <Text style={styles.captionText}>
                  {video.caption}
                  {'  '}
                  <Text
                    style={styles.moreLink}
                    onPress={() => setCaptionExpanded(false)}
                  >
                    less
                  </Text>
                </Text>
              </ScrollView>
            ) : (
              <View>
                <Text 
                  style={styles.captionText} 
                  numberOfLines={1} 
                  ellipsizeMode="tail"
                >
                  {video.caption}
                </Text>
                {canExpand && (
                  <TouchableOpacity 
                    onPress={() => setCaptionExpanded(true)}
                    style={styles.moreTouchTarget}
                  >
                    <Text style={styles.moreLink}>more</Text>
                  </TouchableOpacity>
                )}
              </View>
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
    bottom: 50,
    left: 12,
    right: 80,
    maxHeight: SCREEN_HEIGHT * 0.5,
    flexDirection: 'column',
    justifyContent: 'flex-end',
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
  captionContainer: {
    flexShrink: 1,
  },
  captionScrollView: {
    flexShrink: 1,
  },
  captionScrollContent: {
    flexGrow: 1,
  },
  captionText: {
    color: COLORS.caption,
    fontSize: 14,
    lineHeight: 20,
  },
  moreLink: {
    color: '#8B5CF6',
    fontSize: 13,
    fontWeight: '700',
  },
  moreTouchTarget: {
    marginTop: 4,
    alignSelf: 'flex-start',
  },
  hiddenText: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    opacity: 0.01,
    height: 1,
    overflow: 'hidden',
  },
  heartOverlay: {
    position: 'absolute',
    width: 60,
    height: 60,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
});
