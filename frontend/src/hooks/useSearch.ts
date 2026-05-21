import { useState, useEffect, useRef } from 'react';
import supabase from '../../supabase/client';

export interface SearchResultUser {
  id: string;
  username: string;
  avatar_url: string | null;
  bio: string | null;
  matricule: string;
}

export function useSearch(query: string) {
  const [results, setResults] = useState<SearchResultUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeQueryRef = useRef('');

  useEffect(() => {
    const trimmed = query.trim();
    activeQueryRef.current = trimmed;

    // Do NOT search if query is empty or less than 2 characters
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);

    // Debounce execution by 300ms
    const timer = setTimeout(async () => {
      try {
        const { data, error: err } = await supabase
          .from('users')
          .select('id, username, avatar_url, bio, matricule')
          .or(`username.ilike.%${trimmed}%,matricule.ilike.%${trimmed}%`)
          .limit(20);

        if (err) throw err;

        // Prevent stale async responses (race conditions / network delays)
        if (activeQueryRef.current === trimmed) {
          setResults(data || []);
        }
      } catch (e: any) {
        if (activeQueryRef.current === trimmed) {
          setError(e.message || 'An error occurred during search.');
        }
      } finally {
        if (activeQueryRef.current === trimmed) {
          setLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [query]);

  return { results, loading, error };
}
