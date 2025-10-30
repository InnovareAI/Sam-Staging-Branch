#!/usr/bin/env node
/**
 * Fix prospects with missing names by extracting from LinkedIn URLs
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fixMissingNames() {
  console.log('🔧 FIXING PROSPECTS WITH MISSING NAMES\n');
  console.log('='.repeat(70));
  
  // Find all prospects with missing first_name or last_name
  const { data: prospects } = await supabase
    .from('campaign_prospects')
    .select('*')
    .or('first_name.is.null,last_name.is.null,first_name.eq.,last_name.eq.');
  
  console.log(`\nFound ${prospects?.length || 0} prospects with missing names\n`);
  
  if (!prospects || prospects.length === 0) {
    console.log('✅ No prospects need fixing');
    return;
  }
  
  let fixedCount = 0;
  let failedCount = 0;
  
  for (const prospect of prospects) {
    console.log(`\nProcessing: ${prospect.first_name || '?'} ${prospect.last_name || '?'}`);
    console.log(`   LinkedIn: ${prospect.linkedin_url || 'N/A'}`);
    console.log(`   Campaign: ${prospect.campaign_id}`);
    
    let firstName = prospect.first_name;
    let lastName = prospect.last_name;
    
    // Try to extract from LinkedIn URL
    if (prospect.linkedin_url && (!firstName || !lastName)) {
      const match = prospect.linkedin_url.match(/\/in\/([^\/\?]+)/);
      if (match) {
        const urlName = match[1].split('-');
        if (!firstName && urlName.length > 0) {
          firstName = urlName[0].charAt(0).toUpperCase() + urlName[0].slice(1);
        }
        if (!lastName && urlName.length > 1) {
          lastName = urlName.slice(1).map(part => 
            part.charAt(0).toUpperCase() + part.slice(1)
          ).join(' ');
        }
        
        console.log(`   ✅ Extracted: ${firstName} ${lastName}`);
        
        // Update the record
        const { error } = await supabase
          .from('campaign_prospects')
          .update({
            first_name: firstName || 'Unknown',
            last_name: lastName || 'User'
          })
          .eq('id', prospect.id);
        
        if (error) {
          console.log(`   ❌ Failed to update: ${error.message}`);
          failedCount++;
        } else {
          fixedCount++;
        }
      } else {
        console.log(`   ⚠️  Could not extract name from URL`);
        
        // Set defaults
        const { error } = await supabase
          .from('campaign_prospects')
          .update({
            first_name: firstName || 'Unknown',
            last_name: lastName || 'User'
          })
          .eq('id', prospect.id);
        
        if (!error) fixedCount++;
        else failedCount++;
      }
    } else if (!firstName || !lastName) {
      console.log(`   ⚠️  No LinkedIn URL, setting defaults`);
      
      const { error } = await supabase
        .from('campaign_prospects')
        .update({
          first_name: firstName || 'Unknown',
          last_name: lastName || 'User'
        })
        .eq('id', prospect.id);
      
      if (!error) fixedCount++;
      else failedCount++;
    }
  }
  
  console.log('\n' + '='.repeat(70));
  console.log('📊 SUMMARY');
  console.log('='.repeat(70));
  console.log(`\n   Fixed: ${fixedCount}`);
  console.log(`   Failed: ${failedCount}`);
  console.log('\n' + '='.repeat(70));
}

fixMissingNames().catch(console.error);
