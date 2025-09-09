import { headers } from 'next/headers';
import { Webhook } from 'svix';
import { WebhookEvent } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

async function syncToSupabase(userData: any, isNewUser: boolean = false) {
  try {
    const supabase = supabaseAdmin();
    const userEmail = userData.email_addresses?.[0]?.email_address;
    
    // Create or update user in Supabase
    const { data: user, error: userError } = await supabase
      .from('users')
      .upsert({
        clerk_id: userData.id,
        email: userEmail,
        first_name: userData.first_name,
        last_name: userData.last_name,
        image_url: userData.image_url,
        created_at: userData.created_at,
        updated_at: userData.updated_at,
      }, {
        onConflict: 'clerk_id'
      })
      .select()
      .single();

    if (userError) {
      console.error('Supabase user sync error:', userError);
      throw userError;
    }

    console.log('User synced to Supabase:', user);

    // If this is a new user, handle workspace assignment
    if (isNewUser && user && userEmail) {
      // First, check if there are any pending invitations for this email
      const { data: pendingInvitations, error: inviteError } = await supabase
        .from('workspace_invitations')
        .select('*')
        .eq('email', userEmail)
        .is('accepted_at', null)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false });

      if (inviteError) {
        console.error('Error checking invitations:', inviteError);
      }

      let hasJoinedWorkspace = false;

      // If there are pending invitations, auto-accept the most recent one
      if (pendingInvitations && pendingInvitations.length > 0) {
        const invitation = pendingInvitations[0];
        console.log('Auto-accepting invitation for new user:', invitation);

        // Add user to workspace
        const { error: memberError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: invitation.workspace_id,
            user_id: user.id,
            role: invitation.role,
            invited_by: invitation.invited_by,
            joined_at: new Date().toISOString()
          });

        if (!memberError) {
          // Mark invitation as accepted
          await supabase
            .from('workspace_invitations')
            .update({
              accepted_at: new Date().toISOString(),
              accepted_by: user.id
            })
            .eq('id', invitation.id);

          // Set as user's current workspace
          await supabase
            .from('users')
            .update({ current_workspace_id: invitation.workspace_id })
            .eq('id', user.id);

          hasJoinedWorkspace = true;
          console.log('User auto-joined workspace via invitation');
        } else {
          console.error('Error adding user to invited workspace:', memberError);
        }
      }

      // If no invitation was accepted, create a default workspace
      if (!hasJoinedWorkspace) {
        const workspaceName = userData.first_name 
          ? `${userData.first_name}'s Workspace`
          : 'My Workspace';

        // Create workspace
        const { data: workspace, error: workspaceError } = await supabase
          .from('workspaces')
          .insert({
            name: workspaceName,
            owner_id: user.id,
            created_by: user.id,
            settings: {
              industry: null,
              team_size: '1-10',
              features: ['chat', 'knowledge_base', 'campaigns']
            }
          })
          .select()
          .single();

        if (workspaceError) {
          console.error('Workspace creation error:', workspaceError);
          throw workspaceError;
        }

        console.log('Workspace created:', workspace);

        // Add user as owner of the workspace
        const { error: memberError } = await supabase
          .from('workspace_members')
          .insert({
            workspace_id: workspace.id,
            user_id: user.id,
            role: 'owner',
            joined_at: new Date().toISOString()
          });

        if (memberError) {
          console.error('Workspace member error:', memberError);
          throw memberError;
        }

        // Update user's workspace references
        const { error: updateError } = await supabase
          .from('users')
          .update({ 
            default_workspace_id: workspace.id,
            current_workspace_id: workspace.id 
          })
          .eq('id', user.id);

        if (updateError) {
          console.error('User workspace update error:', updateError);
          throw updateError;
        }

        console.log('User workspace association completed');
      }
    }

    return user;
  } catch (error) {
    console.error('Failed to sync to Supabase:', error);
    throw error;
  }
}

export async function POST(req: Request) {
  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get("svix-id");
  const svix_timestamp = headerPayload.get("svix-timestamp");
  const svix_signature = headerPayload.get("svix-signature");

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occured -- no svix headers', {
      status: 400
    });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  // Create a new Svix instance with your webhook secret
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;
  
  if (!webhookSecret) {
    console.error('CLERK_WEBHOOK_SECRET not configured');
    return new Response('Webhook secret not configured', { status: 500 });
  }

  const wh = new Webhook(webhookSecret);

  let evt: WebhookEvent;

  // Verify the payload with the headers
  try {
    evt = wh.verify(body, {
      "svix-id": svix_id,
      "svix-timestamp": svix_timestamp,
      "svix-signature": svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occured', {
      status: 400
    });
  }

  // Handle the webhook events
  const eventType = evt.type;
  console.log('Webhook event type:', eventType);

  switch (eventType) {
    case 'user.created':
      try {
        // Sync to Supabase and create workspace for new user
        await syncToSupabase(evt.data, true);
        
        return new Response('User and workspace created successfully', { status: 200 });
      } catch (error) {
        console.error('User creation sync error:', error);
        return new Response('Sync failed', { status: 500 });
      }
      
    case 'user.updated':
      try {
        // Just sync user data, don't create workspace
        await syncToSupabase(evt.data, false);
        
        return new Response('User updated successfully', { status: 200 });
      } catch (error) {
        console.error('User update sync error:', error);
        return new Response('Sync failed', { status: 500 });
      }
      
    case 'user.deleted':
      // Handle user deletion if needed
      console.log('User deleted:', evt.data.id);
      // You might want to mark the user as deleted in Supabase rather than actually deleting
      break;
      
    case 'organization.created':
      try {
        // Sync new organization to Supabase
        const orgData = evt.data;
        const supabase = supabaseAdmin();
        
        const { error: orgError } = await supabase
          .from('organizations')
          .upsert({
            clerk_org_id: orgData.id,
            name: orgData.name,
            slug: orgData.slug,
            created_by: orgData.created_by,
            settings: {
              industry: null,
              team_size: '1-10',
              features: ['chat', 'knowledge_base', 'campaigns'],
              subscription_plan: 'starter'
            }
          }, {
            onConflict: 'clerk_org_id'
          });

        if (orgError) {
          console.error('Organization sync error:', orgError);
        } else {
          console.log('✅ Organization synced to Supabase:', orgData.id);
        }
        
        return new Response('Organization synced successfully', { status: 200 });
      } catch (error) {
        console.error('Organization sync error:', error);
        return new Response('Organization sync failed', { status: 500 });
      }
      
    case 'organization.updated':
      try {
        // Update organization in Supabase
        const orgData = evt.data;
        const supabase = supabaseAdmin();
        
        const { error: updateError } = await supabase
          .from('organizations')
          .update({
            name: orgData.name,
            slug: orgData.slug,
            updated_at: new Date().toISOString()
          })
          .eq('clerk_org_id', orgData.id);

        if (updateError) {
          console.error('Organization update error:', updateError);
        } else {
          console.log('✅ Organization updated in Supabase:', orgData.id);
        }
        
        return new Response('Organization updated successfully', { status: 200 });
      } catch (error) {
        console.error('Organization update error:', error);
        return new Response('Organization update failed', { status: 500 });
      }

    case 'organizationMembership.created':
      try {
        // Handle when users join organizations
        const membershipData = evt.data;
        console.log('✅ User joined organization:', membershipData);
        
        return new Response('Membership created successfully', { status: 200 });
      } catch (error) {
        console.error('Membership creation error:', error);
        return new Response('Membership creation failed', { status: 500 });
      }
      
    default:
      console.log('Unhandled webhook event:', eventType);
  }

  return new Response('Webhook received', { status: 200 });
}