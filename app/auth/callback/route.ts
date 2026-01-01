import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { AutoIPAssignmentService } from '@/lib/services/auto-ip-assignment';
import { detectCorruptedCookiesInRequest, clearAllAuthCookies } from '@/lib/auth/cookie-cleanup';

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const type = requestUrl.searchParams.get('type');
  const error = requestUrl.searchParams.get('error');
  const errorDescription = requestUrl.searchParams.get('error_description');

  // AUTOMATIC COOKIE CLEANUP: Clear any corrupted cookies before processing callback
  const allCookies = request.cookies.getAll();
  const corruptedCookies = detectCorruptedCookiesInRequest(allCookies);

  if (corruptedCookies.length > 0) {
    console.warn('[Auth Callback] Detected corrupted cookies - clearing before processing');
    // Continue processing but log the issue (cookies will be replaced by new session)
  }

  // Handle authentication errors
  if (error) {
    console.error('Auth callback error:', error, errorDescription);

    if (error === 'access_denied' && errorDescription?.includes('expired')) {
      // Password reset link expired - redirect to signin with message
      const response = NextResponse.redirect(
        new URL('/signin?error=reset_expired&message=' + encodeURIComponent('Your password reset link has expired. Please request a new one.'), request.url)
      );
      // Clear cookies on error
      clearAllAuthCookies(response);
      return response;
    }

    // Redirect all other auth errors to signin with cleared cookies
    const response = NextResponse.redirect(
      new URL('/signin?error=' + error, request.url)
    );
    clearAllAuthCookies(response);
    return response;
  }

  if (code) {
    // CRITICAL: Check if this is a recovery flow BEFORE exchanging the code
    // Recovery codes can only be used once, so we must not consume them here
    if (type === 'recovery') {
      console.log('🔑 Recovery flow detected - passing code to reset password page WITHOUT exchanging');
      const resetUrl = new URL('/reset-password', request.url);
      resetUrl.searchParams.set('code', code);
      resetUrl.searchParams.set('type', 'recovery');
      return NextResponse.redirect(resetUrl);
    }

    const cookieStore = await cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet) {
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              );
            } catch {
              // Cookie setting can fail in middleware
            }
          },
        },
      }
    );

    try {
      // Exchange the auth code for a session (only for non-recovery flows)
      const { data, error } = await supabase.auth.exchangeCodeForSession(code);

      if (error) {
        console.error('[Auth Callback] Code exchange error:', error);
        const response = NextResponse.redirect(
          new URL('/signin?error=callback_error&message=' + encodeURIComponent('Authentication failed. Please try signing in again.'), request.url)
        );
        // Clear cookies on error
        clearAllAuthCookies(response);
        return response;
      }

      if (data.user) {
        // Create user profile if it doesn't exist
        try {
          // Pool imported from lib/db
// Create user profile
          const { data: userProfile, error: profileError } = await supabaseAdmin
            .from('users')
            .upsert({
              id: data.user.id,
              supabase_id: data.user.id, // Supabase user ID
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
            .select('current_workspace_id')
            .eq('id', data.user.id)
            .single();

          // If user doesn't have a workspace, create one automatically
          if (!userCheckError && existingUser && !existingUser.current_workspace_id) {
            console.log('Creating default workspace for new user:', data.user.email);

            // SECURITY FIX: ALWAYS create personal workspace for each user
            // NEVER add users to shared workspaces automatically (multi-tenant isolation)

            // Extract user info from metadata
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

                // Update user with current workspace
                await supabaseAdmin
                  .from('users')
                  .update({
                    current_workspace_id: newWorkspace.id,
                    updated_at: new Date().toISOString()
                  })
                  .eq('id', data.user.id);

                console.log('✅ Created personal workspace for user');
              }
            }

          // Automatically assign Bright Data dedicated IP for email-verified users
          try {
            // Check if user already has IP assignment
            const { data: existingProxy } = await supabaseAdmin
              .from('user_proxy_preferences')
              .select('id')
              .eq('user_id', data.user.id)
              .single();

            if (!existingProxy) {
              console.log('🌍 Assigning dedicated IP for email-verified user...');
              
              const autoIPService = new AutoIPAssignmentService();
              
              // Detect user location from request headers
              const userLocation = await autoIPService.detectUserLocation(request);
              console.log('📍 Detected callback location:', userLocation);
              
              // Generate optimal proxy configuration for the user
              const proxyConfig = await autoIPService.generateOptimalProxyConfig(userLocation || undefined);
              
              console.log('✅ Generated proxy config for verified user:', {
                country: proxyConfig.country,
                state: proxyConfig.state,
                confidence: proxyConfig.confidence,
                sessionId: proxyConfig.sessionId
              });
              
              // Store user's proxy preference in database
              const { error: proxyError } = await supabaseAdmin
                .from('user_proxy_preferences')
                .insert({
                  user_id: data.user.id,
                  detected_location: userLocation ? `${userLocation.city}, ${userLocation.regionName}, ${userLocation.country}` : null,
                  preferred_country: proxyConfig.country,
                  preferred_state: proxyConfig.state,
                  preferred_city: proxyConfig.city,
                  confidence_score: proxyConfig.confidence,
                  session_id: proxyConfig.sessionId,
                  is_auto_assigned: true,
                  created_at: new Date().toISOString(),
                  last_updated: new Date().toISOString()
                });
              
              if (proxyError) {
                console.error('❌ Failed to store proxy preference during email verification:', proxyError);
              } else {
                console.log('✅ Successfully assigned dedicated IP during email verification');
              }
            } else {
              console.log('ℹ️ User already has IP assignment, skipping');
            }
            
          } catch (ipAssignmentError) {
            console.error('⚠️ IP assignment during email verification failed (non-critical):', ipAssignmentError);
            // Don't fail the entire callback if IP assignment fails
          }

        } catch (profileErr) {
          console.error('Error creating user profile:', profileErr);
        }
      }

      // Check if this is a magic link
      if (type === 'magiclink') {
        // For magic link authentication, user should be automatically signed in
        // No password change needed - redirect directly to the app
        console.log('Magic link authentication successful, redirecting to app');
        return NextResponse.redirect(new URL('/', request.url));
      }

      // Redirect to the main app
      return NextResponse.redirect(new URL('/', request.url));
    } catch (error) {
      console.error('[Auth Callback] Callback processing error:', error);
      const response = NextResponse.redirect(
        new URL('/signin?error=callback_processing_error&message=' + encodeURIComponent('Something went wrong. Please try signing in again.'), request.url)
      );
      // Clear cookies on error
      clearAllAuthCookies(response);
      return response;
    }
  }

  // If no code provided, redirect to signin
  const response = NextResponse.redirect(new URL('/signin', request.url));
  // Clear any stale cookies
  clearAllAuthCookies(response);
  return response;
}