import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
  Linking,
  Alert,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import supabase from '../../supabase/client';
import { optimizeThumbnailUrl } from '../services/cloudinary/urlTransform';

const { width } = Dimensions.get('window');

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
  border: '#1C1726',
  divider: '#1C1726',
  error: '#EF4444',
};

export default function AnnouncementsScreen() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnnouncements = useCallback(async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err: any) {
      console.error('Error fetching announcements:', err);
      setError(err.message || 'Failed to load announcements.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleOpenDocument = async (url: string) => {
    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Error', `Cannot open document URL: ${url}`);
      }
    } catch (err) {
      console.error('Error opening document URL:', err);
      Alert.alert('Error', 'Failed to open document.');
    }
  };

  const renderItem = ({ item }: { item: Announcement }) => {
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Ionicons name="megaphone" size={20} color={COLORS.primary} style={styles.megaphoneIcon} />
          <Text style={styles.cardTitle}>{item.title}</Text>
        </View>
        
        <Text style={styles.cardDate}>{formatDate(item.created_at)}</Text>
        
        <Text style={styles.cardBody}>{item.body}</Text>

        {item.image_url ? (
          <Image
            source={{ uri: optimizeThumbnailUrl(item.image_url)! }}
            style={styles.cardImage}
            contentFit="cover"
            transition={200}
          />
        ) : null}

        {item.document_url ? (
          <TouchableOpacity
            style={styles.documentContainer}
            onPress={() => handleOpenDocument(item.document_url!)}
            activeOpacity={0.7}
          >
            <Ionicons name="document-text" size={24} color="#A78BFA" style={styles.documentIcon} />
            <View style={styles.documentInfo}>
              <Text style={styles.documentName} numberOfLines={1}>
                {item.document_name || 'Attachment'}
              </Text>
              <Text style={styles.documentAction}>Tap to view document</Text>
            </View>
            <Ionicons name="download-outline" size={20} color={COLORS.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <Text style={styles.title}>Announcements</Text>
      </View>

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.retryText} onPress={() => fetchAnnouncements()}>Tap to retry</Text>
        </View>
      ) : announcements.length === 0 ? (
        <FlatList
          data={[]}
          renderItem={null}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <Ionicons name="notifications-off-outline" size={64} color={COLORS.textMuted} />
              <Text style={styles.emptyTitle}>No Announcements</Text>
              <Text style={styles.emptySubtitle}>Updates from the administration will appear here.</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchAnnouncements(true)}
              tintColor={COLORS.primary}
            />
          }
        />
      ) : (
        <FlatList
          data={announcements}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchAnnouncements(true)}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
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
  listContent: {
    padding: 16,
    paddingBottom: 100, // padding to prevent tab bar overlay
  },
  card: {
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#1C1726',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  megaphoneIcon: {
    marginRight: 8,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    flex: 1,
  },
  cardDate: {
    fontSize: 12,
    color: COLORS.textMuted,
    marginBottom: 12,
  },
  cardBody: {
    fontSize: 14,
    color: '#E2E8F0',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardImage: {
    width: '100%',
    height: 200,
    borderRadius: 8,
    marginTop: 8,
    backgroundColor: '#0F0C15',
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 80,
  },
  errorText: {
    color: COLORS.error,
    fontSize: 16,
    marginTop: 12,
    textAlign: 'center',
  },
  retryText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: 'bold',
    marginTop: 8,
  },
  emptyTitle: {
    color: COLORS.text,
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
  },
  emptySubtitle: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  documentContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0F0C15',
    borderWidth: 1,
    borderColor: '#1C1726',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
  },
  documentIcon: {
    marginRight: 12,
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
  },
  documentAction: {
    color: '#A78BFA',
    fontSize: 12,
    marginTop: 2,
  },
});
