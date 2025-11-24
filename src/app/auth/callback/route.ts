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
      const currentFlag = data.user.user_metadata?.has_password;
      
      // If user doesn't have password flag set to true, update it to false
      if (currentFlag !== true) {
        await supabase.auth.updateUser({
          data: { 
            has_password: false,
            last_magic_link_login: new Date().toISOString()
          }
        });
      }
      
      // Add query param to indicate magic link login
      const redirectUrl = new URL(next, requestUrl.origin);
      if (currentFlag !== true) {
        redirectUrl.searchParams.set('magic_link', 'true');
      }
      return NextResponse.redirect(redirectUrl);
    }
  }

  // Redirect to the next URL or dashboard
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
