import assert from 'node:assert'
import { generateLinkedInSequence } from '../lib/templates/sequence-builder'
import type { ICPDiscoveryPayload } from '../lib/icp-discovery/types'

const payload: ICPDiscoveryPayload = {
  target_role: 'VP Sales',
  target_industry: 'SaaS',
  objectives: [
    { description: 'Hit quota consistently', priority: 1, urgency: 'struggling_urgent' }
  ],
  focus_areas: [{ description: 'Coaching reps', priority: 1 }],
  pain_points: [
    { description: 'Reps spending 70% of their week researching', intensity: 'high', cost_type: 'time', cost_detail: 'Leadership reporting suffers when calls drop' }
  ],
  solution_expectations: {
    primary: '70% of rep time focused on selling',
    deliverable: 'yes_confidently'
  },
  customer_language: ['We are underwater on prospecting']
}

const sequence = generateLinkedInSequence(payload)

assert.strictEqual(sequence.messages.length, 8, 'Sequence should contain 8 LinkedIn messages')
assert.ok(sequence.messages[0].body.length <= 300, 'Connection request must respect LinkedIn character limit')
assert.ok(sequence.summary.includes('SaaS'), 'Summary should reference industry')

console.log('✅ Sequence builder test passed')
