import { useState, useEffect, useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import supabase from '../../supabase/client';

export interface UseFollowResult {
  isFollowing: boolean;
  followerCount: number;
  toggleFollow: () => Promise<void>;
  loading: boolean;
  refresh: () => Promise<void>;
}

/**
 * useFollow — manages the following status and follower count of a user.
 * 
 * Concurrency-safe, memory-leak protected, and database/auth constraint resilient.
 */
export function useFollow(targetUserId: string): UseFollowResult {
  const [isFollowing, setIsFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const isMounted = useRef(true);
  const isToggling = useRef(false);

  // Set up mount status protection
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
    };
  }, []);

  const fetchFollowStatus = useCallback(async () => {
    if (!targetUserId) return;

    // Start loading state
    setLoading(true);

    try {
      // Fetch session safely
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError) {
        console.warn('[useFollow] session error during mount fetch:', sessionError.message);
        if (isMounted.current) {
          setLoading(false);
        }
        return;
      }

      const authUid = session?.user?.id;
      if (!authUid) {
        // Not authenticated, silently abort
        if (isMounted.current) {
          setLoading(false);
        }
        return;
      }

      if (isMounted.current) {
        setCurrentUserId(authUid);
      }

      // If user is looking at their own profile, follows cannot exist and toggle is disabled
      if (authUid === targetUserId) {
        // Still fetch count for accurate display, but isFollowing is always false
        const { count, error } = await supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', targetUserId);

        if (error) throw error;

        if (isMounted.current) {
          setIsFollowing(false);
          setFollowerCount(Math.max(0, count || 0));
        }
        return;
      }

      // Fetch follow relationship and follower count in parallel
      const [followingRes, countRes] = await Promise.all([
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('follower_id', authUid)
          .eq('following_id', targetUserId),
        supabase
          .from('follows')
          .select('*', { count: 'exact', head: true })
          .eq('following_id', targetUserId)
      ]);

      if (followingRes.error) throw followingRes.error;
      if (countRes.error) throw countRes.error;

      if (isMounted.current) {
        setIsFollowing((followingRes.count || 0) > 0);
        setFollowerCount(Math.max(0, countRes.count || 0));
      }
    } catch (err: any) {
      console.warn('[useFollow] fetch error:', err.message || err);
      // Suppress raw errors to user
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  }, [targetUserId]);

  // Trigger fetch on mount or targetUserId change
  useEffect(() => {
    fetchFollowStatus();
  }, [fetchFollowStatus]);

  const toggleFollow = useCallback(async () => {
    // Concurrency lock
    if (isToggling.current) {
      console.log('[useFollow] Toggle already in progress, ignoring tap.');
      return;
    }

    let uid = currentUserId;

    // Lazy load user ID if not set
    if (!uid) {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        uid = session?.user?.id || null;
        if (uid && isMounted.current) {
          setCurrentUserId(uid);
        }
      } catch (err: any) {
        console.warn('[useFollow] Auth fetch error during toggle:', err.message || err);
        return;
      }
    }

    if (!uid) {
      console.warn('[useFollow] Aborting toggle: no authenticated session found.');
      return;
    }

    // Safety constraint: Prevent self-follow
    if (uid === targetUserId) {
      console.warn('[useFollow] Aborting toggle: self-follow is prohibited.');
      return;
    }

    isToggling.current = true;

    // Cache current state for rollback
    const wasFollowing = isFollowing;
    const prevCount = followerCount;

    // Step 1: Optimistic Update
    const nextFollowing = !wasFollowing;
    const nextCount = nextFollowing ? prevCount + 1 : Math.max(0, prevCount - 1);

    setIsFollowing(nextFollowing);
    setFollowerCount(nextCount);

    try {
      if (nextFollowing) {
        // Step 2: Supabase Follow Insert
        const { error } = await supabase
          .from('follows')
          .insert({
            follower_id: uid,
            following_id: targetUserId
          });

        if (error) {
          // Handle unique constraint duplicate follow gracefully
          if (error.code === '23505') {
            console.warn('[useFollow] Follow relation already exists in database.');
          } else {
            throw error;
          }
        }
      } else {
        // Step 2: Supabase Unfollow Delete
        const { error } = await supabase
          .from('follows')
          .delete()
          .eq('follower_id', uid)
          .eq('following_id', targetUserId);

        if (error) throw error;
      }
    } catch (err: any) {
      console.warn('[useFollow] Mutation error:', err.message || err);

      // Step 3: Rollback on Error
      if (isMounted.current) {
        setIsFollowing(wasFollowing);
        setFollowerCount(prevCount);
      }

      // UI Friendly Alert without raw DB details
      const actionName = nextFollowing ? 'follow' : 'unfollow';
      Alert.alert('Error', `Could not ${actionName} user. Try again.`);
    } finally {
      isToggling.current = false;
    }
  }, [currentUserId, targetUserId, isFollowing, followerCount]);

  return {
    isFollowing,
    followerCount,
    toggleFollow,
    loading,
    refresh: fetchFollowStatus
  };
}
