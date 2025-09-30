import assert from 'node:assert'
import { mapDiscoveryToProspect } from '../app/lib/template-selection-engine'
import type { ICPDiscoveryPayload } from '../lib/icp-discovery/types'

type Prospect = ReturnType<typeof mapDiscoveryToProspect>

const payload: ICPDiscoveryPayload = {
  target_role: 'VP Sales',
  target_industry: 'SaaS',
  company_stage: 'Series A (50-150 employees)',
  objectives: [
    { description: 'Hit quota consistently', priority: 1, urgency: 'struggling_urgent' }
  ],
  focus_areas: [
    { description: 'Coaching reps', priority: 1 }
  ],
  pain_points: [
    { description: 'Reps spending 70% of time on research', intensity: 'high', cost_type: 'time', cost_detail: 'Losing 20 hours/week' }
  ],
  solution_expectations: {
    primary: 'Flip to 70% selling / 30% prospecting',
    deliverable: 'yes_confidently'
  }
}

const prospect: Prospect = mapDiscoveryToProspect(payload)

assert.strictEqual(prospect.job_title, 'VP Sales', 'Job title should map through from payload')
assert.strictEqual(prospect.industry, 'saas', 'Industry should normalize to lowercase for template engine')
assert.ok((prospect.pain_points || []).includes('Reps spending 70% of time on research'), 'Primary pain point should propagate to template engine input')

console.log('✅ ICP discovery mapping test passed')
