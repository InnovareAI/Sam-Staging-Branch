export interface SamFunnelTemplate {
  id: string;
  name: string;
  description: string;
  type: 'linkedin' | 'email';
  target_audience: string;
  industry?: string;
  steps: SamFunnelStep[];
  settings: {
    total_duration_weeks: number;
    weekdays_only: boolean;
    mandatory_elements: string[];
  };
  variables: string[];
  expected_response_rate: string;
}

export interface SamFunnelStep {
  step_number: number;
  step_type: 'connection_request' | 'follow_up' | 'goodbye' | 'email';
  day_offset: number;
  week: number;
  weekday: string;
  subject?: string;
  message_template: string;
  mandatory_element?: 'competence_validation' | 'free_trial' | 'loom_video' | 'second_cta' | 'goodbye_qualification';
  cta_options?: string[];
  conditions?: string[];
}

export const SAM_FUNNEL_TEMPLATES: SamFunnelTemplate[] = [
  {
    id: 'linkedin_sam_funnel_standard',
    name: 'LinkedIn Sam Funnel - Standard (1 CR + 4 FU + 1 GB)',
    description: 'Standardized LinkedIn funnel with all mandatory elements over 4 weeks',
    type: 'linkedin',
    target_audience: 'B2B Decision Makers',
    steps: [
      {
        step_number: 1,
        step_type: 'connection_request',
        day_offset: 1,
        week: 1,
        weekday: 'Monday',
        message_template: "Hi {first_name}, I'm the CEO of InnovareAI, a pioneering agentic AI company. I'm interested in connecting with {target_role} who are interested in AI-driven {industry} solutions. Would you be open to connecting?",
        conditions: ['profile_available', 'not_connected']
      },
      {
        step_number: 2,
        step_type: 'follow_up',
        day_offset: 5,
        week: 1,
        weekday: 'Friday',
        message_template: "Hi {first_name}, great to connect! I spend a lot of time talking with {target_role} about the challenge of {industry_pain_point}. The catch-22 is brutal: you need {desired_outcome} to show traction, but you can't afford to {current_limitation}. We recently helped a {similar_role} at {similar_company} achieve {specific_result}. Does that sound familiar?",
        mandatory_element: 'competence_validation',
        conditions: ['connection_accepted']
      },
      {
        step_number: 3,
        step_type: 'follow_up',
        day_offset: 10,
        week: 2,
        weekday: 'Wednesday',
        message_template: "That challenge is exactly why we built Sam—{solution_description}. I can create a personalized Loom video showing exactly how Sam would {specific_benefit} for {company_name}. Worth a 3-minute watch to see how this works for your specific situation?",
        mandatory_element: 'loom_video',
        conditions: ['previous_message_sent', 'no_negative_response']
      },
      {
        step_number: 4,
        step_type: 'follow_up',
        day_offset: 16,
        week: 3,
        weekday: 'Tuesday',
        message_template: "Hi {first_name}, following up on the Loom demonstration. The best way to see this in action for {company_name} is a 15-minute live demo where I can walk you through the exact workflow. We also have a 14-day free trial with money-back guarantee so you can experience the results risk-free. Available this week?",
        mandatory_element: 'free_trial',
        conditions: ['loom_engagement_detected']
      },
      {
        step_number: 5,
        step_type: 'follow_up',
        day_offset: 19,
        week: 3,
        weekday: 'Friday',
        message_template: "Following up on automating {process_name} for {company_name}. If timing for a demo is tricky, I have our Sam Innovation Consultant GPT that can help you model the ROI of this approach for your specific goals. It's like having a free consultation with Sam's AI brain. Want access?",
        mandatory_element: 'second_cta',
        cta_options: ['custom_gpt', '5min_zoom', 'benchmark_report', 'async_consultation'],
        conditions: ['no_response_to_previous']
      },
      {
        step_number: 6,
        step_type: 'goodbye',
        day_offset: 25,
        week: 4,
        weekday: 'Thursday',
        message_template: "Hi {first_name}, final follow-up on automating {process_name} for {company_name}. Our 14-day free trial with unconditional money-back guarantee lets you see Sam deliver real {desired_outcome} completely risk-free. Where are you at with this?\n\na) Not the right time, I'm busy - touch base in a few weeks\nb) I already have a solution in place - take me off your list\nc) I'm interested - let's schedule some time on my calendar\nd) Not interested - opt out",
        mandatory_element: 'goodbye_qualification',
        cta_options: ['reschedule', 'remove', 'schedule', 'opt_out']
      }
    ],
    settings: {
      total_duration_weeks: 4,
      weekdays_only: true,
      mandatory_elements: ['competence_validation', 'free_trial', 'loom_video', 'second_cta', 'goodbye_qualification']
    },
    variables: [
      'first_name', 'company_name', 'target_role', 'industry', 
      'industry_pain_point', 'desired_outcome', 'current_limitation',
      'similar_role', 'similar_company', 'specific_result',
      'solution_description', 'specific_benefit', 'process_name'
    ],
    expected_response_rate: '15-25%'
  },

  {
    id: 'email_sam_funnel_standard',
    name: 'Email Sam Funnel - Standard (4 + 1 GB)',
    description: 'Standardized email funnel with all mandatory elements over 4 weeks',
    type: 'email',
    target_audience: 'B2B Decision Makers',
    steps: [
      {
        step_number: 1,
        step_type: 'email',
        day_offset: 1,
        week: 1,
        weekday: 'Monday',
        subject: 'The {industry} catch-22 that is limiting {company_name}',
        message_template: "Hi {first_name},\n\nI spend a lot of time talking with {target_role} about the {industry} challenge: you need {desired_outcome} to show traction, but you can't afford to {current_limitation}.\n\nWe recently helped {similar_company} overcome this exact challenge and achieve {specific_result} in just {time_frame}.\n\nDoes this sound familiar for {company_name}?\n\nBest regards,\n{sender_name}",
        mandatory_element: 'competence_validation'
      },
      {
        step_number: 2,
        step_type: 'email',
        day_offset: 4,
        week: 1,
        weekday: 'Thursday',
        subject: 'How {similar_company} solved this (3-min Loom)',
        message_template: "Hi {first_name},\n\nThat challenge is exactly why we built Sam—{solution_description}.\n\nI created a personalized Loom video showing exactly how Sam would {specific_benefit} for {company_name}, similar to what we did for {similar_company}.\n\n[Loom Video: Custom for {company_name}]\n\nWorth a 3-minute watch to see the approach?\n\nBest,\n{sender_name}",
        mandatory_element: 'loom_video'
      },
      {
        step_number: 3,
        step_type: 'email',
        day_offset: 10,
        week: 2,
        weekday: 'Wednesday',
        subject: 'Risk-free trial for {company_name}',
        message_template: "Hi {first_name},\n\nFollowing up on the Loom demonstration for {company_name}.\n\nThe best way to prove value is to let you experience it yourself. We have a 14-day free trial with unconditional money-back guarantee where you can see Sam deliver real {desired_outcome}.\n\nCompletely risk-free way to see if this works for your specific situation.\n\nWorth setting up for {company_name}?\n\nBest regards,\n{sender_name}",
        mandatory_element: 'free_trial'
      },
      {
        step_number: 4,
        step_type: 'email',
        day_offset: 16,
        week: 3,
        weekday: 'Tuesday',
        subject: 'Alternative: Sam Innovation Consultant (Free)',
        message_template: "Hi {first_name},\n\nI know timing for trials can be tricky when you're wearing ten hats at {company_name}.\n\nIf you're still in the early stages of planning your {process_name} strategy, I built a Sam Innovation Consultant GPT that acts as a free consultant. It can help you model the ROI of this approach for your specific goals and industry.\n\nIt's like having a free consultation with Sam's AI brain - no commitment required.\n\nWant access?\n\nBest,\n{sender_name}",
        mandatory_element: 'second_cta',
        cta_options: ['custom_gpt', 'benchmark_report', 'async_consultation']
      },
      {
        step_number: 5,
        step_type: 'goodbye',
        day_offset: 22,
        week: 4,
        weekday: 'Monday',
        subject: 'Final follow-up + where are you at?',
        message_template: "Hi {first_name},\n\nFinal follow-up on automating {process_name} for {company_name}.\n\nOur 14-day free trial with unconditional money-back guarantee is the most risk-free way to see if Sam can deliver the {desired_outcome} you need.\n\nWhere are you at with this?\n\na) Not the right time, I'm busy at the moment - let's touch base in a few weeks\nb) I already have a solution in place - please take me off your list  \nc) I'm interested - let's schedule some time on my calendar\nd) Not interested - please opt me out\n\nJust reply with a, b, c, or d.\n\nBest regards,\n{sender_name}",
        mandatory_element: 'goodbye_qualification',
        cta_options: ['reschedule', 'remove', 'schedule', 'opt_out']
      }
    ],
    settings: {
      total_duration_weeks: 4,
      weekdays_only: true,
      mandatory_elements: ['competence_validation', 'free_trial', 'loom_video', 'second_cta', 'goodbye_qualification']
    },
    variables: [
      'first_name', 'company_name', 'target_role', 'industry',
      'industry_pain_point', 'desired_outcome', 'current_limitation',
      'similar_company', 'specific_result', 'time_frame',
      'solution_description', 'specific_benefit', 'process_name', 'sender_name'
    ],
    expected_response_rate: '20-30%'
  }
];

