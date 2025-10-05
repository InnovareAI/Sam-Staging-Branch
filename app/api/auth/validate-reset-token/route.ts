import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

const supabaseAdmin = createServiceClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { token } = await request.json();

    if (!token) {
      return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // For password reset via Supabase recovery links, we just validate the format
    // The actual token validation happens during the password update
    // This endpoint is kept for backward compatibility but doesn't use a separate table

    if (!token || token.length < 10) {
      return NextResponse.json({ error: 'Invalid token format' }, { status: 400 });
    }

    return NextResponse.json({ valid: true });

  } catch (error) {
    console.error('Token validation error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}