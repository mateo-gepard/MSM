import { NextResponse } from 'next/server';
import { safeInternalRedirect } from '@/lib/security/safe-redirect';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const next = safeInternalRedirect(requestUrl.searchParams.get('next'), '/dashboard');
  const code = requestUrl.searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=invalid_callback', requestUrl.origin));
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) return NextResponse.redirect(new URL('/login?error=auth_failed', requestUrl.origin));

    return NextResponse.redirect(new URL(next, requestUrl.origin));
  } catch {
    return NextResponse.redirect(new URL('/login?error=service_unavailable', requestUrl.origin));
  }
}
