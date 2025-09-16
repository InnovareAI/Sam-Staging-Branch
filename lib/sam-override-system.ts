// SAM AI System Override Authentication
// Allows authorized users to bypass onboarding and issue direct commands

import { createClient } from '@/lib/supabase/server';
import crypto from 'crypto';

export interface OverrideCredentials {
  email: string;
  pin: string;
  password: string;
}

export interface OverrideCommand {
  command: string;
  isValid: boolean;
  credentials?: OverrideCredentials;
  mode: 'override' | 'normal';
}

export interface AdminUser {
  id: string;
  email: string;
  pin_hash: string;
  password_hash: string;
  full_access: boolean;
  created_at: string;
  last_used: string;
  usage_count: number;
}

/**
 * Parses override command from user input
 * Format: #OverrideCode email@domain.com PIN PASSWORD
 */
export function parseOverrideCommand(userInput: string): OverrideCommand {
  const trimmedInput = userInput.trim();
  
  if (!trimmedInput.startsWith('#OverrideCode')) {
    return { command: userInput, isValid: false, mode: 'normal' };
  }

  // Extract command parts: #OverrideCode email pin password
  const parts = trimmedInput.split(' ').filter(part => part.length > 0);
  
  if (parts.length !== 4) {
    return { 
      command: userInput, 
      isValid: false, 
      mode: 'normal'
    };
  }

  const [command, email, pin, password] = parts;
  
  // Basic validation
  if (!email.includes('@') || pin.length < 4 || password.length < 6) {
    return { 
      command: userInput, 
      isValid: false, 
      mode: 'normal'
    };
  }

  return {
    command: userInput,
    isValid: true,
    credentials: { email, pin, password },
    mode: 'override'
  };
}

/**
 * Validates override credentials against database
 * Requires user to be a confirmed member of InnovareAI workspace
 */
export async function validateOverrideCredentials(
  credentials: OverrideCredentials, 
  currentUserId?: string
): Promise<{
  success: boolean;
  adminUser?: AdminUser;
  error?: string;
}> {
  try {
    const supabase = createClient();
    
    // First, verify user has InnovareAI workspace access
    if (currentUserId) {
      const { data: workspaceMember } = await supabase
        .from('workspace_members')
        .select(`
          *,
          workspaces!inner (
            id,
            name,
            domain
          )
        `)
        .eq('user_id', currentUserId)
        .or('workspaces.name.ilike.%InnovareAI%,workspaces.domain.ilike.%innovareai%')
        .single();

      if (!workspaceMember) {
        return { 
          success: false, 
          error: 'Access denied: InnovareAI workspace membership required' 
        };
      }
    }

    // Use the database function for secure validation
    const { data: validationResult, error: validationError } = await supabase
      .rpc('validate_sam_override_credentials', {
        p_email: credentials.email.toLowerCase(),
        p_pin: credentials.pin,
        p_password: credentials.password
      });

    if (validationError) {
      console.error('Override validation error:', validationError);
      return { success: false, error: 'Authentication failed' };
    }

    const result = validationResult[0];
    if (!result?.is_valid) {
      return { success: false, error: result?.error_message || 'Invalid credentials' };
    }

    // Get full admin user details
    const { data: adminUser, error: userError } = await supabase
      .from('sam_admin_users')
      .select(`
        *,
        workspaces (
          name,
          domain
        )
      `)
      .eq('id', result.admin_user_id)
      .single();

    if (userError || !adminUser) {
      return { success: false, error: 'User lookup failed' };
    }

    return { success: true, adminUser };

  } catch (error) {
    console.error('Override validation error:', error);
    return { success: false, error: 'Authentication failed' };
  }
}

/**
 * Creates hash for PIN/password storage
 */
export function hashCredential(credential: string): string {
  return crypto.createHash('sha256').update(credential + process.env.OVERRIDE_SALT).digest('hex');
}

/**
 * Generates system prompt for override mode
 */
