import type { ICPDiscoveryPayload } from '@/lib/icp-discovery/types';
import { IndustryBlueprint, INDUSTRY_BLUEPRINTS, findBlueprintByIndustry } from './industry-blueprints';

export interface SequenceMessage {
  step: number;
  label: string;
  dayOffset: number;
  body: string;
  personalizationNotes: string[];
  characterCount: number;
}

export interface GeneratedSequence {
  blueprint: IndustryBlueprint;
  personaKey: string;
  summary: string;
  messages: SequenceMessage[];
  recommendedCTA: string;
}

const CONNECTION_LIMIT = 275;
const MESSAGE_LIMIT = 1000;

export function generateLinkedInSequence(
  payload: ICPDiscoveryPayload,
  overrides?: { industryCode?: string; personaKey?: string }
): GeneratedSequence {
  const blueprint = resolveBlueprint(payload, overrides?.industryCode);
  const persona = resolvePersona(blueprint, payload, overrides?.personaKey);

  const primaryObjective = payload.objectives?.[0]?.description || persona.outcomes[0] || blueprint.hook;
  const primaryPain = payload.pain_points?.[0]?.description || persona.painPoints[0] || blueprint.hook;
  const costDetail = payload.pain_points?.[0]?.cost_detail || blueprint.whyItMatters;
  const expectation = payload.solution_expectations?.primary || persona.outcomes[0];
  const longTerm = payload.long_term_desire || primaryObjective;
  const language = payload.customer_language?.[0] || blueprint.commonLanguage[0];
  const dailyFrustration = payload.frustrations?.daily?.[0] || primaryPain;
  const breakdownScenario = payload.frustrations?.breakdown_scenario;
  const primaryObjection = payload.objections?.[0];
  const fear = payload.fears?.[0];
  const implicationChain = payload.implications?.chain?.length ? payload.implications.chain.join(' → ') : undefined;
  const disappointment = payload.disappointments?.past_solutions?.[0];
  const pastFailure = payload.past_failures?.[0];
  const skepticism = payload.disappointments?.skepticism_level;

  const messages: SequenceMessage[] = [];

  const connectionBody = buildConnectionRequest(persona, primaryPain, expectation);
  messages.push({
    step: 1,
    label: 'Connection Request',
    dayOffset: 0,
    body: connectionBody.slice(0, CONNECTION_LIMIT),
    personalizationNotes: [
      'Reference mutual context (funding, mutual connection, recent post).',
      `Keep under ${CONNECTION_LIMIT} characters.`,
      'Swap {pain} with the exact language you captured during discovery.'
    ],
    characterCount: connectionBody.slice(0, CONNECTION_LIMIT).length
  });

  messages.push({
    step: 2,
    label: 'Hook / Problem',
    dayOffset: 2,
    body: buildHookMessage(persona, primaryPain, dailyFrustration, costDetail, blueprint),
    personalizationNotes: [
      'Swap the first sentence with a note about their company stage or focus area.',
      'Tie the pain directly to numbers if you have them.'
    ],
    characterCount: buildHookMessage(persona, primaryPain, dailyFrustration, costDetail, blueprint).length
  });

  messages.push({
    step: 3,
    label: 'Case Study',
    dayOffset: 5,
    body: buildCaseStudyMessage(blueprint, primaryPain, expectation, implicationChain),
    personalizationNotes: [
      'Mention a relevant client or peer if you have one.',
      'Highlight the outcome that matches their success criteria.'
    ],
    characterCount: buildCaseStudyMessage(blueprint, primaryPain, expectation, implicationChain).length
  });

  messages.push({
    step: 4,
    label: 'Demo / Loom Invite',
    dayOffset: 10,
    body: buildDemoMessage(primaryPain, expectation, primaryObjection, disappointment, pastFailure),
    personalizationNotes: [
      'Add link to calendar or Loom demo.',
      'Acknowledge they are busy—respectful tone wins.'
    ],
    characterCount: buildDemoMessage(primaryPain, expectation, primaryObjection, disappointment, pastFailure).length
  });

  messages.push({
    step: 5,
    label: 'Irresistible Offer',
    dayOffset: 16,
    body: buildOfferMessage(primaryPain, expectation, fear),
    personalizationNotes: ['If you have a free trial or audit, link it here.'],
    characterCount: buildOfferMessage(primaryPain, expectation, fear).length
  });

  messages.push({
    step: 6,
    label: 'Nudge / Social Proof',
    dayOffset: 25,
    body: buildNudgeMessage(blueprint, fear),
    personalizationNotes: ['Update numbers with fresh successes if available.'],
    characterCount: buildNudgeMessage(blueprint, fear).length
  });

  messages.push({
    step: 7,
    label: 'Alternative CTA',
    dayOffset: 35,
    body: buildAltCTAMessage(blueprint, disappointment, skepticism),
    personalizationNotes: [
      'Attach the mentioned resource if you have it.',
      'Offer a low-friction next step like a calculator or template.'
    ],
    characterCount: buildAltCTAMessage(blueprint, disappointment, skepticism).length
  });

  messages.push({
    step: 8,
    label: 'Goodbye / Opt-out',
    dayOffset: 45,
    body: buildGoodbyeMessage(longTerm, language, breakdownScenario),
    personalizationNotes: ['Always include a respectful opt-out line.'],
    characterCount: buildGoodbyeMessage(longTerm, language, breakdownScenario).length
  });

  const summary = `Targeting ${persona.description} in ${blueprint.industry}. Lead with “${primaryPain}”, solve daily frustration “${dailyFrustration}”, and promise “${expectation}.” Objection to pre-handle: ${primaryObjection?.objection || 'budget/priority'}.`;

  return {
    blueprint,
    personaKey: persona.key,
    summary,
    messages,
    recommendedCTA: expectation
  };
}

