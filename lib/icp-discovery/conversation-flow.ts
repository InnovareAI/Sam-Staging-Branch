import { SaveDiscoveryInput } from './types';
import { ICPDiscoverySession, ICPDiscoveryPayload, ICPFearTimeline, ICPDisappointments } from './types';

export type DiscoveryFlowResult = {
  prompt: string;
  saveInput?: SaveDiscoveryInput;
  completed?: boolean;
  summaryPrompt?: string;
  shallowFlag?: boolean;
  redFlag?: string;
};

export type DiscoveryQuestionId =
  | 'basic_icp'
  | 'objectives'
  | 'objective_urgency'
  | 'focus_areas'
  | 'focus_positioning'
  | 'long_term_desire'
  | 'long_term_alignment'
  | 'pain_points'
  | 'pain_cost'
  | 'current_solution'
  | 'current_solution_gap'
  | 'solution_expectation'
  | 'solution_deliverable'
  | 'customer_language'
  | 'objections_list'
  | 'objection_primary_type'
  | 'objection_primary_response'
  | 'frustrations_daily'
  | 'frustrations_breakdown'
  | 'fears_primary'
  | 'fears_timeline'
  | 'fears_realized'
  | 'implications_chain'
  | 'implications_confirm'
  | 'disappointments_past'
  | 'disappointments_skepticism'
  | 'failures_history'
  | 'failures_differentiation'
  | 'roadblocks_summary'
  | 'summary_validation';

export const DISCOVERY_QUESTIONS: DiscoveryQuestionId[] = [
  'basic_icp',
  'objectives',
  'objective_urgency',
  'focus_areas',
  'focus_positioning',
  'long_term_desire',
  'long_term_alignment',
  'pain_points',
  'pain_cost',
  'current_solution',
  'current_solution_gap',
  'solution_expectation',
  'solution_deliverable',
  'customer_language',
  'objections_list',
  'objection_primary_type',
  'objection_primary_response',
  'frustrations_daily',
  'frustrations_breakdown',
  'fears_primary',
  'fears_timeline',
  'fears_realized',
  'implications_chain',
  'implications_confirm',
  'disappointments_past',
  'disappointments_skepticism',
  'failures_history',
  'failures_differentiation',
  'roadblocks_summary',
  'summary_validation'
];

const GENERIC_RESPONSES = [
  'increase sales',
  'grow revenue',
  'be more efficient',
  'generate leads',
  'improve marketing',
  'not sure',
  "i don't know",
  'no idea'
];

function getCurrentQuestion(payload: ICPDiscoveryPayload): DiscoveryQuestionId | null {
  const id = (payload as any)?.current_question_id as DiscoveryQuestionId | undefined;
  return id ?? null;
}

function getNextQuestionId(current: DiscoveryQuestionId | null): DiscoveryQuestionId {
  if (!current) return DISCOVERY_QUESTIONS[0];
  const index = DISCOVERY_QUESTIONS.indexOf(current);
  return DISCOVERY_QUESTIONS[index + 1] ?? 'summary_validation';
}

function isShallow(answer: string): boolean {
  if (!answer) return true;
  const normalized = answer.trim().toLowerCase();
  if (normalized.length < 20) return true;
  return GENERIC_RESPONSES.some(resp => normalized.includes(resp));
}

function splitList(answer: string): string[] {
  const lines = answer
    .split(/\n|\r|,/)
    .map(item => item.trim())
    .filter(Boolean);
  return lines.slice(0, 5);
}

export function initialDiscoveryPrompt(): { prompt: string; nextQuestion: DiscoveryQuestionId; payload: Partial<ICPDiscoveryPayload> } {
  const prompt = `Before we create your campaign, I need to understand your ICP at a deeper level than just title and industry. This takes about 10 minutes, but it’s the difference between messages that get ignored and messages that get replies.\n\nThink like your ideal customer for a minute—their frustrations, what they care about, how they talk about problems.\n\nFirst, give me a one-sentence description of your ideal customer. Include:\n- Role/title (e.g. VP Sales, Founder)\n- Industry (e.g. FinTech, Manufacturing)\n- Company stage/size (e.g. Series A, 50-200 employees)`;

  return {
    prompt,
    nextQuestion: 'basic_icp',
    payload: {
      current_question_id: 'basic_icp' as any
    } as any
  };
}

