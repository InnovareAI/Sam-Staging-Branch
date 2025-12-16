#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SARA_DRAFT_ID = '9301679d-5c5d-48b3-9fb2-90246f1078cf';

const { data: draft } = await supabase
  .from('reply_agent_drafts')
  .select('*')
  .eq('id', SARA_DRAFT_ID)
  .single();

console.log('📋 SARA DRAFT RESEARCH STATUS');
console.log('='.repeat(70));
console.log(`\nLinkedIn Research: ${draft.research_linkedin_profile || 'NONE'}`);
console.log(`Company Research: ${draft.research_company_profile || 'NONE'}`);
console.log(`Website Research: ${draft.research_website || 'NONE'}`);
console.log(`\nProspect Title: ${draft.prospect_title}`);
console.log(`Prospect Company: ${draft.prospect_company}`);
