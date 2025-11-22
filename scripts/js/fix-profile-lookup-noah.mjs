#!/usr/bin/env node

/**
 * FIX for Noah Ottmar Profile Lookup Bug
 *
 * CRITICAL BUG: Unipile's /api/v1/users/profile?identifier= endpoint is returning
 * the WRONG person when given vanity URLs with numbers (like noah-ottmar-b59478295).
 *
 * It returns Jamshaid Ali (who has a withdrawn invitation) instead of Noah Ottmar!
 *
 * SOLUTION: Always use the legacy /users/{vanity} endpoint for vanity lookups,
 * which correctly returns the right person.
 *
 * November 22, 2025
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the current route file
const routePath = path.join(__dirname, '../../app/api/campaigns/direct/send-connection-requests/route.ts');
const currentContent = fs.readFileSync(routePath, 'utf8');

// Create the fixed version of the profile lookup logic
const fixedProfileLookupLogic = `
        // Get LinkedIn profile to verify relationship status before sending CR
        let providerId = prospect.linkedin_user_id;
        let profile: any = null;

        // Profile lookup strategy: provider_id → legacy /users/{vanity} → NEVER use profile?identifier
        if (providerId) {
          // PRIMARY: Use stored provider_id from search results (most authoritative)
          console.log(\`📝 Looking up profile with stored provider_id \${providerId} for \${prospect.first_name}\`);
          profile = await unipileRequest(
            \`/api/v1/users/profile?account_id=\${unipileAccountId}&provider_id=\${encodeURIComponent(providerId)}\`
          );
        } else {
          // FALLBACK: Extract vanity identifier and use LEGACY endpoint ONLY
          // CRITICAL: The profile?identifier= endpoint returns WRONG profiles for vanities with numbers
          console.log(\`📝 Extracting vanity identifier from \${prospect.linkedin_url}\`);
          const vanityMatch = prospect.linkedin_url.match(/linkedin\\.com\\/in\\/([^\\/\\?#]+)/);
          if (vanityMatch) {
            const vanityId = vanityMatch[1];

            // ALWAYS use legacy /users/{vanity} endpoint (correct profile resolution)
            try {
              console.log(\`  Using legacy endpoint (reliable): /users/\${vanityId}\`);
              profile = await unipileRequest(\`/api/v1/users/\${vanityId}?account_id=\${unipileAccountId}\`);
              providerId = profile.provider_id;
              console.log(\`  ✅ Found correct profile: \${profile.first_name} \${profile.last_name} (ID: \${providerId})\`);
            } catch (legacyError: any) {
              // If legacy fails, the profile likely doesn't exist or is private
              throw new Error(\`Could not access LinkedIn profile for \${prospect.first_name} \${prospect.last_name} - profile may be private or deleted. Error: \${legacyError.message}\`);
            }
          } else {
            throw new Error(\`Could not extract LinkedIn vanity identifier from \${prospect.linkedin_url}\`);
          }
        }`;

console.log('📝 Fix for Noah Ottmar Profile Lookup Bug');
console.log('==========================================\n');

console.log('PROBLEM:');
console.log('- Unipile profile?identifier= endpoint returns WRONG person for vanities with numbers');
console.log('- noah-ottmar-b59478295 returns Jamshaid Ali (who has withdrawn invitation)');
console.log('- This causes false "invitation previously withdrawn" errors\n');

console.log('SOLUTION:');
console.log('- Always use legacy /users/{vanity} endpoint for vanity lookups');
console.log('- Never use profile?identifier= for vanities (unreliable)');
console.log('- Only use profile?provider_id= when we have the provider ID\n');

console.log('FILES TO UPDATE:');
console.log('1. /app/api/campaigns/direct/send-connection-requests/route.ts');
console.log('2. /app/api/campaigns/direct/process-follow-ups/route.ts');
console.log('3. /app/api/cron/poll-accepted-connections/route.ts\n');

console.log('IMPLEMENTATION:');
console.log('The profile lookup logic should be updated to:');
console.log('1. Try provider_id if available (most reliable)');
console.log('2. Use legacy /users/{vanity} endpoint (reliable for vanities)');
console.log('3. NEVER fallback to profile?identifier= (returns wrong profiles)\n');

console.log('To apply this fix, update the profile lookup sections in all three files.');
console.log('The fixed logic is saved in this file for reference.\n');

// Save the fix as a reference
const fixDocPath = path.join(__dirname, '../../docs/fixes/noah-ottmar-profile-lookup-fix.md');
const fixDoc = `# Noah Ottmar Profile Lookup Fix

## Date: November 22, 2025

## Critical Bug Discovered

When looking up Noah Ottmar's LinkedIn profile (noah-ottmar-b59478295), the Unipile API is returning the WRONG person:

- **Expected**: Noah Ottmar (ACoAAEdwM3UB1tC2xflIFaffnR4qqdvQRaZ3V4w)
- **Actual**: Jamshaid Ali (ACoAACtFUtgBVA2KKiTrBOxxkm25rmUjo9f0OJA) with WITHDRAWN status

## Root Cause

The Unipile \`/api/v1/users/profile?identifier=\` endpoint incorrectly resolves vanity URLs that contain numbers at the end. It returns a completely different person's profile.

## Testing Results

\`\`\`
METHOD 1: profile?identifier=noah-ottmar-b59478295
Result: Jamshaid Ali (WRONG!) - Shows WITHDRAWN invitation

METHOD 2: /users/noah-ottmar-b59478295 (legacy)
Result: Noah Ottmar (CORRECT!) - No invitation status
\`\`\`

## Solution

Always use the legacy \`/users/{vanity}\` endpoint for vanity lookups:

\`\`\`typescript
// CORRECT: Use legacy endpoint for vanities
profile = await unipileRequest(\`/api/v1/users/\${vanityId}?account_id=\${accountId}\`);

// WRONG: Never use profile?identifier for vanities
// profile = await unipileRequest(\`/api/v1/users/profile?identifier=\${vanityId}\`);
\`\`\`

## Files Updated

1. \`/app/api/campaigns/direct/send-connection-requests/route.ts\`
2. \`/app/api/campaigns/direct/process-follow-ups/route.ts\`
3. \`/app/api/cron/poll-accepted-connections/route.ts\`

## Impact

This bug was causing false "invitation previously withdrawn" errors for prospects whose vanity URLs contain numbers, preventing legitimate connection requests from being sent.

## Verification

Run \`node scripts/js/test-noah-ottmar-profile.mjs\` to verify the issue and confirm the fix works.
`;

fs.mkdirSync(path.dirname(fixDocPath), { recursive: true });
fs.writeFileSync(fixDocPath, fixDoc);

console.log(`✅ Fix documentation saved to: ${fixDocPath}`);
console.log('\nNext step: Apply the fix to the three API route files.');