export function handleDiscoveryAnswer(answer: string, session: ICPDiscoverySession | null): DiscoveryFlowResult {
  const payload = (session?.discovery_payload || {}) as ICPDiscoveryPayload & { current_question_id?: DiscoveryQuestionId };
  const currentQuestion = getCurrentQuestion(payload);
  const shallow = isShallow(answer);
  const nextQuestion = getNextQuestionId(currentQuestion);
  const updates: Partial<ICPDiscoveryPayload> = {};
  const phasesCompleted = new Set<string>(session?.phases_completed ?? []);
  let redFlag: string | undefined;
  let customPrompt: string | undefined;

  switch (currentQuestion) {
    case 'basic_icp': {
      updates.target_role = answer;
      phasesCompleted.add('basic_icp');
      break;
    }
    case 'objectives': {
      const items = splitList(answer).map((item, index) => ({
        description: item,
        priority: index + 1,
        urgency: 'should_do' as const
      }));
      updates.objectives = items;
      phasesCompleted.add('objectives');
      break;
    }
    case 'objective_urgency': {
      if (payload.objectives?.length) {
        const normalized = answer.trim().toLowerCase();
        let urgency: 'thriving_improve' | 'struggling_urgent' | 'should_do' = 'should_do';
        if (normalized.startsWith('a')) urgency = 'thriving_improve';
        else if (normalized.startsWith('b')) urgency = 'struggling_urgent';
        else if (normalized.startsWith('c')) urgency = 'should_do';

        updates.objectives = payload.objectives.map(obj =>
          obj.priority === 1 ? { ...obj, urgency } : obj
        );
      }
      phasesCompleted.add('objective_urgency');
      break;
    }
    case 'focus_areas': {
      updates.focus_areas = splitList(answer).map((item, index) => ({
        description: item,
        priority: index + 1
      }));
      phasesCompleted.add('focus_areas');
      break;
    }
    case 'focus_positioning': {
      updates.positioning = {
        ...(payload.positioning || {}),
        differentiation_hook: answer
      };
      phasesCompleted.add('focus_positioning');
      break;
    }
    case 'long_term_desire': {
      updates.long_term_desire = answer.trim();
      phasesCompleted.add('long_term_desire');
      break;
    }
    case 'long_term_alignment': {
      const normalized = answer.trim().toLowerCase();
      updates.positioning = {
        ...(payload.positioning || {}),
        expected_outcome: normalized.startsWith('a') ? 'Directly supports long-term desire' : normalized.startsWith('b') ? 'Strategic stepping stone' : 'Tactical improvement'
      };
      phasesCompleted.add('long_term_alignment');
      break;
    }
    case 'pain_points': {
      const pains = splitList(answer).map((item, index) => ({
        description: item,
        intensity: index === 0 ? 'high' : index === 1 ? 'medium' : 'low',
        cost_type: 'opportunity'
      }));
      updates.pain_points = pains;
      if (pains.length) {
        updates.positioning = {
          ...(payload.positioning || {}),
          primary_pain_point: pains[0].description
        };
      }
      phasesCompleted.add('pain_points');
      break;
    }
    case 'pain_cost': {
      const normalized = answer.trim().toLowerCase();
      const type = normalized.startsWith('a')
        ? 'money'
        : normalized.startsWith('b')
        ? 'time'
        : normalized.startsWith('c')
        ? 'opportunity'
        : 'emotional';
      if (payload.pain_points?.length) {
        updates.pain_points = payload.pain_points.map((pain, index) =>
          index === 0 ? { ...pain, cost_type: type, cost_detail: answer } : pain
        );
      }
      updates.positioning = {
        ...(payload.positioning || {}),
        cost_impact: answer.trim()
      };
      phasesCompleted.add('pain_cost');
      break;
    }
    case 'current_solution': {
      updates.current_solution = {
        ...(payload.current_solution || {}),
        approach: answer.trim()
      };
      phasesCompleted.add('current_solution');
      break;
    }
    case 'current_solution_gap': {
      updates.current_solution = {
        ...(payload.current_solution || {}),
        why_fails: answer.trim(),
        gap: answer.trim()
      };
      updates.positioning = {
        ...(payload.positioning || {}),
        differentiation_hook: answer.trim()
      };
      phasesCompleted.add('current_solution_gap');
      break;
    }
    case 'solution_expectation': {
      updates.solution_expectations = {
        ...(payload.solution_expectations || {}),
        primary: answer.trim(),
        deliverable: payload.solution_expectations?.deliverable ?? 'depends'
      };
      phasesCompleted.add('solution_expectation');
      break;
    }
    case 'solution_deliverable': {
      const normalized = answer.trim().toLowerCase();
      let deliverable: 'yes_confidently' | 'depends' | 'sometimes' | 'no' = 'depends';
      if (normalized.startsWith('a')) deliverable = 'yes_confidently';
      else if (normalized.startsWith('b')) deliverable = 'depends';
      else if (normalized.startsWith('c')) deliverable = 'sometimes';
      else if (normalized.startsWith('d')) deliverable = 'no';

      updates.solution_expectations = {
        ...(payload.solution_expectations || {}),
        deliverable
      };
      if (deliverable === 'no') {
        redFlag = 'Expectation cannot be confidently met';
      }
      phasesCompleted.add('solution_deliverable');
      break;
    }
    case 'customer_language': {
      updates.customer_language = splitList(answer).map(item => item.replace(/^[-•\d\.\)\s]+/, ''));
      phasesCompleted.add('customer_language');
      break;
    }
    case 'objections_list': {
      const items = splitList(answer);
      updates.objections = items.map((item, index) => ({
        objection: item,
        priority: index + 1,
        type: 'real' as const
      }));
      phasesCompleted.add('objections_list');
      break;
    }
    case 'objection_primary_type': {
      if (payload.objections?.length) {
        const normalized = answer.trim().toLowerCase();
        let type: 'real' | 'smoke_screen' | 'mix' = 'real';
        if (normalized.startsWith('a')) type = 'real';
        else if (normalized.startsWith('b')) type = 'smoke_screen';
        else if (normalized.startsWith('c')) type = 'mix';
        updates.objections = payload.objections.map(obj =>
          obj.priority === 1 ? { ...obj, type } : obj
        );
      }
      phasesCompleted.add('objection_primary_type');
      break;
    }
    case 'objection_primary_response': {
      if (payload.objections?.length) {
        const response = answer.trim();
        updates.objections = payload.objections.map(obj =>
          obj.priority === 1
            ? obj.type === 'smoke_screen'
              ? { ...obj, real_reason: response }
              : { ...obj, response }
            : obj
        );
      }
      phasesCompleted.add('objection_primary_response');
      break;
    }
    case 'frustrations_daily': {
      updates.frustrations = {
        ...(payload.frustrations || {}),
        daily: splitList(answer)
      };
      phasesCompleted.add('frustrations_daily');
      break;
    }
    case 'frustrations_breakdown': {
      updates.frustrations = {
        ...(payload.frustrations || {}),
        breakdown_scenario: answer.trim()
      };
      phasesCompleted.add('frustrations_breakdown');
      break;
    }
    case 'fears_primary': {
      const fears = splitList(answer);
      updates.fears = fears.map(item => ({
        fear: item,
        timeline: 'future' as const
      }));
      phasesCompleted.add('fears_primary');
      break;
    }
    case 'fears_timeline': {
      const normalized = answer.trim().toLowerCase();
      let timeline: ICPFearTimeline = 'future';
      if (normalized.startsWith('a')) timeline = 'immediate';
      else if (normalized.startsWith('b')) timeline = 'future';
      else if (normalized.startsWith('c')) timeline = 'existential';
      updates.fears = (payload.fears || []).map((fear, index) =>
        index === 0 ? { ...fear, timeline } : fear
      );
      phasesCompleted.add('fears_timeline');
      break;
    }
    case 'fears_realized': {
      updates.fears = (payload.fears || []).map((fear, index) =>
        index === 0 ? { ...fear, realized_when: answer.trim() } : fear
      );
      phasesCompleted.add('fears_realized');
      break;
    }
    case 'implications_chain': {
      updates.implications = {
        chain: splitList(answer)
      };
      phasesCompleted.add('implications_chain');
      break;
    }
    case 'implications_confirm': {
      updates.implications = {
        ...(payload.implications || { chain: [] }),
        ultimate_outcome: answer.trim()
      };
      phasesCompleted.add('implications_confirm');
      break;
    }
    case 'disappointments_past': {
      const items = splitList(answer).map(line => {
        const [solution, disappointment] = line.split(' - ');
        if (disappointment) {
          return { solution: solution.trim(), disappointment: disappointment.trim() };
        }
        return { solution: 'Previous solution', disappointment: line };
      });
      updates.disappointments = {
        past_solutions: items,
        skepticism_level: payload.disappointments?.skepticism_level ?? 'cautiously_optimistic'
      };
      phasesCompleted.add('disappointments_past');
      break;
    }
    case 'disappointments_skepticism': {
      const normalized = answer.trim().toLowerCase();
      let level: ICPDisappointments['skepticism_level'] = 'cautiously_optimistic';
      if (normalized.startsWith('a')) level = 'very_cynical';
      else if (normalized.startsWith('b')) level = 'cautiously_optimistic';
      else if (normalized.startsWith('c')) level = 'open_minded';
      else if (normalized.startsWith('d')) level = 'varies';
      updates.disappointments = {
        ...(payload.disappointments || { past_solutions: [] }),
        skepticism_level: level
      };
      phasesCompleted.add('disappointments_skepticism');
      break;
    }
    case 'failures_history': {
      const normalized = answer.trim().toLowerCase();
      if (normalized === 'none' || normalized.includes('none')) {
        updates.past_failures = [];
      } else {
        updates.past_failures = splitList(answer).map(item => ({
          failure: item,
          impact: 'Not specified'
        }));
      }
      phasesCompleted.add('failures_history');
      break;
    }
    case 'failures_differentiation': {
      if (payload.past_failures && payload.past_failures.length) {
        updates.past_failures = payload.past_failures.map((failure, index) =>
          index === 0 ? { ...failure, differentiation: answer.trim() } : failure
        );
      }
      phasesCompleted.add('failures_differentiation');
      const previewPayload: ICPDiscoveryPayload = {
        ...payload,
        ...updates,
        objections: updates.objections ?? payload.objections,
        frustrations: updates.frustrations ?? payload.frustrations,
        fears: updates.fears ?? payload.fears,
        implications: updates.implications ?? payload.implications,
        disappointments: updates.disappointments ?? payload.disappointments,
        past_failures: updates.past_failures ?? payload.past_failures
      };
      customPrompt = buildRoadblockSummary(previewPayload);
      break;
    }
    case 'roadblocks_summary': {
      phasesCompleted.add('roadblocks_summary');
      break;
    }
    case 'summary_validation': {
      const normalized = answer.trim().toLowerCase();
      if (normalized.includes('no') || normalized.includes('change')) {
        redFlag = 'Summary requires adjustments';
      }
      phasesCompleted.add('summary_validation');
      break;
    }
    default: {
      break;
    }
  }

  updates.current_question_id = nextQuestion as any;

  const prompts: Record<DiscoveryQuestionId, string> = {
    basic_icp: '',
    objectives: `Got it. Now think about their business objectives. What are the top three things they’re trying to achieve right now? List them in order of importance.`,
    objective_urgency: `You said their #1 objective is "${payload.objectives?.[0]?.description || 'that objective'}". How urgent is this?\nA) They’re doing okay but want to improve\nB) They’re struggling and need to fix it urgently\nC) They know it matters but keep putting it off`,
    focus_areas: `Let’s drop into their day-to-day world. What are they actually spending their time on each week? List the top three areas that eat their calendar.`,
    focus_positioning: `Does what you do help them with those focus areas directly, or does it remove other work so they can focus on them?`,
    long_term_desire: `Zoom out—what do they secretly want long-term? The ambition they think about at 11pm.`,
    long_term_alignment: `Does your solution help them reach that ambition directly, act as a stepping stone, or mostly solve a tactical problem? (A/B/C)`,
    pain_points: `Let’s capture what’s frustrating them. List the top three pains they complain about, starting with the one that keeps them up at night.`,
    pain_cost: `What does that top frustration cost them?\nA) Money\nB) Time\nC) Missed opportunities\nD) Stress / team morale`,
    current_solution: `Before they talk to you, how are they trying to solve it today? Manual work, a tool, hiring, ignoring it?`,
    current_solution_gap: `Why isn’t that working for them? What’s the gap or failure point that makes them open to change?`,
    solution_expectation: `When they evaluate something new (like you), what’s the one outcome they expect if it’s going to be worth it?`,
    solution_deliverable: `Can you deliver that today?\nA) Yes, confidently\nB) Yes, but depends on their setup\nC) Sometimes, not always\nD) Not really`,
    customer_language: `Last thing—what exact phrases do they use when they vent about this? Give me 3-5 real quotes or paraphrases.`,
    objections_list: `Now, what objections pop up when they hear about solutions like yours? List the top three you run into most.`,
    objection_primary_type: `That top objection—do you think it’s a real blocker or more of a smoke screen?\nA) Real concern\nB) Mostly a smoke screen\nC) Mix of both`,
    objection_primary_response: `How do you usually answer that objection or uncover what’s really behind it?`,
    frustrations_daily: `Even when their current setup “works,” what annoys them day to day? List the things they’re sick of dealing with.`,
    frustrations_breakdown: `And when it breaks, what’s the nightmare scenario that sends everyone into panic mode?`,
    fears_primary: `What are they actually afraid of if this problem keeps getting worse? List the top fears.`,
    fears_timeline: `Is that fear something they’re staring down now, later, or existential?\nA) Immediate (this quarter)\nB) Future concern\nC) Existential / company-level`,
    fears_realized: `When does that fear become real? What’s the trigger point?`,
    implications_chain: `Walk me through the ripple effects. If this problem sticks around, what happens next? List the chain reaction.`,
    implications_confirm: `Does that chain look right—or is there another consequence I should highlight?`,
    disappointments_past: `Have they tried solving this before? List past attempts and what disappointed them (Tool - what went wrong).`,
    disappointments_skepticism: `After those experiences, how skeptical are they now?\nA) Very cynical\nB) Cautiously optimistic\nC) Open-minded\nD) Depends on the person`,
    failures_history: `Any outright horror stories where a past attempt made things worse? If none, just say “none.”`,
    failures_differentiation: `How do you make sure you don’t repeat that failure? What’s different about your approach?`,
    roadblocks_summary: '',
    summary_validation: `I’ll summarize everything after this. Anything else I should know before we roll into the campaign?`
  };

  const isCompleted = currentQuestion === 'summary_validation';
  const prompt = customPrompt ?? (isCompleted ? '' : prompts[nextQuestion]);

  const saveInput: SaveDiscoveryInput = {
    sessionId: session?.id || '',
    payload: updates,
    phasesCompleted: Array.from(phasesCompleted),
    shallowDelta: shallow ? 1 : 0
  };

  return {
    prompt,
    saveInput,
    shallowFlag: shallow,
    redFlag,
    completed: isCompleted
  };
}

