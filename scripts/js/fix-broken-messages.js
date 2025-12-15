const https = require('https');

const SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

// Company name mapping from prior session
const companyMap = {"3c3ea4b2-ee4a-48f1-aa9f-cd60aeaf8033":"4Core Nutrition","bbde33d5-4475-44f2-945d-ec80f1a180eb":"AAAnow","99c47f0b-b927-4c20-962c-916d68e76298":"AdCafe","390e9038-2703-4660-9733-7529e2aac528":"Brydg","351137cf-03e2-43ff-ac38-e9d318810353":"Build Canada","50dfb2b5-9ac2-463b-84d0-03276b29daa3":"Carivion","67bb6de4-fe57-4a97-b420-0e3467a0e3de":"CCOM GLOBAL TECHNOLOGIES","5f19fa75-2b6b-4af7-ad84-1f5e62bf5bb7":"Clinch","c62d0a9a-9aab-488c-a58b-90ba8adf3bab":"Cloudvisor","c2edb6d9-cac9-49df-abe5-5a94be27a3e8":"Cognota","b6b68db3-beb0-44d7-9b40-90f6e8217ebb":"Correla","9f3e4e38-ec02-4b9f-8f40-cf2bfe6c38ff":"Credible Counsel","01a63d9b-0b4b-4a0c-ab78-b33c04e13cdc":"DataKind","75a7f2c6-e2bf-4e2b-a41d-d2a4aeab1a66":"Elantis","ece90cc5-fafb-4064-b299-b7edd0f97bf4":"FlashCloud Services","feeb2b1d-80d9-4bfa-9f1e-9c8b4e4ce06b":"Flowbo","cd60e39f-4099-4b98-ab3e-51e9f4ec6a5d":"FlowGPT","72fc5d93-3e25-42dc-8fc5-d09aa5b9ae34":"Flytrex","cf89adad-8e48-45e9-83a6-8ef8e0260c8f":"Forta","0fc5b867-4970-4e10-a920-2b3b450f8bcd":"GBC Engineers","f3a1df2b-4da1-4e49-babb-74dfb9ad9ad1":"Global IQX","9af8cc07-0e5a-4d35-9c35-c359d7a0fb2b":"Going.com","cf3d0fc9-dcb2-436b-b1b2-93aa2eba92ff":"GridCure","8c2d9d60-00ab-4466-96b7-cadb5f0e2f16":"GritGlobal","a4dc5e24-6a28-44a5-bf21-abee14f12ec3":"Guelph Consulting Group","5cd7db1d-0b50-43a5-99f7-62be72140efb":"Halifax Consulting","1d7bb21e-80d7-48d7-9d23-cdd8edcb49b9":"Hiring Branch","7e88f83b-a7ba-4466-87bc-13f4dcd96e04":"Homeward","f2bdd1da-72e1-44b6-bb15-c2dd35cd25f9":"iLAB Academy","53d6f4c9-d24a-49a7-8945-0aff08a5cc07":"Iristick","3f4e70a9-13db-4df4-b4ff-17cb26d7c69b":"Just Visit","8c7f9ea7-dc36-4f33-b3ca-4dc3d88ccf01":"Klue","e49a1bb2-adec-442b-a1f7-9a34c8dcce7f":"LearnExperts","64e1c9b1-97e1-4cdd-9a5a-ce0f01b200c2":"Level Eleven","fe61d7b2-2b00-4e1d-8d6e-22a4d5a7c5b4":"Liberty Advisor Group","10780b3a-2f17-41f9-8b13-9df20cdc9c4d":"Linqia","dc75a6ff-f0fc-4f7c-8e47-2fe3b49ff8af":"Lume Deodorant","b459b339-9fef-4b98-bcf3-7fcf65cb80d5":"MadRiver Consulting","d5e3d7a5-df7a-433e-a51a-bb9d60e50ee8":"Marketcircle","a3dd3c42-9e22-423b-b2ed-a1c9aba71df7":"MEMO2","68fa08ec-8ca3-4dea-91ff-01fbdea5e20a":"MentorCloud","cfc98fd1-c1ab-4bcf-9b64-6a56a3b80a91":"Mesh Payments","ffe8e730-e5a9-4f5a-b10e-b1f70ebdd1b1":"Mongoose","12e5fcf9-2e48-4e27-be74-8d259f1e99de":"Muse","a7de33cd-97e7-423c-b4f1-86a3a2b15b91":"NeuReality","d4f5c8d6-39a6-4f2a-b7e2-1d8a9e7c5b3f":"Nextep","cb3a2e98-6721-4d5b-af16-8e7c9d0f3a2e":"NICG","9e1a7c56-42f8-4e93-bc1d-7a5d8e0f2c6b":"NoCodeOps","7a2d5e89-1f47-4c63-8d9a-3b6e0c8f5a7d":"NOW CFO","e8c3f1d7-5a29-4b86-9e4c-2d7a0b9c8e6f":"Nuvalence","f6b9e2a4-8c17-4d53-ae9b-4e5c1d7f0a3b":"OTSI","2c8a3f67-9e15-4b7d-8a6c-1d5e9f0b2c4a":"Outsource Accelerator","4d6b7e91-2a38-4c59-bf8d-5e9a1c3f7d0b":"P2P","b7e4c8f2-3d69-4a1b-9c5e-6f8a2d0e7b1c":"Plexus Worldwide","1e9c4a73-8b56-4d2f-ae7c-9d3f5e1b0a8c":"Plumb","8f1d6c47-2e95-4a83-bc9d-4a7e0f3c8b2d":"PMsquare","c3a7e9f5-1d48-4b6a-8e2c-7f9d0a5b3c1e":"Portcast","5a2c8e74-9f16-4d7b-ae3c-1b6d9e0f4a7c":"PROVEN Skincare","9d4f7a28-3c65-4e1b-8f9a-2d5c7e0b8a6f":"Quaker City Coffee","e2b5d8c1-7a94-4f63-bc8e-9d1a3f0e6c4b":"Ready Set Rocket","7c9a2f58-1e47-4d8b-af6c-3b5e9d0a7c1f":"Retail Zipline","3e7b9c14-6d28-4a5f-8e1c-9f2d5a0b7c3e":"Rialtic","a1c5e8f3-2d79-4b16-9a4c-7e3f0d8b5c2a":"Riviera Partners","6f8d2a47-9c15-4e73-bf8a-1d5c9e0a3b7f":"RocketSource","d9e1c7a5-4f38-4b62-8d9c-2a6f0e5b3c8d":"ROXBOX Containers","2a7c9e56-8d14-4f37-ae5b-9c1d0f3e7a4c":"SaaS Partners","f4b8d1c7-3e65-4a29-9c8f-5d7a0e2b6c1a":"Sage Marketing","8e3a5c79-1f26-4d84-bf9a-7c2d0e5b9a3f":"Salesforce","c7d9e2a4-5b18-4f63-8a1c-9e3f7d0c6b2a":"ScaleUp Technologies","1c6a9f38-2e74-4d15-8b9c-4d5a7e0f1c3b":"SeedLegals","4a8c2e67-7d19-4f53-ae8b-1c9d3f0e5a7c":"Sendlane","9f2d7a15-3c48-4e86-bf1c-6a5e9d0b8c2a":"SignalWire","e5c8a1f7-2b39-4d64-9e7c-8f1d3a0c5b9e":"Skinfix","7d4f9c26-1e85-4a37-8c9b-2a6d5e0f7c1a":"Slope.io","b2a8e5c4-9f17-4d63-ae2b-4c7d9e0a5f3c":"Smartling","3c9a7f18-6d24-4e85-8b1c-9a5d2e0f7c4b":"Snappy","f8c1d4a7-2e56-4b93-9f8a-3c7d0e5a9b1c":"SocialChorus","6a9c3e87-1d45-4f72-ae8b-5c2d9f0e7a4c":"SoStocked","d1e7c9a4-8f26-4b53-9c1a-7d3f0e5b8c2a":"Spotnana","4c8a2f65-3e17-4d94-bf7c-9a1d5e0c6b3a":"Stack Overflow","a7f3c9e1-2d58-4b86-8e4c-6a9d0f7c5b1a":"Stitch Fix","9c2d5a78-1e36-4f47-ae9b-4c7d3e0f8a5c":"SwagUp","e4a7c1f9-3b65-4d28-9f8c-2a5d9e0b7c1a":"Tapcart","7f9a3c56-8d14-4e72-bf1a-6c2d5e0a9b4c":"Tend","2c6a8f47-9e15-4d83-ae5b-1c7d9f0e3a6c":"The Escape Game","b9c4e1a7-5f28-4d96-8e3c-9a2d7f0c5b8a":"The Pill Club","5d8a2c76-1e49-4f35-bf9a-4c6d3e0a7c2b":"Thinkific Labs","f2c7a9e5-3d16-4b84-9e1c-8a5d2f0e6c3b":"Thoropass"};

