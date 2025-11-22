#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔧 FIXING PROFILE LOOKUP PATTERN\n');
console.log('='.repeat(80));
console.log('\nPROBLEM: Vanity identifiers with numbers return wrong profiles');
console.log('SOLUTION: Use legacy /users/{vanity} endpoint which works correctly\n');

// Read the current implementation
const filePath = path.join(__dirname, '../../app/api/campaigns/direct/send-connection-requests/route.ts');
const content = fs.readFileSync(filePath, 'utf8');

// Create the improved lookup logic
const improvedLookupLogic = `        // Profile lookup strategy: provider_id → legacy /users/{vanity} → profile API
        if (providerId) {
          // PRIMARY: Use stored provider_id from search results (most authoritative)
          console.log(\`📝 Looking up profile with stored provider_id \${providerId} for \${prospect.first_name}\`);
          profile = await unipileRequest(
            \`/api/v1/users/profile?account_id=\${unipileAccountId}&provider_id=\${encodeURIComponent(providerId)}\`
          );
        } else {
          // FALLBACK: Extract vanity identifier and use legacy endpoint (more reliable for vanity with numbers)
          console.log(\`📝 Extracting vanity identifier from \${prospect.linkedin_url}\`);
          const vanityMatch = prospect.linkedin_url.match(/linkedin\\.com\\/in\\/([^\\/\\?#]+)/);
          if (vanityMatch) {
            const vanityId = vanityMatch[1];

            // Try legacy /users/{vanity} endpoint first (works better with numbers in vanity)
            try {
              console.log(\`  Trying legacy endpoint: /users/\${vanityId}\`);
              profile = await unipileRequest(\`/api/v1/users/\${vanityId}?account_id=\${unipileAccountId}\`);
              providerId = profile.provider_id;
              console.log(\`  ✅ Found via legacy endpoint: \${profile.first_name} \${profile.last_name}\`);
            } catch (legacyError) {
              // If legacy fails, try the profile API with identifier parameter
              console.log(\`  Legacy failed, trying profile API with identifier=\${vanityId}\`);
              profile = await unipileRequest(
                \`/api/v1/users/profile?account_id=\${unipileAccountId}&identifier=\${encodeURIComponent(vanityId)}\`
              );
              providerId = profile.provider_id;
              console.log(\`  ✅ Found via profile API: \${profile.first_name} \${profile.last_name}\`);
            }
          } else {
            throw new Error(\`Could not extract LinkedIn vanity identifier from \${prospect.linkedin_url}\`);
          }
        }`;

// Find the section to replace (lines 194-221 in the original)
const startMarker = '        // Profile lookup strategy:';
const endMarker = '        }';

// Find the exact section to replace
const startIndex = content.indexOf(startMarker);
if (startIndex === -1) {
  console.error('❌ Could not find the profile lookup section to replace');
  process.exit(1);
}

// Find the matching closing brace for this block
let braceCount = 0;
let endIndex = startIndex;
let insideBlock = false;

for (let i = startIndex; i < content.length; i++) {
  if (content[i] === '{') {
    braceCount++;
    insideBlock = true;
  } else if (content[i] === '}') {
    braceCount--;
    if (insideBlock && braceCount === 0) {
      endIndex = i + 1;
      break;
    }
  }
}

// Replace the section
const before = content.substring(0, startIndex);
const after = content.substring(endIndex);
const newContent = before + improvedLookupLogic + after;

// Write the updated file
fs.writeFileSync(filePath, newContent);

console.log('✅ Updated /app/api/campaigns/direct/send-connection-requests/route.ts');
console.log('\nChanges made:');
console.log('1. Added fallback to legacy /users/{vanity} endpoint');
console.log('2. Legacy endpoint works correctly with vanity IDs containing numbers');
console.log('3. Only uses /users/profile?identifier= as last resort');
console.log('\n' + '='.repeat(80));
console.log('\n📝 Also updating the process-follow-ups endpoint...\n');

// Update the process-follow-ups endpoint too
const followUpPath = path.join(__dirname, '../../app/api/campaigns/direct/process-follow-ups/route.ts');
if (fs.existsSync(followUpPath)) {
  const followUpContent = fs.readFileSync(followUpPath, 'utf8');

  // Apply similar fix to follow-up endpoint
  const followUpStartIndex = followUpContent.indexOf('        // Profile lookup strategy:');
  if (followUpStartIndex !== -1) {
    // Find the end of this block
    let braceCount = 0;
    let endIndex = followUpStartIndex;
    let insideBlock = false;

    for (let i = followUpStartIndex; i < followUpContent.length; i++) {
      if (followUpContent[i] === '{') {
        braceCount++;
        insideBlock = true;
      } else if (followUpContent[i] === '}') {
        braceCount--;
        if (insideBlock && braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }

    const followUpBefore = followUpContent.substring(0, followUpStartIndex);
    const followUpAfter = followUpContent.substring(endIndex);
    const newFollowUpContent = followUpBefore + improvedLookupLogic + followUpAfter;

    fs.writeFileSync(followUpPath, newFollowUpContent);
    console.log('✅ Updated /app/api/campaigns/direct/process-follow-ups/route.ts');
  }
}

console.log('\n🚀 Fix applied! The legacy endpoint pattern will now be used for vanity lookups.');
console.log('\nThis should resolve the issue where vanity IDs with numbers return wrong profiles.');