import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';
import * as postmark from 'postmark';
import { createPostmarkHelper, EMAIL_BYPASS_MODE, shouldBypassEmail, getSafeTestEmail } from '../../../../lib/postmark-helper';
import { activeCampaignService } from '../../../../lib/activecampaign';

// Enhanced type definitions for better error handling
interface SupabaseUser {
  id: string;
  email?: string;
  invited_at?: string;
  user_metadata?: Record<string, any>;
  app_metadata?: Record<string, any>;
  created_at?: string;
  updated_at?: string;
}

interface SupabaseInviteResponse {
  user?: SupabaseUser;
  id?: string;
  user_id?: string;
  userId?: string;
  invited_at?: string;
  email?: string;
  [key: string]: any;
}

interface EnhancedInviteData {
  user: SupabaseUser;
  source: 'existing_user' | 'new_invitation' | 'fallback_created';
}

// Company configurations
const COMPANY_CONFIG = {
  InnovareAI: {
    postmarkApiKey: process.env.POSTMARK_INNOVAREAI_API_KEY,
    fromEmail: 'sp@innovareai.com', // Sarah Powell
    companyName: 'InnovareAI',
    contactEmail: 'sp@innovareai.com',
    contactName: 'Sarah Powell'
  },
  '3cubedai': {
    postmarkApiKey: process.env.POSTMARK_3CUBEDAI_API_KEY,
    fromEmail: 'sophia@3cubed.ai', // Sophia Caldwell
    companyName: '3CubedAI',
    contactEmail: 'sophia@3cubed.ai',
    contactName: 'Sophia Caldwell'
  }
};

// Super admin emails
const SUPER_ADMIN_EMAILS = ['tl@innovareai.com', 'cl@innovareai.com'];

// Enhanced logging utility for debugging invitation issues
function logInvitationDebug(context: string, data: any, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO') {
  const timestamp = new Date().toISOString();
  const prefix = level === 'ERROR' ? '❌' : level === 'WARN' ? '⚠️' : '✅';
  
  console.log(`${prefix} [${timestamp}] INVITATION_${context}:`);
  if (typeof data === 'object') {
    console.log(JSON.stringify(data, null, 2));
  } else {
    console.log(data);
  }
}

// Enhanced fallback logic for handling incomplete Supabase responses
function extractUserIdFromSupabaseResponse(response: SupabaseInviteResponse, email: string): EnhancedInviteData | null {
  logInvitationDebug('RESPONSE_ANALYSIS', {
    hasUserProperty: !!response.user,
    userPropertyId: response.user?.id,
    directId: response.id,
    userIdProperty: response.user_id,
    userIdVariant: response.userId,
    email: email,
    fullResponseKeys: Object.keys(response)
  });

  // Primary: Check if user object exists with ID
  if (response.user?.id) {
    logInvitationDebug('PRIMARY_PATH_SUCCESS', {
      userId: response.user.id,
      email: response.user.email || email,
      source: 'user_object'
    });
    
    return {
      user: response.user,
      source: 'new_invitation'
    };
  }

  // Secondary: Try various ID fields from the response root
  const possibleIds = [
    response.id,
    response.user_id, 
    response.userId,
    (response as any).user?.id,
    (response as any).data?.user?.id,
    (response as any).data?.id
  ].filter(Boolean);

  logInvitationDebug('ID_EXTRACTION_ATTEMPT', {
    possibleIds,
    totalFound: possibleIds.length
  });

  if (possibleIds.length > 0) {
    const userId = possibleIds[0];
    const fallbackUser: SupabaseUser = {
      id: userId,
      email: email,
      invited_at: response.invited_at || new Date().toISOString()
    };

    logInvitationDebug('FALLBACK_SUCCESS', {
      userId,
      email,
      source: 'id_extraction',
      extractedFrom: possibleIds.length > 1 ? 'multiple_sources' : 'single_source'
    });

    return {
      user: fallbackUser,
      source: 'fallback_created'
    };
  }

  // Tertiary: Deep inspection of nested objects
  const deepSearch = (obj: any, path: string = ''): string | null => {
    if (!obj || typeof obj !== 'object') return null;
    
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;
      
      // Look for ID-like properties
      if ((key === 'id' || key.includes('id') || key.includes('Id')) && 
          typeof value === 'string' && 
          value.length > 10) {
        logInvitationDebug('DEEP_ID_FOUND', { path: currentPath, value, key });
        return value as string;
      }
      
      // Recursively search nested objects
      if (typeof value === 'object' && value !== null) {
        const nestedResult = deepSearch(value, currentPath);
        if (nestedResult) return nestedResult;
      }
    }
    return null;
  };

  const deepId = deepSearch(response);
  if (deepId) {
    const fallbackUser: SupabaseUser = {
      id: deepId,
      email: email,
      invited_at: response.invited_at || new Date().toISOString()
    };

    logInvitationDebug('DEEP_SEARCH_SUCCESS', {
      userId: deepId,
      email,
      source: 'deep_inspection'
    });

    return {
      user: fallbackUser,
      source: 'fallback_created'
    };
  }

  // Complete failure - no user ID found
  logInvitationDebug('COMPLETE_FAILURE', {
    message: 'No user ID found in any location',
    responseStructure: {
      keys: Object.keys(response),
      hasUser: !!response.user,
      responseType: typeof response,
      email: email
    }
  }, 'ERROR');

  return null;
}

