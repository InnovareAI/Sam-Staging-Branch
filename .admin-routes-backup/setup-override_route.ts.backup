import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  try {
    // Create admin client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const body = await req.json();
    const { email, pin, password, setupToken } = body;

    // Basic security check
    if (setupToken !== 'innovare-setup-2024') {
      return NextResponse.json(
        { error: 'Invalid setup token' },
        { status: 401 }
      );
    }

    if (!email || !pin || !password) {
      return NextResponse.json(
        { error: 'Email, PIN, and password are required' },
        { status: 400 }
      );
    }

    // Get or create InnovareAI workspace
    let { data: workspace } = await supabase
      .from('workspaces')
      .select('id')
      .ilike('name', '%InnovareAI%')
      .single();

    if (!workspace) {
      const { data: newWorkspace, error: workspaceError } = await supabase
        .from('workspaces')
        .insert({
          name: 'InnovareAI',
          domain: 'innovareai.com',
          description: 'InnovareAI core workspace for system administration'
        })
        .select('id')
        .single();

      if (workspaceError) {
        console.error('Workspace creation error:', workspaceError);
        return NextResponse.json(
          { error: 'Failed to create workspace' },
          { status: 500 }
        );
      }

      workspace = newWorkspace;
    }

    // Hash credentials with salt
    const salt = process.env.OVERRIDE_SALT || 'innovareai_override_2024';
    const pinHash = crypto.createHash('sha256').update(pin + salt).digest('hex');
    const passwordHash = crypto.createHash('sha256').update(password + salt).digest('hex');

    // Create or update admin user
    const { data: adminUser, error: adminError } = await supabase
      .from('sam_admin_users')
      .upsert({
        workspace_id: workspace.id,
        email: email.toLowerCase(),
        pin_hash: pinHash,
        password_hash: passwordHash,
        full_access: true,
        is_active: true,
        usage_count: 0,
        notes: 'InnovareAI admin user - manual setup'
      }, {
        onConflict: 'workspace_id,email'
      })
      .select()
      .single();

    if (adminError) {
      console.error('Admin user creation error:', adminError);
      return NextResponse.json(
        { error: 'Failed to create admin user' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Admin user created successfully',
      adminUser: {
        id: adminUser.id,
        email: adminUser.email,
        workspace_id: adminUser.workspace_id
      }
    });

  } catch (error) {
    console.error('Setup override error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}