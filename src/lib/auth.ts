import { supabase } from './supabase';

export async function signUp(email: string, password: string, name: string) {
  // Try to sign in first to check if user already exists
  const { data: signInData } = await supabase.auth.signInWithPassword({
    email,
    password: 'test-check-existence'
  });

  // If user exists (even with wrong password), the email is taken
  if (signInData?.user || signInData?.session) {
    return {
      data: null,
      error: { message: 'Ein Account mit dieser E-Mail-Adresse existiert bereits. Bitte melde dich stattdessen an.' }
    };
  }

  // Also check if the sign-in error message indicates the user exists
  const { error: checkError } = await supabase.auth.signInWithPassword({
    email,
    password: 'dummy-check'
  });
  
  if (checkError && !checkError.message.includes('Invalid login credentials') && !checkError.message.includes('Email not confirmed')) {
    // If error is not about wrong password, user might exist
    if (checkError.message.toLowerCase().includes('user') || checkError.message.toLowerCase().includes('email')) {
      return {
        data: null,
        error: { message: 'Ein Account mit dieser E-Mail-Adresse existiert bereits. Bitte melde dich stattdessen an.' }
      };
    }
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { name }
    }
  });
  
  // Supabase may return a user even if they already exist (with emailConfirmation disabled)
  // Check if the user was created just now vs already existed
  if (data?.user && !error) {
    // If identities is empty, user already existed
    if (data.user.identities && data.user.identities.length === 0) {
      return {
        data: null,
        error: { message: 'Ein Account mit dieser E-Mail-Adresse existiert bereits. Bitte melde dich stattdessen an.' }
      };
    }
  }
  
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function sendMagicLink(email: string, redirectTo?: string) {
  const finalRedirect = redirectTo || '/dashboard';
  const { data, error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(finalRedirect)}`
    }
  });
  return { data, error };
}

export async function resetPassword(email: string) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`
  });
  return { data, error };
}

export async function updatePassword(newPassword: string) {
  const { data, error } = await supabase.auth.updateUser({
    password: newPassword
  });
  return { data, error };
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}
