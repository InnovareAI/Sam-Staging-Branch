/**
 * Update all workspace creation dates to September 1st, 2025
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function updateWorkspaceCreationDates() {
  console.log('🔧 Updating all workspace creation dates to September 1st, 2025...');
  
  try {
    // Set creation date to September 1st, 2025
    const newCreationDate = '2025-09-01T00:00:00.000Z';
    
    // First get all workspaces
    const { data: allWorkspaces, error: fetchError } = await supabase
      .from('workspaces')
      .select('id, name, created_at');

    if (fetchError) {
      console.error('❌ Failed to fetch workspaces:', fetchError.message);
      return;
    }

    console.log(`Found ${allWorkspaces.length} workspaces to update`);

    // Update each workspace individually
    let updateCount = 0;
    for (const workspace of allWorkspaces) {
      const { error: updateError } = await supabase
        .from('workspaces')
        .update({ created_at: newCreationDate })
        .eq('id', workspace.id);

      if (updateError) {
        console.error(`❌ Failed to update workspace ${workspace.name}:`, updateError.message);
      } else {
        updateCount++;
        console.log(`✅ Updated ${workspace.name}`);
      }
    }

    console.log(`\n✅ Updated ${updateCount} workspaces`);

    // Show all workspaces with their new creation dates
    const { data: finalWorkspaces, error: finalFetchError } = await supabase
      .from('workspaces')
      .select('name, created_at')
      .order('name');

    if (finalFetchError) {
      console.error('❌ Failed to fetch final workspaces:', finalFetchError.message);
      return;
    }

    console.log('\n📋 All workspaces with updated creation dates:');
    finalWorkspaces.forEach(workspace => {
      console.log(`  - ${workspace.name}: ${workspace.created_at}`);
    });

    console.log('\n✅ All workspace creation dates updated successfully!');

  } catch (error) {
    console.error('❌ Update workspace creation dates failed:', error);
  }
}

updateWorkspaceCreationDates();