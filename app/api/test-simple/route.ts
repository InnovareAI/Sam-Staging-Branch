import { NextRequest, NextResponse } from 'next/server';

// Simple test without any dependencies
export async function GET(req: NextRequest) {
  try {
    return NextResponse.json({
      message: 'API route is working!',
      timestamp: new Date().toISOString(),
      nodeEnv: process.env.NODE_ENV,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      hasSupabaseKeys: !!process.env.SUPABASE_SERVICE_ROLE_KEY && !!process.env.NEXT_PUBLIC_SUPABASE_URL
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}