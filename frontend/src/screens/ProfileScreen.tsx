import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Alert, Dimensions, Modal, FlatList, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { useRoute, useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useProfile } from '../hooks/useProfile';
import { useProfileVideos } from '../hooks/useProfileVideos';
import supabase from '../../supabase/client';
import VideoCard from '../components/VideoCard';
import EditProfileSheet from '../components/EditProfileSheet';
import { FeedVideo } from '../hooks/useFeed';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CELL_SIZE = SCREEN_WIDTH / 3;

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
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={{color: 'white'}}>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const targetUserId = paramUserId || authUid;
  
  return <ProfileContent userId={targetUserId!} isOwnProfile={!paramUserId || paramUserId === authUid} authUid={authUid} />;
}

function ProfileContent({ userId, isOwnProfile, authUid }: { userId: string, isOwnProfile: boolean, authUid: string | null }) {
  const { profile, isFollowing, loading: profileLoading, error: profileError, refresh: refreshProfile } = useProfile(userId);
  const { videos, loading: videosLoading } = useProfileVideos(userId, profile);
  const [selectedVideo, setSelectedVideo] = useState<FeedVideo | null>(null);
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);

  if (profileLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={{color: 'white'}}>Loading profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (profileError || !profile) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.center}>
          <Text style={{color: 'red'}}>Error loading profile</Text>
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

  const handleFollowToggle = () => {
    if (isFollowing) {
      Alert.alert(
        "Unfollow",
        `Unfollow @${profile.username}?`,
        [
          { text: "Cancel", style: "cancel" },
          { text: "Unfollow", style: "destructive", onPress: () => console.log("Unfollow placeholder") }
        ]
      );
    } else {
      console.log("Follow placeholder");
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
        if (error) throw error;
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
          <Text style={styles.statNumber}>{profile.stats.followers}</Text>
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
            <Text style={styles.deleteText}>Want to delete your account? Contact admin.</Text>
          </View>
        ) : (
          <TouchableOpacity 
            style={[styles.followButton, isFollowing ? styles.followingButton : styles.notFollowingButton]} 
            onPress={handleFollowToggle}
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
      return (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <View key={i} style={styles.cellContainer}>
              <View style={styles.thumbnailPlaceholder} />
            </View>
          ))}
        </View>
      );
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
                onComment={() => { console.log('comment placeholder') }}
                onProfile={() => { console.log('profile placeholder') }}
                onDelete={() => { console.log('delete placeholder') }}
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
  deleteText: {
    fontSize: 12,
    color: '#9CA3AF',
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
});