// Helper function to get Sam Funnel template by ID
export const getSamFunnelTemplateById = (id: string): SamFunnelTemplate | undefined => {
  return SAM_FUNNEL_TEMPLATES.find(template => template.id === id);
};

// Helper function to get templates by type
export const getSamFunnelTemplatesByType = (type: 'linkedin' | 'email'): SamFunnelTemplate[] => {
  return SAM_FUNNEL_TEMPLATES.filter(template => template.type === type);
};

// Helper function to calculate weekday scheduling
export const calculateWeekdaySchedule = (startDate: Date): { [key: number]: Date } => {
  const schedule: { [key: number]: Date } = {};
  const weekdays = [1, 2, 3, 4, 5]; // Monday to Friday
  let currentDate = new Date(startDate);
  let weekdayCount = 0;
  
  // Calculate schedule for 4 weeks
  const targetDays = [1, 5, 10, 16, 19, 25]; // Day offsets from template
  
  targetDays.forEach(dayOffset => {
    let workingDate = new Date(startDate);
    let addedDays = 0;
    let workingWeekdays = 0;
    
    while (workingWeekdays < dayOffset) {
      if (weekdays.includes(workingDate.getDay())) {
        workingWeekdays++;
        if (workingWeekdays === dayOffset) {
          schedule[dayOffset] = new Date(workingDate);
          break;
        }
      }
      workingDate.setDate(workingDate.getDate() + 1);
    }
  });
  
  return schedule;
};

