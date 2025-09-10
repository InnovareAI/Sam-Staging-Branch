import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function POST(request: NextRequest) {
  try {
    // Check for auth header
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Authorization required' }, { status: 401 });
    }

    // Create Supabase admin client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !userData.user) {
      return NextResponse.json({ error: 'Invalid authorization' }, { status: 401 });
    }

    const user = userData.user;
    const { name, userId } = await request.json();

    if (!name || !userId) {
      return NextResponse.json({ error: 'Name and userId required' }, { status: 400 });
    }

    if (user.id !== userId) {
      return NextResponse.json({ error: 'User mismatch' }, { status: 401 });
    }

    if (!user.email_confirmed_at) {
      return NextResponse.json({ error: 'Email verification required' }, { status: 403 });
    }

    // Create organization using admin client
    const slug = name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const { data: orgData, error: orgError } = await supabaseAdmin
      .from('organizations')
      .insert({
        name: name.trim(),
        slug: slug
      })
      .select()
      .single();

    if (orgError) {
      console.error('Org creation error:', orgError);
      return NextResponse.json({ error: 'Failed to create organization' }, { status: 500 });
    }

    // Add user to org
    const { error: userOrgError } = await supabaseAdmin.from('user_organizations').insert({
      organization_id: orgData.id,
      user_id: userId,
      role: 'owner'
    });

    if (userOrgError) {
      console.error('User organization link error:', userOrgError);
      // Continue anyway - organization was created
    }

    return NextResponse.json({
      message: 'Organization created successfully',
      organization: orgData
    });

  } catch (error) {
    console.error('Server error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}