import { useState, useEffect, useCallback } from 'react';
import supabase from '../../supabase/client';
import { FeedVideo } from './useFeed';
import { ProfileData } from './useProfile';

export function useProfileVideos(userId: string, profile: ProfileData | null) {
  const [videos, setVideos] = useState<FeedVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVideos = useCallback(async () => {
    if (!userId || !profile) return;
    
    setLoading(true);
    setError(null);
    try {
      const { data, error: fetchError } = await supabase
        .from('videos')
        .select('id, thumbnail_url, video_url, caption, created_at, user_id')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      // Fetch actual comment counts for all videos in parallel
      const videoIds = (data || []).map(v => v.id);
      const commentCounts: Record<string, number> = {};

      if (videoIds.length > 0) {
        // Batch fetch comment counts for all videos
        const { data: countData, error: countError } = await supabase
          .from('comments')
          .select('video_id', { count: 'exact', head: false })
          .in('video_id', videoIds);

        if (!countError && countData) {
          // Count occurrences per video_id
          for (const row of countData) {
            commentCounts[row.video_id] = (commentCounts[row.video_id] || 0) + 1;
          }
        }
      }

      const feedVideos: FeedVideo[] = (data || []).map(v => ({
        id: v.id,
        user_id: v.user_id,
        video_url: v.video_url,
        thumbnail_url: v.thumbnail_url,
        caption: v.caption,
        created_at: v.created_at,
        username: profile.username,
        avatar_url: profile.avatar_url,
        like_count: 0,
        comment_count: commentCounts[v.id] || 0,
        is_liked: false,
      }));

      setVideos(feedVideos);
    } catch (e: any) {
      console.error('Error fetching profile videos:', e);
      setError(e.message || 'Failed to fetch videos');
    } finally {
      setLoading(false);
    }
  }, [userId, profile]);

  useEffect(() => {
    fetchVideos();
  }, [fetchVideos]);

  return { videos, setVideos, loading, error, refresh: fetchVideos };
}
