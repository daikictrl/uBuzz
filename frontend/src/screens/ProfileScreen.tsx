import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, Modal, FlatList, Pressable, Animated } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Image } from 'expo-image';
import { useRoute, useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '../hooks/useProfile';
import { useProfileVideos } from '../hooks/useProfileVideos';
import { useFollow } from '../hooks/useFollow';
import supabase from '../../supabase/client';
import VideoCard from '../components/VideoCard';
import EditProfileSheet from '../components/EditProfileSheet';
import { FeedVideo } from '../hooks/useFeed';
import SkeletonGrid from '../components/SkeletonGrid';
import { badgeManager } from '../lib/badge';
import CommentsSheet from '../components/CommentsSheet';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_SIZE = SCREEN_WIDTH / 3;

function ProfileSkeleton() {
  const pulseAnim = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.8,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0.4,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();

    return () => {
      pulse.stop();
    };
  }, [pulseAnim]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        {/* Avatar */}
        <Animated.View style={[styles.avatarPlaceholder, { opacity: pulseAnim }]} />
        
        {/* Username */}
        <Animated.View style={[styles.skeletonUsername, { opacity: pulseAnim }]} />

        {/* Matricule */}
        <Animated.View style={[styles.skeletonMatricule, { opacity: pulseAnim }]} />

        {/* Bio */}
        <Animated.View style={[styles.skeletonBio, { opacity: pulseAnim }]} />

        {/* Stats Row */}
        <View style={styles.statsRow}>
          <View style={styles.statCol}>
            <Animated.View style={[styles.skeletonStatNum, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.skeletonStatLabel, { opacity: pulseAnim }]} />
          </View>
          <View style={styles.statCol}>
            <Animated.View style={[styles.skeletonStatNum, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.skeletonStatLabel, { opacity: pulseAnim }]} />
          </View>
          <View style={styles.statCol}>
            <Animated.View style={[styles.skeletonStatNum, { opacity: pulseAnim }]} />
            <Animated.View style={[styles.skeletonStatLabel, { opacity: pulseAnim }]} />
          </View>
        </View>

        {/* Action Button */}
        <View style={styles.actionsContainer}>
          <Animated.View style={[styles.skeletonButton, { opacity: pulseAnim }]} />
        </View>
      </View>

      {/* Grid below header */}
      <SkeletonGrid />
    </SafeAreaView>
  );
}

export default function ProfileScreen() {
  const route = useRoute<any>();
  const paramUserId = route.params?.userId;
  const [authUid, setAuthUid] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthUid(data.session?.user?.id || null);
    });
  }, []);

  if (!paramUserId && !authUid) {
    return <ProfileSkeleton />;
  }

  const targetUserId = paramUserId || authUid;
  
  return <ProfileContent userId={targetUserId!} isOwnProfile={!paramUserId || paramUserId === authUid} authUid={authUid} />;
}

