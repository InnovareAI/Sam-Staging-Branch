import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { airtableService } from '@/lib/airtable';

export const maxDuration = 300; // 5 minutes

const STATUS_MAP_AIRTABLE_TO_SUPABASE: Record<string, string> = {
    'Interested': 'interested',
    'Not Interested': 'not_interested',
    'Info Requested': 'replied',
    'Meeting Booked': 'meeting_booked',
    'Went Silent': 'replied', // Fallback for Supabase which might not have 'went_silent'
};

export async function POST(request: NextRequest) {
    try {
        // Security check
        const authHeader = request.headers.get('x-cron-secret');
        if (authHeader !== process.env.CRON_SECRET) {
            return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
        }

        console.log('🔄 Starting Airtable Reverse Sync...');

        // Create Supabase client
        // 1. Fetch recent contacts from Airtable
        const recentContacts = await airtableService.listRecentContacts(50);
        console.log(`📊 Found ${recentContacts.length} recent contacts in Airtable`);

        let updatedCount = 0;

        for (const record of recentContacts) {
            const email = record.fields['Email'];
            const profileUrl = record.fields['Profile URL'];
            const airtableStatus = record.fields['Status'];

            if (!airtableStatus) continue;

            const supabaseStatus = STATUS_MAP_AIRTABLE_TO_SUPABASE[airtableStatus];
            if (!supabaseStatus) continue;

            // 2. Find matching prospect in Supabase
            let query = supabase.from('campaign_prospects').select('id, status');

            if (email && profileUrl) {
                query = query.or(`email.eq."${email}",linkedin_url.eq."${profileUrl}"`);
            } else if (email) {
                query = query.eq('email', email);
            } else if (profileUrl) {
                query = query.eq('linkedin_url', profileUrl);
            } else {
                continue;
            }

            const { data: prospects, error: fetchError } = await query;

            if (fetchError) {
                console.error(`❌ Error fetching prospect ${email || profileUrl}:`, fetchError);
                continue;
            }

            for (const prospect of prospects || []) {
                if (prospect.status !== supabaseStatus) {
                    console.log(`🆙 Updating prospect ${prospect.id} state: ${prospect.status} -> ${supabaseStatus} (Airtable sync)`);

                    const { error: updateError } = await supabase
                        .from('campaign_prospects')
                        .update({
                            status: supabaseStatus,
                            updated_at: new Date().toISOString()
                        })
                        .eq('id', prospect.id);

                    if (updateError) {
                        console.error(`❌ Error updating prospect ${prospect.id}:`, updateError);
                    } else {
                        updatedCount++;
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            message: `Airtable reverse sync completed. Updated ${updatedCount} prospects.`
        });
    } catch (error) {
        console.error('❌ Airtable reverse sync failed:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
