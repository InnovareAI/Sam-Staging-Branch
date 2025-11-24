import { createClient } from '@/app/lib/supabase';
import { NextResponse } from 'next/server';

/**
 * Force clear auth session - dev mode only
 * GET /api/auth/clear
 */
export async function GET() {
  try {
    const supabase = createClient();

    console.log('🧹 Clearing auth session...');

    // Sign out completely
    await supabase.auth.signOut({ scope: 'global' });

    console.log('✅ Auth cleared');

    // Return HTML that clears localStorage and redirects
    return new NextResponse(
      `<!DOCTYPE html>
<html>
<head>
  <title>Clearing Auth...</title>
</head>
<body>
  <h1>Clearing authentication...</h1>
  <script>
    console.log('🧹 Clearing all storage...');
    localStorage.clear();
    sessionStorage.clear();

    // Clear all cookies
    document.cookie.split(";").forEach(c => {
      document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
    });

    console.log('✅ Storage cleared, redirecting...');

    // Redirect to home
    setTimeout(() => {
      window.location.href = '/';
    }, 500);
  </script>
</body>
</html>`,
      {
        status: 200,
        headers: {
          'Content-Type': 'text/html',
        },
      }
    );

  } catch (error) {
    console.error('❌ Error clearing auth:', error);
    return NextResponse.json(
      { error: 'Failed to clear auth' },
      { status: 500 }
    );
  }
}
