'use client';

import { useEffect, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    try {
      const supabase = getSupabaseBrowserClient();
      void supabase.auth.getUser().then(({ data, error }) => {
        if (!active) return;
        setUser(error ? null : data.user);
        setLoading(false);
      });

      const { data } = supabase.auth.onAuthStateChange((_event, session) => {
        if (active) setUser(session?.user ?? null);
      });

      return () => {
        active = false;
        data.subscription.unsubscribe();
      };
    } catch {
      queueMicrotask(() => {
        if (!active) return;
        setUser(null);
        setLoading(false);
      });
      return () => {
        active = false;
      };
    }
  }, []);

  return { user, loading };
}