function resolveBlueprint(payload: ICPDiscoveryPayload, overrideCode?: string): IndustryBlueprint {
  if (overrideCode) {
    const preset = INDUSTRY_CODE_LOOKUP[overrideCode];
    if (preset) return preset;
  }
  if (payload.target_industry) {
    const match = findBlueprintByIndustry(payload.target_industry);
    if (match) return match;
  }
  if (payload.campaign_type && findBlueprintByIndustry(payload.campaign_type)) {
    return findBlueprintByIndustry(payload.campaign_type)!;
  }
  return INDUSTRY_CODE_LOOKUP['saas'];
}

function resolvePersona(blueprint: IndustryBlueprint, payload: ICPDiscoveryPayload, overrideKey?: string) {
  if (overrideKey) {
    const existing = blueprint.personas.find(p => p.key === overrideKey);
    if (existing) return existing;
  }
  if (payload.target_role) {
    const lower = payload.target_role.toLowerCase();
    const match = blueprint.personas.find(persona =>
      persona.titleVariations.some(variation => lower.includes(variation.toLowerCase()))
    );
    if (match) return match;
  }
  return blueprint.personas.find(p => p.key === blueprint.defaultPersona) || blueprint.personas[0];
}

function buildConnectionRequest(persona: { description: string; painPoints: string[] }, pain: string, expectation: string) {
  const line = `Hey {{first_name}}, I help ${persona.description.toLowerCase()} swap “${pain}” for ${expectation.toLowerCase()}. Worth connecting?`;
  return line;
}

function buildHookMessage(
  persona: { description: string; painPoints: string[]; outcomes: string[] },
  pain: string,
  dailyFrustration: string,
  costDetail: string,
  blueprint: IndustryBlueprint
) {
  return [
    `Hey {{first_name}}, most ${persona.description.toLowerCase()} I talk to are dealing with ${pain}.`,
    `Day to day it feels like: ${dailyFrustration}.`,
    costDetail,
    `We built Sam to fix it: ${blueprint.solutionOneLiner}`,
    'If that is on your radar, happy to walk you through how other teams solved it. If not, no worries.'
  ].filter(Boolean).join('\n\n');
}

function buildCaseStudyMessage(blueprint: IndustryBlueprint, pain: string, expectation: string, implicationChain?: string) {
  const proof = blueprint.proof;
  return [
    `Thought this might be relevant.`,
    `We partnered with a ${proof.label} who struggled with “${pain}.”`,
    `Before: ${proof.before}.`,
    `After: ${proof.after}.`,
    proof.metrics.map(metric => `• ${metric}`).join('\n'),
    implicationChain ? `It stopped the spiral of ${implicationChain}.` : '',
    `Want me to break down how they reached ${expectation.toLowerCase()}?`
  ].filter(Boolean).join('\n\n');
}

