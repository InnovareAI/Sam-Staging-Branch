import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/security/route-auth'

export async function GET(request: NextRequest) {
  // CRITICAL: Require admin authentication
  // This prevents unauthorized access to all workspace/member data
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    )
    
    // Fetch workspaces
    const { data: workspaces, error: wsError } = await supabase
      .from('workspaces')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (wsError) throw wsError
    
    // Fetch workspace members
    const { data: members, error: memError } = await supabase
      .from('workspace_members')
      .select('*')
      .order('joined_at', { ascending: false })
    
    if (memError) throw memError
    
    return NextResponse.json({ 
      workspaces: workspaces || [], 
      members: members || []
    })
  } catch (error: any) {
    console.error('Error fetching superadmin data:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to fetch data' },
      { status: 500 }
    )
  }
}
