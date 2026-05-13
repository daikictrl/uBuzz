import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  StyleSheet,
  Dimensions,
  ViewToken,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useIsFocused, useFocusEffect, useNavigation } from '@react-navigation/native';
import supabase from '../../supabase/client';
import { useFeed, FeedType, FeedVideo } from '../hooks/useFeed';
import { useLike } from '../hooks/useLike';
import VideoCard from '../components/VideoCard';
import CommentsSheet from '../components/CommentsSheet';

// ─── Constants ────────────────────────────────────────────────────────────────

const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Skeleton placeholder (Phase 7 will replace with animated version) ────────

function SkeletonCard() {
  return (
    <View style={[styles.card, { backgroundColor: '#1a1a1a', justifyContent: 'flex-end' }]}>
      {/* Simulated avatar + text block */}
      <View style={{ padding: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#2e2e2e' }} />
          <View style={{ width: 100, height: 14, borderRadius: 7, backgroundColor: '#2e2e2e' }} />
        </View>
        <View style={{ width: '80%', height: 12, borderRadius: 6, backgroundColor: '#2e2e2e' }} />
        <View style={{ width: '60%', height: 12, borderRadius: 6, backgroundColor: '#2e2e2e' }} />
      </View>
    </View>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();

  const [feedType, setFeedType] = useState<FeedType>('forYou');
  const {
    videos,
    loadMore,
    refresh,
    loading,
    refreshing,
    error,
    setVideos,
    markCommentAsLocallyDeleted,
    clearAllLocallyDeletedComments,
    consumeLocallyDeletedComment,
    optimisticDeleteCommentCount,
    optimisticRestoreCommentCount,
  } = useFeed(feedType);
  const { toggleLike } = useLike(setVideos);

  // Track current user ID for VideoCard ownership checks
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(data?.user?.id ?? null);
    });
  }, []);

  // Comments Sheet state
  const [activeCommentVideo, setActiveCommentVideo] = useState<FeedVideo | null>(null);

  // Active video tracking — use ref to avoid re-render on every scroll
  const activeIndexRef = useRef<number>(0);
  const [activeIndex, setActiveIndex] = useState(0);

  const onViewableItemsChanged = useCallback(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems.length > 0 && viewableItems[0].index !== null) {
        const idx = viewableItems[0].index;
        activeIndexRef.current = idx;
        setActiveIndex(idx);
      }
    },
    [],
  );

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 80,
  }).current;

  // ── Pause all videos when screen loses focus (e.g. upload modal opens) ──────
  const isFocused = useIsFocused();

  // Derived active index: -1 when screen is not visible → all VideoCards pause
  const effectiveActiveIndex = isFocused ? activeIndex : -1;

  // ── Auto-refresh when returning to this screen after a completed upload ──────
  // We skip the very first focus event (initial mount) to avoid a double-fetch.
  const isFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (isFirstFocus.current) {
        isFirstFocus.current = false;
        return;
      }
      // Screen re-gained focus (e.g. user posted a video and came back)
      refresh();
    }, [refresh]),
  );

  // Reset active index when switching tabs
  const handleTabSwitch = useCallback((type: FeedType) => {
    setFeedType(type);
    setActiveIndex(0);
    activeIndexRef.current = 0;
  }, []);

  // Remove deleted video from list
  const handleDelete = useCallback(
    (videoId: string) => {
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
    },
    [setVideos],
  );

  // Comment handler
  const handleComment = useCallback((video: FeedVideo) => {
    setActiveCommentVideo(video);
  }, []);

  // Profile navigation
  const handleProfile = useCallback((userId: string) => {
    navigation.navigate('Profile', { userId });
  }, [navigation]);

  // ── Render helpers ──────────────────────────────────────────────────────────

  const renderItem = useCallback(
    ({ item, index }: { item: FeedVideo; index: number }) => (
      <VideoCard
        video={item}
        isActive={index === effectiveActiveIndex}
        currentUserId={currentUserId}
        toggleLike={toggleLike}
        onComment={handleComment}
        onProfile={handleProfile}
        onDelete={handleDelete}
      />
    ),
    [effectiveActiveIndex, currentUserId, toggleLike, handleComment, handleProfile, handleDelete],
  );

  const keyExtractor = useCallback((item: FeedVideo) => item.id, []);

  // ── Loading skeleton ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={styles.root}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        {[0, 1, 2].map((i) => (
          <SkeletonCard key={i} />
        ))}
        {/* Tab bar still visible during load */}
        <FloatingTabs
          feedType={feedType}
          onSwitch={handleTabSwitch}
          insetTop={insets.top}
        />
      </View>
    );
  }

  // ── Error state ─────────────────────────────────────────────────────────────
  if (error && videos.length === 0) {
    return (
      <View style={[styles.root, styles.centered]}>
        <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />
        <Text style={styles.stateText}>Something went wrong. Pull down to refresh.</Text>
        <TouchableOpacity style={styles.retryButton} onPress={refresh}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
        <FloatingTabs
          feedType={feedType}
          onSwitch={handleTabSwitch}
          insetTop={insets.top}
        />
      </View>
    );
  }

  // ── Empty states ────────────────────────────────────────────────────────────
  const emptyMessage =
    feedType === 'forYou'
      ? 'No videos yet. Be the first to post!'
      : 'You are not following anyone yet.\nExplore the For You feed and follow students you like.';

  return (
    <View style={styles.root}>
      <StatusBar barStyle="light-content" translucent backgroundColor="transparent" />

      <FlatList<FeedVideo>
        data={videos}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        // ── Paging ──
        pagingEnabled
        snapToInterval={SCREEN_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        // ── Infinite scroll ──
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        // ── Pull to refresh ──
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refresh}
            tintColor="#FFFFFF"
            colors={['#FFFFFF']}
          />
        }
        // ── Active video detection ──
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        // ── Performance ──
        removeClippedSubviews
        windowSize={3}
        maxToRenderPerBatch={2}
        initialNumToRender={1}
        // ── Empty state ──
        ListEmptyComponent={
          <View style={[styles.card, styles.centered]}>
            <Text style={[styles.stateText, { textAlign: 'center', paddingHorizontal: 32 }]}>
              {emptyMessage}
            </Text>
          </View>
        }
      />

      {/* Floating tab bar — rendered on top of FlatList */}
      <FloatingTabs
        feedType={feedType}
        onSwitch={handleTabSwitch}
        insetTop={insets.top}
      />

      {/* Comments Sheet */}
      <CommentsSheet
        visible={!!activeCommentVideo}
        onClose={() => setActiveCommentVideo(null)}
        videoId={activeCommentVideo?.id || null}
        currentUserId={currentUserId}
        onProfile={handleProfile}
        markCommentAsLocallyDeleted={markCommentAsLocallyDeleted}
        clearAllLocallyDeletedComments={clearAllLocallyDeletedComments}
        consumeLocallyDeletedComment={consumeLocallyDeletedComment}
        optimisticDeleteCommentCount={optimisticDeleteCommentCount}
        optimisticRestoreCommentCount={optimisticRestoreCommentCount}
      />
    </View>
  );
}

