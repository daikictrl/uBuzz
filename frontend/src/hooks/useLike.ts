import { useCallback } from 'react';
import { Alert } from 'react-native';
import supabase from '../../supabase/client';
import { FeedVideo } from './useFeed';

type SetVideos = React.Dispatch<React.SetStateAction<FeedVideo[]>>;

interface UseLikeResult {
  toggleLike: (videoId: string, currentIsLiked: boolean, videoOwnerId?: string) => Promise<void>;
}

/**
 * useLike — optimistic like/unlike toggle.
 *
 * Accepts setVideos from useFeed so it can update the shared feed state
 * in-place without re-fetching. Reverts to the original state on error.
 */
export function useLike(setVideos: SetVideos): UseLikeResult {
  const toggleLike = useCallback(
    async (videoId: string, currentIsLiked: boolean, videoOwnerId?: string) => {
      // ── Step 1: Optimistic update ─────────────────────────────────────────
      const applyDelta = (liked: boolean, delta: number) => {
        setVideos((prev) =>
          prev.map((v) =>
            v.id === videoId
              ? { ...v, is_liked: liked, like_count: v.like_count + delta }
              : v,
          ),
        );
      };

      // Apply forward delta immediately (before the network call)
      applyDelta(!currentIsLiked, currentIsLiked ? -1 : +1);

      // ── Step 2: Supabase write ────────────────────────────────────────────
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) throw new Error('Not authenticated');

        if (currentIsLiked) {
          // Unlike: delete the row
          const { error } = await supabase
            .from('likes')
            .delete()
            .eq('user_id', user.id)
            .eq('video_id', videoId);

          if (error) throw error;
        } else {
          // Like: insert a new row
          const { error } = await supabase
            .from('likes')
            .insert({ user_id: user.id, video_id: videoId });

          if (error) {
            // Gracefully ignore unique constraint violations (already liked)
            if (error.code === '23505') {
              console.log('[useLike] Duplicate like ignored gracefully');
            } else {
              throw error;
            }
          } else {
            // Broadcast like notification to video owner if not liking own video
            if (videoOwnerId && user.id !== videoOwnerId) {
              const notifChannel = supabase.channel(`channel-notif-likes-${videoOwnerId}`);
              notifChannel
                .send({
                  type: 'broadcast',
                  event: 'like',
                  payload: { userId: user.id },
                })
                .then(() => {
                  supabase.removeChannel(notifChannel);
                })
                .catch((err) => {
                  console.error('[useLike] Error sending like broadcast:', err);
                });
            }
          }
        }
      } catch (e: unknown) {
        // ── Step 3: Revert optimistic update on error ──────────────────────
        applyDelta(currentIsLiked, currentIsLiked ? +1 : -1);

        const msg =
          e instanceof Error ? e.message : 'An unexpected error occurred.';
        console.error('[useLike] error:', msg);
        Alert.alert('Error', 'Could not update like. Try again.');
      }
    },
    [setVideos],
  );

  return { toggleLike };
}

