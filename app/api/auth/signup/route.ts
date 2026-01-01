import { pool } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getAdminAuth } from '@/lib/firebase-admin';
import { AutoIPAssignmentService } from '@/lib/services/auto-ip-assignment';
import { analyzeWebsiteInBackground } from '@/lib/website-intelligence';

export const dynamic = 'force-dynamic';

const SESSION_COOKIE_NAME = 'session';

export async function POST(request: NextRequest) {
  try {
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

    console.log('Creating user with Firebase Auth:', { email, firstName, lastName });

    const adminAuth = getAdminAuth();

    // Create user with Firebase Auth
    let firebaseUser;
    try {
      firebaseUser = await adminAuth.createUser({
        email,
        password,
        displayName: `${firstName} ${lastName}`,
        emailVerified: true, // Auto-verify for simplicity
      });
    } catch (authError: any) {
      console.error('Firebase signup error:', authError);

      if (authError.code === 'auth/email-already-exists') {
        return NextResponse.json(
          { error: 'User already exists with this email address' },
          { status: 409 }
        );
      }

      return NextResponse.json(
        { error: authError.message },
        { status: 400 }
      );
    }

    console.log('User created successfully:', firebaseUser.uid);

    // Create user profile in database
    let workspace: any = null;
    try {
      // Detect country from IP if not provided
      const autoIPService = new AutoIPAssignmentService();
      let detectedCountryCode = profileCountry;

      if (!detectedCountryCode) {
        const userLocation = await autoIPService.detectUserLocation(request);
        if (userLocation?.countryCode) {
          detectedCountryCode = userLocation.countryCode.toLowerCase();
          console.log('🌍 Auto-detected country from IP:', detectedCountryCode);
        }
      }

      // Create user profile using pool.query
      await pool.query(
        `INSERT INTO users (id, email, first_name, last_name, profile_country, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
         ON CONFLICT (id) DO UPDATE SET
           email = EXCLUDED.email,
           first_name = EXCLUDED.first_name,
           last_name = EXCLUDED.last_name,
           updated_at = NOW()`,
        [firebaseUser.uid, email, firstName, lastName, detectedCountryCode]
      );

      // Auto-assign proxy configuration
      try {
        const proxyConfig = await autoIPService.generateOptimalProxyConfig(
          undefined,
          detectedCountryCode || undefined
        );

        await pool.query(
          `INSERT INTO user_proxy_preferences 
           (user_id, detected_location, preferred_country, preferred_state, preferred_city, confidence_score, session_id, is_auto_assigned, last_updated)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW())
           ON CONFLICT (user_id) DO UPDATE SET
             detected_location = EXCLUDED.detected_location,
             preferred_country = EXCLUDED.preferred_country,
             preferred_state = EXCLUDED.preferred_state,
             preferred_city = EXCLUDED.preferred_city,
             confidence_score = EXCLUDED.confidence_score,
             session_id = EXCLUDED.session_id,
             last_updated = NOW()`,
          [firebaseUser.uid, detectedCountryCode, proxyConfig.country, proxyConfig.state, proxyConfig.city, proxyConfig.confidence, proxyConfig.sessionId]
        );
        console.log('✅ Proxy config assigned');
      } catch (proxyError) {
        console.error('⚠️ Proxy assignment failed (non-critical):', proxyError);
      }

      // Handle invitation token
      if (inviteToken) {
        console.log('🎟️ User has invitation token:', inviteToken);
        try {
          const inviteResult = await pool.query(
            `SELECT accept_workspace_invitation($1, $2) as result`,
            [inviteToken, firebaseUser.uid]
          );
          if (inviteResult.rows[0]?.result) {
            const inviteData = inviteResult.rows[0].result;
            workspace = { id: inviteData.workspace_id, name: inviteData.workspace_name };
            console.log('✅ Joined workspace via invitation:', workspace?.name);
          }
        } catch (inviteErr) {
          console.error('Invitation acceptance failed:', inviteErr);
        }
      }

      // If no invitation, try domain-based matching or create new workspace
      if (!workspace) {
        const emailDomain = email.split('@')[1]?.toLowerCase();
        console.log('📧 Checking for workspace with domain:', emailDomain);

        if (emailDomain) {
          try {
            const matchResult = await pool.query(
              `SELECT workspace_id, workspace_name FROM find_workspace_by_email_domain($1)`,
              [email]
            );
            if (matchResult.rows.length > 0) {
              const matched = matchResult.rows[0];
              await pool.query(
                `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'member')`,
                [matched.workspace_id, firebaseUser.uid]
              );
              workspace = { id: matched.workspace_id, name: matched.workspace_name };
              console.log('✅ User joined workspace via domain match');
            }
          } catch (matchErr) {
            console.error('⚠️ Domain matching failed (non-critical):', matchErr);
          }
        }

        // Create new workspace if no match
        if (!workspace) {
          const workspaceSlug = `${companyName.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${firebaseUser.uid.substring(0, 8)}`;
          try {
            const wsResult = await pool.query(
              `INSERT INTO workspaces (name, slug, owner_id, company_url) VALUES ($1, $2, $3, $4) RETURNING id, name`,
              [companyName, workspaceSlug, firebaseUser.uid, companyWebsite]
            );
            workspace = wsResult.rows[0];

            await pool.query(
              `INSERT INTO workspace_members (workspace_id, user_id, role) VALUES ($1, $2, 'admin')`,
              [workspace.id, firebaseUser.uid]
            );
            console.log('✅ Workspace created:', workspace.id);

            // Trigger website analysis
            if (companyWebsite) {
              analyzeWebsiteInBackground({
                url: companyWebsite,
                workspaceId: workspace.id,
                companyName: companyName
              }).catch(err => console.error('⚠️ Website analysis failed:', err));
            }
          } catch (wsErr) {
            console.error('Workspace creation error:', wsErr);
          }
        }
      }

    } catch (profileErr) {
      console.error('Error creating user profile:', profileErr);
    }

    // Create session cookie
    try {
      const customToken = await adminAuth.createCustomToken(firebaseUser.uid);
      // Note: The client should exchange this for a session
      // For now, we'll return the custom token

      return NextResponse.json({
        message: 'Registration successful! You are now logged in.',
        customToken, // Client exchanges this for ID token
        user: {
          id: firebaseUser.uid,
          email: email,
          firstName: firstName,
          lastName: lastName
        },
        workspace: workspace ? { id: workspace.id, name: workspace.name } : null
      });
    } catch (tokenErr) {
      console.error('Token creation error:', tokenErr);
      return NextResponse.json({
        message: 'Registration successful!',
        user: { id: firebaseUser.uid, email },
        workspace: workspace ? { id: workspace.id, name: workspace.name } : null
      });
    }

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
                    <input type="text" id="firstName" name="firstName" required
                        class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="First name">
                </div>
                <div>
                    <label for="lastName" class="block text-sm font-medium text-gray-300 mb-2">Last Name</label>
                    <input type="text" id="lastName" name="lastName" required
                        class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        placeholder="Last name">
                </div>
            </div>
            
            <div>
                <label for="email" class="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <input type="email" id="email" name="email" required
                    class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter your email">
            </div>
            
            <div>
                <label for="companyName" class="block text-sm font-medium text-gray-300 mb-2">Company Name</label>
                <input type="text" id="companyName" name="companyName" required
                    class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Your company">
            </div>
            
            <div>
                <label for="companyWebsite" class="block text-sm font-medium text-gray-300 mb-2">Company Website</label>
                <input type="url" id="companyWebsite" name="companyWebsite" required
                    class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="https://yourcompany.com">
            </div>
            
            <div>
                <label for="password" class="block text-sm font-medium text-gray-300 mb-2">Password</label>
                <input type="password" id="password" name="password" required minlength="8"
                    class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Create a password (min 8 characters)">
            </div>
            
            <button type="submit" class="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors">
                Create Account
            </button>
            
            <div class="text-center">
                <p class="text-gray-400 text-sm">
                    Already have an account? 
                    <a href="/signin" class="text-purple-400 hover:text-purple-300">Sign in</a>
                </p>
            </div>
        </form>
        
        <div id="error-message" class="hidden mt-4 p-4 bg-red-600 text-white rounded-lg"></div>
        <div id="success-message" class="hidden mt-4 p-4 bg-green-600 text-white rounded-lg"></div>
    </div>
    
    <script>
        document.getElementById('signup-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const data = {
                firstName: document.getElementById('firstName').value,
                lastName: document.getElementById('lastName').value,
                email: document.getElementById('email').value,
                companyName: document.getElementById('companyName').value,
                companyWebsite: document.getElementById('companyWebsite').value,
                password: document.getElementById('password').value
            };
            
            const errorDiv = document.getElementById('error-message');
            const successDiv = document.getElementById('success-message');
            
            errorDiv.classList.add('hidden');
            successDiv.classList.add('hidden');
            
            try {
                const response = await fetch('/api/auth/signup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(data)
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    successDiv.textContent = result.message;
                    successDiv.classList.remove('hidden');
                    setTimeout(() => window.location.href = '/', 1500);
                } else {
                    errorDiv.textContent = result.error;
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