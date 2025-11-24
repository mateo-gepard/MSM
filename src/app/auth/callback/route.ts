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
    
    // ALWAYS mark that user logged in via magic link (no password)
    // This ensures we track that they used magic link to login
    if (!error && data.user) {
      const currentFlag = data.user.user_metadata?.has_password;
      
      // If user doesn't have password flag set to true, set it to false
      // This means: if they login via magic link, they don't have a password (yet)
      if (currentFlag !== true) {
        await supabase.auth.updateUser({
          data: { 
            has_password: false,
            last_magic_link_login: new Date().toISOString()
          }
        });
      }
    }
  }

  // Redirect to the next URL or dashboard
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
