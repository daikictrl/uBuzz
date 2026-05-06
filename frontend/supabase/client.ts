import { AppState } from 'react-native';
import 'react-native-url-polyfill/auto';
import * as SecureStore from 'expo-secure-store';
import { createClient } from '@supabase/supabase-js';

// ─── Chunked SecureStore Adapter ──────────────────────────────────────────────
// expo-secure-store has a 2048-byte limit per value on Android.
// Supabase sessions (two JWTs + metadata) routinely exceed this.
// Solution: split large values into ≤2000-byte chunks across multiple keys.

const CHUNK_SIZE = 2000; // bytes, safely under the 2048 limit

const ChunkedSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    // Try reading as a single value first (backward-compat with existing sessions)
    const single = await SecureStore.getItemAsync(key);
    if (single !== null) return single;

    // Otherwise, reassemble from chunks
    const countStr = await SecureStore.getItemAsync(`${key}_count`);
    if (!countStr) return null;

    const count = parseInt(countStr, 10);
    let result = '';
    for (let i = 0; i < count; i++) {
      const chunk = await SecureStore.getItemAsync(`${key}_chunk_${i}`);
      if (chunk === null) return null; // corrupted — force re-auth
      result += chunk;
    }
    return result;
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (value.length <= CHUNK_SIZE) {
      // Small enough — store directly and clean up any old chunks
      await SecureStore.setItemAsync(key, value);
      await ChunkedSecureStoreAdapter._deleteChunks(key);
      return;
    }

    // Too large — remove any old single-key value and store in chunks
    await SecureStore.deleteItemAsync(key);
    const chunks: string[] = [];
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE));
    }
    await SecureStore.setItemAsync(`${key}_count`, String(chunks.length));
    await Promise.all(
      chunks.map((chunk, i) => SecureStore.setItemAsync(`${key}_chunk_${i}`, chunk))
    );
  },

  removeItem: async (key: string): Promise<void> => {
    await SecureStore.deleteItemAsync(key);
    await ChunkedSecureStoreAdapter._deleteChunks(key);
  },

  // Internal helper — removes chunk keys for a given base key
  _deleteChunks: async (key: string): Promise<void> => {
    const countStr = await SecureStore.getItemAsync(`${key}_count`);
    if (!countStr) return;
    const count = parseInt(countStr, 10);
    await SecureStore.deleteItemAsync(`${key}_count`);
    await Promise.all(
      Array.from({ length: count }, (_, i) =>
        SecureStore.deleteItemAsync(`${key}_chunk_${i}`)
      )
    );
  },
};

// ─── Supabase Client ──────────────────────────────────────────────────────────

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ChunkedSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

AppState.addEventListener('change', (state) => {
  if (state === 'active') {
    supabase.auth.startAutoRefresh();
  } else {
    supabase.auth.stopAutoRefresh();
  }
});

export default supabase;