export async function POST(request: NextRequest) {
  try {
    // Get auth header for admin verification
    const authHeader = request.headers.get('authorization');
    if (!authHeader) {
      return NextResponse.json(
        { error: 'Authorization required' },
        { status: 401 }
      );
    }

    // Create Supabase client with service role for admin operations
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const adminSupabase = createClient(supabaseUrl, supabaseServiceKey);

    // Also create client with user context for verification
    const userSupabase = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: authHeader } }
    });

    // Verify the requesting user is authenticated and has admin rights
    const { data: { user }, error: authError } = await userSupabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is super admin
    if (!SUPER_ADMIN_EMAILS.includes(user.email?.toLowerCase() || '')) {
      return NextResponse.json(
        { error: 'Forbidden - Super admin access required' },
        { status: 403 }
      );
    }

    const { email, firstName, lastName, organizationId, workspaceId, company = 'InnovareAI', role = 'member' } = await request.json();

    if (!email || !firstName || !lastName) {
      return NextResponse.json(
        { error: 'Email, first name, and last name are required' },
        { status: 400 }
      );
    }

    // Validate company
    if (!COMPANY_CONFIG[company as keyof typeof COMPANY_CONFIG]) {
      return NextResponse.json(
        { error: 'Invalid company' },
        { status: 400 }
      );
    }

    // Check if organization exists (if provided)
    if (organizationId) {
      const { data: org, error: orgError } = await adminSupabase
        .from('organizations')
        .select('id, name')
        .eq('id', organizationId)
        .single();

      if (orgError || !org) {
        return NextResponse.json(
          { error: 'Organization not found' },
          { status: 404 }
        );
      }
    }

    console.log('Sending invitation to:', email);

    // Check if user already exists in auth.users
    const { data: existingUsers, error: checkError } = await adminSupabase.auth.admin.listUsers();
    if (checkError) {
      console.error('Error checking existing users:', checkError);
      return NextResponse.json(
        { error: 'Failed to check existing users: ' + checkError.message },
        { status: 500 }
      );
    }

    const existingUser = existingUsers.users.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
    let inviteData: EnhancedInviteData;

    if (existingUser) {
      // User already exists - don't try to invite via auth, just use existing user
      logInvitationDebug('EXISTING_USER_FOUND', {
        email,
        userId: existingUser.id,
        userCreatedAt: existingUser.created_at
      });
      
      inviteData = { 
        user: existingUser as SupabaseUser, 
        source: 'existing_user' 
      };
    } else {
      // User doesn't exist - send invitation via Supabase Admin API
      logInvitationDebug('NEW_USER_INVITATION_START', {
        email,
        firstName,
        lastName,
        organizationId,
        role,
        invitedBy: user.id
      });

      // Create user directly with email confirmation to avoid Supabase's email templates
      const { data: newInviteData, error: inviteError } = await adminSupabase.auth.admin.createUser({
        email: email,
        email_confirm: true, // Auto-confirm email to avoid Supabase's email templates
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
          invited_by: user.id,
          organization_id: organizationId,
          role: role
        }
      });

      if (inviteError) {
        logInvitationDebug('INVITATION_ERROR', {
          error: inviteError,
          email,
          errorMessage: inviteError.message,
          errorCode: (inviteError as any).status || 'unknown'
        }, 'ERROR');

        return NextResponse.json(
          { error: 'Failed to send invitation: ' + inviteError.message },
          { status: 500 }
        );
      }

      logInvitationDebug('SUPABASE_RESPONSE_RECEIVED', {
        email,
        dataKeys: Object.keys(newInviteData || {}),
        hasUser: !!(newInviteData as SupabaseInviteResponse)?.user,
        rawResponse: newInviteData
      });

      // Use enhanced fallback logic
      const extractedData = extractUserIdFromSupabaseResponse(
        newInviteData as SupabaseInviteResponse, 
        email
      );

      if (extractedData) {
        inviteData = extractedData;
        logInvitationDebug('EXTRACTION_SUCCESS', {
          userId: extractedData.user.id,
          email: extractedData.user.email,
          source: extractedData.source
        });
      } else {
        // Complete failure - enhanced error logging already done in extract function
        logInvitationDebug('CRITICAL_EXTRACTION_FAILURE', {
          message: 'Enhanced extraction failed completely',
          email,
          responseReceived: !!newInviteData,
          supportContact: 'Please contact technical support with this error'
        }, 'ERROR');

        return NextResponse.json(
          { 
            error: 'Failed to create user invitation - unable to extract user ID from Supabase response. Please try again or contact technical support.',
            details: {
              email,
              timestamp: new Date().toISOString(),
              errorCode: 'USER_ID_EXTRACTION_FAILED'
            }
          },
          { status: 500 }
        );
      }
    }

    // Send custom welcome email using enhanced Postmark helper with suppression handling
    try {
      const postmarkHelper = createPostmarkHelper(company as 'InnovareAI' | '3cubedai');
      if (postmarkHelper) {
        const redirectUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com';
        const isNewUser = !existingUser;
        const companyConfig = COMPANY_CONFIG[company as keyof typeof COMPANY_CONFIG];
        
        // Handle email bypass mode for testing
        let targetEmail = email;
        let emailNote = '';
        
        if (shouldBypassEmail(email)) {
          targetEmail = getSafeTestEmail();
          emailNote = ` (BYPASS MODE: Original recipient was ${email})`;
          logInvitationDebug('EMAIL_BYPASS_ACTIVE', {
            originalEmail: email,
            redirectedTo: targetEmail,
            reason: 'EMAIL_BYPASS_MODE enabled'
          }, 'WARN');
        }
        
        const emailSubject = isNewUser 
          ? `Welcome to SAM AI - Your Account is Ready!${emailNote}`
          : `You've been added to SAM AI by ${companyConfig.companyName}${emailNote}`;
          
        const emailHtmlBody = isNewUser ? `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${emailNote ? `<div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 20px; color: #856404;"><strong>TEST MODE:</strong> This email was originally intended for ${email}</div>` : ''}
            <h1 style="color: #7c3aed;">Welcome to SAM AI!</h1>
            <p>Hello ${firstName},</p>
            <p>You've been invited to join SAM AI by ${companyConfig.companyName}. Your intelligent sales assistant is ready to help you streamline your sales process and boost productivity.</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${redirectUrl}/auth/callback" 
                 style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                Access SAM AI Platform
              </a>
            </div>
            <p><strong>What you can do with SAM AI:</strong></p>
            <ul>
              <li>Chat with your AI sales assistant for personalized guidance</li>
              <li>Access comprehensive knowledge base</li>
              <li>Manage your lead pipeline efficiently</li>
              <li>Track campaign performance and analytics</li>
              <li>Collaborate with your team in shared workspaces</li>
            </ul>
            <p style="color: #666; font-size: 14px;">
              If you have any questions, please contact ${companyConfig.contactName} at ${companyConfig.contactEmail} or our support team.
            </p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">
              This invitation was sent by ${companyConfig.companyName}. 
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        ` : `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            ${emailNote ? `<div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 20px; color: #856404;"><strong>TEST MODE:</strong> This email was originally intended for ${email}</div>` : ''}
            <h1 style="color: #7c3aed;">You've been added to SAM AI!</h1>
            <p>Hello ${firstName},</p>
            <p>Good news! ${companyConfig.companyName} has added you to their SAM AI workspace. You can now access the platform with your existing account.</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${redirectUrl}" 
                 style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                Access Your Workspace
              </a>
            </div>
            <p><strong>What you can do with SAM AI:</strong></p>
            <ul>
              <li>Chat with your AI sales assistant for personalized guidance</li>
              <li>Access comprehensive knowledge base</li>
              <li>Manage your lead pipeline efficiently</li>
              <li>Track campaign performance and analytics</li>
              <li>Collaborate with your team in shared workspaces</li>
            </ul>
            <p style="color: #666; font-size: 14px;">
              If you have any questions, please contact ${companyConfig.contactName} at ${companyConfig.contactEmail} or our support team.
            </p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">
              You received this email because ${companyConfig.companyName} added you to their SAM AI workspace.
            </p>
          </div>
        `;
        
        // Use the enhanced email helper with suppression handling
        const emailResult = await postmarkHelper.sendEmailSafely({
          To: targetEmail,
          Subject: emailSubject,
          HtmlBody: emailHtmlBody,
          TextBody: isNewUser ? `
            Welcome to SAM AI!
            ${emailNote}
            
            Hello ${firstName},
            
            You've been invited to join SAM AI by ${companyConfig.companyName}. Your intelligent sales assistant is ready to help you streamline your sales process and boost productivity.
            
            Access your account at: ${redirectUrl}/auth/callback
            
            What you can do with SAM AI:
            - Chat with your AI sales assistant for personalized guidance
            - Access comprehensive knowledge base  
            - Manage your lead pipeline efficiently
            - Track campaign performance and analytics
            - Collaborate with your team in shared workspaces
            
            If you have any questions, please contact ${companyConfig.contactName} at ${companyConfig.contactEmail} or our support team.
            
            This invitation was sent by ${companyConfig.companyName}.
          ` : `
            You've been added to SAM AI!
            ${emailNote}
            
            Hello ${firstName},
            
            Good news! ${companyConfig.companyName} has added you to their SAM AI workspace. You can now access the platform with your existing account.
            
            Access your workspace at: ${redirectUrl}
            
            What you can do with SAM AI:
            - Chat with your AI sales assistant for personalized guidance
            - Access comprehensive knowledge base  
            - Manage your lead pipeline efficiently
            - Track campaign performance and analytics
            - Collaborate with your team in shared workspaces
            
            If you have any questions, please contact ${companyConfig.contactName} at ${companyConfig.contactEmail} or our support team.
            
            You received this email because ${companyConfig.companyName} added you to their SAM AI workspace.
          `
        });
        
        if (emailResult.success) {
          logInvitationDebug('EMAIL_SENT_SUCCESS', {
            messageId: emailResult.messageId,
            email: targetEmail,
            originalEmail: email,
            isNewUser,
            bypassMode: EMAIL_BYPASS_MODE
          });
          console.log(`Custom ${isNewUser ? 'welcome' : 'notification'} email sent to ${targetEmail} from ${companyConfig.companyName}`);
        } else {
          logInvitationDebug('EMAIL_SEND_FAILURE', {
            error: emailResult.error,
            email: targetEmail,
            originalEmail: email,
            suppressionInfo: emailResult.suppressionInfo,
            canRetryAfterReactivation: emailResult.canRetryAfterReactivation
          }, 'WARN');
          
          // Log detailed suppression information if available
          if (emailResult.suppressionInfo) {
            console.warn(`Email suppression detected for ${email}:`, {
              reason: emailResult.suppressionInfo.SuppressionReason,
              origin: emailResult.suppressionInfo.Origin,
              createdAt: emailResult.suppressionInfo.CreatedAt
            });
          }
        }
      }
    } catch (emailError) {
      logInvitationDebug('EMAIL_SYSTEM_ERROR', {
        error: emailError instanceof Error ? {
          name: emailError.name,
          message: emailError.message,
          stack: emailError.stack
        } : emailError,
        email,
        company
      }, 'ERROR');
      console.error('Failed to send custom welcome email:', emailError);
      // Don't fail the invitation if email fails, just log it
    }


    // CRITICAL: ENSURE membership assignment BEFORE storing invitation record
    if (workspaceId || organizationId) {
      const targetWorkspaceId = workspaceId || organizationId;
      const companyConfig = COMPANY_CONFIG[company as keyof typeof COMPANY_CONFIG];
      const expirationDate = new Date();
      expirationDate.setDate(expirationDate.getDate() + 7); // 7 days expiration

      logInvitationDebug('WORKSPACE_ASSIGNMENT_START', {
        targetWorkspaceId,
        userId: inviteData.user?.id,
        email,
        role,
        company,
        inviteDataSource: inviteData.source,
        isExistingUser: inviteData.source === 'existing_user'
      });

      // Step 1: FIRST check if user exists and get their ID (critical for membership)
      if (!inviteData.user?.id) {
        logInvitationDebug('WORKSPACE_ASSIGNMENT_FAILURE_NO_ID', {
          message: 'No user ID available for workspace assignment',
          inviteDataStructure: {
            hasUser: !!inviteData.user,
            userKeys: inviteData.user ? Object.keys(inviteData.user) : [],
            source: inviteData.source
          },
          email,
          targetWorkspaceId,
          company,
          isExistingUser: !!existingUser
        }, 'ERROR');

        return NextResponse.json(
          { 
            error: 'User ID required for workspace assignment but not available. Please try again or contact technical support.',
            details: {
              email,
              workspace: targetWorkspaceId,
              errorCode: 'MISSING_USER_ID_FOR_WORKSPACE',
              timestamp: new Date().toISOString()
            }
          },
          { status: 500 }
        );
      }

      // Step 2: Check existing membership BEFORE making any database changes
      logInvitationDebug('MEMBERSHIP_CHECK_START', {
        targetWorkspaceId,
        userId: inviteData.user.id,
        email
      });

      const { data: existingMembership, error: membershipCheckError } = await adminSupabase
        .from('workspace_members')
        .select('id, role, joined_at')
        .eq('workspace_id', targetWorkspaceId)
        .eq('user_id', inviteData.user.id)
        .maybeSingle();

      // Check for errors in membership check
      if (membershipCheckError) {
        logInvitationDebug('MEMBERSHIP_CHECK_ERROR', {
          error: membershipCheckError,
          targetWorkspaceId,
          userId: inviteData.user.id,
          email,
          errorMessage: membershipCheckError.message,
          errorCode: (membershipCheckError as any).code || 'unknown'
        }, 'ERROR');

        return NextResponse.json(
          { 
            error: 'Failed to check existing membership', 
            details: {
              message: membershipCheckError.message,
              workspace: targetWorkspaceId,
              email,
              errorCode: 'MEMBERSHIP_CHECK_FAILED'
            }
          },
          { status: 500 }
        );
      }

      logInvitationDebug('MEMBERSHIP_CHECK_COMPLETE', {
        existingMembershipFound: !!existingMembership,
        membershipData: existingMembership || null,
        userId: inviteData.user.id,
        targetWorkspaceId
      });

      // Step 3: Add to workspace_members FIRST (if not already a member)
      if (!existingMembership) {
        logInvitationDebug('MEMBERSHIP_ASSIGNMENT_START', {
          email,
          userId: inviteData.user.id,
          targetWorkspaceId,
          role,
          invitedBy: user.id
        });

        // Step 2.5: Ensure user exists in users table (required for workspace_members foreign key)
        logInvitationDebug('ENSURING_USER_IN_USERS_TABLE', { userId: inviteData.user.id });
        const { error: userInsertError } = await adminSupabase
          .from('users')
          .upsert({
            id: inviteData.user.id,
            supabase_id: inviteData.user.id, // Supabase user ID
            email: email,
            first_name: firstName || '',
            last_name: lastName || '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }, {
            onConflict: 'id',
            ignoreDuplicates: true
          });

        if (userInsertError) {
          logInvitationDebug('USER_SYNC_ERROR', {
            error: userInsertError,
            userId: inviteData.user.id,
            email
          }, 'ERROR');
          // Don't fail the whole process - log and continue
          console.warn('⚠️ Continuing without user in users table, may cause foreign key issues');
        }

        const { error: membershipError } = await adminSupabase
          .from('workspace_members')
          .insert({
            workspace_id: targetWorkspaceId,
            user_id: inviteData.user.id,
            role: role,
            invited_by: user.id,
            joined_at: new Date().toISOString()
          });

        if (membershipError) {
          logInvitationDebug('MEMBERSHIP_ASSIGNMENT_CRITICAL_FAILURE', {
            error: membershipError,
            email,
            userId: inviteData.user.id,
            targetWorkspaceId,
            role,
            errorMessage: membershipError.message,
            errorCode: (membershipError as any).code || 'unknown',
            errorDetails: (membershipError as any).details || null
          }, 'ERROR');

          // CRITICAL: If we can't add them to the workspace, don't create the invitation record
          return NextResponse.json(
            { 
              error: 'Failed to assign user to workspace - this is the core issue that was being debugged', 
              details: {
                message: membershipError.message,
                email,
                workspace: targetWorkspaceId,
                userId: inviteData.user.id,
                errorCode: 'WORKSPACE_ASSIGNMENT_FAILED',
                debugInfo: {
                  supabaseError: membershipError,
                  inviteDataSource: inviteData.source,
                  timestamp: new Date().toISOString()
                }
              }
            },
            { status: 500 }
          );
        }
        
        logInvitationDebug('MEMBERSHIP_ASSIGNMENT_SUCCESS', {
          email,
          userId: inviteData.user.id,
          targetWorkspaceId,
          role,
          message: `User successfully assigned to workspace`
        });
      } else {
        logInvitationDebug('MEMBERSHIP_ALREADY_EXISTS', {
          email,
          userId: inviteData.user.id,
          targetWorkspaceId,
          existingRole: existingMembership.role,
          joinedAt: existingMembership.joined_at,
          message: `User already a member of workspace`
        });
      }

      // Step 4: ONLY store invitation record AFTER successful membership assignment
      logInvitationDebug('INVITATION_RECORD_STORE_START', {
        targetWorkspaceId,
        email,
        role,
        company,
        expiresAt: expirationDate.toISOString(),
        invitedBy: user.id
      });

      const { error: invitationError } = await adminSupabase
        .from('workspace_invitations')
        .insert({
          workspace_id: targetWorkspaceId,
          email: email,
          role: role,
          company: company,
          expires_at: expirationDate.toISOString(),
          invited_by: user.id
        });

      if (invitationError) {
        logInvitationDebug('INVITATION_RECORD_STORE_WARNING', {
          error: invitationError,
          email,
          targetWorkspaceId,
          errorMessage: invitationError.message,
          note: 'Membership succeeded but invitation record failed - user is still properly added to workspace'
        }, 'WARN');
        
        // NOTE: Don't fail the entire operation since membership succeeded
        // Just log the warning - the user is already in the workspace
      } else {
        logInvitationDebug('INVITATION_RECORD_STORE_SUCCESS', {
          email,
          targetWorkspaceId,
          company: companyConfig.companyName,
          message: 'User invited and invitation record stored successfully'
        });
      }
    }

    const companyConfig = COMPANY_CONFIG[company as keyof typeof COMPANY_CONFIG];
    const isExistingUser = inviteData.source === 'existing_user';
    const successMessage = isExistingUser ? 'User added to workspace successfully' : 'Invitation sent successfully';
    
    logInvitationDebug('INVITATION_PROCESS_COMPLETE', {
      email,
      userId: inviteData.user?.id,
      company: companyConfig.companyName,
      isExistingUser,
      inviteDataSource: inviteData.source,
      workspaceAssigned: !!(workspaceId || organizationId),
      successMessage
    });

    // Step 5: Sync to ActiveCampaign (SAM list with company tag)
    try {
      logInvitationDebug('ACTIVECAMPAIGN_SYNC_START', {
        email,
        firstName,
        lastName,
        company: companyConfig.companyName,
        message: 'Starting ActiveCampaign sync to SAM list'
      });

      const acCompany = companyConfig.companyName === 'InnovareAI' ? 'InnovareAI' : '3CubedAI';
      const acResult = await activeCampaignService.addSamUserToList(
        email,
        firstName || '',
        lastName || '',
        acCompany as 'InnovareAI' | '3CubedAI'
      );

      if (acResult.success) {
        logInvitationDebug('ACTIVECAMPAIGN_SYNC_SUCCESS', {
          email,
          company: acCompany,
          contactId: acResult.contactId,
          listId: acResult.listId,
          tagId: acResult.tagId,
          message: 'Successfully synced user to ActiveCampaign SAM list'
        });
      } else {
        logInvitationDebug('ACTIVECAMPAIGN_SYNC_WARNING', {
          email,
          company: acCompany,
          error: acResult.error,
          message: 'Failed to sync to ActiveCampaign - user invitation still successful'
        }, 'WARN');
      }
    } catch (acError) {
      logInvitationDebug('ACTIVECAMPAIGN_SYNC_ERROR', {
        email,
        company: companyConfig.companyName,
        error: acError instanceof Error ? acError.message : String(acError),
        message: 'ActiveCampaign sync failed - user invitation still successful'
      }, 'ERROR');
      
      // Don't fail the entire invitation process if ActiveCampaign sync fails
      // The user invitation was successful, AC sync is a bonus feature
    }

    return NextResponse.json({
      message: successMessage,
      company: companyConfig.companyName,
      isNewUser: !isExistingUser,
      user: {
        id: inviteData.user?.id,
        email: inviteData.user?.email,
        invited_at: inviteData.user?.invited_at
      },
      debug: {
        source: inviteData.source,
        timestamp: new Date().toISOString()
      }
    });

  } catch (error) {
    // Extract email from request if possible for error logging
    let errorEmail = 'unknown';
    try {
      const body = await request.clone().json();
      errorEmail = body?.email || 'unknown';
    } catch {
      // If we can't parse the request body, just use 'unknown'
    }

    logInvitationDebug('UNEXPECTED_SERVER_ERROR', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack
      } : error,
      email: errorEmail,
      timestamp: new Date().toISOString()
    }, 'ERROR');

    return NextResponse.json(
      { 
        error: 'Internal server error',
        details: {
          timestamp: new Date().toISOString(),
          errorCode: 'UNEXPECTED_ERROR',
          message: 'An unexpected error occurred. Please contact technical support.'
        }
      },
      { status: 500 }
    );
  }
}