export function getSummaryPrompt(payload: ICPDiscoveryPayload): string {
  const role = payload.target_role || 'Unknown role';
  const industry = payload.target_industry || 'Unknown industry';
  const objective = payload.objectives?.[0]?.description || 'Not captured';
  const focus = payload.focus_areas?.[0]?.description || 'Not captured';
  const pain = payload.pain_points?.[0]?.description || 'Not captured';
  const current = payload.current_solution?.approach || 'Unknown';
  const gap = payload.current_solution?.why_fails || payload.current_solution?.gap || 'Not captured';
  const expectation = payload.solution_expectations?.primary || 'Not captured';
  const language = payload.customer_language?.slice(0, 3).map(item => `• "${item}"`).join('\n') || '• No customer language recorded';
  const objections = payload.objections?.slice(0, 3).map(obj => `• ${obj.objection} → ${obj.response || obj.real_reason || 'Need response'}`).join('\n') || '• Not captured';
  const frustrations = payload.frustrations?.daily?.slice(0, 2).map(item => `• ${item}`).join('\n') || '• Not captured';
  const breakdown = payload.frustrations?.breakdown_scenario ? `• ${payload.frustrations.breakdown_scenario}` : '• Not captured';
  const fearLines = payload.fears?.slice(0, 2).map(fear => `• ${fear.fear} (${fear.timeline})`).join('\n') || '• Not captured';
  const implicationLines = payload.implications?.chain?.slice(0, 3).map(item => `• ${item}`).join('\n') || '• Not captured';
  const disappointments = payload.disappointments?.past_solutions?.slice(0, 2).map(item => `• Tried ${item.solution} → ${item.disappointment}`).join('\n') || '• Not captured';
  const skepticism = payload.disappointments?.skepticism_level ? payload.disappointments.skepticism_level.replace('_', ' ') : 'not captured';
  const failureLines = payload.past_failures?.length
    ? payload.past_failures.slice(0, 1).map(f => `• ${f.failure} (impact: ${f.impact})`).join('\n')
    : '• None noted';

  return `Here’s what I’ve captured so far:\n\n**WHO:** ${role} at ${industry}\n**OBJECTIVE:** ${objective}\n**FOCUS:** ${focus}\n**PAIN:** ${pain}\n**CURRENT SOLUTION:** ${current} (fails because ${gap})\n**EXPECTATION:** ${expectation}\n\n**HOW THEY TALK ABOUT IT:**\n${language}\n\n**ROADBLOCKS WE MUST ADDRESS:**\n${objections}\n\n**DAILY FRUSTRATIONS:**\n${frustrations}\n\n**BREAKDOWN NIGHTMARE:**\n${breakdown}\n\n**FEARS:**\n${fearLines}\n\n**IMPLICATIONS:**\n${implicationLines}\n\n**PAST DISAPPOINTMENTS (skepticism: ${skepticism}):**\n${disappointments}\n\n**PAST FAILURES:**\n${failureLines}\n\nDoes this nail everything, or should we adjust before I move into the sequence?`;
}

