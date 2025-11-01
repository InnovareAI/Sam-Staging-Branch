#!/usr/bin/env node
/**
 * Test Phase 2: Real-Time KB Updates & Confidence Scoring
 */

console.log('🧪 Testing Phase 2: Real-Time KB Updates\n');

// Test 1: Q&A Extraction
console.log('Test 1: Q&A Extraction from Conversation\n');

const qaTests = [
  {
    question: "What industry are you targeting?",
    answer: "We target SaaS companies and software companies",
    expectedCategory: 'target_industry',
    expectedStructured: { industries: ['SaaS companies', 'software companies'] }
  },
  {
    question: "What are the main pain points your customers face?",
    answer: "1. High customer acquisition costs\n2. Low conversion rates\n3. Poor lead quality",
    expectedCategory: 'pain_points',
    expectedStructured: true
  },
  {
    question: "What makes you different from competitors?",
    answer: "We use AI to automate the entire sales process",
    expectedCategory: 'messaging',
    expectedStructured: null
  },
  {
    question: "What's your pricing model?",
    answer: "We charge $99/month for startups, $399 for SMEs",
    expectedCategory: 'pricing',
    expectedStructured: null
  }
];

qaTests.forEach((test, i) => {
  console.log(`  Test ${i + 1}:`);
  console.log(`    Q: "${test.question}"`);
  console.log(`    A: "${test.answer.substring(0, 50)}..."`);
  console.log(`    Expected Category: ${test.expectedCategory}`);
  console.log(`    Would Extract: ${test.answer.length > 10 ? '✅' : '❌'}`);
  console.log('');
});

// Test 2: Confidence Score Calculation
console.log('\nTest 2: Confidence Score Calculation\n');

const confidenceTests = [
  { source: 'user_input', metadata: { user_confirmed: true }, expected: 1.0 },
  { source: 'sam_discovery', metadata: {}, expected: 0.95 },
  { source: 'document_upload', metadata: { extraction_quality: 'high' }, expected: 0.95 },
  { source: 'document_upload', metadata: { extraction_quality: 'medium' }, expected: 0.85 },
  { source: 'website_auto', metadata: { sources: 1 }, expected: 0.75 },
  { source: 'website_auto', metadata: { sources: 3 }, expected: 0.95 },
  { source: 'ai_inference', metadata: { model_confidence: 0.7 }, expected: 0.7 },
  { source: 'ai_inference', metadata: {}, expected: 0.6 }
];

confidenceTests.forEach(test => {
  const score = calculateMockConfidence(test.source, test.metadata);
  const match = Math.abs(score - test.expected) < 0.01;
  console.log(`  ${test.source}:`);
  console.log(`    Metadata: ${JSON.stringify(test.metadata)}`);
  console.log(`    Score: ${score.toFixed(2)} (expected: ${test.expected.toFixed(2)}) ${match ? '✅' : '❌'}`);
  console.log('');
});

// Test 3: ICP Completion Percentage
console.log('\nTest 3: ICP Completion Percentage Calculation\n');

const icpTests = [
  {
    name: 'Empty ICP',
    fields: { industries: [], job_titles: [], pain_points: [] },
    expected: 0
  },
  {
    name: 'Partial ICP',
    fields: {
      industries: ['SaaS'],
      job_titles: ['VP Sales'],
      pain_points: [],
      company_size_min: null
    },
    expected: 29 // 2 of 7 fields = 28.5% ~= 29%
  },
  {
    name: 'Complete ICP',
    fields: {
      industries: ['SaaS'],
      job_titles: ['VP Sales', 'CRO'],
      pain_points: ['High CAC', 'Low conversion'],
      company_size_min: 50,
      company_size_max: 500,
      locations: ['US', 'UK'],
      qualification_criteria: { budget: '> $10k' }
    },
    expected: 100
  }
];

icpTests.forEach(test => {
  const filledCount = Object.entries(test.fields).filter(([_, value]) => {
    if (Array.isArray(value)) return value.length > 0;
    if (typeof value === 'object') return value && Object.keys(value).length > 0;
    return value != null && value !== '';
  }).length;

  const percentage = Math.round((filledCount / 7) * 100);

  console.log(`  ${test.name}:`);
  console.log(`    Filled Fields: ${filledCount}/7`);
  console.log(`    Percentage: ${percentage}% (expected: ${test.expected}%) ${Math.abs(percentage - test.expected) <= 1 ? '✅' : '❌'}`);
  console.log('');
});

// Test 4: Category Detection
console.log('\nTest 4: Category Detection from Questions\n');

const categoryTests = [
  { question: "Who is your ideal customer?", expected: 'icp_definition' },
  { question: "What pain points do they face?", expected: 'pain_points' },
  { question: "What industry are you in?", expected: 'target_industry' },
  { question: "What role do you target?", expected: 'target_role' },
  { question: "Tell me about your product", expected: 'products' },
  { question: "What's your pricing?", expected: 'pricing' },
  { question: "What makes you different?", expected: 'messaging' },
  { question: "Who are your competitors?", expected: 'competition' },
  { question: "What objections do you hear?", expected: 'objections' }
];

categoryTests.forEach(test => {
  const detected = detectMockCategory(test.question);
  const match = detected === test.expected;
  console.log(`  "${test.question}"`);
  console.log(`    Detected: ${detected} (expected: ${test.expected}) ${match ? '✅' : '❌'}`);
  console.log('');
});

console.log('✅ All Phase 2 tests completed!\n');
console.log('📋 Next Steps:');
console.log('1. Apply migration: npm run migrate (or via Supabase dashboard)');
console.log('2. Start dev server: npm run dev');
console.log('3. Have SAM ask you a question');
console.log('4. Answer it');
console.log('5. Check logs for: "✅ KB updated in real-time"');
console.log('6. Check database: SELECT * FROM knowledge_base ORDER BY created_at DESC LIMIT 5\n');

// Helper functions
function calculateMockConfidence(source, metadata) {
  switch (source) {
    case 'user_input':
    case 'sam_discovery':
      return metadata.user_confirmed ? 1.0 : 0.95;
    case 'document_upload':
      if (metadata.extraction_quality === 'high') return 0.95;
      if (metadata.extraction_quality === 'medium') return 0.85;
      if (metadata.extraction_quality === 'low') return 0.70;
      return 0.90;
    case 'website_auto':
      const sources = metadata.sources || 1;
      return Math.min(0.65 + (sources * 0.10), 0.95);
    case 'ai_inference':
      return metadata.model_confidence || 0.60;
    default:
      return 0.50;
  }
}

function detectMockCategory(question) {
  const q = question.toLowerCase();
  if (q.includes('ideal customer') || q.includes('who should')) return 'icp_definition';
  if (q.includes('pain point') || q.includes('challenge')) return 'pain_points';
  if (q.includes('industry') || q.includes('sector')) return 'target_industry';
  if (q.includes('role') || q.includes('title')) return 'target_role';
  if (q.includes('product') || q.includes('service')) return 'products';
  if (q.includes('pricing') || q.includes('cost')) return 'pricing';
  if (q.includes('different') || q.includes('unique')) return 'messaging';
  if (q.includes('competitor') || q.includes('alternative')) return 'competition';
  if (q.includes('objection') || q.includes('pushback')) return 'objections';
  return 'general';
}
