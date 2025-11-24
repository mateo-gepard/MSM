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
    
    // If successful and user doesn't have has_password flag, set it to false
    if (!error && data.user) {
      const hasPasswordFlag = data.user.user_metadata?.has_password;
      
      // Only set flag if it's not already set
      if (hasPasswordFlag === undefined) {
        // User logged in via magic link and doesn't have password flag
        // Set it to false to indicate they need to set a password
        await supabase.auth.updateUser({
          data: {
            has_password: false
          }
        });
      }
    }
  }

  // Redirect to the next URL or dashboard
  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
