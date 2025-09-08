import { auth } from '@clerk/nextjs/server';
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';

// Test authentication and database connection
export async function GET(req: NextRequest) {
  try {
    console.log('🔍 Testing auth and database...');
    
    // Test Clerk auth
    const { userId } = await auth();
    console.log('👤 Clerk user ID:', userId);
    
    if (!userId) {
      return NextResponse.json({ 
        error: 'Not authenticated',
        authenticated: false 
      }, { status: 401 });
    }

    // Test Supabase connection
    const supabase = supabaseAdmin();
    console.log('📡 Testing Supabase connection...');
    
    // Try to fetch user from database
    const { data: userData, error: userError } = await supabase
      .from('users')
      .select('id, first_name, last_name, email, current_workspace_id')
      .eq('clerk_id', userId)
      .single();
    
    console.log('🗃️ User data:', userData);
    console.log('❌ User error:', userError);

    // Test workspace access
    let workspaceData = null;
    if (userData?.current_workspace_id) {
      const { data: workspace, error: workspaceError } = await supabase
        .from('workspaces')
        .select('id, name')
        .eq('id', userData.current_workspace_id)
        .single();
      
      workspaceData = workspace;
      console.log('🏢 Workspace data:', workspace);
      console.log('❌ Workspace error:', workspaceError);
    }

    return NextResponse.json({
      authenticated: true,
      userId,
      user: userData,
      userError: userError?.message,
      workspace: workspaceData,
      supabaseConnection: 'OK'
    });

  } catch (error) {
    console.error('💥 Test error:', error);
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}