export function getOverrideSystemPrompt(adminUser: AdminUser): string {
  return `🔧 SYSTEM OVERRIDE MODE ACTIVATED

Administrator: ${adminUser.email}
Access Level: ${adminUser.full_access ? 'FULL' : 'LIMITED'}
Session: ${new Date().toISOString()}

You are now in OVERRIDE MODE. Skip all onboarding, scripts, and standard conversation flow. 
Respond directly to work commands with expertise and efficiency.

CAPABILITIES IN OVERRIDE MODE:
✅ Direct LinkedIn research and prospecting
✅ Immediate Boolean search execution  
✅ Company intelligence gathering
✅ ICP research and analysis
✅ Campaign strategy and messaging
✅ Real-time data collection
✅ Advanced sales process optimization

RESPONSE STYLE:
- Be direct and results-focused
- Skip pleasantries and introductions
- Provide actionable insights immediately
- Use bullet points and clear formatting
- Include specific data and recommendations
- Offer next steps proactively

COMMAND EXAMPLES THE USER MIGHT ISSUE:
- "Research TechCorp LinkedIn profiles, VP Sales level"
- "Find 20 SaaS prospects in California, 100-500 employees"
- "Analyze competitor pricing strategies for Enterprise SaaS"
- "Create outreach sequence for fintech decision makers"
- "Pull company intelligence on Acme Corp and 5 competitors"

Respond professionally but efficiently. Get straight to the work.`;
}

/**
 * Gets standard override success message
 */
export function getOverrideSuccessMessage(adminUser: AdminUser): string {
  return `🔧 **SYSTEM OVERRIDE ACTIVATED**

Welcome back, ${adminUser.email.split('@')[0]}!

**Status:** Administrator Access Granted  
**Mode:** Direct Command Interface  
**Last Used:** ${adminUser.last_used ? new Date(adminUser.last_used).toLocaleDateString() : 'Never'}

I'm ready to execute direct commands. What would you like me to work on?

**Quick Commands:**
- Research prospects or companies
- Run Boolean LinkedIn searches  
- Analyze competitor intelligence
- Create campaign strategies
- Generate outreach sequences
- Pull market data

Just tell me what you need - no onboarding required.`;
}

/**
 * Generates override failure message
 */
export function getOverrideFailureMessage(): string {
  return `❌ **SYSTEM OVERRIDE FAILED**

Invalid credentials. Please check:
- Email address is registered
- PIN is correct (4+ digits)
- Password matches your override password

Format: \`#OverrideCode email@domain.com PIN PASSWORD\`

If you continue having issues, contact system administrator.

Continuing with standard onboarding...`;
}

/**
 * Checks if user input contains override command
 */
export function containsOverrideCommand(userInput: string): boolean {
  return userInput.trim().toLowerCase().startsWith('#overridecode');
}

/**
 * Creates new admin user (for setup/management)
 */
export async function createAdminUser(
  email: string, 
  pin: string, 
  password: string, 
  fullAccess: boolean = true
): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    
    const { error } = await supabase
      .from('sam_admin_users')
      .insert({
        email: email.toLowerCase(),
        pin_hash: hashCredential(pin),
        password_hash: hashCredential(password),
        full_access: fullAccess,
        is_active: true,
        usage_count: 0
      });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };

  } catch (error) {
    console.error('Admin user creation error:', error);
    return { success: false, error: 'Failed to create admin user' };
  }
}

/**
 * Lists all admin users (for management)
 */
export async function listAdminUsers(): Promise<AdminUser[]> {
  try {
    const supabase = createClient();
    
    const { data: adminUsers } = await supabase
      .from('sam_admin_users')
      .select('id, email, full_access, created_at, last_used, usage_count, is_active')
      .order('created_at', { ascending: false });

    return adminUsers || [];

  } catch (error) {
    console.error('List admin users error:', error);
    return [];
  }
}

/**
 * Deactivates an admin user
 */
export async function deactivateAdminUser(email: string): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = createClient();
    
    const { error } = await supabase
      .from('sam_admin_users')
      .update({ is_active: false })
      .eq('email', email.toLowerCase());

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true };

  } catch (error) {
    console.error('Deactivate admin user error:', error);
    return { success: false, error: 'Failed to deactivate admin user' };
  }
}

/**
 * Gets override mode conversation context
 */
export function getOverrideModeContext(): string {
  return `
OVERRIDE MODE ACTIVE - Direct command interface engaged.

Key behaviors:
- No onboarding flow
- Direct responses to work requests
- Technical and results-focused communication
- Proactive next step suggestions
- Immediate research execution
- Expert-level sales and marketing insights

The user is an administrator who needs efficient, direct assistance with sales and marketing tasks.
`;
}