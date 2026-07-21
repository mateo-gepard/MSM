'use client';

import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { safeInternalRedirect } from '@/lib/security/safe-redirect';

export async function signUp(email: string, password: string, name: string) {
  const supabase = getSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { name: name.trim() } },
  });

  // Supabase deliberately obscures whether a confirmed account exists. An
  // empty identities array is the supported signal returned for duplicate signup.
  if (!error && data.user?.identities?.length === 0) {
    return {
      data: null,
      error: { message: 'Ein Account mit dieser E-Mail-Adresse existiert bereits. Bitte melde dich stattdessen an.' },
    };
  }

  return { data, error };
}

export async function signIn(email: string, password: string) {
  return getSupabaseBrowserClient().auth.signInWithPassword({ email, password });
}

export async function signOut() {
  const { error } = await getSupabaseBrowserClient().auth.signOut();
  return { error };
}

export async function sendMagicLink(email: string, redirectTo?: string) {
  const next = safeInternalRedirect(redirectTo, '/dashboard');
  const callback = new URL('/auth/callback', window.location.origin);
  callback.searchParams.set('next', next);

  return getSupabaseBrowserClient().auth.signInWithOtp({
    email,
    options: { emailRedirectTo: callback.toString() },
  });
}

export async function resetPassword(email: string) {
  return getSupabaseBrowserClient().auth.resetPasswordForEmail(email, {
    redirectTo: new URL('/reset-password', window.location.origin).toString(),
  });
}

export async function updatePassword(newPassword: string) {
  return getSupabaseBrowserClient().auth.updateUser({ password: newPassword });
}

export async function getCurrentUser() {
  const { data, error } = await getSupabaseBrowserClient().auth.getUser();
  if (error) return null;
  return data.user;
}
