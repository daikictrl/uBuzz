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
        comment_count: 0,
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

  return { videos, loading, error, refresh: fetchVideos };
}