function buildDemoMessage(
  pain: string,
  expectation: string,
  objection?: { objection: string; response?: string; real_reason?: string; type: string },
  disappointment?: { solution: string; disappointment: string },
  pastFailure?: { failure: string; impact: string; differentiation?: string }
) {
  return [
    `I know you get pitches all the time, so I'll keep it direct.`,
    `We help teams stop “${pain}” and hit ${expectation.toLowerCase()} without adding headcount.`,
    objection ? `Most people push back with “${objection.objection}.” We handle it by ${objection.response || objection.real_reason || 'showing the math so it pays for itself'}.` : '',
    disappointment ? `Saw teams burned by ${disappointment.solution} because ${disappointment.disappointment}. We took the opposite route (quality over volume).` : '',
    pastFailure ? `Also—no spam. ${pastFailure.failure} happened to a few folks, so we built safeguards (${pastFailure.differentiation || 'human review before anything sends'}).` : '',
    `If you want the 15-minute walkthrough, grab a slot here: {{calendar_link}}`,
    'If the timing is off, shoot me a “not now” and I’ll circle back later.'
  ].filter(Boolean).join('\n\n');
}

function buildOfferMessage(pain: string, expectation: string, fear?: { fear: string; timeline: string }) {
  return [
    `Since I haven’t heard back, I’m guessing it’s either timing or proof.`,
    `If it’s proof: here’s the 14-day trial / audit so you can see whether ${expectation.toLowerCase()} happens in your world: {{offer_link}}`,
    fear ? `If it’s timing, reply “later” and I’ll park it. If it’s neither, I’d hate for “${fear.fear.toLowerCase()}” to pop up because we waited.` : `If it’s timing, reply “later” and I’ll park it. If it’s neither, tell me to stop and I will.`
  ].filter(Boolean).join('\n\n');
}

function buildNudgeMessage(blueprint: IndustryBlueprint, fear?: { fear: string; timeline: string }) {
  return [
    `Quick note: in the last couple of weeks ${blueprint.industry} teams like yours started using Sam for the same problem.`,
    blueprint.proof.metrics.length ? `Highlights: ${blueprint.proof.metrics.join(', ')}.` : '',
    fear ? `They wanted to get ahead of “${fear.fear.toLowerCase()}” before it bit them.` : '',
    `No pressure at all—just didn’t want you to miss the window if it’s on the roadmap.`
  ].filter(Boolean).join('\n\n');
}

function buildAltCTAMessage(
  blueprint: IndustryBlueprint,
  disappointment?: { solution: string; disappointment: string },
  skepticism?: string
) {
  const resource = blueprint.freeResource;
  return [
    'Last thing from me.',
    resource
      ? `I pulled together a ${resource.title} that helps with the exact pain you mentioned. I’ll leave it here: {{resource_link}}`
      : 'I wrote up a quick checklist that teams use to fix this on their own—I’m happy to send it if helpful.',
    disappointment ? `It’s built for teams who were burned by ${disappointment.solution.toLowerCase()} so you can pressure-test us without risk.` : '',
    skepticism ? `Since you’re ${skepticism.replace('_', ' ')} about new vendors, this keeps it low-stakes.` : '',
    'Use it whenever you want, and if you ever want to compare notes live just ping me.'
  ].filter(Boolean).join('\n\n');
}

function buildGoodbyeMessage(longTerm: string, language: string, breakdownScenario?: string) {
  return [
    `Since I haven’t heard back, I’ll close the loop.`,
    `If ${longTerm.toLowerCase()} is still on your mind later, save this message.` ,
    breakdownScenario ? `Keeping an eye on ${breakdownScenario.toLowerCase()} anyway—happy to revisit if it spikes again.` : '',
    `And if I missed the mark, just reply “${language.toLowerCase() || 'stop'}” and I’ll bow out cleanly.`
  ].filter(Boolean).join('\n\n');
}

const INDUSTRY_CODE_LOOKUP: Record<string, IndustryBlueprint> = INDUSTRY_BLUEPRINTS;
