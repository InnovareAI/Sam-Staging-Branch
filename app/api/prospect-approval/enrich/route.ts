import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/app/lib/supabase';

// BrightData configuration - supports multiple env var formats
// Option 1: REST API token (BRIGHTDATA_API_TOKEN)
// Option 2: Scraping Browser auth (BRIGHT_DATA_AUTH format: customer-zone:password)
const BRIGHTDATA_API_TOKEN = process.env.BRIGHTDATA_API_TOKEN ||
    process.env.BRIGHT_DATA_API_TOKEN ||
    process.env.BRIGHT_DATA_TOKEN;
const BRIGHTDATA_ZONE = process.env.BRIGHT_DATA_ZONE || 'linkedin_enrichment';
// Scraping browser auth for puppeteer-based scraping
const BRIGHT_DATA_AUTH = process.env.BRIGHT_DATA_AUTH ||
    'brd-customer-hl_4e98ded8-zone-sam_scraping_browser:9pdlxe2o4fhi';

/**
 * POST /api/prospect-approval/enrich
 * Triggers manual enrichment for a prospect (Find Email or Refresh Profile)
 * Uses BrightData for actual data enrichment
 * 
 * Body:
 * - prospect_id: string
 * - action: 'find_email' | 'refresh_profile'
 * - workspace_id: string
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { prospect_id, action, workspace_id } = body;

        if (!prospect_id || !action || !workspace_id) {
            return NextResponse.json({
                success: false,
                error: 'Missing required fields: prospect_id, action, workspace_id'
            }, { status: 400 });
        }

        if (!['find_email', 'refresh_profile'].includes(action)) {
            return NextResponse.json({
                success: false,
                error: 'Invalid action. Must be "find_email" or "refresh_profile"'
            }, { status: 400 });
        }

        // Auth
        const cookieStore = await cookies();
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() { return cookieStore.getAll(); },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value, options }) => {
                            cookieStore.set(name, value, options);
                        });
                    }
                }
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
        }

        const adminClient = supabaseAdmin();

        // Verify user has access to this workspace
        const { data: membership } = await adminClient
            .from('workspace_members')
            .select('workspace_id')
            .eq('user_id', user.id)
            .eq('workspace_id', workspace_id)
            .maybeSingle();

        if (!membership) {
            return NextResponse.json({ success: false, error: 'Access denied' }, { status: 403 });
        }

        // Get prospect data - try new architecture first
        let prospect: any = null;
        let prospectRecord: any = null;

        const { data: newProspect } = await adminClient
            .from('workspace_prospects')
            .select('*')
            .eq('id', prospect_id)
            .eq('workspace_id', workspace_id)
            .maybeSingle();

        if (newProspect) {
            prospectRecord = newProspect;
            prospect = {
                id: newProspect.id,
                name: `${newProspect.first_name || ''} ${newProspect.last_name || ''}`.trim(),
                firstName: newProspect.first_name,
                lastName: newProspect.last_name,
                linkedinUrl: newProspect.linkedin_url,
                linkedinUserId: newProspect.linkedin_user_id,
                email: newProspect.email,
                company: newProspect.company,
                title: newProspect.title,
                source: 'workspace_prospects',
                enrichmentData: newProspect.enrichment_data || {}
            };
        } else {
            // Try legacy architecture
            const { data: legacyProspect } = await adminClient
                .from('prospect_approval_data')
                .select('*')
                .eq('prospect_id', prospect_id)
                .maybeSingle();

            if (legacyProspect) {
                prospectRecord = legacyProspect;
                prospect = {
                    id: legacyProspect.prospect_id,
                    name: legacyProspect.name,
                    firstName: legacyProspect.name?.split(' ')[0],
                    lastName: legacyProspect.name?.split(' ').slice(1).join(' '),
                    linkedinUrl: legacyProspect.contact?.linkedin_url,
                    linkedinUserId: legacyProspect.contact?.linkedin_user_id,
                    email: legacyProspect.contact?.email,
                    company: legacyProspect.company?.name,
                    title: legacyProspect.title,
                    source: 'prospect_approval_data',
                    enrichmentData: {}
                };
            }
        }

        if (!prospect) {
            return NextResponse.json({
                success: false,
                error: 'Prospect not found'
            }, { status: 404 });
        }

        console.log(`📧 Enrichment request: ${action} for prospect ${prospect_id} (${prospect.name})`);

        // ============================================
        // FIND EMAIL - Use BrightData to find email
        // ============================================
        if (action === 'find_email') {
            // Check if we already have an email
            if (prospect.email) {
                return NextResponse.json({
                    success: true,
                    message: 'Email already exists',
                    email: prospect.email,
                    status: 'already_enriched'
                });
            }

            // Need LinkedIn URL for enrichment
            if (!prospect.linkedinUrl) {
                return NextResponse.json({
                    success: false,
                    error: 'LinkedIn URL required for email lookup'
                }, { status: 400 });
            }

            console.log(`📧 Calling BrightData for email + industry: ${prospect.name}`);

            // Call BrightData API for email + industry enrichment
            const enrichmentResult = await enrichWithBrightData(prospect.linkedinUrl);

            if (enrichmentResult.success && (enrichmentResult.email || enrichmentResult.industry)) {
                // Update prospect with enriched data
                if (prospect.source === 'workspace_prospects') {
                    const updateData: any = {
                        enrichment_data: {
                            ...prospect.enrichmentData,
                            enriched_at: new Date().toISOString(),
                            enrichment_source: 'brightdata',
                            enrichment_confidence: enrichmentResult.confidence || 0.7,
                            enrichment_cost: 0.01
                        }
                    };

                    if (enrichmentResult.email) updateData.email = enrichmentResult.email;
                    if (enrichmentResult.industry) updateData.industry = enrichmentResult.industry;

                    await adminClient
                        .from('workspace_prospects')
                        .update(updateData)
                        .eq('id', prospect_id);
                }

                const foundItems = [];
                if (enrichmentResult.email) foundItems.push('email');
                if (enrichmentResult.industry) foundItems.push('industry');

                return NextResponse.json({
                    success: true,
                    message: `Found ${foundItems.join(' and ')} successfully`,
                    email: enrichmentResult.email,
                    industry: enrichmentResult.industry,
                    confidence: enrichmentResult.confidence,
                    status: 'enriched',
                    prospectId: prospect_id
                });
            } else {
                // Update with failed status
                if (prospect.source === 'workspace_prospects') {
                    await adminClient
                        .from('workspace_prospects')
                        .update({
                            enrichment_data: {
                                ...prospect.enrichmentData,
                                email_lookup_failed_at: new Date().toISOString(),
                                email_lookup_error: enrichmentResult.error || 'Email not found'
                            }
                        })
                        .eq('id', prospect_id);
                }

                return NextResponse.json({
                    success: false,
                    message: enrichmentResult.error || 'Email not found',
                    status: 'not_found',
                    prospectId: prospect_id
                });
            }
        }

        // ============================================
        // REFRESH PROFILE - Use Unipile for profile data
        // BrightData only for email + industry (not provided by LinkedIn)
        // ============================================
        if (action === 'refresh_profile') {
            if (!prospect.linkedinUrl && !prospect.linkedinUserId) {
                return NextResponse.json({
                    success: false,
                    error: 'No LinkedIn URL or ID available for refresh'
                }, { status: 400 });
            }

            // Get a Unipile account for this workspace
            const { data: unipileAccount } = await adminClient
                .from('workspace_accounts')
                .select('unipile_account_id')
                .eq('workspace_id', workspace_id)
                .eq('account_type', 'linkedin')
                .not('unipile_account_id', 'is', null)
                .limit(1)
                .maybeSingle();

            if (!unipileAccount?.unipile_account_id) {
                return NextResponse.json({
                    success: false,
                    error: 'No LinkedIn account connected. Connect a LinkedIn account to refresh profiles.'
                }, { status: 400 });
            }

            const linkedinIdentifier = prospect.linkedinUserId ||
                prospect.linkedinUrl?.split('/in/')[1]?.replace(/\/$/, '');

            if (!linkedinIdentifier) {
                return NextResponse.json({
                    success: false,
                    error: 'Could not extract LinkedIn identifier'
                }, { status: 400 });
            }

            console.log(`🔄 Refreshing profile via Unipile for: ${prospect.name} (${linkedinIdentifier})`);

            try {
                // Call Unipile to get fresh profile data
                const unipileResponse = await fetch(
                    `https://${process.env.UNIPILE_DSN}/api/v1/users/${encodeURIComponent(linkedinIdentifier)}?account_id=${unipileAccount.unipile_account_id}`,
                    {
                        headers: {
                            'X-API-KEY': process.env.UNIPILE_API_KEY!,
                            'Accept': 'application/json'
                        }
                    }
                );

                if (!unipileResponse.ok) {
                    const errorText = await unipileResponse.text();
                    console.error('Unipile profile fetch error:', errorText);
                    return NextResponse.json({
                        success: false,
                        error: `Failed to fetch profile: ${unipileResponse.status}`,
                        status: 'failed',
                        prospectId: prospect_id
                    });
                }

                const profileData = await unipileResponse.json();
                console.log(`✅ Unipile returned profile data for: ${profileData.first_name} ${profileData.last_name}`);

                // Update prospect with Unipile data
                if (prospect.source === 'workspace_prospects') {
                    const updateData: any = {
                        enrichment_data: {
                            ...prospect.enrichmentData,
                            profile_refreshed_at: new Date().toISOString(),
                            refresh_source: 'unipile'
                        }
                    };

                    // Update fields from Unipile (NOT email or industry - those come from BrightData)
                    if (profileData.first_name) updateData.first_name = profileData.first_name;
                    if (profileData.last_name) updateData.last_name = profileData.last_name;
                    if (profileData.headline || profileData.title) updateData.title = profileData.headline || profileData.title;
                    if (profileData.company) updateData.company = profileData.company;
                    if (profileData.location) updateData.location = profileData.location;
                    if (profileData.provider_id) updateData.linkedin_user_id = profileData.provider_id;

                    await adminClient
                        .from('workspace_prospects')
                        .update(updateData)
                        .eq('id', prospect_id);
                }

                const updatedFields = ['first_name', 'last_name', 'title', 'company', 'location']
                    .filter(f => profileData[f] || profileData.headline);

                return NextResponse.json({
                    success: true,
                    message: 'Profile refreshed successfully via Unipile',
                    status: 'refreshed',
                    prospectId: prospect_id,
                    updatedFields,
                    hint: 'For email and industry, use "Find Email" which uses BrightData'
                });

            } catch (error) {
                console.error('Profile refresh error:', error);
                return NextResponse.json({
                    success: false,
                    message: error instanceof Error ? error.message : 'Profile refresh failed',
                    status: 'failed',
                    prospectId: prospect_id
                });
            }
        }

        return NextResponse.json({ success: false, error: 'Unknown action' }, { status: 400 });

    } catch (error) {
        console.error('Enrichment error:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

/**
 * Enrich prospect with BrightData (email + industry)
 * These fields are NOT provided by LinkedIn/Unipile
 * 
 * Uses BrightData Web Unlocker API to scrape LinkedIn profile
 */
