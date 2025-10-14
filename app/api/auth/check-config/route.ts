import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({
        error: 'Missing Supabase configuration',
        details: {
          hasUrl: !!supabaseUrl,
          hasAnonKey: !!supabaseAnonKey
        }
      }, { status: 500 });
    }

    // Test Supabase connection
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Try to fetch auth settings
    const { data, error } = await supabase.auth.getSession();

    return NextResponse.json({
      status: 'ok',
      supabaseUrl,
      sessionError: error?.message || null,
      hasSession: !!data.session,
      timestamp: new Date().toISOString(),
      expectedRedirectUrl: 'https://app.meet-sam.com/auth/callback'
    });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Configuration check failed',
      message: error.message
    }, { status: 500 });
  }
}
