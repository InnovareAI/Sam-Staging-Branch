import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const workspaceId = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

const messagingContent = `
# ChillMine - Brian Neirby Messaging Guide

## Company Overview
- **Company**: ChillMine
- **Website**: www.chillmine.io
- **Value Proposition**: Changing the game of water cooled data storage
- **Target**: Investors interested in Bitcoin Mining / Data Storage
- **Investor Deck**: https://link.chillmine.io/BitcoinMining

## Tone & Voice
- Professional but friendly
- Always sign off with "Cheers, Brian" or "Cheers, Brian Neirby"
- Use first names when addressing prospects
- Polite and non-pushy ("I hope you don't mind me following up")
- Ask permission-based questions ("If so, am pleased to share more with you?")

## Message Templates

### Connection Request
"Dear [FIRST_NAME], very pleased to meet you.

Cheers,
Brian Neirby"

### Follow-up 1 (Introduction)
"Thank you for the link up, [FIRST_NAME]. Reaching out by way of introductions to ChillMine, we are changing the game of water cooled data storage, www.chillmine.io. Unsure if this fits into your investment thesis? If so, am pleased to share more with you?

Cheers,
Brian Neirby"

### Follow-up 2 (Investor Deck)
"Hello [FIRST_NAME], I hope you don't mind me following up with the ChillMine short form investor deck: https://link.chillmine.io/BitcoinMining?

Very pleased to have a deeper dive with you if there is interest.

Cheers,
Brian"

## Reply Guidelines

### When prospect shows INTEREST:
- Thank them for their interest
- Offer to schedule a call or deeper dive
- Share the investor deck link if not already sent
- Keep it brief and action-oriented

### When prospect asks QUESTIONS:
- Answer directly and concisely
- Offer to provide more details via call
- Reference the investor deck for comprehensive information

### When prospect has OBJECTIONS:
- Acknowledge their concern politely
- Provide brief clarification if appropriate
- Don't be pushy - respect their decision
- Leave door open for future contact

### When prospect says NOT INTERESTED:
- Thank them for their time
- Respect their decision
- Keep response brief and professional
`;

// Store in knowledge_base
const { data, error } = await supabase
  .from('knowledge_base')
  .upsert({
    workspace_id: workspaceId,
    title: 'ChillMine Messaging Guide - Brian Neirby',
    content: messagingContent,
    content_type: 'reply_agent_training',
    source: 'manual',
    metadata: {
      type: 'messaging_templates',
      owner: 'Brian Neirby',
      company: 'ChillMine',
      website: 'www.chillmine.io',
      investor_deck: 'https://link.chillmine.io/BitcoinMining'
    }
  }, {
    onConflict: 'workspace_id,title'
  })
  .select();

if (error) {
  console.error('Error storing messaging guide:', error);
} else {
  console.log('✅ Messaging guide stored successfully');
  console.log(data);
}

// Also check if there's a reply_agent_config table
const { data: configCheck, error: configError } = await supabase
  .from('reply_agent_config')
  .select('*')
  .eq('workspace_id', workspaceId)
  .limit(1);

if (configError && configError.code === '42P01') {
  console.log('\n⚠️ reply_agent_config table does not exist - using knowledge_base only');
} else if (configCheck) {
  console.log('\n📋 Existing reply_agent_config:', configCheck);
}