async function enrichWithBrightData(linkedinUrl: string): Promise<{
    success: boolean;
    email?: string;
    industry?: string;
    company?: string;
    title?: string;
    confidence?: number;
    error?: string;
}> {
    const apiToken = BRIGHTDATA_API_TOKEN;

    if (!apiToken) {
        console.warn('⚠️ BRIGHTDATA_API_TOKEN not configured');
        return { success: false, error: 'BRIGHTDATA_API_TOKEN not configured in environment variables' };
    }

    try {
        // Clean the LinkedIn URL
        const cleanUrl = linkedinUrl.split('?')[0];
        console.log(`🌐 BrightData Web Unlocker enrichment for: ${cleanUrl}`);

        // Use BrightData Web Unlocker API
        const response = await fetch('https://api.brightdata.com/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiToken}`
            },
            body: JSON.stringify({
                zone: BRIGHTDATA_ZONE,
                url: cleanUrl,
                format: 'raw'  // Returns HTML content
            }),
            signal: AbortSignal.timeout(60000) // 60 second timeout
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ BrightData API error:', response.status, errorText);
            return {
                success: false,
                error: `BrightData API error: ${response.status}`
            };
        }

        const html = await response.text();
        console.log(`✅ BrightData returned ${html.length} bytes`);

        let email: string | undefined;
        let industry: string | undefined;

        // Extract email from scraped HTML
        const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (emailMatch && emailMatch.length > 0) {
            // Filter out common false positives
            const validEmails = emailMatch.filter(e =>
                !e.includes('linkedin.com') &&
                !e.includes('example.com') &&
                !e.includes('sentry.io') &&
                !e.includes('@static') &&
                !e.includes('@licdn') &&
                !e.includes('noreply') &&
                !e.includes('support@') &&
                !e.includes('help@')
            );
            if (validEmails.length > 0) {
                email = validEmails[0];
                console.log(`📧 Found email: ${email}`);
            }
        }

        // Extract industry from scraped HTML
        // LinkedIn stores industry in JSON-LD or structured data
        const industryPatterns = [
            /"industry":\s*"([^"]+)"/,
            /"industryName":\s*"([^"]+)"/,
            /"industry":\s*\[\s*"([^"]+)"/,
            /data-field="industry"[^>]*>([^<]+)</i
        ];

        for (const pattern of industryPatterns) {
            const match = html.match(pattern);
            if (match && match[1]) {
                industry = match[1].trim();
                console.log(`🏭 Found industry: ${industry}`);
                break;
            }
        }

        if (email || industry) {
            return {
                success: true,
                email,
                industry,
                confidence: email ? 0.7 : 0.5
            };
        }

        return { success: false, error: 'No email or industry found in profile' };

    } catch (error) {
        console.error('BrightData enrichment error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Enrichment failed'
        };
    }
}

