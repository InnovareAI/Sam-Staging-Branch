import { headers } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type ClerkWebhookEvent = {
  type: string;
  data: {
    id: string;
    object: string;
    slug?: string;
    name?: string;
    created_by?: string;
    members_count?: number;
    [key: string]: any;
  };
};

export async function POST(req: NextRequest) {
  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  // If there are no headers, error out
  if (!svix_id || !svix_timestamp || !svix_signature) {
    return NextResponse.json(
      { error: 'Error occurred -- no svix headers' },
      { status: 400 }
    );
  }

  // Get the body
  const payload = await req.text();
  const body = JSON.parse(payload);

  // Create a new Svix instance with your webhook secret.
  const wh = new Webhook(process.env.CLERK_WEBHOOK_SECRET || '');

  let evt: ClerkWebhookEvent;

  // Verify the webhook signature
  try {
    evt = wh.verify(payload, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return NextResponse.json(
      { error: 'Error occurred -- webhook verification failed' },
      { status: 400 }
    );
  }

  // Handle the webhook
  const eventType = evt.type;
  console.log('Clerk webhook event:', eventType, evt.data);

  try {
    switch (eventType) {
      case 'user.created':
        await handleUserCreated(evt.data);
        break;
      case 'user.updated':
        await handleUserUpdated(evt.data);
        break;
      case 'organization.created':
        await handleOrganizationCreated(evt.data);
        break;
      case 'organization.updated':
        await handleOrganizationUpdated(evt.data);
        break;
      case 'organizationMembership.created':
        await handleOrganizationMembershipCreated(evt.data);
        break;
      case 'organizationMembership.deleted':
        await handleOrganizationMembershipDeleted(evt.data);
        break;
      default:
        console.log(`Unhandled webhook event: ${eventType}`);
    }

    return NextResponse.json({ status: 'success' }, { status: 200 });
  } catch (error) {
    console.error('Error handling webhook:', error);
    return NextResponse.json(
      { error: 'Error occurred -- webhook processing failed' },
      { status: 500 }
    );
  }
}

async function handleUserCreated(data: any) {
  console.log('Creating user:', data.id);

  const { error } = await supabaseAdmin
    .from('users')
    .insert({
      clerk_id: data.id,
      email: data.email_addresses[0]?.email_address,
      first_name: data.first_name,
      last_name: data.last_name,
      image_url: data.image_url,
    });

  if (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

async function handleUserUpdated(data: any) {
  console.log('Updating user:', data.id);

  const { error } = await supabaseAdmin
    .from('users')
    .update({
      email: data.email_addresses[0]?.email_address,
      first_name: data.first_name,
      last_name: data.last_name,
      image_url: data.image_url,
    })
    .eq('clerk_id', data.id);

  if (error) {
    console.error('Error updating user:', error);
    throw error;
  }
}

async function handleOrganizationCreated(data: any) {
  console.log('Creating organization:', data.id);

  const { error } = await supabaseAdmin
    .from('organizations')
    .insert({
      clerk_org_id: data.id,
      name: data.name,
      slug: data.slug,
      created_by: data.created_by,
    });

  if (error) {
    console.error('Error creating organization:', error);
    throw error;
  }
}

async function handleOrganizationUpdated(data: any) {
  console.log('Updating organization:', data.id);

  const { error } = await supabaseAdmin
    .from('organizations')
    .update({
      name: data.name,
      slug: data.slug,
    })
    .eq('clerk_org_id', data.id);

  if (error) {
    console.error('Error updating organization:', error);
    throw error;
  }
}

async function handleOrganizationMembershipCreated(data: any) {
  console.log('Creating organization membership:', data);

  // Get the user ID from Clerk user ID
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('clerk_id', data.public_user_data.user_id)
    .single();

  if (userError || !user) {
    console.error('Error finding user:', userError);
    return;
  }

  // Get the organization ID from Clerk org ID
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', data.organization.id)
    .single();

  if (orgError || !org) {
    console.error('Error finding organization:', orgError);
    return;
  }

  // Create user_organization relationship
  const { error } = await supabaseAdmin
    .from('user_organizations')
    .insert({
      user_id: user.id,
      organization_id: org.id,
      role: data.role,
    });

  if (error) {
    console.error('Error creating organization membership:', error);
    throw error;
  }
}

async function handleOrganizationMembershipDeleted(data: any) {
  console.log('Deleting organization membership:', data);

  // Get the user ID from Clerk user ID
  const { data: user, error: userError } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('clerk_id', data.public_user_data.user_id)
    .single();

  if (userError || !user) {
    console.error('Error finding user:', userError);
    return;
  }

  // Get the organization ID from Clerk org ID
  const { data: org, error: orgError } = await supabaseAdmin
    .from('organizations')
    .select('id')
    .eq('clerk_org_id', data.organization.id)
    .single();

  if (orgError || !org) {
    console.error('Error finding organization:', orgError);
    return;
  }

  // Delete user_organization relationship
  const { error } = await supabaseAdmin
    .from('user_organizations')
    .delete()
    .eq('user_id', user.id)
    .eq('organization_id', org.id);

  if (error) {
    console.error('Error deleting organization membership:', error);
    throw error;
  }
}