// Helper function to validate template variables
export const validateSamFunnelVariables = (template: SamFunnelTemplate, prospectData: any): string[] => {
  const missingVariables: string[] = [];
  
  template.variables.forEach(variable => {
    if (!prospectData[variable] && !prospectData[variable.replace('_', '')]) {
      missingVariables.push(variable);
    }
  });
  
  return missingVariables;
};

// Helper function to populate template with prospect data
export const populateSamFunnelTemplate = (messageTemplate: string, prospectData: any): string => {
  let populatedMessage = messageTemplate;
  
  // Replace all variables in the format {variable_name}
  Object.keys(prospectData).forEach(key => {
    const regex = new RegExp(`{${key}}`, 'g');
    populatedMessage = populatedMessage.replace(regex, prospectData[key] || `[${key}]`);
  });
  
  return populatedMessage;
};

// A/B Testing framework for 2nd CTA
export interface CTATestVariation {
  id: string;
  name: string;
  message_template: string;
  traffic_allocation: number; // 0.0 to 1.0
  cta_type: 'custom_gpt' | '5min_zoom' | 'benchmark_report' | 'async_consultation';
}

export const SECOND_CTA_TEST_VARIATIONS: CTATestVariation[] = [
  {
    id: 'custom_gpt_primary',
    name: 'Sam Innovation Consultant GPT',
    message_template: "If timing for a demo is tricky, I have our Sam Innovation Consultant GPT that can help you model the ROI of this approach for your specific goals. It's like having a free consultation with Sam's AI brain. Want access?",
    traffic_allocation: 0.4,
    cta_type: 'custom_gpt'
  },
  {
    id: 'quick_zoom_test',
    name: '5-Minute Zoom Session',
    message_template: "If a full demo timing doesn't work, would a quick 5-minute Zoom be easier to discuss how this fits your current situation? Just a brief conversation to see if it's worth exploring further.",
    traffic_allocation: 0.3,
    cta_type: '5min_zoom'
  },
  {
    id: 'benchmark_report',
    name: 'Industry Benchmark Report',
    message_template: "If you're still evaluating options, I can send you our {industry} benchmark report showing how companies like {company_name} are approaching {process_name} automation. Worth a look?",
    traffic_allocation: 0.2,
    cta_type: 'benchmark_report'
  },
  {
    id: 'async_consultation',
    name: 'Async Voice Consultation',
    message_template: "If scheduling is challenging, I could record a personalized voice message analyzing {company_name}'s situation and potential approach. You could listen when convenient and respond if interested. Worth trying?",
    traffic_allocation: 0.1,
    cta_type: 'async_consultation'
  }
];

// Response qualification handling
export interface QualificationResponse {
  option: 'a' | 'b' | 'c' | 'd';
  meaning: string;
  action: string;
  follow_up_timing?: string;
}

export const QUALIFICATION_RESPONSES: QualificationResponse[] = [
  {
    option: 'a',
    meaning: 'Not the right time, touch base later',
    action: 'schedule_follow_up',
    follow_up_timing: '3-4 weeks'
  },
  {
    option: 'b', 
    meaning: 'Already have solution, remove from list',
    action: 'mark_dnc_and_remove'
  },
  {
    option: 'c',
    meaning: 'Interested, wants to schedule',
    action: 'send_calendar_link'
  },
  {
    option: 'd',
    meaning: 'Not interested, opt out',
    action: 'mark_dnc_and_unsubscribe'
  }
];