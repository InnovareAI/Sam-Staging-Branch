#!/usr/bin/env node
/**
 * Test Bidirectional KB Features
 * - KB Health Check
 * - Search Intent Detection
 * - ICP-Aware Search
 */

console.log('🧪 Testing Bidirectional KB Features\n');

// Test 1: Search keyword detection
console.log('Test 1: Search Keyword Detection');
const searchPhrases = [
  'find prospects for me',
  'search for VP Sales in SaaS',
  'help me find companies in healthcare',
  'I need to target CTOs',
  'pull a list of directors'
];

searchPhrases.forEach(phrase => {
  const keywords = ['find prospects', 'search for', 'look for', 'help me find', 'pull a list'];
  const detected = keywords.some(kw => phrase.toLowerCase().includes(kw));
  console.log(`  "${phrase}"`);
  console.log(`  → Detected: ${detected ? '✅' : '❌'}\n`);
});

// Test 2: Mock ICP detection
console.log('\nTest 2: ICP Keyword Matching');
const mockICP = {
  industries: ['SaaS', 'Software'],
  job_titles: ['VP Sales', 'Director of Sales', 'CRO']
};

const testMessages = [
  'find VP Sales in SaaS companies',
  'search for CTOs in healthcare',
  'help me find prospects'
];

testMessages.forEach(msg => {
  const words = msg.toLowerCase().split(/\s+/);
  const mentionsIndustry = mockICP.industries.some(ind =>
    words.some(w => ind.toLowerCase().includes(w) || w.includes(ind.toLowerCase()))
  );
  const mentionsRole = mockICP.job_titles.some(role =>
    words.some(w => role.toLowerCase().includes(w) || w.includes(role.toLowerCase()))
  );

  console.log(`  "${msg}"`);
  console.log(`  → Mentions Industry: ${mentionsIndustry ? '✅' : '❌'}`);
  console.log(`  → Mentions Role: ${mentionsRole ? '✅' : '❌'}`);
  console.log(`  → Type: ${mentionsIndustry || mentionsRole ? 'ICP Search' : 'Validation Needed'}\n`);
});

// Test 3: Health Score Calculation
console.log('\nTest 3: KB Health Score Calculation');

const mockKBs = [
  {
    name: 'Empty KB',
    icpCount: 0,
    totalDocuments: 0,
    criticalSections: 0
  },
  {
    name: 'Partial KB',
    icpCount: 1,
    totalDocuments: 5,
    criticalSections: 2
  },
  {
    name: 'Complete KB',
    icpCount: 2,
    totalDocuments: 20,
    criticalSections: 4
  }
];

mockKBs.forEach(kb => {
  let score = 50;
  if (kb.icpCount > 0) score += 25;
  score += (kb.criticalSections / 4) * 20;
  score += Math.min(kb.totalDocuments, 15);

  const grade = score >= 90 ? 'A' :
                score >= 75 ? 'B' :
                score >= 60 ? 'C' :
                score >= 40 ? 'D' : 'F';

  console.log(`  ${kb.name}:`);
  console.log(`    ICP: ${kb.icpCount}, Docs: ${kb.totalDocuments}, Critical: ${kb.criticalSections}/4`);
  console.log(`    Score: ${score}/100 (Grade: ${grade})\n`);
});

console.log('✅ All tests completed!\n');
console.log('📋 Next Steps:');
console.log('1. Start dev server: npm run dev');
console.log('2. Open SAM conversation');
console.log('3. Type: /kb-health');
console.log('4. Try: "find me VP Sales in SaaS"');
console.log('5. Watch for ICP-aware prompts!\n');
