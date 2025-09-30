export type ICPObjectiveUrgency = 'thriving_improve' | 'struggling_urgent' | 'should_do';

export type ICPSessionStatus = 'in_progress' | 'completed' | 'abandoned';

export interface ICPObjective {
  description: string;
  priority: number;
  urgency: ICPObjectiveUrgency;
}

export interface ICPFocusArea {
  description: string;
  priority: number;
}

export interface ICPPainPoint {
  description: string;
  intensity: 'low' | 'medium' | 'high';
  cost_type: 'money' | 'time' | 'opportunity' | 'emotional';
  cost_detail?: string;
}

export interface ICPCurrentSolution {
  approach: string;
  why_fails: string;
  gap: string;
}

export interface ICPSolutionExpectation {
  primary: string;
  deliverable: 'yes_confidently' | 'depends' | 'sometimes' | 'no';
  secondary?: string;
}

export interface ICPDiscoveryPayload {
  target_role?: string;
  target_industry?: string;
  company_stage?: string;
  quick_summary?: string;
  current_question_id?: string;
  objectives?: ICPObjective[];
  focus_areas?: ICPFocusArea[];
  long_term_desire?: string;
  pain_points?: ICPPainPoint[];
  current_solution?: ICPCurrentSolution;
  solution_expectations?: ICPSolutionExpectation;
  customer_language?: string[];
  positioning?: {
    primary_pain_point?: string;
    cost_impact?: string;
    differentiation_hook?: string;
    expected_outcome?: string;
  };
  conversational_notes?: {
    shallow_answers?: string[];
    research_recommended?: boolean;
    follow_up_actions?: string[];
  };
  objections?: ICPObjection[];
  frustrations?: ICPFrustrations;
  fears?: ICPFear[];
  implications?: ICPImplications;
  disappointments?: ICPDisappointments;
  past_failures?: ICPPastFailure[];
}

export interface ICPObjection {
  objection: string;
  priority: number;
  type: 'real' | 'smoke_screen' | 'mix';
  response?: string;
  real_reason?: string;
}

export interface ICPFrustrations {
  daily: string[];
  breakdown_scenario?: string;
}

export type ICPFearTimeline = 'immediate' | 'future' | 'existential';

export interface ICPFear {
  fear: string;
  timeline: ICPFearTimeline;
  trigger?: string;
  realized_when?: string;
}

export interface ICPImplications {
  chain: string[];
  ultimate_outcome?: string;
}

export interface ICPDisappointments {
  past_solutions: { solution: string; disappointment: string }[];
  skepticism_level: 'very_cynical' | 'cautiously_optimistic' | 'open_minded' | 'varies';
}

export interface ICPPastFailure {
  failure: string;
  impact: string;
  differentiation?: string;
}

export interface ICPDiscoverySummary {
  headline: string;
  key_points: string[];
  recommended_positioning: string;
  risk_notes?: string[];
}

export interface ICPDiscoverySession {
  id: string;
  workspace_id: string;
  user_id: string;
  campaign_id?: string | null;
  session_status: ICPSessionStatus;
  is_quick_flow: boolean;
  discovery_payload: ICPDiscoveryPayload;
  discovery_summary: ICPDiscoverySummary;
  red_flags: string[];
  shallow_answer_count: number;
  questions_skipped: number;
  phases_completed: string[];
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
}

export interface SaveDiscoveryInput {
  sessionId: string;
  payload: Partial<ICPDiscoveryPayload>;
  phasesCompleted?: string[];
  shallowDelta?: number;
  questionsSkippedDelta?: number;
  sessionStatus?: ICPSessionStatus;
  completedAt?: string;
}
