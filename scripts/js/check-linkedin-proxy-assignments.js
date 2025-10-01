#!/usr/bin/env node

/**
 * Check LinkedIn Account Proxy Assignments
 * Shows dedicated Bright Data IP assignments for each LinkedIn account
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('   Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkProxyAssignments(userEmail = null) {
  console.log('🔍 Checking LinkedIn Proxy Assignments\n');
  console.log('═'.repeat(80));
  
  try {
    // Get user if email provided
    let userId = null;
    if (userEmail) {
      const { data: authUser } = await supabase.auth.admin.listUsers();
      const user = authUser?.users?.find(u => u.email === userEmail);
      
      if (!user) {
        console.error(`❌ User not found: ${userEmail}`);
        process.exit(1);
      }
      
      userId = user.id;
      console.log(`👤 User: ${user.email} (${userId})\n`);
    }
    
    // Fetch proxy assignments
    let query = supabase
      .from('linkedin_proxy_assignments')
      .select('*')
      .order('last_updated', { ascending: false });
    
    if (userId) {
      query = query.eq('user_id', userId);
    }
    
    const { data: assignments, error } = await query;
    
    if (error) {
      console.error('❌ Failed to fetch proxy assignments:', error);
      return;
    }
    
    if (!assignments || assignments.length === 0) {
      console.log('ℹ️  No proxy assignments found');
      return;
    }
    
    console.log(`📊 Found ${assignments.length} LinkedIn account(s) with dedicated IPs\n`);
    console.log('═'.repeat(80));
    
    // Display each assignment
    for (const assignment of assignments) {
      console.log(`\n🔹 ${assignment.linkedin_account_name}`);
      console.log(`   Account ID: ${assignment.linkedin_account_id}`);
      console.log(`   Detected Country: ${assignment.detected_country}`);
      console.log(`\n   📡 Bright Data Proxy Configuration:`);
      console.log(`      Country: ${assignment.proxy_country.toUpperCase()}`);
      
      if (assignment.proxy_state) {
        console.log(`      State: ${assignment.proxy_state.toUpperCase()}`);
      }
      
      if (assignment.proxy_city) {
        console.log(`      City: ${assignment.proxy_city}`);
      }
      
      console.log(`      Session ID: ${assignment.proxy_session_id}`);
      console.log(`      Username: ${assignment.proxy_username.substring(0, 80)}...`);
      console.log(`\n   📊 Status:`);
      console.log(`      Connectivity: ${getStatusEmoji(assignment.connectivity_status)} ${assignment.connectivity_status}`);
      console.log(`      Confidence: ${(assignment.confidence_score * 100).toFixed(0)}%`);
      console.log(`      Primary Account: ${assignment.is_primary_account ? '⭐ Yes' : 'No'}`);
      
      if (assignment.account_features && assignment.account_features.length > 0) {
        console.log(`      Features: ${assignment.account_features.join(', ')}`);
      }
      
      console.log(`\n   🕐 Timing:`);
      console.log(`      Last Updated: ${new Date(assignment.last_updated).toLocaleString()}`);
      
      if (assignment.last_connectivity_test) {
        console.log(`      Last Test: ${new Date(assignment.last_connectivity_test).toLocaleString()}`);
      }
      
      if (assignment.next_rotation_due) {
        console.log(`      Next Rotation: ${new Date(assignment.next_rotation_due).toLocaleString()}`);
      }
      
      if (assignment.connectivity_details) {
        console.log(`\n   🔌 Connectivity Details:`);
        console.log(`      ${JSON.stringify(assignment.connectivity_details, null, 6).replace(/\n/g, '\n      ')}`);
      }
      
      console.log('\n' + '─'.repeat(80));
    }
    
    // Summary statistics
    console.log('\n📈 Summary Statistics:\n');
    
    const statusCounts = assignments.reduce((acc, a) => {
      acc[a.connectivity_status] = (acc[a.connectivity_status] || 0) + 1;
      return acc;
    }, {});
    
    const countryCounts = assignments.reduce((acc, a) => {
      acc[a.proxy_country] = (acc[a.proxy_country] || 0) + 1;
      return acc;
    }, {});
    
    console.log('   Status Distribution:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`      ${getStatusEmoji(status)} ${status}: ${count}`);
    });
    
    console.log('\n   Proxy Country Distribution:');
    Object.entries(countryCounts).forEach(([country, count]) => {
      console.log(`      ${country.toUpperCase()}: ${count}`);
    });
    
    const primaryCount = assignments.filter(a => a.is_primary_account).length;
    const withFeatures = assignments.filter(a => a.account_features?.length > 0).length;
    
    console.log(`\n   Primary Accounts: ${primaryCount}`);
    console.log(`   Accounts with Premium Features: ${withFeatures}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  console.log('\n' + '═'.repeat(80));
}

function getStatusEmoji(status) {
  switch (status) {
    case 'active': return '✅';
    case 'failed': return '❌';
    case 'untested': return '⏳';
    case 'disabled': return '🚫';
    default: return '❓';
  }
}

// Parse command line arguments
const userEmail = process.argv[2];

if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
LinkedIn Proxy Assignment Checker

Usage:
  node scripts/js/check-linkedin-proxy-assignments.js [email]
  
Arguments:
  email    Optional: Filter by user email address
  
Examples:
  node scripts/js/check-linkedin-proxy-assignments.js
  node scripts/js/check-linkedin-proxy-assignments.js tl@innovareai.com
`);
  process.exit(0);
}

// Run the check
checkProxyAssignments(userEmail);
