import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');
  

  // Handle authentication errors
  if (error) {
    console.error('Auth callback error:', error, errorDescription);
    
    if (error === 'access_denied' && errorDescription?.includes('expired')) {
      return NextResponse.redirect(
        new URL('/api/auth/reset-password?error=expired', request.url)
      );
    }
    
    return NextResponse.redirect(
      new URL('/api/auth/signin?error=' + error, request.url)
    );
  }

  if (code) {
    const supabase = createRouteHandlerClient({ cookies: cookies });

    try {
      // Exchange the auth code for a session
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('Auth callback error:', error);
        return NextResponse.redirect(
          new URL('/api/auth/signin?error=callback_error', request.url)
        );
      }

      if (data.user) {
        // Create user profile if it doesn't exist
        try {
          const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
          );

          // Create user profile
          const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('users')
            .upsert({
              id: data.user.id,
              clerk_id: data.user.id, // Use Supabase user ID as clerk_id for compatibility
              email: data.user.email,
              first_name: data.user.user_metadata?.first_name,
              last_name: data.user.user_metadata?.last_name,
            }, {
              onConflict: 'id'
            })
            .select()
            .single();

          if (profileError) {
            console.error('Profile creation error:', profileError);
          }

          // Check if user already has a workspace
          const { data: existingUser, error: userCheckError } = await supabaseAdmin
            .from('users')
            .select('default_workspace_id')
            .eq('id', data.user.id)
            .single();

          // If user doesn't have a workspace, create one automatically
          if (!userCheckError && existingUser && !existingUser.default_workspace_id) {
            console.log('Creating default workspace for new user:', data.user.email);
            
            // Check if there's an InnovareAI workspace to add them to
            const { data: innovareWorkspace } = await supabaseAdmin
              .from('workspaces')
              .select('*')
              .eq('name', 'InnovareAI')
              .single();

            if (innovareWorkspace) {
              // Add user to InnovareAI workspace
              await supabaseAdmin
                .from('workspace_members')
                .insert({
                  workspace_id: innovareWorkspace.id,
                  user_id: data.user.id,
                  role: 'member'
                });

              // Update user with InnovareAI workspace
              await supabaseAdmin
                .from('users')
                .update({
                  default_workspace_id: innovareWorkspace.id,
                  current_workspace_id: innovareWorkspace.id,
                  updated_at: new Date().toISOString()
                })
                .eq('id', data.user.id);

              console.log('✅ Added user to InnovareAI workspace');
            } else {
              // Create personal workspace as fallback
              const firstName = data.user.user_metadata?.first_name || 'User';
              const lastName = data.user.user_metadata?.last_name || '';
              const workspaceName = `${firstName} ${lastName}`.trim() + "'s Workspace";
              
              const { data: newWorkspace, error: workspaceError } = await supabaseAdmin
                .from('workspaces')
                .insert({
                  name: workspaceName,
                  owner_id: data.user.id,
                  created_by: data.user.id,
                  settings: {}
                })
                .select()
                .single();

              if (!workspaceError && newWorkspace) {
                // Add user as workspace member
                await supabaseAdmin
                  .from('workspace_members')
                  .insert({
                    workspace_id: newWorkspace.id,
                    user_id: data.user.id,
                    role: 'owner'
                  });

                // Update user with default workspace
                await supabaseAdmin
                  .from('users')
                  .update({
                    default_workspace_id: newWorkspace.id,
                    current_workspace_id: newWorkspace.id,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', data.user.id);

                console.log('✅ Created personal workspace for user');
              }
            }
          }

        } catch (profileErr) {
          console.error('Error creating user profile:', profileErr);
        }
      }

      // Check if this is a password recovery flow or magic link
      if (type === 'recovery' || type === 'magiclink') {
        // For magic link authentication, user should be automatically signed in
        // No password change needed - redirect directly to the app
        console.log('Magic link authentication successful, redirecting to app');
        return NextResponse.redirect(new URL('/', request.url));
      }

      // Redirect to the main app
      return NextResponse.redirect(new URL('/', request.url));
    } catch (error) {
      console.error('Callback processing error:', error);
      return NextResponse.redirect(
        new URL('/api/auth/signin?error=callback_processing_error', request.url)
      );
    }
  }

  // If no code provided, redirect to signin
  return NextResponse.redirect(new URL('/api/auth/signin', request.url));
}