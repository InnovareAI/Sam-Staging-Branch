import { NextRequest, NextResponse } from 'next/server';
import { auth, clerkClient } from '@clerk/nextjs/server';
import { supabaseAdmin } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    // Get authenticated user from Clerk
    const { userId } = await auth();
    
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('🏢 Creating organization for user:', userId);
    
    const body = await req.json();
    const { name, slug } = body;

    if (!name) {
      return NextResponse.json({ error: 'Organization name is required' }, { status: 400 });
    }

    // Create organization in Clerk
    const clerk = await clerkClient();
    const organization = await clerk.organizations.createOrganization({
      name,
      slug: slug || name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      createdBy: userId,
    });

    console.log('✅ Clerk organization created:', organization.id);

    // Create organization membership for the user (as admin)
    await clerk.organizations.createOrganizationMembership({
      organizationId: organization.id,
      userId: userId,
      role: 'org:admin'
    });

    console.log('✅ User added as organization admin');

    // Sync organization to Supabase for additional data
    const supabase = supabaseAdmin();
    
    const { data: supabaseOrg, error: supabaseError } = await supabase
      .from('organizations')
      .insert({
        clerk_org_id: organization.id,
        name: organization.name,
        slug: organization.slug,
        created_by: userId,
        settings: {
          industry: null,
          team_size: '1-10',
          features: ['chat', 'knowledge_base', 'campaigns'],
          subscription_plan: 'starter'
        }
      })
      .select()
      .single();

    if (supabaseError) {
      console.error('Supabase organization sync error:', supabaseError);
      // Don't fail the request - organization is created in Clerk
      // This is just additional metadata
    } else {
      console.log('✅ Organization synced to Supabase:', supabaseOrg.id);
    }

    return NextResponse.json({ 
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug
      }
    });

  } catch (error) {
    console.error('Organization creation error:', error);
    return NextResponse.json(
      { error: 'Failed to create organization' },
      { status: 500 }
    );
  }
}