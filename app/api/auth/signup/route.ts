import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { AutoIPAssignmentService } from '@/lib/services/auto-ip-assignment';
import { analyzeWebsiteInBackground } from '@/lib/website-intelligence';

export async function POST(request: NextRequest) {
  try {
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
              // Cookie setting can fail in middleware context
            }
          }
        }
      }
    );

    const { email, password, firstName, lastName, companyName, companyWebsite, country, inviteToken } = await request.json();

    // Validate input
    if (!email || !password || !firstName || !lastName || !companyName || !companyWebsite) {
      return NextResponse.json(
        { error: 'All fields are required (including company name and website)' },
        { status: 400 }
      );
    }

    // Country is optional - will be auto-detected from IP if not provided
    let profileCountry: string | null = null;
    if (country && typeof country === 'string' && country.trim().length > 0) {
      const c = country.trim().toLowerCase();
      if (c.length === 2) {
        profileCountry = c;
      } else {
        return NextResponse.json(
          { error: 'Country must be a 2-letter code (e.g., DE, US)' },
          { status: 400 }
        );
      }
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters long' },
        { status: 400 }
      );
    }

    console.log('Creating user with Supabase Auth:', { email, firstName, lastName });

    // Create user with Supabase Auth
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          first_name: firstName,
          last_name: lastName,
        },
        // Configure email confirmation redirect
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com'}/auth/callback`,
      }
    });

    if (error) {
      console.error('Supabase signup error:', error);
      
      // Handle specific error types
      if (error.message.includes('User already registered')) {
        return NextResponse.json(
          { error: 'User already exists with this email address' },
          { status: 409 }
        );
      }
      
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    // If user created but requires email verification, still proceed to create profile and auto-assign proxy
    if (data.user && !data.session) {
      try {
        // Pool imported from lib/db
// Auto-assign proxy using profile country if provided; fallback to IP
        const autoIPService = new AutoIPAssignmentService();
        let detectedCountryCode = profileCountry; // Start with user-provided country
        
        // If no country provided, detect from IP
        if (!detectedCountryCode) {
          const userLocation = await autoIPService.detectUserLocation(request);
          if (userLocation?.countryCode) {
            detectedCountryCode = userLocation.countryCode.toLowerCase();
            console.log('🌍 Auto-detected country from IP:', detectedCountryCode);
          }
        }
        
        // Create user profile (best-effort)
        await poolClient
          .from('users')
          .upsert({
            id: data.user.id,
            supabase_id: data.user.id,
            email: data.user.email,
            first_name: firstName,
            last_name: lastName,
            profile_country: detectedCountryCode, // Auto-detected or user-provided
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        const proxyConfig = await autoIPService.generateOptimalProxyConfig(
          null,
          detectedCountryCode || undefined
        );

        await poolClient
          .from('user_proxy_preferences')
          .upsert({
            user_id: data.user.id,
            detected_location: detectedCountryCode || null,
            linkedin_location: null,
            preferred_country: proxyConfig.country,
            preferred_state: proxyConfig.state,
            preferred_city: proxyConfig.city,
            confidence_score: proxyConfig.confidence,
            session_id: proxyConfig.sessionId,
            is_auto_assigned: true,
            last_updated: new Date().toISOString()
          }, { onConflict: 'user_id' });
      } catch (e) {
        console.error('Post-signup auto-assign (verification) failed (non-critical):', e);
      }

      return NextResponse.json({
        message: 'Registration successful! Please check your email to verify your account.',
        requiresVerification: true,
        email: email
      });
    }

    // If session exists, user is automatically logged in (email verification disabled)
    if (data.session && data.user) {
      console.log('User created successfully:', data.user.id);

      // Create user profile in our database
      let workspace: any = null;
      try {
        // Pool imported from lib/db
// Detect country from IP if not provided
        const autoIPService = new AutoIPAssignmentService();
        let detectedCountryCode = profileCountry; // Start with user-provided country

        if (!detectedCountryCode) {
          const userLocation = await autoIPService.detectUserLocation(request);
          if (userLocation?.countryCode) {
            detectedCountryCode = userLocation.countryCode.toLowerCase();
            console.log('🌍 Auto-detected country from IP:', detectedCountryCode);
          }
        }

        // Create or update user profile (without profile_country for now)
        const { error: profileError } = await pool
          .from('users')
          .upsert({
            id: data.user.id,
            supabase_id: data.user.id, // Supabase user ID
            email: data.user.email,
            first_name: firstName,
            last_name: lastName,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' });

        if (profileError && !profileError.message.includes('duplicate key')) {
          console.error('Profile creation error:', profileError);
        }

        // Automatically assign Bright Data dedicated IP based on user location
        try {
          console.log('🌍 Assigning dedicated IP for new user...');
          
          // Use the detected country code from above
          console.log('📍 Signup country code:', detectedCountryCode);
          
          // Generate optimal proxy configuration for the user
          const proxyConfig = await autoIPService.generateOptimalProxyConfig(
            undefined,
            detectedCountryCode || undefined
          );
          
          console.log('✅ Generated proxy config for new user:', {
            country: proxyConfig.country,
            state: proxyConfig.state,
            confidence: proxyConfig.confidence,
            sessionId: proxyConfig.sessionId
          });
          
          // Store user's proxy preference in database
          const { error: proxyError } = await pool
            .from('user_proxy_preferences')
            .insert({
              user_id: data.user.id,
              detected_location: detectedCountryCode || null,
              preferred_country: proxyConfig.country,
              preferred_state: proxyConfig.state,
              preferred_city: proxyConfig.city,
              confidence_score: proxyConfig.confidence,
              session_id: proxyConfig.sessionId,
              is_auto_assigned: true,
              last_updated: new Date().toISOString()
            });
          
          if (proxyError) {
            console.error('❌ Failed to store proxy preference during signup:', proxyError);
          } else {
            console.log('✅ Successfully assigned dedicated IP during signup');
          }
          
        } catch (ipAssignmentError) {
          console.error('⚠️ IP assignment during signup failed (non-critical):', ipAssignmentError);
          // Don't fail the entire signup if IP assignment fails
        }

        // Check if user has an invitation token
        if (inviteToken) {
          console.log('🎟️ User has invitation token:', inviteToken);

          try {
            // Accept the invitation using database function
            const { data: inviteResult, error: inviteError } = await pool
              .rpc('accept_workspace_invitation', {
                invitation_token: inviteToken,
                user_id: data.user.id
              });

            if (inviteError) {
              console.error('❌ Failed to accept invitation:', inviteError);
              throw inviteError;
            }

            if (inviteResult && inviteResult.length > 0) {
              const inviteData = inviteResult[0];
              workspace = {
                id: inviteData.workspace_id,
                name: inviteData.workspace_name
              };
              console.log('✅ Joined workspace via invitation:', workspace.name);

              // Update Stripe subscription - increase seat count
              try {
                const { data: subscription } = await pool
                  .from('workspace_subscriptions')
                  .select('stripe_subscription_id, plan')
                  .eq('workspace_id', workspace.id)
                  .eq('status', 'active')
                  .single();

                if (subscription?.stripe_subscription_id && subscription.plan === 'perseat') {
                  // Only increase seat count for per-seat plans
                  const Stripe = require('stripe');
                  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

                  // Get current subscription
                  const stripeSubscription = await stripe.subscriptions.retrieve(
                    subscription.stripe_subscription_id
                  );

                  // Increase quantity by 1
                  const currentQuantity = stripeSubscription.items.data[0].quantity || 1;
                  await stripe.subscriptions.update(subscription.stripe_subscription_id, {
                    items: [{
                      id: stripeSubscription.items.data[0].id,
                      quantity: currentQuantity + 1
                    }],
                    proration_behavior: 'always_invoice' // Charge immediately
                  });

                  console.log(`✅ Stripe subscription updated: ${currentQuantity} → ${currentQuantity + 1} seats`);
                }
              } catch (stripeErr) {
                console.error('⚠️ Failed to update Stripe subscription (non-critical):', stripeErr);
                // Don't fail signup if Stripe update fails - can be fixed manually
              }
            }
          } catch (inviteErr) {
            console.error('Invitation acceptance failed:', inviteErr);
            // Continue to create new workspace if invitation fails
          }
        }

        // If no invitation or invitation failed, check for domain-based workspace matching
        if (!workspace) {
          // Extract email domain
          const emailDomain = email.split('@')[1]?.toLowerCase();
          console.log('📧 Checking for existing workspace with domain:', emailDomain);

          // Try to find existing workspace with matching email domain using database function
          if (emailDomain) {
            try {
              const { data: matchedWorkspaces, error: matchError } = await pool
                .rpc('find_workspace_by_email_domain', {
                  user_email: email
                });

              if (!matchError && matchedWorkspaces && matchedWorkspaces.length > 0) {
                const matchedWorkspace = matchedWorkspaces[0];
                console.log('✅ Found existing workspace with matching domain:', matchedWorkspace.workspace_name);
                console.log('   Members in workspace:', matchedWorkspace.member_count);

                // Add user to the existing workspace
                const { error: memberError } = await pool
                  .from('workspace_members')
                  .insert({
                    workspace_id: matchedWorkspace.workspace_id,
                    user_id: data.user.id,
                    role: 'member' // Default to member role
                  });

                if (!memberError) {
                  workspace = {
                    id: matchedWorkspace.workspace_id,
                    name: matchedWorkspace.workspace_name,
                    company_url: matchedWorkspace.workspace_company_url
                  };
                  console.log('✅ User automatically joined workspace via domain match');
                } else {
                  console.error('❌ Failed to add user to matched workspace:', memberError);
                }
              } else if (matchError) {
                console.error('⚠️ Domain matching query failed:', matchError);
                // Continue to create new workspace if domain matching fails
              } else {
                console.log('📧 No existing workspace found with matching domain');
              }
            } catch (err) {
              console.error('⚠️ Domain matching error (non-critical):', err);
              // Continue to create new workspace if domain matching fails
            }
          }

          // If no domain match found, create new workspace
          if (!workspace) {
            const workspaceSlug = `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${data.user.id.substring(0, 8)}`
            const { data: workspaceData, error: workspaceError } = await pool
              .from('workspaces')
              .insert({
                name: companyName,
                slug: workspaceSlug,
                owner_id: data.user.id,
                company_url: companyWebsite
              })
              .select()
              .single();

            if (workspaceError) {
              console.error('Workspace creation error:', workspaceError);
            } else {
              workspace = workspaceData;
              console.log('✅ Workspace created:', workspace.id);
            }

            // Add user as workspace member with admin role (owner_id is in workspaces table)
            if (workspace) {
              const { error: memberError } = await pool
                .from('workspace_members')
                .insert({
                  workspace_id: workspace.id,
                  user_id: data.user.id,
                  role: 'admin'
                });

              if (memberError) {
                console.error('Workspace member creation error:', memberError);
              } else {
                console.log('✅ Workspace member added as admin');
              }

              // Trigger website analysis in background (non-blocking)
              // Note: Results are treated as initial hypotheses that need validation during discovery
              if (companyWebsite) {
                console.log('🌐 Triggering website analysis for:', companyWebsite);
                analyzeWebsiteInBackground({
                  url: companyWebsite,
                  workspaceId: workspace.id,
                  companyName: companyName
                }).catch(err => {
                  console.error('⚠️ Website analysis trigger failed (non-critical):', err);
                  // Don't fail signup if website analysis fails
                });
              }
            }
          }
        }

        // Sync to ActiveCampaign for InnovareAI customers (non-blocking)
        if (workspace) {
          try {
            console.log('🔄 Syncing user to ActiveCampaign...');

            const syncResponse = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/activecampaign/sync-user`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userId: data.user.id })
            });

            const syncResult = await syncResponse.json();

            if (syncResult.success) {
              console.log('✅ User synced to ActiveCampaign');
            } else if (syncResult.skipped) {
              console.log(`⚠️ ActiveCampaign sync skipped: ${syncResult.reason}`);
            } else {
              console.error('❌ ActiveCampaign sync failed:', syncResult.error);
            }
          } catch (acError) {
            console.error('⚠️ ActiveCampaign sync failed (non-critical):', acError);
            // Don't fail signup if ActiveCampaign is down
          }
        }

      } catch (profileErr) {
        console.error('Error creating user profile:', profileErr);
      }

      return NextResponse.json({
        message: 'Registration successful! You are now logged in.',
        user: {
          id: data.user.id,
          email: data.user.email,
          firstName: firstName,
          lastName: lastName
        },
        workspace: workspace ? { id: workspace.id, name: workspace.name } : null
      });
    }

    return NextResponse.json({
      message: 'Registration initiated. Please complete the verification process.',
      requiresVerification: true
    });

  } catch (error) {
    console.error('Signup API error:', error);
    return NextResponse.json(
      { error: 'Internal server error during registration' },
      { status: 500 }
    );
  }
}

// Handle GET requests - show signup page
export async function GET() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Create Account - SAM AI</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 min-h-screen flex items-center justify-center">
    <div class="max-w-md w-full mx-auto bg-gray-800 rounded-lg shadow-xl p-8">
        <div class="text-center mb-8">
            <img src="/SAM.jpg" alt="SAM AI" class="w-16 h-16 rounded-full object-cover mx-auto mb-4" style="object-position: center 30%;">
            <h1 class="text-2xl font-bold text-white">Join SAM AI</h1>
            <p class="text-gray-400">Create your account to get started</p>
        </div>
        
        <form id="signup-form" class="space-y-6">
            <div class="grid grid-cols-2 gap-4">
                <div>
                    <label for="firstName" class="block text-sm font-medium text-gray-300 mb-2">First Name</label>
                    <input 
                        type="text" 
                        id="firstName" 
                        name="firstName"
                        required
                        class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="First name"
                    >
                </div>
                <div>
                    <label for="lastName" class="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
                    <input 
                        type="text" 
                        id="lastName" 
                        name="lastName"
                        required
                        class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Last name"
                    >
                </div>
            </div>
            
            <div>
                <label for="email" class="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <input 
                    type="email" 
                    id="email" 
                    name="email"
                    required
                    class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter your email"
                >
            </div>
            
            <div>
                <label for="password" class="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input 
                    type="password" 
                    id="password" 
                    name="password"
                    required
                    minlength="6"
                    class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Create a password (min 8 characters)"
                >
            </div>
            
            <button 
                type="submit"
                class="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
                Create Account
            </button>
            
            <div class="text-center">
                <p class="text-gray-400 text-sm">
                    Already have an account? 
                    <a href="/api/auth/signin" class="text-purple-400 hover:text-purple-300">Sign in</a>
                </p>
            </div>
        </form>
        
        <div id="error-message" class="hidden mt-4 p-4 bg-red-600 text-white rounded-lg"></div>
        <div id="success-message" class="hidden mt-4 p-4 bg-green-600 text-white rounded-lg"></div>
    </div>
    
    <script>
        document.getElementById('signup-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const firstName = document.getElementById('firstName').value;
            const lastName = document.getElementById('lastName').value;
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            const errorDiv = document.getElementById('error-message');
            const successDiv = document.getElementById('success-message');
            
            // Clear previous messages
            errorDiv.classList.add('hidden');
            successDiv.classList.add('hidden');
            
            try {
                const response = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ firstName, lastName, email, password })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    successDiv.textContent = data.message;
                    successDiv.classList.remove('hidden');
                    
                    // If no verification required, redirect to main app
                    if (!data.requiresVerification) {
                        setTimeout(() => {
                            window.location.href = '/';
                        }, 1000);
                    } else {
                        // Show verification message
                        setTimeout(() => {
                            window.location.href = '/api/auth/signin';
                        }, 3000);
                    }
                } else {
                    errorDiv.textContent = data.error;
                    errorDiv.classList.remove('hidden');
                }
            } catch (error) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.classList.remove('hidden');
            }
        });
    </script>
</body>
</html>
  `;
  
  return new NextResponse(html, {
    headers: { 'Content-Type': 'text/html' },
  });
}