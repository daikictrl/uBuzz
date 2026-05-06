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
}

const PAGE_SIZE = 10;

export function useFeed(feedType: FeedType): UseFeedResult {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Use refs to prevent stale closure issues in callbacks
  const pageRef = useRef(0);
  const isLoadingMoreRef = useRef(false);
  const feedTypeRef = useRef(feedType);

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
      setError(null);

      if (isRefresh) {
        setRefreshing(true);
      } else if (page === 0) {
        setLoading(true);
      }

      try {
        const { data, error: rpcError } = await supabase.rpc('get_feed', {
          feed_type: feedTypeRef.current === 'forYou' ? 'for_you' : 'following',
          page_num: page,
        });

        if (rpcError) throw rpcError;

        const rows = (data as FeedVideo[]) ?? [];

        if (page === 0) {
          setVideos(rows);
        } else {
          // Only append if we actually got results (prevents re-render when at end)
          if (rows.length > 0) {
            setVideos((prev) => [...prev, ...rows]);
          }
        }
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'An error occurred.';
        console.error('[useFeed] fetch error:', msg);
        setError('Something went wrong. Pull down to refresh.');
      } finally {
        setLoading(false);
        setRefreshing(false);
        isLoadingMoreRef.current = false;
      }
    },
    [], // stable — all mutable state accessed via refs
  );

  // When feedType changes → reset everything and re-fetch page 0
  useEffect(() => {
    feedTypeRef.current = feedType;
    pageRef.current = 0;
    setVideos([]);
    setLoading(true);
    setError(null);
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

  return { videos, loadMore, refresh, loading, refreshing, error, setVideos };
}
