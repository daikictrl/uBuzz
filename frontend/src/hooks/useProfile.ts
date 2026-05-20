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

const activeRecoveries = new Map<string, Promise<any>>();

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
          .maybeSingle(),

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

      let userData = userRes.data;

      // If profile row is missing and this is the authenticated user's own profile, attempt recovery
      if (!userData && authUid === userId) {
        let recoveryPromise = activeRecoveries.get(userId);
        if (!recoveryPromise) {
          console.warn(`Profile row for authenticated user ${userId} is missing. Attempting lightweight recovery...`);
          recoveryPromise = (async () => {
            const userEmail = sessionData?.session?.user?.email || `placeholder_${userId.substring(0, 8)}@ubuzz.campus`;
            
            // Generate unique fallback credentials to satisfy DB constraints
            const uniqueId = Math.random().toString(36).substring(2, 8);
            const fallbackUsername = `user_${uniqueId}`;
            const fallbackMatricule = `IU${Math.floor(10000 + Math.random() * 90000)}`;

            const { data, error } = await supabase
              .from('users')
              .insert({
                id: userId,
                email: userEmail,
                username: fallbackUsername,
                matricule: fallbackMatricule,
                bio: 'Auto-recovered profile placeholder',
              })
              .select('id, username, avatar_url, bio, matricule, email')
              .maybeSingle();

            if (error) {
              // If duplicate key error occurs, it means another concurrent request succeeded
              if (error.code === '23505') {
                console.log('Recovery collision detected (another call inserted first). Fetching newly created profile...');
                const { data: fetchedData } = await supabase
                  .from('users')
                  .select('id, username, avatar_url, bio, matricule, email')
                  .eq('id', userId)
                  .maybeSingle();
                if (fetchedData) return fetchedData;
              }
              throw error;
            }
            return data;
          })();
          activeRecoveries.set(userId, recoveryPromise);
        }

        try {
          const recoveryData = await recoveryPromise;
          if (recoveryData) {
            userData = recoveryData;
          }
        } catch (recoveryErr) {
          console.warn('Lightweight profile recovery insertion failed:', recoveryErr);
        } finally {
          activeRecoveries.delete(userId);
        }
      }

      if (!userData) {
        console.warn(`Profile row not found for user ${userId}. No recovery possible.`);
        throw new Error("Profile not found");
      }

      if (videoCountRes.error) throw videoCountRes.error;
      if (likesRes.error) throw likesRes.error;
      if (followersRes.error) throw followersRes.error;
      if (followingRes.error) throw followingRes.error;
      if (isFollowingRes.error) throw isFollowingRes.error;

      setProfile({
        id: userData.id,
        username: userData.username,
        avatar_url: userData.avatar_url,
        bio: userData.bio,
        matricule: userData.matricule,
        email: userData.email,
        stats: {
          videoCount: videoCountRes.count || 0,
          totalLikes: likesRes.count || 0,
          followers: followersRes.count || 0,
          following: followingRes.count || 0,
        }
      });

      setIsFollowing((isFollowingRes.count || 0) > 0);

    } catch (err: any) {
      if (err.message === "Profile not found") {
        console.warn('Profile row missing for:', userId);
      } else {
        console.warn('Error fetching profile:', err);
      }
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
