import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/dashboard';

  if (code) {
    const supabase = createRouteHandlerClient({ cookies });
    
    // Exchange the code for a session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    
    if (!error && data.user) {
      // Redirect with magic link flag
      const redirectUrl = new URL(next, requestUrl.origin);
      redirectUrl.searchParams.set('from_magic_link', '1');
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Redirect to the next URL or dashboard
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
