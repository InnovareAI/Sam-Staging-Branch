import { NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * GET /api/user/get-timezone
 * Fetch user's saved timezone preference
 * Returns null if never set (first campaign creation)
 */
export async function GET() {
  try {
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient({ cookies: () => cookieStore });

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    // Get user's timezone preference
    const { data: userData, error: fetchError } = await supabase
      .from('users')
      .select('profile_timezone')
      .eq('id', user.id)
      .single();

    if (fetchError) {
      console.error('Failed to fetch timezone:', fetchError);
      return NextResponse.json(
        { timezone: null }, // Return null on error, will use default
        { status: 200 }
      );
    }

    return NextResponse.json({
      timezone: userData?.profile_timezone || null
    });

  } catch (error) {
    console.error('Get timezone error:', error);
    return NextResponse.json(
      { timezone: null }, // Return null on error, will use default
      { status: 200 }
    );
  }
}
