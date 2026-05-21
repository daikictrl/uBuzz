import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  TouchableWithoutFeedback,
  FlatList,
  Keyboard,
  KeyboardEvent,
  Animated,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import supabase from '../../supabase/client';
import { sanitizeText } from '../lib/validation';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

// ─── Types ───────────────────────────────────────────────────────────────────

export interface Comment {
  id: string;
  user_id: string;
  body: string;
  created_at: string;
  users: {
    username: string;
    avatar_url: string | null;
  } | null;
}

export interface CommentsSheetProps {
  visible: boolean;
  onClose: () => void;
  videoId: string | null;
  currentUserId: string | null;
  videoOwnerId?: string | null;
  onProfile: (userId: string) => void;
  markCommentAsLocallyDeleted: (commentId: string) => void;
  clearAllLocallyDeletedComments: () => void;
  consumeLocallyDeletedComment: (commentId: string) => boolean;
  optimisticDeleteCommentCount: (videoId: string) => void;
  optimisticRestoreCommentCount: (videoId: string) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function CommentsSheet({
  visible,
  onClose,
  videoId,
  currentUserId,
  videoOwnerId,
  onProfile,
  markCommentAsLocallyDeleted,
  clearAllLocallyDeletedComments,
  consumeLocallyDeletedComment,
  optimisticDeleteCommentCount,
  optimisticRestoreCommentCount,
}: CommentsSheetProps) {
  // ── Animated Slide ──
  const slideAnim = useRef(new Animated.Value(SCREEN_HEIGHT)).current;

  // ── Keyboard State ──
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  // ── Data State ──
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // ── Mount / Dismount Animation ──
  useEffect(() => {
    if (visible && videoId) {
      // Reset states
      setKeyboardHeight(0);
      setInputText('');
      fetchComments();

      // Slide up
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    } else {
      // Slide down
      Animated.timing(slideAnim, {
        toValue: SCREEN_HEIGHT,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        // Animation finished — safe to reset and clear deduplication tracking
        setComments([]);
        setInputText('');
        clearAllLocallyDeletedComments();
      });
    }
  }, [visible, videoId, slideAnim]);

  // ── Keyboard Listeners (Strict dual-transform pattern) ──
  useEffect(() => {
    const showSub = Keyboard.addListener('keyboardDidShow', (e: KeyboardEvent) => {
      setKeyboardHeight(e.endCoordinates.height);
    });
    const hideSub = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0);
    });

    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // ── Data Fetching ──
  const fetchComments = useCallback(async () => {
    if (!videoId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('comments')
        .select(`
          id,
          user_id,
          body,
          created_at,
          users (
            username,
            avatar_url
          )
        `)
        .eq('video_id', videoId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setComments((data as any) || []);
    } catch (e) {
      console.error('[Comments] fetch error:', e);
    } finally {
      setLoading(false);
    }
  }, [videoId]);

  // ── Realtime Subscription ──
  useEffect(() => {
    if (!visible || !videoId) return;

    const uniqueName = `comments_${videoId}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const channel = supabase
      .channel(uniqueName)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'comments',
          filter: `video_id=eq.${videoId}`,
        },
        async (payload) => {
          // Fetch enriched comment with user data
          const { data, error } = await supabase
            .from('comments')
            .select(`
              id,
              user_id,
              body,
              created_at,
              users (
                username,
                avatar_url
              )
            `)
            .eq('id', payload.new.id)
            .single();

          if (!error && data) {
            setComments((prev) => [data as any, ...prev]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'comments',
          filter: `video_id=eq.${videoId}`,
        },
        (payload) => {
          const deletedId = payload.old?.id;
          if (!deletedId) return;

          // Always remove from local list (idempotent)
          setComments((prev) => prev.filter((c) => c.id !== deletedId));

          // consumeLocallyDeletedComment returns true if this deletion was already
          // handled optimistically (local delete flow). In that case the count was
          // already decremented — skip to avoid a double-decrement.
          // Returns false for external deletes (dashboard / another device) → decrement now.
          const wasLocal = consumeLocallyDeletedComment(deletedId);
          if (!wasLocal && videoId) {
            optimisticDeleteCommentCount(videoId);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [visible, videoId]);

  // ── Handlers ──
  const handleSend = async () => {
    const text = sanitizeText(inputText.trim(), 500);
    if (!text || !videoId || !currentUserId) return;

    setSubmitting(true);
    Keyboard.dismiss();

    try {
      const { error } = await supabase.from('comments').insert({
        video_id: videoId,
        user_id: currentUserId,
        body: text,
      });

      if (error) throw error;
      
      // Broadcast comment notification to video owner if not commenting on own video
      if (videoOwnerId && currentUserId && videoOwnerId !== currentUserId) {
        const notifChannel = supabase.channel(`channel-notif-comments-${videoOwnerId}`);
        notifChannel
          .send({
            type: 'broadcast',
            event: 'comment',
            payload: { userId: currentUserId },
          })
          .then(() => {
            supabase.removeChannel(notifChannel);
          })
          .catch((err) => {
            console.error('[CommentsSheet] Error sending comment broadcast:', err);
          });
      }

      // Note: We don't manually update state here because the Realtime 
      // subscription will catch the INSERT and update the list.
      setInputText('');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleProfileTap = (userId: string) => {
    onClose();
    // Use a small timeout to let the modal close smoothly before navigating
    setTimeout(() => {
      onProfile(userId);
    }, 150);
  };

  const handleDeleteComment = (comment: Comment) => {
    if (comment.user_id !== currentUserId) return;

    Alert.alert(
      'Delete Comment',
      'Delete this comment?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            if (!videoId) return;
            
            // Backup for rollback
            const backupComments = [...comments];

            // 1. Mark as locally deleted (for useFeed deduplication)
            markCommentAsLocallyDeleted(comment.id);

            // 2. Optimistic local list update
            setComments((prev) => prev.filter((c) => c.id !== comment.id));

            // 3. Optimistic count decrement via useFeed
            optimisticDeleteCommentCount(videoId);

            // 4. Perform actual database delete
            const { error } = await supabase
              .from('comments')
              .delete()
              .eq('id', comment.id)
              .eq('user_id', currentUserId);

            if (error) {
              // Rollback
              setComments(backupComments);
              optimisticRestoreCommentCount(videoId);
              Alert.alert('Error', 'Failed to delete comment. Try again.');
            }
          },
        },
      ],
      { cancelable: true }
    );
  };

  // ── Renders ──
  const renderItem = ({ item }: { item: Comment }) => {
    const avatar = item.users?.avatar_url;
    const username = item.users?.username || 'user';

    return (
      <TouchableOpacity
        style={styles.commentRow}
        activeOpacity={0.7}
        delayLongPress={300}
        onLongPress={() => {
          if (item.user_id === currentUserId) {
            handleDeleteComment(item);
          }
        }}
      >
        <TouchableOpacity onPress={() => handleProfileTap(item.user_id)}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarFallback]}>
              <Ionicons name="person" size={20} color="#FFFFFF" />
            </View>
          )}
        </TouchableOpacity>
        
        <View style={styles.commentContent}>
          <TouchableOpacity onPress={() => handleProfileTap(item.user_id)}>
            <Text style={styles.username}>@{username}</Text>
          </TouchableOpacity>
          <Text style={styles.body}>{item.body}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  // If not visible, we can just return null so it unmounts completely,
  // or return a hidden view. For animation we need it mounted.
  // We'll use absolute positioning and pointerEvents.
  if (!visible && slideAnim === (SCREEN_HEIGHT as any)) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <View style={StyleSheet.absoluteFill} pointerEvents="auto">
        {/* Dimmed Background */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={styles.overlay} />
        </TouchableWithoutFeedback>

      {/* Animated Bottom Sheet */}
      <Animated.View
        style={[
          styles.sheet,
          {
            transform: [
              { translateY: slideAnim },
              { translateY: Platform.OS === 'ios' ? -keyboardHeight : 0 },
            ],
          },
        ]}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comments</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color="#6200EE" />
          </View>
        ) : (
          <FlatList
            style={{ flex: 1 }}
            data={comments}
            renderItem={renderItem}
            keyExtractor={(c: Comment) => c.id}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={
              <Text style={styles.emptyText}>No comments yet. Be the first!</Text>
            }
          />
        )}

        {/* Input Area */}
        <View style={styles.inputArea}>
          <TextInput
            style={styles.input}
            placeholder="Add a comment..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={inputText}
            onChangeText={setInputText}
            maxLength={500}
            multiline
            editable={!submitting}
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!inputText.trim() || submitting) && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim() || submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="send" size={20} color="#FFFFFF" />
            )}
          </TouchableOpacity>
        </View>
      </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: '65%',
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 4,
  },
  loadingWrapper: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  emptyText: {
    color: 'rgba(255,255,255,0.5)',
    textAlign: 'center',
    marginTop: 40,
    fontSize: 15,
  },
  commentRow: {
    flexDirection: 'row',
    marginBottom: 20,
    gap: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  avatarFallback: {
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  commentContent: {
    flex: 1,
  },
  username: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  body: {
    color: '#FFFFFF',
    fontSize: 15,
    lineHeight: 20,
  },
  inputArea: {
    flexDirection: 'row',
    padding: 12,
    paddingBottom: 24, // extra padding for safe area
    borderTopWidth: 1,
    borderTopColor: '#333',
    alignItems: 'flex-end',
    backgroundColor: '#1a1a1a',
  },
  input: {
    flex: 1,
    backgroundColor: '#2a2a2a',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    minHeight: 40,
    maxHeight: 100,
    color: '#FFFFFF',
    fontSize: 15,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#6200EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
    marginBottom: 2, // align with input bottom roughly
  },
  sendBtnDisabled: {
    backgroundColor: '#444',
  },
});
