import { useState, useEffect, useCallback } from 'react';
import supabase from '../../supabase/client';

export interface ProfileData {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  matricule: string;
  email: string;
  stats: {
    videoCount: number;
    totalLikes: number;
    followers: number;
    following: number;
  };
}

export function useProfile(userId: string) {
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!userId) return;

    setLoading(true);
    setError(null);

    try {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) throw sessionError;

      const authUid = sessionData?.session?.user?.id;

      const [
        userRes,
        videoCountRes,
        likesRes,
        followersRes,
        followingRes,
        isFollowingRes
      ] = await Promise.all([
        supabase
          .from('users')
          .select('id, username, avatar_url, bio, matricule, email')
          .eq('id', userId)
          .single(),

        supabase
          .from('videos')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', userId),

        supabase
          .from('likes')
          .select('*, videos!inner(user_id)', { count: 'exact', head: true })
          .eq('videos.user_id', userId),

        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', userId),

        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', userId),

        authUid && authUid !== userId
          ? supabase
              .from('follows')
              .select('*', { count: 'exact', head: true })
              .eq('follower_id', authUid)
              .eq('following_id', userId)
          : Promise.resolve({ count: 0, error: null })
      ]);

      if (userRes.error) throw userRes.error;
      if (videoCountRes.error) throw videoCountRes.error;
      if (likesRes.error) throw likesRes.error;
      if (followersRes.error) throw followersRes.error;
      if (followingRes.error) throw followingRes.error;
      if (isFollowingRes.error) throw isFollowingRes.error;

      setProfile({
        id: userRes.data.id,
        username: userRes.data.username,
        avatar_url: userRes.data.avatar_url,
        bio: userRes.data.bio,
        matricule: userRes.data.matricule,
        email: userRes.data.email,
        stats: {
          videoCount: videoCountRes.count || 0,
          totalLikes: likesRes.count || 0,
          followers: followersRes.count || 0,
          following: followingRes.count || 0,
        }
      });

      setIsFollowing((isFollowingRes.count || 0) > 0);

    } catch (err: any) {
      console.error('Error fetching profile:', err);
      setError(err.message || 'Failed to load profile.');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  return {
    profile,
    isFollowing,
    loading,
    error,
    refresh: fetchProfile
  };
}