function ProfileContent({ userId, isOwnProfile, authUid }: { userId: string, isOwnProfile: boolean, authUid: string | null }) {
  const navigation = useNavigation<any>();
  const { profile, loading: profileLoading, error: profileError, refresh: refreshProfile } = useProfile(userId);
  const { videos, setVideos, loading: videosLoading, refresh: refreshVideos } = useProfileVideos(userId, profile);
  const {
    isFollowing,
    followerCount,
    toggleFollow,
    loading: followLoading,
    refresh: refreshFollow
  } = useFollow(userId);

  const [selectedVideo, setSelectedVideo] = useState<FeedVideo | null>(null);
  const [activeCommentVideo, setActiveCommentVideo] = useState<FeedVideo | null>(null);
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Mute preference syncing for modal video playback
  const [isMuted, setIsMuted] = useState(false);
  useEffect(() => {
    AsyncStorage.getItem('ubuzz_mute_preference').then((val) => {
      if (val !== null) setIsMuted(val === 'true');
    });
  }, [selectedVideo]);

  const handleMuteToggle = useCallback(() => {
    setIsMuted((m) => {
      const next = !m;
      AsyncStorage.setItem('ubuzz_mute_preference', String(next));
      return next;
    });
  }, []);

  const locallyDeletedCommentIdsRef = useRef<Set<string>>(new Set());
  const authUidRef = useRef(authUid);
  authUidRef.current = authUid;

  // ── Global Realtime Comments Subscription for Profile ──
  // Uses a ref for authUid so the channel is created ONCE per userId and never torn down/re-created.
  useEffect(() => {
    const channel = supabase
      .channel(`comments_profile_${userId}_${Date.now()}`)
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
          if (newComment.user_id !== authUidRef.current) {
            setVideos((prev) =>
              prev.map((v) =>
                v.id === newComment.video_id
                  ? { ...v, comment_count: Number(v.comment_count || 0) + 1 }
                  : v
              )
            );
            setSelectedVideo((prev) =>
              prev && prev.id === newComment.video_id
                ? { ...prev, comment_count: Number(prev.comment_count || 0) + 1 }
                : prev
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
            setSelectedVideo((prev) =>
              prev && prev.id === videoId
                ? { ...prev, comment_count: Math.max(0, Number(prev.comment_count || 0) - 1) }
                : prev
            );
          }
        }
      )
      .subscribe((status) => {
        console.log(`[ProfileScreen] Global comments channel status for ${userId}:`, status);
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const optimisticAddCommentCount = useCallback((videoId: string) => {
    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId ? { ...v, comment_count: Number(v.comment_count || 0) + 1 } : v
      )
    );
    setSelectedVideo((prev) =>
      prev && prev.id === videoId
        ? { ...prev, comment_count: Number(prev.comment_count || 0) + 1 }
        : prev
    );
  }, [setVideos]);

  const optimisticDeleteCommentCount = useCallback((videoId: string, commentId?: string) => {
    if (commentId) {
      locallyDeletedCommentIdsRef.current.add(commentId);
    }
    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId ? { ...v, comment_count: Math.max(0, Number(v.comment_count || 0) - 1) } : v
      )
    );
    setSelectedVideo((prev) =>
      prev && prev.id === videoId
        ? { ...prev, comment_count: Math.max(0, Number(prev.comment_count || 0) - 1) }
        : prev
    );
  }, [setVideos]);

  const optimisticRestoreCommentCount = useCallback((videoId: string, commentId?: string) => {
    if (commentId) {
      locallyDeletedCommentIdsRef.current.delete(commentId);
    }
    setVideos((prev) =>
      prev.map((v) =>
        v.id === videoId ? { ...v, comment_count: Number(v.comment_count || 0) + 1 } : v
      )
    );
    setSelectedVideo((prev) =>
      prev && prev.id === videoId
        ? { ...prev, comment_count: Number(prev.comment_count || 0) + 1 }
        : prev
    );
  }, [setVideos]);

  const handleDelete = useCallback(
    (videoId: string) => {
      setVideos((prev) => prev.filter((v) => v.id !== videoId));
      setSelectedVideo(null);
    },
    [setVideos],
  );

  // Re-fetch profile + videos every time this screen gains focus.
  // Fixes stale data when returning after an upload or interaction.
  useFocusEffect(
    useCallback(() => {
      refreshProfile();
      refreshFollow();
    }, [refreshProfile, refreshFollow])
  );

  // Reset notification badge on focus if this is our own profile
  useFocusEffect(
    useCallback(() => {
      if (isOwnProfile) {
        badgeManager.reset();
      }
    }, [isOwnProfile])
  );

  if (profileLoading) {
    return <ProfileSkeleton />;
  }

  if (profileError || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={64} color="#EF4444" style={{ marginBottom: 16 }} />
          <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
            Profile Not Found
          </Text>
          <Text style={{ color: '#9CA3AF', fontSize: 14, textAlign: 'center', marginHorizontal: 32, marginBottom: 24 }}>
            The profile row in the database could not be loaded or is missing.
          </Text>
          
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity 
              style={{
                paddingHorizontal: 20,
                paddingVertical: 12,
                backgroundColor: '#8B5CF6',
                borderRadius: 10,
              }}
              onPress={() => refreshProfile()}
            >
              <Text style={{ color: '#FFFFFF', fontWeight: '600' }}>Retry</Text>
            </TouchableOpacity>

            <TouchableOpacity 
              style={{
                paddingHorizontal: 20,
                paddingVertical: 12,
                borderWidth: 1,
                borderColor: '#EF4444',
                borderRadius: 10,
              }}
              onPress={async () => {
                await supabase.auth.signOut({ scope: 'local' });
              }}
            >
              <Text style={{ color: '#EF4444', fontWeight: '600' }}>Force Logout</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const maskMatricule = (mat: string) => {
    if (!mat) return null;
    if (mat.length <= 4) return mat;
    return "IU" + "*".repeat(Math.max(mat.length - 4, 0)) + mat.slice(-2);
  };

  const handleEditProfile = () => {
    setIsEditProfileVisible(true);
  };

  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      await supabase.auth.signOut();
      // onAuthStateChange in App.tsx handles redirect — no manual navigation needed
    } catch (err) {
      console.error('Logout error:', err);
      Alert.alert('Error', 'Could not log out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account?',
      'This action is permanent. Your profile, videos, comments, follows, and account data will be permanently removed.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsDeletingAccount(true);
              const { data: { session } } = await supabase.auth.getSession();
              if (!session?.access_token) {
                throw new Error("No active session found. Please log in again.");
              }
              const { error } = await supabase.functions.invoke('delete-account', {
                body: { token: session.access_token },
                headers: {
                  Authorization: `Bearer ${process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY}`
                }
              });
              if (error) throw error;
              
              // Success — sign out LOCALLY. 
              // We must use scope: 'local' because the user is already deleted on the server, 
              // so a standard network signOut would throw a 404/401 error and abort.
              await supabase.auth.signOut({ scope: 'local' });
            } catch (err) {
              console.error('Account deletion error:', err);
              // Do NOT sign out — leave session intact on failure
              Alert.alert(
                'Error',
                'Failed to delete account. Please try again.'
              );
            } finally {
              setIsDeletingAccount(false);
            }
          },
        },
      ]
    );
  };

  const handleFollowToggle = () => {
    if (isFollowing) {
      Alert.alert(
        `Unfollow @${profile.username}?`,
        "You will stop seeing their videos in your Following feed.",
        [
          { text: "Cancel", style: "cancel" },
          { 
            text: "Unfollow", 
            style: "destructive", 
            onPress: () => {
              toggleFollow();
            } 
          }
        ]
      );
    } else {
      toggleFollow();
    }
  };

  const handleSelectVideo = async (item: FeedVideo) => {
    // Set immediately for fast modal open
    setSelectedVideo(item);

    // Aggressively re-fetch stats
    try {
      const [likesRes, commentsRes, isLikedRes] = await Promise.all([
        supabase.from('likes').select('id', { count: 'exact', head: true }).eq('video_id', item.id),
        supabase.from('comments').select('id', { count: 'exact', head: true }).eq('video_id', item.id),
        authUid 
          ? supabase.from('likes').select('id', { count: 'exact', head: true }).eq('video_id', item.id).eq('user_id', authUid)
          : Promise.resolve({ count: 0, error: null })
      ]);

      setSelectedVideo(prev => {
        // Only update if still viewing the same video
        if (prev && prev.id === item.id) {
          return {
            ...prev,
            like_count: likesRes.count || 0,
            comment_count: commentsRes.count || 0,
            is_liked: (isLikedRes.count || 0) > 0,
          };
        }
        return prev;
      });
    } catch (e) {
      console.error('Aggressive refetch failed:', e);
    }
  };

  const handleToggleLike = async (videoId: string, currentIsLiked: boolean) => {
    if (!authUid) return;
    
    // Optimistic update
    setSelectedVideo(prev => prev && prev.id === videoId ? {
      ...prev,
      is_liked: !currentIsLiked,
      like_count: prev.like_count + (currentIsLiked ? -1 : +1)
    } : prev);

    try {
      if (currentIsLiked) {
        const { error } = await supabase.from('likes').delete().eq('user_id', authUid).eq('video_id', videoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('likes').insert({ user_id: authUid, video_id: videoId });
        if (error) {
          // Gracefully ignore unique constraint violations (already liked)
          if (error.code === '23505') {
            console.log('[ProfileScreen] Duplicate like ignored gracefully');
          } else {
            throw error;
          }
        } else {
          // Broadcast like notification to video owner if not liking own video
          if (selectedVideo && authUid !== selectedVideo.user_id) {
            const notifChannel = supabase.channel(`channel-notif-likes-${selectedVideo.user_id}`);
            notifChannel
              .send({
                type: 'broadcast',
                event: 'like',
                payload: { userId: authUid },
              })
              .then(() => {
                supabase.removeChannel(notifChannel);
              })
              .catch((err) => {
                console.error('[ProfileScreen] Error sending like broadcast:', err);
              });
          }
        }
      }
    } catch (e) {
      // Revert optimistic on error
      setSelectedVideo(prev => prev && prev.id === videoId ? {
        ...prev,
        is_liked: currentIsLiked,
        like_count: prev.like_count + (currentIsLiked ? +1 : -1)
      } : prev);
      Alert.alert('Error', 'Could not update like. Try again.');
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity 
        disabled={!isOwnProfile} 
        onPress={handleEditProfile}
        style={styles.avatarContainer}
      >
        {profile.avatar_url ? (
          <Image source={{ uri: profile.avatar_url }} style={styles.avatar} contentFit="cover" />
        ) : (
          <View style={styles.avatarPlaceholder}>
            <Ionicons name="person" size={40} color="#9CA3AF" />
          </View>
        )}
      </TouchableOpacity>

      <Text style={styles.username}>{profile.username}</Text>
      
      {profile.matricule ? (
        <Text style={styles.matricule}>{maskMatricule(profile.matricule)}</Text>
      ) : null}

      {profile.bio ? (
        <Text style={styles.bio} numberOfLines={2}>{profile.bio}</Text>
      ) : null}

      <View style={styles.statsRow}>
        <View style={styles.statCol}>
          <Text style={styles.statNumber}>{profile.stats.videoCount}</Text>
          <Text style={styles.statLabel}>Videos</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statNumber}>{followerCount}</Text>
          <Text style={styles.statLabel}>Followers</Text>
        </View>
        <View style={styles.statCol}>
          <Text style={styles.statNumber}>{profile.stats.following}</Text>
          <Text style={styles.statLabel}>Following</Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        {isOwnProfile ? (
          <View style={styles.ownProfileActions}>
            <TouchableOpacity style={styles.editButton} onPress={handleEditProfile}>
              <Text style={styles.editButtonText}>Edit Profile</Text>
            </TouchableOpacity>

            <View style={styles.accountActionsRow}>
              <TouchableOpacity
                style={[styles.logoutButton, isLoggingOut && styles.buttonDisabled]}
                onPress={handleLogout}
                disabled={isLoggingOut}
              >
                <Text style={styles.logoutButtonText}>
                  {isLoggingOut ? 'Logging out…' : 'Logout'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.deleteAccountButton, isDeletingAccount && styles.buttonDisabled]}
                onPress={handleDeleteAccount}
                disabled={isDeletingAccount}
              >
                <Text style={styles.deleteAccountButtonText}>
                  {isDeletingAccount ? 'Deleting…' : 'Delete Account'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.followButton, isFollowing ? styles.followingButton : styles.notFollowingButton, followLoading && styles.buttonDisabled]} 
            onPress={handleFollowToggle}
            disabled={followLoading}
          >
            <Text style={isFollowing ? styles.followingText : styles.notFollowingText}>
              {isFollowing ? "Following" : "Follow"}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const renderVideoCell = ({ item }: { item: FeedVideo }) => (
    <Pressable 
      style={styles.cellContainer} 
      onPress={() => handleSelectVideo(item)}
    >
      {item.thumbnail_url ? (
        <Image source={{ uri: item.thumbnail_url }} style={styles.thumbnail} contentFit="cover" />
      ) : (
        <View style={styles.thumbnailPlaceholder} />
      )}
      <View style={styles.playIconOverlay} pointerEvents="none">
        <Ionicons name="play" size={24} color="rgba(255,255,255,0.7)" />
      </View>
      <View style={styles.durationBadge}>
        <Text style={styles.durationText}>0:15</Text>
      </View>
    </Pressable>
  );

  const renderEmptyState = () => {
    if (videosLoading) {
      return <SkeletonGrid />;
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyText}>
          {isOwnProfile 
            ? "You haven't posted yet. Share your first video!" 
            : `@${profile.username} hasn't posted yet.`}
        </Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <FlatList
        data={videosLoading ? [] : videos}
        keyExtractor={(item) => item.id}
        numColumns={3}
        renderItem={renderVideoCell}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={renderEmptyState}
        contentContainerStyle={styles.scrollContent}
        removeClippedSubviews={true}
        initialNumToRender={12}
        windowSize={5}
        showsVerticalScrollIndicator={false}
      />

      {/* Video Player Modal */}
      <Modal
        visible={selectedVideo !== null}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setSelectedVideo(null)}
      >
        <View style={{ flex: 1, backgroundColor: '#000' }}>
          {selectedVideo && (
            <>
              <VideoCard
                video={selectedVideo}
                isActive={true}
                currentUserId={authUid || userId}
                singleVideoMode={true}
                toggleLike={handleToggleLike}
                onComment={setActiveCommentVideo}
                onProfile={(authorId) => {
                  setSelectedVideo(null);
                  navigation.navigate('Profile', { userId: authorId });
                }}
                onDelete={handleDelete}
                isMuted={isMuted}
                onMuteToggle={handleMuteToggle}
              />
              <TouchableOpacity 
                style={styles.closeModalButton} 
                onPress={() => setSelectedVideo(null)}
              >
                <Ionicons name="close" size={30} color="white" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </Modal>

      {/* Edit Profile Sheet */}
      {isOwnProfile && profile && (
        <EditProfileSheet
          visible={isEditProfileVisible}
          onClose={() => setIsEditProfileVisible(false)}
          currentUserId={userId}
          initialUsername={profile.username}
          initialBio={profile.bio || ''}
          initialAvatarUrl={profile.avatar_url}
          onProfileUpdated={refreshProfile}
        />
      )}

      {/* Comments Sheet */}
      <CommentsSheet
        visible={!!activeCommentVideo}
        onClose={() => setActiveCommentVideo(null)}
        videoId={activeCommentVideo?.id || null}
        currentUserId={authUid}
        videoOwnerId={activeCommentVideo?.user_id || null}
        onProfile={(authorId) => {
          setActiveCommentVideo(null);
          setSelectedVideo(null);
          navigation.navigate('Profile', { userId: authorId });
        }}
        optimisticAddCommentCount={optimisticAddCommentCount}
        optimisticDeleteCommentCount={optimisticDeleteCommentCount}
        optimisticRestoreCommentCount={optimisticRestoreCommentCount}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    paddingBottom: 100,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 32,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1a1a1a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  username: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  matricule: {
    fontSize: 14,
    color: '#9CA3AF',
    marginBottom: 8,
  },
  bio: {
    fontSize: 14,
    color: '#9CA3AF',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 20,
  },
  statsRow: {
    flexDirection: 'row',
    width: '100%',
    marginVertical: 16,
  },
  statCol: {
    flex: 1,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  actionsContainer: {
    width: '100%',
    marginTop: 16,
  },
  ownProfileActions: {
    alignItems: 'center',
    width: '100%',
  },
  editButton: {
    width: '100%',
    height: 52,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  editButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  logoutButton: {
    flex: 1,
    height: 52,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2a2a2a',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  logoutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  deleteAccountButton: {
    flex: 1,
    height: 52,
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.3)',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteAccountButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  accountActionsRow: {
    flexDirection: 'row',
    width: '100%',
  },

  followButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  notFollowingButton: {
    backgroundColor: '#8B5CF6',
  },
  followingButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#2a2a2a',
  },
  notFollowingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  followingText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  cellContainer: {
    width: CELL_SIZE,
    height: CELL_SIZE,
    padding: 1,
  },
  thumbnail: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  thumbnailPlaceholder: {
    flex: 1,
    backgroundColor: '#1a1a1a',
  },
  playIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  durationBadge: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 9999,
  },
  durationText: {
    color: '#FFFFFF',
    fontSize: 10,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  closeModalButton: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    padding: 4,
  },
  skeletonUsername: {
    width: 120,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1a1a1a',
    marginBottom: 8,
    marginTop: 8,
  },
  skeletonMatricule: {
    width: 80,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1a1a1a',
    marginBottom: 12,
  },
  skeletonBio: {
    width: '60%',
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1a1a1a',
    marginBottom: 16,
  },
  skeletonStatNum: {
    width: 30,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#1a1a1a',
    marginBottom: 4,
  },
  skeletonStatLabel: {
    width: 50,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#1a1a1a',
  },
  skeletonButton: {
    width: '100%',
    height: 52,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
  },
});