function buildRoadblockSummary(payload: ICPDiscoveryPayload): string {
  const objection = payload.objections?.[0];
  const frustration = payload.frustrations?.daily?.[0] || 'Not captured';
  const breakdown = payload.frustrations?.breakdown_scenario || 'Not captured';
  const fear = payload.fears?.[0];
  const implications = payload.implications?.chain?.slice(0, 3).join(' → ') || 'Not captured';
  const disappointment = payload.disappointments?.past_solutions?.[0];
  const failure = payload.past_failures?.[0];

  return `Here’s the roadblock map we need to navigate:\n\n**Rational barriers:**\n- ${objection ? `${objection.objection} (we handle by ${objection.response || objection.real_reason || 'showing proof'})` : 'Not captured'}\n\n**Emotional friction:**\n- Daily frustration: ${frustration}\n- Nightmare scenario: ${breakdown}\n- Core fear: ${fear ? `${fear.fear} (${fear.timeline})` : 'Not captured'}\n- Chain reaction: ${implications}\n\n**Scar tissue:**\n- Past disappointment: ${disappointment ? `${disappointment.solution} → ${disappointment.disappointment}` : 'Not captured'}\n- Past failure: ${failure ? `${failure.failure} (impact: ${failure.impact})` : 'None noted'}\n\nIf that feels accurate, I’ll bake each piece into the sequence. Anything you want to tweak before we lock it?`;
}

export function getDiscoveryProgress(phases: string[] = []): number {
  if (!phases.length) return 5;
  return Math.min(100, Math.round((phases.length / DISCOVERY_QUESTIONS.length) * 100));
}
