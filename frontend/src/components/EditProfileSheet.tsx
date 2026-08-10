import React, { useState, useEffect, useRef } from 'react';
import { 
  View, Text, StyleSheet, Modal, TouchableOpacity, TextInput, 
  KeyboardAvoidingView, Platform, ActivityIndicator, Animated, 
  TouchableWithoutFeedback, Keyboard, Alert, ScrollView
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system/legacy';
import supabase from '../../supabase/client';
import { uploadImage } from '../services/cloudinary/uploadImage';
import { sanitizeText } from '../lib/validation';

interface EditProfileSheetProps {
  visible: boolean;
  onClose: () => void;
  currentUserId: string;
  initialUsername: string;
  initialBio: string;
  initialAvatarUrl: string | null;
  onProfileUpdated: () => void; // Trigger refresh
}

type SaveState = 'idle' | 'uploading_image' | 'checking_username' | 'saving' | 'error';

export default function EditProfileSheet({ 
  visible, onClose, currentUserId, initialUsername, initialBio, initialAvatarUrl, onProfileUpdated 
}: EditProfileSheetProps) {
  const [username, setUsername] = useState(initialUsername);
  const [bio, setBio] = useState(initialBio || '');
  const [avatarUri, setAvatarUri] = useState<string | null>(initialAvatarUrl);
  const [localImagePicked, setLocalImagePicked] = useState(false);
  
  const [saveState, setSaveState] = useState<SaveState>('idle');
  const [usernameError, setUsernameError] = useState<string | null>(null);

  const slideAnim = useRef(new Animated.Value(500)).current;

  useEffect(() => {
    if (visible) {
      setUsername(initialUsername);
      setBio(initialBio || '');
      setAvatarUri(initialAvatarUrl);
      setLocalImagePicked(false);
      setSaveState('idle');
      setUsernameError(null);

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 0,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 500,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  // Username validation debouncing would be ideal, but for now we check on save
  const checkUsername = async (requestedUsername: string) => {
    if (requestedUsername === initialUsername) return true;
    if (requestedUsername.length < 3) {
      setUsernameError('Username must be at least 3 characters');
      return false;
    }
    
    setSaveState('checking_username');
    try {
      const { data, error } = await supabase.rpc('check_username_available', { 
        requested_username: requestedUsername 
      });
      if (error) throw error;
      if (!data) {
        setUsernameError('Username is already taken');
        setSaveState('idle');
        return false;
      }
      setUsernameError(null);
      return true;
    } catch (e: any) {
      console.error(e);
      setUsernameError('Error checking username');
      setSaveState('idle');
      return false;
    }
  };

  const handlePickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: false,
    });

    if (!result.canceled && result.assets[0]) {
      setAvatarUri(result.assets[0].uri);
      setLocalImagePicked(true);
    }
  };

  const handleSave = async () => {
    Keyboard.dismiss();
    const sanitizedUsername = sanitizeText(username.trim().toLowerCase(), 20);
    const sanitizedBio = sanitizeText(bio.trim(), 100);
    
    const isAvailable = await checkUsername(sanitizedUsername);
    if (!isAvailable) return;

    setSaveState('saving');
    try {
      let finalAvatarUrl = initialAvatarUrl;
      let avatarPublicId: string | undefined;
      let avatarProvider: string | undefined;

      // 1. Upload new image if picked
      if (localImagePicked && avatarUri) {
        setSaveState('uploading_image');
        const uploadResult = await uploadImage(avatarUri);
        finalAvatarUrl = uploadResult.secure_url;
        avatarPublicId = uploadResult.public_id;
        avatarProvider = 'cloudinary';
      }

      setSaveState('saving');
      // 2. Update profile table
      const updatePayload: Record<string, any> = {
        username: sanitizedUsername,
        bio: sanitizedBio,
        avatar_url: finalAvatarUrl,
      };

      // Only update provider metadata when a new avatar was uploaded
      if (avatarProvider) {
        updatePayload.media_provider = avatarProvider;
        updatePayload.cloudinary_public_id = avatarPublicId;
      }

      const { error: updateError } = await supabase
        .from('users')
        .update(updatePayload)
        .eq('id', currentUserId);

      if (updateError) throw updateError;

      setSaveState('idle');
      onProfileUpdated();
      onClose();

    } catch (e: any) {
      console.error(e);
      Alert.alert('Save Failed', e.message || 'Could not update profile.');
      setSaveState('error');
    }
  };

  const isBusy = saveState !== 'idle' && saveState !== 'error';

  const renderButtonContent = () => {
    switch (saveState) {
      case 'checking_username': return <Text style={styles.saveText}>Checking...</Text>;
      case 'uploading_image': return <Text style={styles.saveText}>Uploading Image...</Text>;
      case 'saving': return <ActivityIndicator color="#0a0a0a" />;
      default: return <Text style={styles.saveText}>Save</Text>;
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent={true}
    >
      <KeyboardAvoidingView 
        style={styles.overlay} 
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <View style={styles.backdrop}>
            <Animated.View style={[styles.sheet, { transform: [{ translateY: slideAnim }] }]}>
              
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} disabled={isBusy}>
                  <Text style={styles.cancelText}>Cancel</Text>
                </TouchableOpacity>
                <Text style={styles.title}>Edit Profile</Text>
                <TouchableOpacity 
                  onPress={handleSave} 
                  disabled={isBusy || username.trim().length === 0}
                >
                  {renderButtonContent()}
                </TouchableOpacity>
              </View>

              {/* Avatar Picker */}
              <View style={styles.avatarSection}>
                <TouchableOpacity onPress={handlePickImage} disabled={isBusy}>
                  {avatarUri ? (
                    <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
                  ) : (
                    <View style={styles.avatarPlaceholder}>
                      <Ionicons name="person" size={40} color="#9CA3AF" />
                    </View>
                  )}
                  <View style={styles.cameraIconContainer}>
                    <Ionicons name="camera" size={16} color="white" />
                  </View>
                </TouchableOpacity>
              </View>

              {/* Form Fields */}
              <ScrollView
                bounces={false}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <View style={styles.form}>
                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Username</Text>
                    <TextInput
                      style={styles.input}
                      value={username}
                      onChangeText={(t) => { setUsername(t); setUsernameError(null); }}
                      maxLength={20}
                      placeholder="Enter username"
                      placeholderTextColor="#666"
                      autoCapitalize="none"
                      editable={!isBusy}
                    />
                    {usernameError && <Text style={styles.errorText}>{usernameError}</Text>}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Bio</Text>
                    <TextInput
                      style={[styles.input, styles.bioInput]}
                      value={bio}
                      onChangeText={(t) => {
                        if (t.length <= 100) {
                          setBio(t);
                        }
                      }}
                      maxLength={100}
                      placeholder="Tell us about yourself"
                      placeholderTextColor="#666"
                      multiline
                      editable={!isBusy}
                    />
                    <Text style={styles.charCount}>{bio.length}/100</Text>
                  </View>
                </View>
              </ScrollView>

            </Animated.View>
          </View>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  cancelText: {
    color: '#9CA3AF',
    fontSize: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  saveText: {
    color: '#8B5CF6',
    fontSize: 16,
    fontWeight: 'bold',
  },
  avatarSection: {
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
  },
  avatarPlaceholder: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cameraIconContainer: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#8B5CF6',
    borderRadius: 15,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#1a1a1a',
  },
  form: {
    gap: 16,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    color: '#9CA3AF',
    fontSize: 14,
  },
  input: {
    backgroundColor: '#2a2a2a',
    borderRadius: 10,
    color: '#FFFFFF',
    padding: 12,
    fontSize: 16,
  },
  bioInput: {
    height: 100,
    textAlignVertical: 'top',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
  },
  charCount: {
    color: '#666',
    fontSize: 12,
    textAlign: 'right',
  },
});
