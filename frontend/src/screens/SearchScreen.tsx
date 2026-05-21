import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  Keyboard,
  Platform,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useSearch, SearchResultUser } from '../hooks/useSearch';

// ─── Constants ────────────────────────────────────────────────────────────────

const COLORS = {
  background: '#121212',
  cardBackground: '#1e1e1e',
  text: '#ffffff',
  textMuted: '#9CA3AF',
  primary: '#6200EE',
  primaryFocus: '#8B5CF6',
  border: '#333333',
  error: '#EF4444',
  divider: '#2A2A2A',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function maskMatricule(matricule: string): string {
  if (!matricule) return '';
  const clean = matricule.trim();
  if (clean.length < 4) return clean;
  return 'IU' + '*'.repeat(clean.length - 4) + clean.slice(-2);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SearchScreen() {
  const navigation = useNavigation<any>();
  const [query, setQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const { results, loading, error } = useSearch(query);

  const handleClear = () => {
    setQuery('');
    Keyboard.dismiss();
  };

  const handleUserTap = (userId: string) => {
    Keyboard.dismiss();
    navigation.navigate('Profile', { userId });
  };

  const renderItem = ({ item }: { item: SearchResultUser }) => {
    const masked = maskMatricule(item.matricule);

    return (
      <TouchableOpacity
        style={styles.card}
        onPress={() => handleUserTap(item.id)}
        activeOpacity={0.7}
      >
        <View style={styles.cardLeft}>
          {item.avatar_url ? (
            <Image source={{ uri: item.avatar_url }} style={styles.avatar} contentFit="cover" />
          ) : (
            <View style={[styles.avatar, styles.avatarPlaceholder]}>
              <Ionicons name="person" size={24} color="#FFFFFF" />
            </View>
          )}
          <View style={styles.userDetails}>
            <Text style={styles.username}>@{item.username}</Text>
            <View style={styles.metaRow}>
              <Text style={styles.matricule}>{masked}</Text>
              {item.bio ? (
                <Text style={styles.bio} numberOfLines={1}>
                  • {item.bio}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={20} color={COLORS.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right']}>
      {/* Search Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Search</Text>
        <View
          style={[
            styles.inputWrapper,
            isFocused && styles.inputWrapperFocused,
          ]}
        >
          <Ionicons
            name="search-outline"
            size={20}
            color={isFocused ? COLORS.primaryFocus : COLORS.textMuted}
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.input}
            placeholder="Search by username or matricule..."
            placeholderTextColor="rgba(255,255,255,0.4)"
            value={query}
            onChangeText={(text) => {
              // Character limit check (max 30 chars)
              if (text.length <= 30) {
                setQuery(text);
              }
            }}
            maxLength={30}
            autoCapitalize="none"
            autoCorrect={false}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            returnKeyType="search"
          />
          {query.length > 0 ? (
            <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
              <Ionicons name="close-circle" size={18} color={COLORS.textMuted} />
            </TouchableOpacity>
          ) : null}
        </View>
        {query.length >= 25 ? (
          <Text style={styles.charCount}>{query.length}/30</Text>
        ) : null}
      </View>

      {/* Main Content Area */}
      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={COLORS.primaryFocus} />
        </View>
      ) : error ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>Search failed</Text>
          <Text style={styles.errorSubtext}>{error}</Text>
        </View>
      ) : query.trim().length < 2 ? (
        // Empty / Initial state
        <View style={styles.centerContainer}>
          <View style={styles.illustrationWrapper}>
            <Ionicons name="search" size={64} color="rgba(255,255,255,0.15)" />
          </View>
          <Text style={styles.placeholderTitle}>Discover Students</Text>
          <Text style={styles.placeholderText}>
            Type at least 2 characters to search for students by their username or matricule.
          </Text>
        </View>
      ) : results.length === 0 ? (
        // No results state
        <FlatList
          data={[]}
          renderItem={null}
          ListEmptyComponent={
            <View style={styles.centerContainer}>
              <View style={styles.illustrationWrapper}>
                <Ionicons name="people-outline" size={64} color="rgba(255,255,255,0.15)" />
              </View>
              <Text style={styles.placeholderTitle}>No Students Found</Text>
              <Text style={styles.placeholderText}>
                We couldn't find any students matching "@${query.trim()}". Try checking the spelling.
              </Text>
            </View>
          }
        />
      ) : (
        // Results list
        <FlatList
          data={results}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        />
      )}
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  title: {
    color: COLORS.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBackground,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 12,
    height: 48,
  },
  inputWrapperFocused: {
    borderColor: COLORS.primaryFocus,
  },
  searchIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    color: COLORS.text,
    fontSize: 16,
    paddingVertical: Platform.OS === 'ios' ? 12 : 8,
  },
  clearButton: {
    padding: 4,
  },
  charCount: {
    color: COLORS.textMuted,
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
    paddingRight: 4,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingBottom: 80, // Offset bottom tab bar
  },
  illustrationWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.03)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  placeholderTitle: {
    color: COLORS.text,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderText: {
    color: COLORS.textMuted,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
  },
  errorText: {
    color: COLORS.error,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 16,
    marginBottom: 4,
  },
  errorSubtext: {
    color: COLORS.textMuted,
    fontSize: 14,
    textAlign: 'center',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100, // Safe padding for bottom tabs
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.cardBackground,
    padding: 14,
    borderRadius: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: COLORS.divider,
  },
  cardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    marginRight: 14,
  },
  avatarPlaceholder: {
    backgroundColor: '#333333',
    justifyContent: 'center',
    alignItems: 'center',
  },
  userDetails: {
    flex: 1,
    justifyContent: 'center',
  },
  username: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  matricule: {
    color: COLORS.primaryFocus,
    fontSize: 13,
    fontWeight: '600',
  },
  bio: {
    color: COLORS.textMuted,
    fontSize: 13,
    marginLeft: 6,
    flex: 1,
  },
});