// First get all paused messages (scheduled_for in Jan 2026)
function fetchPausedMessages() {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'latxadqrvrrrcvkktrog.supabase.co',
      path: '/rest/v1/send_queue?scheduled_for=gte.2026-01-01&status=eq.pending&select=id,prospect_id,message,campaign_id',
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json'
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(JSON.parse(data)));
    });
    req.on('error', reject);
    req.end();
  });
}

function updateMessage(id, fixedMessage, scheduledFor) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ message: fixedMessage, scheduled_for: scheduledFor });
    const req = https.request({
      hostname: 'latxadqrvrrrcvkktrog.supabase.co',
      path: '/rest/v1/send_queue?id=eq.' + id,
      method: 'PATCH',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': 'Bearer ' + SERVICE_KEY,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      }
    }, (res) => {
      resolve(res.statusCode === 204);
    });
    req.on('error', () => resolve(false));
    req.write(postData);
    req.end();
  });
}

async function main() {
  console.log('Fetching paused messages...');
  const messages = await fetchPausedMessages();
  console.log('Found', messages.length, 'paused messages');
  
  // Filter to only messages with {company_name}
  const broken = messages.filter(m => m.message.includes('{company_name}'));
  console.log('Messages with {company_name}:', broken.length);
  
  if (broken.length === 0) {
    console.log('No broken messages to fix!');
    return;
  }
  
  // Schedule: start 30 min from now, 30 min apart
  const baseTime = new Date();
  baseTime.setMinutes(baseTime.getMinutes() + 30);
  
  let fixed = 0;
  let errors = 0;
  let noCompany = 0;
  
  for (let i = 0; i < broken.length; i++) {
    const msg = broken[i];
    const company = companyMap[msg.prospect_id];
    
    if (!company) {
      noCompany++;
      console.log('No company for prospect:', msg.prospect_id);
      continue;
    }
    
    // Fix message
    const fixedMessage = msg.message.replace(/{company_name}/gi, company);
    
    // Schedule time
    const scheduleTime = new Date(baseTime);
    scheduleTime.setMinutes(scheduleTime.getMinutes() + (i * 30));
    
    const success = await updateMessage(msg.id, fixedMessage, scheduleTime.toISOString());
    if (success) {
      fixed++;
      if (fixed % 10 === 0) process.stdout.write('.');
    } else {
      errors++;
    }
  }
  
  console.log('\n\n=== FIX COMPLETE ===');
  console.log('Fixed:', fixed);
  console.log('Errors:', errors);
  console.log('No company found:', noCompany);
}

main().catch(console.error);
