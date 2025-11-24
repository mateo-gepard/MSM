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
    
    // Mark that user logged in via magic link (no password)
    if (!error && data.user) {
      const hasPasswordFlag = data.user.user_metadata?.has_password;
      
      // If flag is not set yet, set to false (magic link user without password)
      if (hasPasswordFlag === undefined) {
        await supabase.auth.updateUser({
          data: { has_password: false }
        });
      }
    }
  }

  // Redirect to the next URL or dashboard
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
