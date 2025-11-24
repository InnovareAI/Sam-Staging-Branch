import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

/**
 * POST /api/user/update-timezone
 * Save user's timezone preference to their profile
 * Called after first campaign creation to remember their timezone choice
 */
export async function POST(request: NextRequest) {
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

    const body = await request.json();
    const { timezone } = body;

    if (!timezone) {
      return NextResponse.json(
        { error: 'Timezone is required' },
        { status: 400 }
      );
    }

    // Update user's timezone preference
    const { error: updateError } = await supabase
      .from('users')
      .update({ profile_timezone: timezone })
      .eq('id', user.id);

    if (updateError) {
      console.error('Failed to update timezone:', updateError);
      return NextResponse.json(
        { error: 'Failed to update timezone preference' },
        { status: 500 }
      );
    }

    console.log(`✅ Updated timezone for user ${user.email}: ${timezone}`);

    return NextResponse.json({
      success: true,
      timezone
    });

  } catch (error) {
    console.error('Update timezone error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
