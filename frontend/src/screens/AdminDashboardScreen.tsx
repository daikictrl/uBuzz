import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Keyboard,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import supabase from '../../supabase/client';
import { uploadImage } from '../services/cloudinary/uploadImage';
import { uploadDocument } from '../services/cloudinary/uploadDocument';
import { optimizeThumbnailUrl } from '../services/cloudinary/urlTransform';

interface Announcement {
  id: string;
  title: string;
  body: string;
  image_url: string | null;
  document_url: string | null;
  document_name: string | null;
  created_at: string;
  user_id: string;
}

const COLORS = {
  background: '#0F0C15',
  cardBackground: '#1C1726',
  text: '#ffffff',
  textMuted: '#5A5266',
  primary: '#7C3AED',
  primaryHover: '#6D28D9',
  border: '#1C1726',
  error: '#EF4444',
  success: '#10B981',
};

export default function AdminDashboardScreen() {
  // Composer state
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [docUri, setDocUri] = useState<string | null>(null);
  const [docName, setDocName] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // Past announcements state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingAnnouncements, setLoadingAnnouncements] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchAnnouncements = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoadingAnnouncements(true);
    }
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err: any) {
      console.error('Error fetching announcements:', err);
      Alert.alert('Error', 'Failed to load announcements.');
    } finally {
      setLoadingAnnouncements(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const handlePickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Camera roll permissions are required to upload images.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setImageUri(result.assets[0].uri);
    }
  };

  const handleRemoveImage = () => {
    setImageUri(null);
  };

  const handlePickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        setDocUri(result.assets[0].uri);
        setDocName(result.assets[0].name);
      }
    } catch (err) {
      console.error('Error picking document:', err);
      Alert.alert('Error', 'Failed to select document.');
    }
  };

  const handleRemoveDocument = () => {
    setDocUri(null);
    setDocName(null);
  };

  const handlePublish = async () => {
    const trimmedTitle = title.trim();
    const trimmedBody = body.trim();

    if (!trimmedTitle) {
      Alert.alert('Validation Error', 'Please enter a title for the announcement.');
      return;
    }
    if (!trimmedBody) {
      Alert.alert('Validation Error', 'Please enter a body description.');
      return;
    }

    Keyboard.dismiss();
    setPublishing(true);

    try {
      const { data: userData, error: userError } = await supabase.auth.getUser();
      if (userError || !userData.user) throw new Error('Failed to retrieve current user info.');

      let finalImageUrl = null;
      if (imageUri) {
        // Upload image to Cloudinary
        const uploadRes = await uploadImage(imageUri);
        finalImageUrl = uploadRes.secure_url;
      }

      let finalDocUrl = null;
      let finalDocName = null;
      if (docUri && docName) {
        // Upload document to Cloudinary
        const uploadRes = await uploadDocument(docUri, docName);
        finalDocUrl = uploadRes.secure_url;
        finalDocName = docName;
      }

      // Save to Supabase announcements
      const { error: insertError } = await supabase
        .from('announcements')
        .insert({
          user_id: userData.user.id,
          title: trimmedTitle,
          body: trimmedBody,
          image_url: finalImageUrl,
          document_url: finalDocUrl,
          document_name: finalDocName,
        });

      if (insertError) throw insertError;

      Alert.alert('Success', 'Announcement published successfully!');
      
      // Reset composer form
      setTitle('');
      setBody('');
      setImageUri(null);
      setDocUri(null);
      setDocName(null);
      
      // Refresh list
      fetchAnnouncements();
    } catch (err: any) {
      console.error('Publish error:', err);
      Alert.alert('Publish Failed', err.message || 'An unexpected error occurred.');
    } finally {
      setPublishing(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Announcement',
      'Are you sure you want to delete this announcement? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('announcements')
                .delete()
                .eq('id', id);

              if (error) throw error;
              setAnnouncements((prev) => prev.filter((item) => item.id !== id));
            } catch (err: any) {
              console.error('Delete error:', err);
              Alert.alert('Delete Failed', err.message || 'Failed to delete announcement.');
            }
          },
        },
      ]
    );
  };

  const handleSignOut = () => {
    supabase.auth.signOut();
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Admin Title Bar */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Admin Portal</Text>
          <Text style={styles.subtitle}>IUGET Douala</Text>
        </View>
        <TouchableOpacity style={styles.logoutBtn} onPress={handleSignOut}>
          <Ionicons name="log-out-outline" size={20} color="#EF4444" style={{ marginRight: 4 }} />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={announcements}
        keyExtractor={(item) => item.id}
        ListHeaderComponent={
          <View style={styles.composerCard}>
            <Text style={styles.sectionTitle}>Publish Announcement</Text>
            
            <TextInput
              style={styles.input}
              placeholder="Announcement Title"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={title}
              onChangeText={setTitle}
              maxLength={100}
            />
            
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Write the announcement description..."
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={body}
              onChangeText={setBody}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />

            {imageUri ? (
              <View style={styles.imagePreviewContainer}>
                <Image source={{ uri: imageUri }} style={styles.imagePreview} contentFit="cover" />
                <TouchableOpacity style={styles.removeImageBtn} onPress={handleRemoveImage}>
                  <Ionicons name="close-circle" size={24} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.imagePickerBtn} onPress={handlePickImage}>
                <Ionicons name="image-outline" size={20} color="#A78BFA" style={styles.pickerIcon} />
                <Text style={styles.imagePickerText}>Attach Image (Optional)</Text>
              </TouchableOpacity>
            )}

            {/* Document Picker UI */}
            {docUri ? (
              <View style={styles.documentPreviewContainer}>
                <Ionicons name="document-text-outline" size={24} color="#A78BFA" style={{ marginRight: 8 }} />
                <Text style={styles.documentPreviewText} numberOfLines={1}>
                  {docName}
                </Text>
                <TouchableOpacity style={styles.removeDocBtn} onPress={handleRemoveDocument}>
                  <Ionicons name="close-circle" size={20} color={COLORS.error} />
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={styles.documentPickerBtn} onPress={handlePickDocument}>
                <Ionicons name="document-attach-outline" size={20} color="#A78BFA" style={styles.pickerIcon} />
                <Text style={styles.documentPickerText}>Attach Document (Optional)</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.publishBtn, publishing && styles.publishBtnDisabled]}
              onPress={handlePublish}
              disabled={publishing}
            >
              {publishing ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Ionicons name="paper-plane" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                  <Text style={styles.publishBtnText}>Publish Now</Text>
                </>
              )}
            </TouchableOpacity>

            <View style={styles.divider} />
            <Text style={styles.sectionTitle}>Past Announcements</Text>
          </View>
        }
        contentContainerStyle={styles.listContent}
        refreshing={refreshing}
        onRefresh={() => fetchAnnouncements(true)}
        renderItem={({ item }) => (
          <View style={styles.pastCard}>
            <View style={styles.pastCardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.pastCardTitle} numberOfLines={1}>
                  {item.title}
                </Text>
                <Text style={styles.pastCardDate}>{formatDate(item.created_at)}</Text>
              </View>
              <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.deleteBtn}>
                <Ionicons name="trash-outline" size={18} color={COLORS.error} />
              </TouchableOpacity>
            </View>
            <Text style={styles.pastCardBody} numberOfLines={2}>
              {item.body}
            </Text>
            {item.image_url && (
              <Image
                source={{ uri: optimizeThumbnailUrl(item.image_url)! }}
                style={styles.pastCardImage}
                contentFit="cover"
              />
            )}
            {item.document_name && (
              <View style={styles.pastCardDoc}>
                <Ionicons name="document-text-outline" size={16} color="#A78BFA" style={{ marginRight: 6 }} />
                <Text style={styles.pastCardDocText} numberOfLines={1}>
                  {item.document_name}
                </Text>
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          !loadingAnnouncements ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>No past announcements found.</Text>
            </View>
          ) : (
            <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 20 }} />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#1C1726',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  subtitle: {
    fontSize: 12,
    color: COLORS.primary,
    fontWeight: '600',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  logoutText: {
    color: '#EF4444',
    fontSize: 14,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
  },
  composerCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#2A2338',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#0F0C15',
    borderWidth: 1,
    borderColor: '#2A2338',
    borderRadius: 8,
    padding: 12,
    color: COLORS.text,
    fontSize: 14,
    marginBottom: 12,
  },
  textArea: {
    height: 100,
  },
  imagePickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F0C15',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#A78BFA',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  pickerIcon: {
    marginRight: 8,
  },
  imagePickerText: {
    color: '#A78BFA',
    fontSize: 14,
    fontWeight: '600',
  },
  imagePreviewContainer: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 8,
    overflow: 'hidden',
  },
  imagePreview: {
    width: '100%',
    height: 180,
    backgroundColor: '#0F0C15',
  },
  removeImageBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 12,
  },
  publishBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    padding: 14,
  },
  publishBtnDisabled: {
    backgroundColor: '#4C1D95',
  },
  publishBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  divider: {
    height: 1,
    backgroundColor: '#2A2338',
    marginVertical: 20,
  },
  pastCard: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#1C1726',
  },
  pastCardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  pastCardTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.text,
  },
  pastCardDate: {
    fontSize: 11,
    color: COLORS.textMuted,
    marginTop: 2,
  },
  deleteBtn: {
    padding: 4,
  },
  pastCardBody: {
    fontSize: 13,
    color: '#D1D5DB',
    lineHeight: 18,
    marginBottom: 8,
  },
  pastCardImage: {
    width: '100%',
    height: 100,
    borderRadius: 6,
    marginTop: 4,
    backgroundColor: '#0F0C15',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 30,
  },
  emptyText: {
    color: COLORS.textMuted,
    fontSize: 14,
  },
  documentPickerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F0C15',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#A78BFA',
    borderRadius: 8,
    padding: 14,
    marginBottom: 16,
  },
  documentPickerText: {
    color: '#A78BFA',
    fontSize: 14,
    fontWeight: '600',
  },
  documentPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0C15',
    borderWidth: 1,
    borderColor: '#2A2338',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  documentPreviewText: {
    color: COLORS.text,
    fontSize: 14,
    flex: 1,
  },
  removeDocBtn: {
    padding: 4,
  },
  pastCardDoc: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0C15',
    borderRadius: 6,
    padding: 8,
    marginTop: 6,
    borderWidth: 1,
    borderColor: '#1C1726',
  },
  pastCardDocText: {
    color: '#A78BFA',
    fontSize: 12,
    flex: 1,
  },
});
