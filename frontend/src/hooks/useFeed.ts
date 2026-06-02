import { useState, useEffect, useCallback, useRef } from 'react';
import supabase from '../../supabase/client';

export type FeedType = 'forYou' | 'following';

export interface FeedVideo {
  id: string;
  user_id: string;
  video_url: string;
  thumbnail_url: string | null;
  caption: string | null;
  created_at: string;
  username: string;
  avatar_url: string | null;
  like_count: number;
  comment_count: number;
  is_liked: boolean;
}

interface UseFeedResult {
  videos: FeedVideo[];
  loadMore: () => void;
  refresh: () => Promise<void>;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  setVideos: React.Dispatch<React.SetStateAction<FeedVideo[]>>;
  optimisticAddCommentCount: (videoId: string) => void;
  optimisticDeleteCommentCount: (videoId: string) => void;
  optimisticRestoreCommentCount: (videoId: string) => void;
  followedCount: number;
}

const PAGE_SIZE = 10;

export function useFeed(feedType: FeedType): UseFeedResult {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [followedCount, setFollowedCount] = useState(0);

  const isMounted = useRef(true);
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const pageRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const feedTypeRef = useRef(feedType);
  const currentRequestId = useRef(0);

  // Synchronous reset on feedType switch to prevent rendering stale frames
  const [prevFeedType, setPrevFeedType] = useState<FeedType>(feedType);
  if (feedType !== prevFeedType) {
    setPrevFeedType(feedType);
    setVideos([]);
    setLoading(true);
    setError(null);
    setFollowedCount(0);
    pageRef.current = 0;
    currentRequestId.current++;
    isLoadingMoreRef.current = false;
  }

  const locallyDeletedCommentIdsRef = useRef<Set<string>>(new Set());
  const currentUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (isMounted.current) {
        currentUserIdRef.current = data?.user?.id ?? null;
      }
    });
  }, []);

  // ── Global Realtime Comments Subscription ──
  // Uses a ref for currentUserId so the channel is created ONCE and never torn down/re-created.
  useEffect(() => {
    const channel = supabase
      .channel(`comments_feed_global_${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
        },
        (payload) => {
          const newComment = payload.new;
          if (!newComment) return;

          // If comment is from another user, increment the counter
          if (newComment.user_id !== currentUserIdRef.current) {
            setVideos((prev) =>
              prev.map((v) =>
                v.id === newComment.video_id
                  ? { ...v, comment_count: Number(v.comment_count || 0) + 1 }
                  : v
              )
            );
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
        },
        (payload) => {
          const oldComment = payload.old;
          if (!oldComment) return;

          const commentId = oldComment.id;
          const videoId = oldComment.video_id;

          if (!videoId) return;

          // Check if this was a local deletion
          if (locallyDeletedCommentIdsRef.current.has(commentId)) {
            locallyDeletedCommentIdsRef.current.delete(commentId);
          } else {
            // External deletion, decrement count
            setVideos((prev) =>
              prev.map((v) =>
                v.id === videoId
                  ? { ...v, comment_count: Math.max(0, Number(v.comment_count || 0) - 1) }
                  : v
              )
            );
          }
        }
      )
      .subscribe((status) => {
        console.log('[useFeed] Global comments channel status:', status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const optimisticAddCommentCount = useCallback((videoId: string) => {
    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId
          ? { ...v, comment_count: Number(v.comment_count || 0) + 1 }
          : v
      )
    );
  }, []);

  const optimisticDeleteCommentCount = useCallback((videoId: string, commentId?: string) => {
    if (commentId) {
      locallyDeletedCommentIdsRef.current.add(commentId);
    }
    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId
          ? { ...v, comment_count: Math.max(0, Number(v.comment_count || 0) - 1) }
          : v
      )
    );
  }, []);

  const optimisticRestoreCommentCount = useCallback((videoId: string, commentId?: string) => {
    if (commentId) {
      locallyDeletedCommentIdsRef.current.delete(commentId);
    }
    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId
          ? { ...v, comment_count: Number(v.comment_count || 0) + 1 }
          : v
      )
    );
  }, []);

  /**
   * Core fetch function.
   * @param page    0-indexed page number
   * @param isRefresh  true when triggered by pull-to-refresh
   */
  const fetchPage = useCallback(
    async (page: number, isRefresh = false) => {
      // Guard: don't stack simultaneous requests
      if (isLoadingMoreRef.current) return;
      isLoadingMoreRef.current = true;

      const requestId = ++currentRequestId.current;

      if (isMounted.current) {
        setError(null);
        if (isRefresh) {
          setRefreshing(true);
        } else if (page === 0) {
          setLoading(true);
        }
      }

      try {
        let countOfFollowed = 0;
        
        // If we are on following feed, fetch followed user count to determine empty states
        if (feedTypeRef.current === 'following') {
          const { data: sessionData } = await supabase.auth.getSession();
          const authUid = sessionData?.session?.user?.id;
          if (authUid) {
            const { count, error: countErr } = await supabase
              .from('follows')
              .select('*', { count: 'exact', head: true })
              .eq('follower_id', authUid);
            if (!countErr) {
              countOfFollowed = count || 0;
            }
          }
        }

        const { data, error: rpcError } = await supabase.rpc('get_feed', {
          feed_type: feedTypeRef.current === 'forYou' ? 'for_you' : 'following',
          page_num: page,
        });

        // Request-awareness: verify this is still the active request
        if (requestId !== currentRequestId.current) {
          return;
        }

        if (rpcError) throw rpcError;

        const rows = (data as FeedVideo[]) ?? [];

        if (isMounted.current) {
          if (feedTypeRef.current === 'following') {
            setFollowedCount(countOfFollowed);
          }

          if (page === 0) {
            setVideos(rows);
          } else {
            // Only append if we actually got results (prevents re-render when at end)
            if (rows.length > 0) {
              setVideos((prev) => {
                const combined = [...prev, ...rows];
                const uniqueIds = new Set<string>();
                return combined.filter((v) => {
                  if (uniqueIds.has(v.id)) return false;
                  uniqueIds.add(v.id);
                  return true;
                });
              });
            }
          }
        }
      } catch (e: unknown) {
        if (requestId !== currentRequestId.current) {
          return;
        }
        const msg = e instanceof Error ? e.message : 'An error occurred.';
        console.error('[useFeed] fetch error:', msg);
        if (isMounted.current) {
          setError('Something went wrong. Pull down to refresh.');
        }
      } finally {
        if (requestId === currentRequestId.current) {
          if (isMounted.current) {
            setLoading(false);
            setRefreshing(false);
          }
          isLoadingMoreRef.current = false;
        }
      }
    },
    [], // stable — all mutable state accessed via refs
  );

  // When feedType changes → fetch page 0
  useEffect(() => {
    feedTypeRef.current = feedType;
    fetchPage(0);
  }, [feedType, fetchPage]);

  /** Append next page (no-op if already loading) */
  const loadMore = useCallback(() => {
    if (isLoadingMoreRef.current) return;
    const nextPage = pageRef.current + 1;
    pageRef.current = nextPage;
    fetchPage(nextPage);
  }, [fetchPage]);

  /** Pull-to-refresh: reset to page 0 */
  const refresh = useCallback(async () => {
    pageRef.current = 0;
    await fetchPage(0, true);
  }, [fetchPage]);

  return {
    videos,
    loadMore,
    refresh,
    loading,
    refreshing,
    error,
    setVideos,
    optimisticAddCommentCount,
    optimisticDeleteCommentCount,
    optimisticRestoreCommentCount,
    followedCount,
  };
}
