/**
 * Charissa Campaign CSV Upload API
 * Dedicated endpoint for uploading Charissa's LinkedIn campaign prospects
 * DATABASE-FIRST: Upserts to workspace_prospects first, then campaign_prospects with master_prospect_id FK
 */

import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/app/lib/supabase'
import { parse } from 'csv-parse/sync'

// Helper to normalize LinkedIn URL to hash (vanity name only)
function normalizeLinkedInUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = url.match(/linkedin\.com\/in\/([^\/\?#]+)/i);
  if (match) return match[1].toLowerCase().trim();
  return url.replace(/^\/+|\/+$/g, '').toLowerCase().trim();
}

interface CSVProspect {
  first_name: string
  last_name: string
  company_name: string
  linkedin_url: string
}

export async function POST(request: NextRequest) {
  try {
    console.log('📤 Processing Charissa CSV upload...')
    
    const formData = await request.formData()
    const file = formData.get('file') as File
    
    if (!file) {
      return NextResponse.json({
        success: false,
        error: 'No CSV file provided'
      }, { status: 400 })
    }

    const csvText = await file.text()
    console.log('📄 CSV file received, size:', csvText.length, 'characters')

    // Parse CSV data
    let csvData: CSVProspect[]
    try {
      csvData = parse(csvText, {
        columns: true,
        skip_empty_lines: true,
        trim: true
      })
      console.log('✅ CSV parsed successfully, rows:', csvData.length)
    } catch (parseError) {
      console.error('❌ CSV parse error:', parseError)
      return NextResponse.json({
        success: false,
        error: 'Invalid CSV format',
        details: parseError instanceof Error ? parseError.message : 'Unknown parse error'
      }, { status: 400 })
    }

    if (csvData.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'CSV file is empty'
      }, { status: 400 })
    }

    const supabase = supabaseAdmin()

    // Charissa's campaign configuration
    const charissaConfig = {
      workspace_id: 'charissa-workspace',
      linkedin_account_id: 'he3RXnROSLuhONxgNle7dw',
      campaign_name: 'Charissa - LinkedIn Founder Outreach'
    }

    // First, ensure we have a campaign for Charissa
    let { data: existingCampaign, error: campaignLookupError } = await supabase
      .from('campaigns')
      .select('id, name, status')
      .eq('workspace_id', charissaConfig.workspace_id)
      .eq('name', charissaConfig.campaign_name)
      .single()

    if (campaignLookupError && campaignLookupError.code !== 'PGRST116') {
      console.error('❌ Campaign lookup error:', campaignLookupError)
      return NextResponse.json({
        success: false,
        error: 'Database error during campaign lookup',
        details: campaignLookupError.message
      }, { status: 500 })
    }

    let campaignId: string

    if (!existingCampaign) {
      // Create new campaign for Charissa
      console.log('📋 Creating new campaign for Charissa...')
      
      const { data: newCampaign, error: campaignError } = await supabase
        .from('campaigns')
        .insert([{
          workspace_id: charissaConfig.workspace_id,
          name: charissaConfig.campaign_name,
          description: 'LinkedIn-only campaign targeting early-stage founders',
          campaign_type: 'linkedin_only',
          status: 'draft',
          channel_preferences: {
            email: false,
            linkedin: true
          },
          linkedin_config: {
            account_id: charissaConfig.linkedin_account_id,
            connection_message: 'Hi {first_name}, I work for InnovareAI, an AI company known for its innovative workflow automation and AI agent solutions. I\'m always interested in connecting with like-minded individuals who want to learn all things AI. Would you be open to connecting?',
            follow_up_message: 'Hi {first_name}, I\'ve been thinking about the early-stage founder reality - you\'re probably wearing 10+ hats right now: product development, customer discovery, fundraising prep, AND trying to generate your first paying customers. The catch-22 is brutal: you need customers to show traction for investors, but you can\'t afford to hire sales help, and the manual outreach eats up the time you need for building and fundraising. I\'m curious - as a solo founder (or small team), what\'s your biggest time sink right now? Finding customers, handling repetitive processes, or are you mostly focused on building?'
          }
        }])
        .select('id')
        .single()

      if (campaignError) {
        console.error('❌ Campaign creation error:', campaignError)
        return NextResponse.json({
          success: false,
          error: 'Failed to create campaign',
          details: campaignError.message
        }, { status: 500 })
      }

      campaignId = newCampaign.id
      console.log('✅ Campaign created with ID:', campaignId)
    } else {
      campaignId = existingCampaign.id
      console.log('✅ Using existing campaign ID:', campaignId)
    }

    // Process and insert prospect data
    console.log('👥 Processing', csvData.length, 'prospects...')
    
    // Validate required fields
    const validProspects = csvData.filter((row, index) => {
      if (!row.first_name?.trim() || !row.last_name?.trim() || !row.company_name?.trim() || !row.linkedin_url?.trim()) {
        console.warn(`⚠️ Skipping row ${index + 1}: Missing required fields`)
        return false
      }
      return true
    })

    console.log(`✅ Valid prospects: ${validProspects.length} out of ${csvData.length}`)

    // DATABASE-FIRST: Prepare workspace_prospects data
    console.log('💾 Step 1: Upserting to workspace_prospects master table...')

    const masterProspectsData = validProspects.map((row) => ({
      workspace_id: charissaConfig.workspace_id,
      linkedin_url: row.linkedin_url.trim(),
      linkedin_url_hash: normalizeLinkedInUrl(row.linkedin_url.trim()),
      first_name: row.first_name.trim(),
      last_name: row.last_name.trim(),
      company: row.company_name.trim(),
      source: 'charissa_csv_upload',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    })).filter(p => p.linkedin_url_hash)

    // Batch upsert to workspace_prospects
    const batchSize = 100
    let masterIdMap: Record<string, string> = {}

    for (let i = 0; i < masterProspectsData.length; i += batchSize) {
      const batch = masterProspectsData.slice(i, i + batchSize)

      const { error: masterError } = await supabase
        .from('workspace_prospects')
        .upsert(batch, {
          onConflict: 'workspace_id,linkedin_url_hash',
          ignoreDuplicates: false
        })

      if (masterError) {
        console.warn(`⚠️ Master batch ${Math.floor(i/batchSize) + 1} upsert warning:`, masterError.message)
      } else {
        console.log(`✅ Master batch ${Math.floor(i/batchSize) + 1} upserted`)
      }
    }

    // Get all master_prospect_ids for linking
    const linkedinHashes = masterProspectsData.map(p => p.linkedin_url_hash).filter(Boolean)
    if (linkedinHashes.length > 0) {
      const { data: masterRecords } = await supabase
        .from('workspace_prospects')
        .select('id, linkedin_url_hash')
        .eq('workspace_id', charissaConfig.workspace_id)
        .in('linkedin_url_hash', linkedinHashes)

      if (masterRecords) {
        masterIdMap = masterRecords.reduce((acc: Record<string, string>, r: any) => {
          acc[r.linkedin_url_hash] = r.id
          return acc
        }, {})
      }
    }

    console.log(`✅ Linked ${Object.keys(masterIdMap).length} master prospect IDs`)

    // Now prepare campaign_prospects with master_prospect_id FK
    console.log('💾 Step 2: Inserting to campaign_prospects...')

    const prospectsToInsert = validProspects.map((row, index) => {
      const linkedinHash = normalizeLinkedInUrl(row.linkedin_url.trim())

      return {
        campaign_id: campaignId,
        workspace_id: charissaConfig.workspace_id,
        master_prospect_id: linkedinHash ? masterIdMap[linkedinHash] || null : null,
        first_name: row.first_name.trim(),
        last_name: row.last_name.trim(),
        email: '', // Optional - can be empty for LinkedIn-only campaigns
        company_name: row.company_name.trim(),
        linkedin_url: row.linkedin_url.trim(),
        title: '', // Optional - can be filled later
        phone: '', // Optional
        location: '', // Optional
        industry: '', // Optional
        status: 'pending',
        notes: `LinkedIn prospect - Row ${index + 1}`,
        personalization_data: {
          source: 'charissa_csv_upload',
          uploaded_at: new Date().toISOString(),
          row_number: index + 1,
          required_fields_only: true
        }
      }
    })

    // Insert prospects in batches
    let insertedCount = 0
    let errorCount = 0
    const errors: string[] = []

    for (let i = 0; i < prospectsToInsert.length; i += batchSize) {
      const batch = prospectsToInsert.slice(i, i + batchSize)

      const { data: insertedBatch, error: insertError } = await supabase
        .from('campaign_prospects')
        .insert(batch)
        .select('id')

      if (insertError) {
        console.error(`❌ Batch ${Math.floor(i/batchSize) + 1} insertion error:`, insertError)
        errorCount += batch.length
        errors.push(`Batch ${Math.floor(i/batchSize) + 1}: ${insertError.message}`)
      } else {
        insertedCount += insertedBatch?.length || 0
        console.log(`✅ Batch ${Math.floor(i/batchSize) + 1} inserted:`, insertedBatch?.length, 'prospects')
      }
    }

    // Update campaign status
    if (insertedCount > 0) {
      await supabase
        .from('campaigns')
        .update({ 
          status: 'ready',
          updated_at: new Date().toISOString()
        })
        .eq('id', campaignId)
    }

    const response = {
      success: true,
      campaign_id: campaignId,
      campaign_name: charissaConfig.campaign_name,
      workspace_id: charissaConfig.workspace_id,
      linkedin_account_id: charissaConfig.linkedin_account_id,
      prospects: {
        total_uploaded: csvData.length,
        successfully_inserted: insertedCount,
        failed_inserts: errorCount,
        errors: errors
      },
      next_steps: [
        '✅ CSV data uploaded successfully',
        '✅ Campaign is ready for launch',
        '🚀 Use SAM interface to launch LinkedIn campaign',
        '📊 Monitor campaign progress in dashboard'
      ]
    }

    console.log('🎉 CSV upload complete for Charissa:')
    console.log('- Campaign ID:', campaignId)
    console.log('- Prospects inserted:', insertedCount)
    console.log('- LinkedIn Account:', charissaConfig.linkedin_account_id)
    console.log('- Status: Ready for launch')

    return NextResponse.json(response)

  } catch (error) {
    console.error('❌ CSV upload error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Server error during CSV processing'
    }, { status: 500 })
  }
}