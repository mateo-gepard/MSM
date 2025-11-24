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
      // Create response with redirect
      const response = NextResponse.redirect(new URL(next, requestUrl.origin));
      
      // Set a cookie to indicate magic link login
      response.cookies.set('magic_link_login', 'true', {
        path: '/',
        maxAge: 60, // 60 seconds should be enough
        sameSite: 'lax'
      });
      
      return response;
    }
  }

  // Redirect to the next URL or dashboard
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
