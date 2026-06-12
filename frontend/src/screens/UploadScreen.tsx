import React, { useCallback, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system/legacy';
import AsyncStorage from '@react-native-async-storage/async-storage';
import supabase from '../../supabase/client';
import { sanitizeText } from '../lib/validation';
import { uploadImage } from '../services/cloudinary/uploadImage';
import { uploadVideo } from '../services/cloudinary/uploadVideo';

// ─── Types ────────────────────────────────────────────────────────────────────

type RootStackParamList = {
  AppTabs: undefined;
  UploadModal: undefined;
  Auth: undefined;
};

type UploadScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'UploadModal'
>;

interface Props {
  navigation: UploadScreenNavigationProp;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PREVIEW_HEIGHT = (SCREEN_WIDTH - 32) * (9 / 16); // 16:9
const MAX_CAPTION_LENGTH = 200;
const MAX_FILE_SIZE_BYTES = 30 * 1024 * 1024; // 30 MB
const RATE_LIMIT_KEY = 'ubuzz_upload_history';
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// Nocturnal Pulse tokens
const C = {
  bg:          '#131313',
  surface:     '#1e1e1e',
  border:      '#2a2a2a',
  primary:     '#007AFF',
  white:       '#FFFFFF',
  muted:       'rgba(255,255,255,0.45)',
  danger:      '#FF3B30',
  placeholder: 'rgba(255,255,255,0.35)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}



// ─── Rate limit helpers ───────────────────────────────────────────────────────

async function checkRateLimit(): Promise<{ allowed: boolean }> {
  try {
    const raw = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    const history: number[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const recent = history.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
    if (recent.length >= RATE_LIMIT_MAX) return { allowed: false };
    // Save updated history (append will happen after successful upload)
    return { allowed: true };
  } catch {
    return { allowed: true }; // fail open
  }
}

async function recordUpload(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(RATE_LIMIT_KEY);
    const history: number[] = raw ? JSON.parse(raw) : [];
    const now = Date.now();
    const recent = history.filter((ts) => now - ts < RATE_LIMIT_WINDOW_MS);
    recent.push(now);
    await AsyncStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(recent));
  } catch {
    // non-fatal
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

type UploadPhase =
  | 'idle'
  | 'uploading_video'
  | 'uploading_thumbnail'
  | 'saving'
  | 'done'
  | 'error';

export default function UploadScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();

  // Video state
  const [videoUri, setVideoUri] = useState<string | null>(null);
  const [videoDuration, setVideoDuration] = useState<number>(0); // ms
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

  // Form state
  const [caption, setCaption] = useState('');

  // Upload state
  const [phase, setPhase] = useState<UploadPhase>('idle');
  const [progress, setProgress] = useState(0); // 0–100
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Cancel ref — prevents async continuations from updating state after cancel
  const cancelledRef = useRef(false);

  const isUploading =
    phase === 'uploading_video' ||
    phase === 'uploading_thumbnail' ||
    phase === 'saving';

  // ── Section 1: Pick video ──────────────────────────────────────────────────

  const pickVideo = useCallback(async () => {
    if (isUploading) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your media library to upload videos."
      );
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      allowsEditing: true,
      quality: 0.5,
      videoMaxDuration: 60,
      videoExportPreset: ImagePicker.VideoExportPreset.H264_1280x720,
    });

    if (result.canceled || !result.assets[0]) return;

    const asset = result.assets[0];
    setVideoUri(asset.uri);
    setVideoDuration(asset.duration ?? 0);
    setThumbnailUri(null); // will regenerate
    setErrorMessage(null);

    // Section 2: Generate thumbnail immediately after pick
    try {
      const thumb = await VideoThumbnails.getThumbnailAsync(asset.uri, {
        time: 0,
      });
      setThumbnailUri(thumb.uri);
    } catch (e) {
      console.warn('[UploadScreen] thumbnail gen failed:', e);
      // Non-fatal — upload will still work without thumbnail
    }
  }, [isUploading]);

  // ── Section 4: Upload flow ─────────────────────────────────────────────────

  const handlePost = useCallback(async () => {
    // ── Validate ─────────────────────────────────────────────────────────────
    if (!videoUri) {
      Alert.alert('No video', 'Please choose a video first.');
      return;
    }
    if (!caption.trim()) {
      Alert.alert('No caption', 'Please add a caption.');
      return;
    }

    // Duration check (max 60 seconds)
    const durationInSeconds = videoDuration > 1000 ? videoDuration / 1000 : videoDuration;
    if (durationInSeconds > 60) {
      Alert.alert(
        'Video too long',
        'Videos must be 60 seconds or shorter for the short-form feed. Please choose or edit a shorter video.'
      );
      return;
    }

    // File size check
    try {
      const info = await FileSystem.getInfoAsync(videoUri);
      if ('size' in info && info.size && info.size > MAX_FILE_SIZE_BYTES) {
        Alert.alert(
          'File too large',
          'Video is too large. Maximum size is 30MB.\nPlease choose a shorter or lower quality video.'
        );
        return;
      }
    } catch {
      // Non-fatal — proceed if we can't measure
    }

    // Rate limit check
    const { allowed } = await checkRateLimit();
    if (!allowed) {
      Alert.alert('Upload limit reached', 'You have uploaded 5 videos in the last hour. Try again later.');
      return;
    }

    // ── Begin upload ──────────────────────────────────────────────────────────
    cancelledRef.current = false;
    setErrorMessage(null);
    setProgress(0);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session?.user) {
      Alert.alert('Error', 'You must be logged in to post.');
      return;
    }
    const user = session.user;

    // ── Pre-Upload Safety: Verify Profile Existence ───────────────────────────
    let profileExists = false;
    try {
      const { data: profileData, error: profileFetchError } = await supabase
        .from('users')
        .select('id')
        .eq('id', user.id)
        .maybeSingle();

      if (profileFetchError) {
        console.warn('[UploadScreen] Error checking profile existence:', profileFetchError.message);
      } else if (profileData) {
        profileExists = true;
      }
    } catch (err) {
      console.warn('[UploadScreen] Profile check exception:', err);
    }

    if (!profileExists) {
      console.warn(`[UploadScreen] Profile for user ${user.id} is missing in DB. Attempting recovery before upload...`);
      try {
        const userEmail = user.email || `placeholder_${user.id.substring(0, 8)}@ubuzz.campus`;
        const uniqueId = Math.random().toString(36).substring(2, 8);
        const fallbackUsername = `user_${uniqueId}`;
        const fallbackMatricule = `IU${Math.floor(10000 + Math.random() * 90000)}`;

        const { data: recoveryData, error: recoveryError } = await supabase
          .from('users')
          .insert({
            id: user.id,
            email: userEmail,
            username: fallbackUsername,
            matricule: fallbackMatricule,
            bio: 'Auto-recovered profile placeholder (via upload safety)',
          })
          .select('id')
          .maybeSingle();

        if (recoveryError) {
          console.warn('[UploadScreen] Profile recovery before upload failed:', recoveryError.message);
          Alert.alert(
            'Upload Blocked',
            'Your user profile is missing from the database. Please visit your Profile tab to auto-create it or contact support.',
            [{ text: 'OK' }]
          );
          return;
        } else if (recoveryData) {
          console.log('[UploadScreen] Profile successfully auto-created during upload recovery.');
          profileExists = true;
        } else {
          console.warn('[UploadScreen] Profile recovery returned no data.');
          Alert.alert(
            'Upload Blocked',
            'Your user profile could not be verified. Please visit your Profile tab and try again.',
            [{ text: 'OK' }]
          );
          return;
        }
      } catch (recoveryErr) {
        console.warn('[UploadScreen] Profile recovery exception:', recoveryErr);
        Alert.alert(
          'Upload Blocked',
          'Failed to recover your user profile. Please check your connection and try again.',
          [{ text: 'OK' }]
        );
        return;
      }
    }

    try {
      // ── Step 4: Ensure thumbnail exists ───────────────────────────────────
      let finalThumbUri = thumbnailUri;
      if (!finalThumbUri) {
        try {
          const thumb = await VideoThumbnails.getThumbnailAsync(videoUri, { time: 0 });
          finalThumbUri = thumb.uri;
          if (!cancelledRef.current) setThumbnailUri(thumb.uri);
        } catch {
          // Upload will proceed without thumbnail
        }
      }
      if (cancelledRef.current) return;

      // ── Step 5: Upload video ───────────────────────────────────────────────
      setPhase('uploading_video');

      const videoUploadResult = await uploadVideo(videoUri, {
        onProgress: (progressPercentage) => {
          if (!cancelledRef.current) {
            setProgress(Math.round((progressPercentage / 100) * 85));
          }
        }
      });

      if (cancelledRef.current) return;

      // ── Step 6: Upload thumbnail ───────────────────────────────────────────
      setPhase('uploading_thumbnail');
      setProgress(85);

      let publicThumbUrl: string | null = null;

      if (finalThumbUri) {
        const thumbUploadResult = await uploadImage(finalThumbUri);
        if (cancelledRef.current) return;
        publicThumbUrl = thumbUploadResult.secure_url;
      }

      if (cancelledRef.current) return;
      setProgress(90);

      // ── Step 7: Get public video URL ───────────────────────────────────────
      const publicVideoUrl = videoUploadResult.secure_url;
      if (!publicVideoUrl) throw new Error('Failed to get video public URL.');

      // ── Step 8: INSERT into videos table ──────────────────────────────────
      setPhase('saving');
      setProgress(95);

      const { error: insertError } = await supabase.from('videos').insert({
        user_id: user.id,
        video_url: publicVideoUrl,
        thumbnail_url: publicThumbUrl,
        caption: sanitizeText(caption.trim(), 200),
        media_provider: 'cloudinary',
        cloudinary_public_id: videoUploadResult.public_id,
      });

      if (insertError) throw new Error(`Save failed: ${insertError.message}`);
      if (cancelledRef.current) return;

      // ── Step 9: Success ────────────────────────────────────────────────────
      setProgress(100);
      setPhase('done');

      await recordUpload();

      Alert.alert('Posted!', 'Your video is live.', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('AppTabs'),
        },
      ]);
    } catch (e: unknown) {
      if (cancelledRef.current) return; // ignore errors after cancel

      const msg = e instanceof Error ? e.message : 'Something went wrong during upload.';
      console.warn('[UploadScreen] Upload error:', msg);

      let userFriendlyMessage = msg;
      if (msg.includes('videos_user_id_fkey') || msg.includes('foreign key constraint')) {
        userFriendlyMessage = 'Your user profile is missing from the database. Please visit your Profile tab to automatically restore it.';
      } else if (msg.toLowerCase().includes('network') || msg.toLowerCase().includes('failed to fetch')) {
        userFriendlyMessage = 'Upload failed. Check your connection and try again.';
      }

      setErrorMessage(userFriendlyMessage);
      setPhase('error');
    }
  }, [videoUri, caption, thumbnailUri, navigation]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    setPhase('idle');
    setProgress(0);
    setErrorMessage(null);
  }, []);

  const handleRetry = useCallback(() => {
    setPhase('idle');
    setProgress(0);
    setErrorMessage(null);
    handlePost();
  }, [handlePost]);

  // ── Progress label ──────────────────────────────────────────────────────────
  const progressLabel =
    phase === 'uploading_video'
      ? `Uploading video... ${progress}%`
      : phase === 'uploading_thumbnail'
      ? 'Uploading thumbnail...'
      : phase === 'saving'
      ? 'Saving post...'
      : '';

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => {
            if (isUploading) {
              Alert.alert('Cancel upload?', 'Your video will not be posted.', [
                { text: 'Keep uploading', style: 'cancel' },
                {
                  text: 'Cancel',
                  style: 'destructive',
                  onPress: () => {
                    handleCancel();
                    navigation.goBack();
                  },
                },
              ]);
            } else {
              navigation.goBack();
            }
          }}
          style={styles.headerBtn}
        >
          <Ionicons name="close" size={24} color={C.white} />
        </TouchableOpacity>

        <Text style={styles.headerTitle}>New Post</Text>

        <TouchableOpacity
          style={[styles.postPill, isUploading && styles.postPillDisabled]}
          onPress={handlePost}
          disabled={isUploading}
        >
          <Text style={styles.postPillText}>Post</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ── Section 1: Video Preview Area ── */}
        <TouchableOpacity
          style={[styles.previewContainer, { height: PREVIEW_HEIGHT }]}
          onPress={pickVideo}
          disabled={isUploading}
          activeOpacity={0.8}
        >
          {videoUri ? (
            <>
              {/* Static thumbnail preview — no playback needed on upload screen */}
              {thumbnailUri ? (
                <Image
                  source={{ uri: thumbnailUri }}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                />
              ) : (
                <View style={[StyleSheet.absoluteFill, { backgroundColor: '#111' }]} />
              )}
              {/* Play icon overlay to indicate it's a video */}
              <View style={styles.videoIconOverlay} pointerEvents="none">
                <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.75)" />
              </View>
              {/* Duration badge */}
              {videoDuration > 0 && (
                <View style={styles.durationBadge}>
                  <Text style={styles.durationText}>
                    {formatDuration(videoDuration)}
                  </Text>
                </View>
              )}
              {/* Change video overlay */}
              {!isUploading && (
                <TouchableOpacity
                  style={styles.changeVideoOverlay}
                  onPress={pickVideo}
                >
                  <Ionicons name="repeat" size={18} color={C.white} />
                  <Text style={styles.changeVideoText}>Change Video</Text>
                </TouchableOpacity>
              )}
            </>
          ) : (
            <View style={styles.emptyPreview}>
              <View style={styles.uploadIconCircle}>
                <Ionicons name="cloud-upload-outline" size={36} color={C.primary} />
              </View>
              <Text style={styles.emptyPreviewTitle}>Tap to choose a video</Text>
              <Text style={styles.emptyPreviewSub}>70 MB limit</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* ── Section 2 + 3: Thumbnail + Caption ── */}
        <View style={styles.captionRow}>
          {/* Thumbnail preview */}
          <View style={styles.thumbWrapper}>
            {thumbnailUri ? (
              <Image
                source={{ uri: thumbnailUri }}
                style={styles.thumb}
                contentFit="cover"
              />
            ) : (
              <View style={[styles.thumb, styles.thumbPlaceholder]}>
                <Ionicons name="image-outline" size={22} color={C.muted} />
              </View>
            )}
          </View>

          {/* Caption input */}
          <View style={styles.captionInputWrapper}>
            <TextInput
              style={styles.captionInput}
              placeholder="Write a caption..."
              placeholderTextColor={C.placeholder}
              multiline
              maxLength={MAX_CAPTION_LENGTH}
              value={caption}
              onChangeText={setCaption}
              editable={!isUploading}
              returnKeyType="default"
            />
            <Text
              style={[
                styles.charCount,
                caption.length >= 180 && styles.charCountDanger,
              ]}
            >
              {caption.length} / {MAX_CAPTION_LENGTH}
            </Text>
          </View>
        </View>

        {/* ── Section 4: Progress bar (visible during upload) ── */}
        {isUploading && (
          <View style={styles.progressSection}>
            <Text style={styles.progressLabel}>{progressLabel}</Text>
            <View style={styles.progressTrack}>
              <View
                style={[styles.progressFill, { width: `${progress}%` }]}
              />
            </View>
          </View>
        )}

        {/* ── Error state ── */}
        {phase === 'error' && errorMessage && (
          <View style={styles.errorBox}>
            <Ionicons name="alert-circle-outline" size={20} color={C.danger} />
            <Text style={styles.errorText}>{errorMessage}</Text>
            <TouchableOpacity style={styles.retryBtn} onPress={handleRetry}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Bottom post button ── */}
        <TouchableOpacity
          style={[styles.postButton, isUploading && styles.postButtonDisabled]}
          onPress={handlePost}
          disabled={isUploading}
          activeOpacity={0.85}
        >
          {isUploading ? (
            <ActivityIndicator color={C.white} />
          ) : (
            <Text style={styles.postButtonText}>Post</Text>
          )}
        </TouchableOpacity>

        {/* Cancel link (visible during upload only) */}
        {isUploading && (
          <TouchableOpacity style={styles.cancelLink} onPress={handleCancel}>
            <Text style={styles.cancelLinkText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: C.bg,
  },
  // ── Header ──
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: C.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  postPill: {
    backgroundColor: C.primary,
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  postPillDisabled: {
    opacity: 0.45,
  },
  postPillText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '700',
  },
  // ── Scroll ──
  scrollContent: {
    padding: 16,
    gap: 16,
    paddingBottom: 40,
  },
  // ── Video preview ──
  previewContainer: {
    width: '100%',
    backgroundColor: C.surface,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: C.border,
  },
  videoIconOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyPreview: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  uploadIconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(0,122,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  emptyPreviewTitle: {
    color: C.white,
    fontSize: 16,
    fontWeight: '600',
  },
  emptyPreviewSub: {
    color: C.muted,
    fontSize: 13,
  },
  durationBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: 'rgba(0,0,0,0.65)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  durationText: {
    color: C.white,
    fontSize: 12,
    fontWeight: '700',
  },
  changeVideoOverlay: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
  },
  changeVideoText: {
    color: C.white,
    fontSize: 13,
    fontWeight: '600',
  },
  // ── Caption row ──
  captionRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  thumbWrapper: {},
  thumb: {
    width: 60,
    height: 60,
    borderRadius: 10,
  },
  thumbPlaceholder: {
    backgroundColor: C.surface,
    borderWidth: 1,
    borderColor: C.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  captionInputWrapper: {
    flex: 1,
  },
  captionInput: {
    color: C.white,
    fontSize: 15,
    lineHeight: 22,
    minHeight: 72,
    textAlignVertical: 'top',
    paddingTop: 0,
  },
  charCount: {
    color: C.muted,
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  charCountDanger: {
    color: C.danger,
  },
  // ── Progress ──
  progressSection: {
    gap: 8,
  },
  progressLabel: {
    color: C.muted,
    fontSize: 13,
    fontWeight: '500',
  },
  progressTrack: {
    width: '100%',
    height: 6,
    backgroundColor: C.surface,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: C.primary,
    borderRadius: 3,
  },
  // ── Error ──
  errorBox: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,59,48,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,59,48,0.3)',
    borderRadius: 12,
    padding: 14,
  },
  errorText: {
    color: C.danger,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: C.primary,
  },
  retryText: {
    color: C.white,
    fontSize: 14,
    fontWeight: '700',
  },
  // ── Post button ──
  postButton: {
    backgroundColor: C.primary,
    borderRadius: 28,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    shadowColor: C.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 6,
  },
  postButtonDisabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  postButtonText: {
    color: C.white,
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  // ── Cancel link ──
  cancelLink: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  cancelLinkText: {
    color: C.muted,
    fontSize: 14,
    fontWeight: '500',
  },
});