// ─── Floating Tabs ─────────────────────────────────────────────────────────────

interface FloatingTabsProps {
  feedType: FeedType;
  onSwitch: (type: FeedType) => void;
  insetTop: number;
}

function FloatingTabs({ feedType, onSwitch, insetTop }: FloatingTabsProps) {
  return (
    <View style={[styles.tabsContainer, { top: insetTop + 8 }]}>
      <TouchableOpacity onPress={() => onSwitch('forYou')} activeOpacity={0.8}>
        <Text style={[styles.tabText, feedType === 'forYou' && styles.tabTextActive]}>
          For You
        </Text>
        {feedType === 'forYou' && <View style={styles.tabIndicator} />}
      </TouchableOpacity>

      <View style={styles.tabDivider} />

      <TouchableOpacity onPress={() => onSwitch('following')} activeOpacity={0.8}>
        <Text style={[styles.tabText, feedType === 'following' && styles.tabTextActive]}>
          Following
        </Text>
        {feedType === 'following' && <View style={styles.tabIndicator} />}
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000000',
  },
  card: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  centered: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  stateText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 15,
    fontWeight: '500',
    lineHeight: 22,
  },
  retryButton: {
    marginTop: 16,
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  retryText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  // ── Floating tabs ──
  tabsContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  tabDivider: {
    width: 1,
    height: 16,
    backgroundColor: 'rgba(255,255,255,0.35)',
    marginHorizontal: 16,
  },
  tabText: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    paddingBottom: 4,
  },
  tabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  tabIndicator: {
    height: 2,
    backgroundColor: '#FFFFFF',
    borderRadius: 1,
    marginTop: 2,
  },
});