/**
 * Refresh profile data using BrightData
 */
async function refreshProfileWithBrightData(linkedinUrl: string): Promise<{
    success: boolean;
    company?: string;
    title?: string;
    location?: string;
    email?: string;
    error?: string;
}> {
    if (!BRIGHTDATA_API_TOKEN) {
        console.warn('⚠️ BrightData API token not configured');
        return { success: false, error: 'BrightData API token not configured' };
    }

    try {
        console.log(`🌐 BrightData profile refresh for: ${linkedinUrl}`);

        const response = await fetch('https://api.brightdata.com/request', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${BRIGHTDATA_API_TOKEN}`
            },
            body: JSON.stringify({
                zone: BRIGHTDATA_ZONE,
                url: linkedinUrl,
                format: 'raw'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ BrightData API error:', response.status, errorText);
            return { success: false, error: `BrightData API error: ${response.status}` };
        }

        const html = await response.text();
        console.log(`✅ BrightData returned ${html.length} bytes for profile refresh`);

        // Parse profile data from HTML
        const result: any = { success: true };

        // Extract company (look for common patterns)
        const companyMatch = html.match(/"companyName":"([^"]+)"/);
        if (companyMatch) result.company = companyMatch[1];

        // Extract title
        const titleMatch = html.match(/"title":"([^"]+)"/);
        if (titleMatch) result.title = titleMatch[1];

        // Extract location
        const locationMatch = html.match(/"locationName":"([^"]+)"/);
        if (locationMatch) result.location = locationMatch[1];

        // Extract email if present
        const emailMatch = html.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (emailMatch) {
            const validEmails = emailMatch.filter(email =>
                !email.includes('linkedin.com') &&
                !email.includes('example.com')
            );
            if (validEmails.length > 0) result.email = validEmails[0];
        }

        return result;

    } catch (error) {
        console.error('BrightData profile refresh error:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Profile refresh failed'
        };
    }
}
