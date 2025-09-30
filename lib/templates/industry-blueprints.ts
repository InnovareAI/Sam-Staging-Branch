export interface BlueprintPersona {
  key: string;
  titleVariations: string[];
  description: string;
  painPoints: string[];
  outcomes: string[];
  tone?: 'direct' | 'consultative' | 'analytical' | 'relationship';
}

export interface SocialProof {
  label: string;
  before: string;
  after: string;
  metrics: string[];
}

export interface IndustryBlueprint {
  code: string;
  industry: string;
  defaultPersona: string;
  personas: BlueprintPersona[];
  hook: string;
  whyItMatters: string;
  solutionOneLiner: string;
  differentiation: string;
  proof: SocialProof;
  freeResource?: { title: string; description: string };
  commonLanguage: string[];
}

export const INDUSTRY_BLUEPRINTS: Record<string, IndustryBlueprint> = {
  saas: {
    code: 'saas',
    industry: 'SaaS / Technology',
    defaultPersona: 'founder',
    personas: [
      {
        key: 'founder',
        titleVariations: ['Founder', 'Co-Founder', 'CEO'],
        description: 'Early-stage founders wearing every hat',
        painPoints: [
          'Manual outbound eating 20+ hours/week',
          'Need pipeline traction for investor updates',
          'Cannot afford first SDR hire yet'
        ],
        outcomes: [
          'Get 20 hours back per week',
          'Build predictable top-of-funnel for fundraising',
          'Delay hiring full SDR team without losing momentum'
        ],
        tone: 'direct'
      },
      {
        key: 'vp_sales',
        titleVariations: ['VP Sales', 'Head of Sales', 'Sales Leader'],
        description: 'Growth-stage sales leadership',
        painPoints: [
          'Reps wasting time researching instead of selling',
          'Inconsistent pipeline hitting board reports',
          'Pressure to scale without more headcount'
        ],
        outcomes: [
          'Free reps to focus on closing',
          'Predictable weekly pipeline reviews',
          'Lower CAC while maintaining volume'
        ],
        tone: 'analytical'
      },
      {
        key: 'head_of_growth',
        titleVariations: ['Head of Growth', 'Growth Lead'],
        description: 'Experiment-driven growth teams',
        painPoints: [
          'Spinning up new channels is slow',
          'Cannot prove ROI of outbound experiments',
          'Tools feel heavy for small teams'
        ],
        outcomes: [
          'Launch campaigns in hours not weeks',
          'See CAC impact per channel',
          'Stay agile without more headcount'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'Manual outbound is stealing time from building product and talking to customers.',
    whyItMatters: 'Investors expect traction, but founders cannot live in spreadsheets and inboxes all day.',
    solutionOneLiner: 'Automates prospect research, personalization, and follow-up so founders focus on conversations that close.',
    differentiation: 'Unlike generic sequencers, Sam uses discovery-driven personalization aligned with fundraising narratives.',
    proof: {
      label: 'Series A SaaS',
      before: '5 demos/month, founder doing all outreach',
      after: '40+ demos/month in 90 days, founder back on product',
      metrics: ['Saved 18 hrs/week', '3x more qualified demos', 'Closed seed follow-on']
    },
    freeResource: {
      title: 'Founders First Outbound Playbook',
      description: 'Step-by-step to launch first outbound motion without SDRs'
    },
    commonLanguage: [
      'We are underwater on prospecting',
      'Need pipeline before the next board meeting',
      'Buying back founder hours'
    ]
  },
  financial_services: {
    code: 'financial_services',
    industry: 'Financial Services',
    defaultPersona: 'ria_principal',
    personas: [
      {
        key: 'ria_principal',
        titleVariations: ['Principal', 'Managing Partner'],
        description: 'Registered investment advisors hunting HNW clients',
        painPoints: [
          'Referrals drying up',
          'Compliance blocks creative outreach',
          'Hard to stand out with similar services'
        ],
        outcomes: [
          'Consistent HNW meetings monthly',
          'Compliance-ready messaging library',
          'Differentiate value beyond fees'
        ],
        tone: 'relationship'
      },
      {
        key: 'cfo',
        titleVariations: ['CFO', 'VP Finance'],
        description: 'Finance leaders in mid-market firms',
        painPoints: [
          'Cash-flow pressure from market swings',
          'Manual reporting workloads',
          'Board oversight tightening'
        ],
        outcomes: [
          'Sharper forecast accuracy',
          'Free team from manual reconciliations',
          'Give board confidence in numbers'
        ],
        tone: 'analytical'
      }
    ],
    hook: 'Trust and compliance make outbound slow, but silence is killing pipeline.',
    whyItMatters: 'Financial buyers only move when you show both credibility and cost savings with zero regulatory risk.',
    solutionOneLiner: 'Pair compliant messaging with curated proof to start real conversations without spooking compliance.',
    differentiation: 'Built-in FINRA/SEC guardrails keep every touch on policy so teams move fast and stay safe.',
    proof: {
      label: 'Boutique RIA',
      before: '2 referral meetings/month, inconsistent growth',
      after: '8 qualified HNW conversations every month',
      metrics: ['4x meetings', '$25M new AUM', 'Zero compliance escalations']
    },
    commonLanguage: [
      'Our book is aging out',
      'Compliance won’t approve anything creative',
      'Need proof this is worth client risk'
    ]
  },
  fintech: {
    code: 'fintech',
    industry: 'FinTech',
    defaultPersona: 'product_leader',
    personas: [
      {
        key: 'product_leader',
        titleVariations: ['Head of Product', 'CPO'],
        description: 'FinTech product leads balancing compliance and growth',
        painPoints: [
          'Feature backlog vs. GTM needs',
          'Slow partner onboarding',
          'Proof of trust before pilots'
        ],
        outcomes: [
          'Showcase compliance-ready workflows',
          'Reduce partner onboarding time',
          'Launch pilots with proof data'
        ],
        tone: 'analytical'
      },
      {
        key: 'growth_lead',
        titleVariations: ['Growth Lead', 'VP Growth'],
        description: 'Growth teams in regulated environments',
        painPoints: [
          'Acquisition costs soaring',
          'Hard to personalize under regulation',
          'Need banking/fintech proof fast'
        ],
        outcomes: [
          'Lower CAC with smarter targeting',
          'Stay compliant without boring copy',
          'Land proof-of-concepts quickly'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'FinTech buyers only respond when risk is addressed up front.',
    whyItMatters: 'Without credible trust signals, even great products stall in procurement.',
    solutionOneLiner: 'Delivers compliant outreach that surfaces real trust markers (security, audits, partners).',
    differentiation: 'Combines security narrative + ROI in one sequence tailored to banking stakeholders.',
    proof: {
      label: 'Payments Platform',
      before: '6-month sales cycles, pilots stuck',
      after: 'Pilot decisions in <90 days with 3 banks',
      metrics: ['2.5x pilot velocity', '30% lower CAC']
    },
    commonLanguage: [
      'Who’s already using you?',
      'Need SOC2/SOC1 proof',
      'Bank compliance will kill this if unclear'
    ]
  },
  insurance: {
    code: 'insurance',
    industry: 'Insurance',
    defaultPersona: 'broker',
    personas: [
      {
        key: 'broker',
        titleVariations: ['Insurance Broker', 'Producer'],
        description: 'Independent brokers needing differentiated outreach',
        painPoints: [
          'Referral well has dried up',
          'Hard to prove unique coverage value',
          'Renewals threatened by new entrants'
        ],
        outcomes: [
          'Net-new meetings with ideal accounts',
          'Storytelling that lands unique coverage',
          'Higher retention with proactive communication'
        ],
        tone: 'relationship'
      },
      {
        key: 'benefits_leader',
        titleVariations: ['VP Benefits', 'Head of Benefits'],
        description: 'Benefits leaders managing cost and wellbeing',
        painPoints: [
          'Premiums climbing faster than budgets',
          'Employee satisfaction dropping',
          'Navigating compliance requirements'
        ],
        outcomes: [
          'Reduce total benefits cost',
          'Improve employee experience',
          'Stay compliant without manual admin'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'Traditional outreach sounds like every broker fighting for the same renewal.',
    whyItMatters: 'HR and finance leaders ignore messages that feel commoditized.',
    solutionOneLiner: 'Wraps compliance-ready proof and cost savings into conversational LinkedIn/email flows.',
    differentiation: 'Mutual action plans and claims data callouts make outreach feel advisory, not pushy.',
    proof: {
      label: 'Regional Broker',
      before: 'Lost renewals to national firms',
      after: 'Won 9/10 focus accounts with consultative outreach',
      metrics: ['35% revenue lift', 'Retention up 18%']
    },
    commonLanguage: [
      'Employees complaining about coverage',
      'Need to prove we explored alternatives',
      'Renewal cycle is chaos'
    ]
  },
  pharma: {
    code: 'pharma',
    industry: 'Pharmaceuticals',
    defaultPersona: 'medical_affairs',
    personas: [
      {
        key: 'medical_affairs',
        titleVariations: ['Medical Affairs Director'],
        description: 'Medical affairs balancing compliance and education',
        painPoints: [
          'HCP engagement dropping',
          'Strict regulatory review slows content',
          'Need real-world evidence quickly'
        ],
        outcomes: [
          'Increase compliant touchpoints',
          'Accelerate review cycles',
          'Surface real-world data in conversations'
        ],
        tone: 'analytical'
      },
      {
        key: 'hcp_marketing',
        titleVariations: ['Director HCP Marketing'],
        description: 'Marketing teams driving adoption',
        painPoints: [
          'Message fatigue among physicians',
          'Must prove patient outcomes',
          'Field teams lack actionable insights'
        ],
        outcomes: [
          'Better HCP response rates',
          'Proof of patient impact',
          'Equip reps with relevant data'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'HCPs engage when science, compliance, and empathy line up.',
    whyItMatters: 'Regulatory missteps ruin trust; generic copy wastes MLR cycles.',
    solutionOneLiner: 'AI-assisted messaging stays within guidance while surfacing compelling clinical proof.',
    differentiation: 'Built-in approval checkpoints and reference libraries keep legal comfortable.',
    proof: {
      label: 'Specialty Pharma',
      before: 'Field reps doing manual follow-ups',
      after: '3x HCP engagement with compliant sequencing',
      metrics: ['75% faster MLR approvals', 'HCP response +45%']
    },
    commonLanguage: [
      'Need MLR-approved content fast',
      'HCPs think every message is the same',
      'Regulators watch every word'
    ]
  },
  biotechnology: {
    code: 'biotechnology',
    industry: 'Biotechnology',
    defaultPersona: 'scientific_founder',
    personas: [
      {
        key: 'scientific_founder',
        titleVariations: ['Founder', 'CSO'],
        description: 'Founders turning lab successes into deals',
        painPoints: [
          'Complex science is hard to communicate',
          'Investors demand commercialization proof',
          'Partnerships take forever to close'
        ],
        outcomes: [
          'Tell a clear business story',
          'Showcase validation data quickly',
          'Book BD meetings faster'
        ],
        tone: 'consultative'
      },
      {
        key: 'bd_lead',
        titleVariations: ['BD Lead', 'VP Business Development'],
        description: 'Business development teams courting pharma partnerships',
        painPoints: [
          'Relationship-based deals move slowly',
          'Need to get in front of the right decision makers',
          'Complicated data rooms overwhelm prospects'
        ],
        outcomes: [
          'Target the right partners early',
          'Simplify scientific proof for non-scientists',
          'Move from intro to diligence faster'
        ],
        tone: 'relationship'
      }
    ],
    hook: 'Breakthrough science needs a commercial story to match.',
    whyItMatters: 'Busy pharma execs won’t dig through decks unless the first touch screams relevance.',
    solutionOneLiner: 'Translates complex IP into investor- and BD-friendly narratives at scale.',
    differentiation: 'Sequences blend clinical proof, partner wins, and regulatory path in the first three touches.',
    proof: {
      label: 'Therapeutics Startup',
      before: '6-month partner hunt per deal',
      after: 'Secured 3 strategic intros in 60 days',
      metrics: ['Deal cycle -40%', 'Raised $25M bridge']
    },
    commonLanguage: [
      'Need a champion inside big pharma',
      'We sound too technical',
      'Investors want traction stories'
    ]
  },
  healthcare: {
    code: 'healthcare',
    industry: 'Healthcare Providers',
    defaultPersona: 'operations_leader',
    personas: [
      {
        key: 'operations_leader',
        titleVariations: ['COO', 'VP Operations'],
        description: 'Provider operations leaders reducing cost and burnout',
        painPoints: [
          'Staffing shortages',
          'Patient experience issues',
          'Manual workflows draining time'
        ],
        outcomes: [
          'Automate workflows without burdening clinicians',
          'Improve patient satisfaction',
          'Reduce overtime spend'
        ],
        tone: 'analytical'
      },
      {
        key: 'population_health',
        titleVariations: ['Director Population Health'],
        description: 'Population health teams driving outcomes',
        painPoints: [
          'Data disconnected across systems',
          'Need measurable patient improvements',
          'Regulatory reporting overhead'
        ],
        outcomes: [
          'Unified view of patient risk',
          'Prove outcome gains to payers',
          'Reduce admin headcount burn'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'Provider teams are stretched thin—anything manual gets ignored.',
    whyItMatters: 'If messaging doesn’t mention staffing relief or patient outcomes, it feels irrelevant.',
    solutionOneLiner: 'Automates patient outreach and reporting so clinical teams focus on care, not spreadsheets.',
    differentiation: 'Includes compliance-ready templates and ROI calculators tied to patient outcomes.',
    proof: {
      label: 'Multi-site Clinic',
      before: 'Manual outreach, low screening rates',
      after: '2.5x screening compliance in 90 days',
      metrics: ['Staff hours saved 15/wk', 'Patient satisfaction +18%']
    },
    commonLanguage: [
      'Our nurses are overwhelmed',
      'Need to hit quality metrics',
      'Regulators need proof'
    ]
  },
  legal: {
    code: 'legal',
    industry: 'Legal Services',
    defaultPersona: 'managing_partner',
    personas: [
      {
        key: 'managing_partner',
        titleVariations: ['Managing Partner', 'Founding Partner'],
        description: 'Boutique firm leaders balancing billables and growth',
        painPoints: [
          'Referrals plateauing',
          'Need higher-value matters',
          'Not enough time for BD'
        ],
        outcomes: [
          'Consistent flow of qualified matters',
          'Maintain positioning as specialists',
          'BD without sacrificing billable hours'
        ],
        tone: 'relationship'
      },
      {
        key: 'gc',
        titleVariations: ['General Counsel', 'Chief Legal Officer'],
        description: 'In-house teams evaluating outside counsel',
        painPoints: [
          'Need efficiency without risk',
          'Pressure to reduce outside spend',
          'Want industry-specific expertise'
        ],
        outcomes: [
          'Show measurable cost control',
          'Clear expertise in regulated domains',
          'Responsive partnership'
        ],
        tone: 'analytical'
      }
    ],
    hook: 'Legal prospects only respond to expertise and trust—no gimmicks.',
    whyItMatters: 'Generic “we help with litigation” messaging signals commodity work.',
    solutionOneLiner: 'Positions firm wins, client outcomes, and niche expertise in a consultant tone.',
    differentiation: 'Sequences combine precedent wins + client testimonial quotes to prove credibility fast.',
    proof: {
      label: 'Boutique Employment Firm',
      before: 'Relying on referrals only',
      after: 'Booked 12 enterprise GC meetings in 60 days',
      metrics: ['Revenue +28%', 'Won 4 marquee clients']
    },
    commonLanguage: [
      'Need counsel that knows our industry',
      'Outside counsel costs are under review',
      'Trust is everything'
    ]
  },
  manufacturing: {
    code: 'manufacturing',
    industry: 'Manufacturing',
    defaultPersona: 'ops_director',
    personas: [
      {
        key: 'ops_director',
        titleVariations: ['Director of Operations', 'Plant Manager'],
        description: 'Plant leaders focused on throughput and downtime',
        painPoints: [
          'Unplanned downtime killing output',
          'Manual processes causing errors',
          'Need to justify capex'
        ],
        outcomes: [
          'Predictive maintenance alerts',
          'Reduce scrap and rework',
          'Clear ROI timeline for leadership'
        ],
        tone: 'analytical'
      },
      {
        key: 'supply_chain',
        titleVariations: ['VP Supply Chain'],
        description: 'Supply chain executives managing volatility',
        painPoints: [
          'Supplier delays disrupting production',
          'Poor visibility across facilities',
          'Pressure to reduce inventory without risk'
        ],
        outcomes: [
          'Real-time visibility for decisions',
          'Diversified supplier playbooks',
          'Improve OTIF metrics'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'Downtime and waste are the fastest way to lose margin.',
    whyItMatters: 'Ops leaders buy when you show measurable throughput or cost savings.',
    solutionOneLiner: 'Predicts failures, streamlines workflows, and surfaces ROI tied to production metrics.',
    differentiation: 'Blends engineering credibility with financial outcomes to win both plant and finance teams.',
    proof: {
      label: 'Midwest Manufacturer',
      before: 'Monthly downtime from reactive maintenance',
      after: 'Downtime -45%, throughput +18%',
      metrics: ['Saved $1.2M/year', 'ROI in 6 months']
    },
    commonLanguage: [
      'We can’t afford another line stoppage',
      'Need data our engineers trust',
      'How fast is payback?'
    ]
  },
  energy: {
    code: 'energy',
    industry: 'Energy & Utilities',
    defaultPersona: 'grid_ops',
    personas: [
      {
        key: 'grid_ops',
        titleVariations: ['Director Grid Operations'],
        description: 'Grid operators balancing reliability and modernization',
        painPoints: [
          'Aging infrastructure risk',
          'Regulatory pressure',
          'Need better outage response'
        ],
        outcomes: [
          'Predict outages before they happen',
          'Document compliance improvements',
          'Protect customer satisfaction metrics'
        ],
        tone: 'analytical'
      },
      {
        key: 'renewables',
        titleVariations: ['VP Renewables', 'Director Sustainability'],
        description: 'Leaders scaling renewable portfolios',
        painPoints: [
          'Need PPAs and financing partners',
          'Grid integration challenges',
          'Proving ESG impact'
        ],
        outcomes: [
          'Faster partner pipeline',
          'Grid readiness visibility',
          'ESG reporting automation'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'Reliability issues and ESG mandates carry real penalty costs.',
    whyItMatters: 'Public perception and regulators demand proactive communication.',
    solutionOneLiner: 'Gives ops teams predictive insight and clean reporting to stay ahead of failures and regulators.',
    differentiation: 'Combines outage intelligence + stakeholder messaging in one motion.',
    proof: {
      label: 'Regional Utility',
      before: 'Reactive outage management',
      after: 'Outage response time -35%',
      metrics: ['Regulator scorecard +20%', 'Net promoter +12']
    },
    commonLanguage: [
      'Regulator is breathing down our neck',
      'Aging assets keep failing',
      'Need to prove ESG impact'
    ]
  },
  oil_gas: {
    code: 'oil_gas',
    industry: 'Oil & Gas',
    defaultPersona: 'asset_manager',
    personas: [
      {
        key: 'asset_manager',
        titleVariations: ['Asset Manager', 'Field Operations'],
        description: 'Ops teams balancing safety, production, and cost',
        painPoints: [
          'Equipment failure risk',
          'Safety incidents hurting ESG scores',
          'Manual reporting to regulators'
        ],
        outcomes: [
          'Predict asset failures',
          'Improve safety compliance',
          'Automate reporting packages'
        ],
        tone: 'analytical'
      },
      {
        key: 'esg_lead',
        titleVariations: ['ESG Lead', 'Sustainability Director'],
        description: 'ESG leaders defending license to operate',
        painPoints: [
          'Need defensible emissions data',
          'Stakeholders question ESG commitments',
          'Regulators requiring more transparency'
        ],
        outcomes: [
          'Reliable emissions reporting',
          'Stakeholder-ready story',
          'Avoid penalties from inaccuracies'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'Safety, uptime, and ESG compliance rule every buying conversation.',
    whyItMatters: 'Operators need proof you improve KPIs without adding risk.',
    solutionOneLiner: 'Predicts failures, tracks emissions, and automates reports for regulators and investors.',
    differentiation: 'Built for hazardous environments with offline data capture and audit trails.',
    proof: {
      label: 'Upstream Operator',
      before: 'Manual inspections, frequent downtime',
      after: 'Downtime -30%, incidents -40%',
      metrics: ['Saved $3M/yr', 'ESG score +15']
    },
    commonLanguage: [
      'Safety incident would kill the year',
      'Regulators want defensible data',
      'Production targets under pressure'
    ]
  },
  telecommunications: {
    code: 'telecommunications',
    industry: 'Telecommunications',
    defaultPersona: 'network_lead',
    personas: [
      {
        key: 'network_lead',
        titleVariations: ['Network Operations Lead'],
        description: 'Network teams keeping uptime across regions',
        painPoints: [
          'Service outages damage NPS',
          'Expensive truck rolls',
          'Need to prioritize capex spend'
        ],
        outcomes: [
          'Predict outages',
          'Reduce field visits',
          'Direct investments to highest impact'
        ],
        tone: 'analytical'
      },
      {
        key: 'enterprise_sales',
        titleVariations: ['VP Enterprise Sales'],
        description: 'Enterprise sales teams selling connectivity solutions',
        painPoints: [
          'RFP cycles long and bureaucratic',
          'Difficult to prove differentiated SLAs',
          'Need more executive conversations'
        ],
        outcomes: [
          'Land stakeholder meetings faster',
          'Showcase reliability proof',
          'Position service quality vs price wars'
        ],
        tone: 'direct'
      }
    ],
    hook: 'Connectivity is commoditized—proof of reliability wins deals.',
    whyItMatters: 'Ops leaders only move when you tie outreach to uptime and customer churn.',
    solutionOneLiner: 'Pairs network reliability data with outreach that speaks to churn, NPS, and SLA metrics.',
    differentiation: 'Sequences combine engineering metrics + customer stories instead of price talk.',
    proof: {
      label: 'Regional Carrier',
      before: 'Lost deals on price',
      after: 'Won 6 enterprise accounts with reliability-led story',
      metrics: ['Win-rate +22%', 'Churn -15%']
    },
    commonLanguage: [
      'Our customers switch on outages',
      'Need proof we’re better than big carriers',
      'RFPs drag forever'
    ]
  },
  consulting: {
    code: 'consulting',
    industry: 'Consulting Services',
    defaultPersona: 'practice_lead',
    personas: [
      {
        key: 'practice_lead',
        titleVariations: ['Practice Lead', 'Managing Director'],
        description: 'Consultancy practice heads chasing enterprise projects',
        painPoints: [
          'Feast-or-famine pipeline',
          'Hard to prove differentiation',
          'Too much time on BD vs delivery'
        ],
        outcomes: [
          'Steady pipeline of right-fit deals',
          'Clear value props per vertical',
          'Shift time back to billable work'
        ],
        tone: 'consultative'
      },
      {
        key: 'solo_consultant',
        titleVariations: ['Independent Consultant'],
        description: 'Solo consultants building authority',
        painPoints: [
          'Non-stop outreach to stay visible',
          'Prospects ghost after first call',
          'Need premium positioning'
        ],
        outcomes: [
          'Book consistent strategic calls',
          'Convert curiosity to paid advisory',
          'Keep personal brand intact'
        ],
        tone: 'relationship'
      }
    ],
    hook: 'Clients buy consultants when trust and expertise are obvious from the first message.',
    whyItMatters: 'Generic “we help with digital transformation” gets ignored.',
    solutionOneLiner: 'Injects case stories, frameworks, and ROI in a human voice without templated fluff.',
    differentiation: 'Learns from edits to maintain each consultant’s signature voice.',
    proof: {
      label: 'Boutique GTM Firm',
      before: 'Manual LinkedIn DMs with low reply rate',
      after: '4x qualified exec meetings, $180k pipeline',
      metrics: ['Reply rate 28%', 'Close rate 30%']
    },
    commonLanguage: [
      'Need clients who value expertise',
      'Don’t want to sound salesy',
      'My referrals slowed down'
    ]
  },
  marketing: {
    code: 'marketing',
    industry: 'Marketing & Advertising',
    defaultPersona: 'agency_owner',
    personas: [
      {
        key: 'agency_owner',
        titleVariations: ['Agency Owner', 'Managing Director'],
        description: 'Agency leaders balancing delivery + pipeline',
        painPoints: [
          'Relying on referrals, no predictability',
          'Prospects doubt ROI claims',
          'Too many pitches, low close rate'
        ],
        outcomes: [
          'Book weekly first calls with ICP accounts',
          'Lead with proof instead of promises',
          'Use less founder time per deal'
        ],
        tone: 'direct'
      },
      {
        key: 'demand_gen',
        titleVariations: ['Head of Demand Gen'],
        description: 'In-house demand leaders evaluating vendors',
        painPoints: [
          'Need partners who execute quickly',
          'Executives skeptical of agency spend',
          'Pressure on pipeline targets'
        ],
        outcomes: [
          'Prove payback period fast',
          'Feel confident handing off programs',
          'Reduce burden on internal team'
        ],
        tone: 'analytical'
      }
    ],
    hook: 'Every agency says “we drive results”—proof and specificity break through.',
    whyItMatters: 'Buyers want category expertise and data from campaigns like theirs.',
    solutionOneLiner: 'Human-sounding outreach anchored in case study metrics and clear offers.',
    differentiation: 'Sequences adapt CTA based on service (audit, sprint, retainer) with built-in ROI calculator links.',
    proof: {
      label: 'Demand Gen Agency',
      before: 'Mostly referrals, uneven months',
      after: '30 qualified VP Marketing calls in 60 days',
      metrics: ['Pipeline +$400k', 'Close rate 27%']
    },
    commonLanguage: [
      'Need leads yesterday',
      'Execs want numbers, not fluff',
      'Past agencies overpromised'
    ]
  },
  recruiting: {
    code: 'recruiting',
    industry: 'Recruiting & Talent Acquisition',
    defaultPersona: 'agency_owner',
    personas: [
      {
        key: 'agency_owner',
        titleVariations: ['Recruiting Firm Owner', 'Managing Director'],
        description: 'Recruiting owners hunting hiring managers',
        painPoints: [
          'Feast-or-famine job orders',
          'Competing with in-house recruiters',
          'Need niche positioning'
        ],
        outcomes: [
          'Book hiring manager calls consistently',
          'Fill searches faster with prepared candidates',
          'Charge higher fees with specialization'
        ],
        tone: 'relationship'
      },
      {
        key: 'vp_ta',
        titleVariations: ['VP Talent Acquisition'],
        description: 'TA leaders augmenting internal team',
        painPoints: [
          'Hard-to-fill technical roles',
          'Time-to-fill pressure',
          'Need trusted partners'
        ],
        outcomes: [
          'Get shortlist faster',
          'Improve candidate quality',
          'Hit hiring goals without burning out team'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'Recruiting is won with timing and specialization, not mass blast messages.',
    whyItMatters: 'Hiring managers only meet recruiters who already understand their reqs.',
    solutionOneLiner: 'Highlights niche candidate access + time-to-fill wins with a friendly tone.',
    differentiation: 'Blends hiring signal tracking and niche positioning to reach decision makers pre-RFP.',
    proof: {
      label: 'Tech Recruiting Firm',
      before: 'Cold calls and generic messages',
      after: 'Booked 15 hiring manager meetings in 45 days',
      metrics: ['Fees up 25%', '2-week average shortlist']
    },
    commonLanguage: [
      'Need to fill this role yesterday',
      'Internal team is overloaded',
      'Must see vetted candidates'
    ]
  },
  coaching: {
    code: 'coaching',
    industry: 'Coaching & Professional Services',
    defaultPersona: 'executive_coach',
    personas: [
      {
        key: 'executive_coach',
        titleVariations: ['Executive Coach', 'Leadership Coach'],
        description: 'Executive coaches selling high-ticket engagements',
        painPoints: [
          'Living off referrals',
          'Prospects view coaching as nice-to-have',
          'Time spent on outreach vs clients'
        ],
        outcomes: [
          'Book exec discovery calls weekly',
          'Establish premium positioning',
          'Spend time coaching, not prospecting'
        ],
        tone: 'relationship'
      },
      {
        key: 'fractional_exec',
        titleVariations: ['Fractional CMO', 'Fractional COO'],
        description: 'Fractional executives building retainer pipeline',
        painPoints: [
          'Need right-fit companies at right size',
          'Proving ROI vs full-time hire',
          'Balancing multiple engagements'
        ],
        outcomes: [
          'Fill 2-3 retainer slots',
          'Clear ROI story',
          'Predictable utilization'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'Clients buy transformation—not time blocks.',
    whyItMatters: 'Coaches win when they speak their client’s language and shift mindset quickly.',
    solutionOneLiner: 'Delivers personal, confident outreach rooted in transformation stories.',
    differentiation: 'Templates capture signature voice while logging edits to learn tone.',
    proof: {
      label: 'Leadership Coach',
      before: '100% referrals, inconsistent months',
      after: '4-5 discovery calls per month, $15k engagements',
      metrics: ['Client roster doubled', 'Premium pricing accepted']
    },
    commonLanguage: [
      'Team is stuck at the same level',
      'Need outside perspective',
      'We want lasting change'
    ]
  },
  logistics: {
    code: 'logistics',
    industry: 'Logistics & Supply Chain',
    defaultPersona: '3pl_owner',
    personas: [
      {
        key: '3pl_owner',
        titleVariations: ['3PL Owner', 'Freight Broker'],
        description: '3PL owners targeting shippers',
        painPoints: [
          'Competing on price vs value',
          'Inconsistent volume',
          'Need direct shipper relationships'
        ],
        outcomes: [
          'Win higher-margin lanes',
          'Consistent load volume',
          'Trusted shipper relationships'
        ],
        tone: 'direct'
      },
      {
        key: 'vp_supply_chain',
        titleVariations: ['VP Supply Chain'],
        description: 'Shippers managing disruptions',
        painPoints: [
          'Carrier reliability issues',
          'Need visibility cross-network',
          'Minimize stockouts'
        ],
        outcomes: [
          'Diversify reliable carrier mix',
          'Improve OTIF metrics',
          'Lower logistics cost without risk'
        ],
        tone: 'analytical'
      }
    ],
    hook: 'Shippers partner with pros who bring stability and insight, not rate wars.',
    whyItMatters: 'Strategic shippers care about reliability and communication.',
    solutionOneLiner: 'Automates freight intelligence so outreach speaks to specific lanes, volumes, and pain.',
    differentiation: 'Combines hiring signals + route intel to catch shippers before incumbents.',
    proof: {
      label: 'Specialty 3PL',
      before: 'Cold calls with low response',
      after: '8 new shipper relationships in 4 months',
      metrics: ['Volume +40%', 'Margin +12%']
    },
    commonLanguage: [
      'Need reliable capacity',
      'We hear the same pitch from every broker',
      'Keep my customers happy'
    ]
  },
  engineering: {
    code: 'engineering',
    industry: 'Engineering & Construction',
    defaultPersona: 'project_director',
    personas: [
      {
        key: 'project_director',
        titleVariations: ['Project Director', 'VP Projects'],
        description: 'Project leaders managing timelines and budgets',
        painPoints: [
          'Project delays and overruns',
          'Coordination across subs',
          'Labor shortages'
        ],
        outcomes: [
          'Reduce days behind schedule',
          'Improve sub coordination',
          'Protect margins'
        ],
        tone: 'analytical'
      },
      {
        key: 'bd_lead',
        titleVariations: ['Director Business Development'],
        description: 'BD leaders finding private projects',
        painPoints: [
          'Reliant on public bids',
          'Need better visibility into private deals',
          'Long sales cycles'
        ],
        outcomes: [
          'Find private projects earlier',
          'Increase win rate',
          'Shorten preconstruction timeline'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'Construction profits disappear when delays and change orders pile up.',
    whyItMatters: 'Project owners buy reliability and visibility, not promises.',
    solutionOneLiner: 'Surfaces private projects and keeps subs aligned so builds finish on time.',
    differentiation: 'Sequences showcase schedule savings and private-project wins with proof.',
    proof: {
      label: 'Regional GC',
      before: '15% win rate on public bids',
      after: '35% win rate with private project targeting',
      metrics: ['Pipeline +$12M', 'Margins +8%']
    },
    commonLanguage: [
      'Need reliable subs',
      'Projects slip because of coordination',
      'Public bids are a race to the bottom'
    ]
  },
  cre: {
    code: 'cre',
    industry: 'Commercial Real Estate & Facilities',
    defaultPersona: 'broker',
    personas: [
      {
        key: 'broker',
        titleVariations: ['CRE Broker', 'Leasing Agent'],
        description: 'CRE brokers chasing off-market opportunities',
        painPoints: [
          'Listings saturated before they see them',
          'Decision makers hard to reach',
          'Long negotiation cycles'
        ],
        outcomes: [
          'Meet tenants before leases expire',
          'Win exclusive representations',
          'Shorten decision cycles'
        ],
        tone: 'relationship'
      },
      {
        key: 'facilities_lead',
        titleVariations: ['Director Facilities', 'VP Real Estate'],
        description: 'Corporate facilities leaders managing portfolios',
        painPoints: [
          'Underused space',
          'Need to justify relocations',
          'Vendor management complexity'
        ],
        outcomes: [
          'Optimize portfolio costs',
          'Easy vendor coordination',
          'Employee experience improvements'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'The CRE brokers winning deals know about moves 12 months early.',
    whyItMatters: 'Executives want partners who see the market before it hits CoStar.',
    solutionOneLiner: 'Tracks expansion signals and opens doors with CFO/COO stakeholders early.',
    differentiation: 'Combines data (funding, hiring, expansions) with human outreach story.',
    proof: {
      label: 'Tenant Rep Team',
      before: 'Mostly waiting on inbound RFPs',
      after: 'Closed 3 exclusive deals from pre-expiration outreach',
      metrics: ['Commission +$2.1M', 'Cycle time -25%']
    },
    commonLanguage: [
      'Lease expires in 12 months',
      'Need new location with better amenities',
      'Executives want cost certainty'
    ]
  },
  it_services: {
    code: 'it_services',
    industry: 'IT Services & MSP',
    defaultPersona: 'msp_owner',
    personas: [
      {
        key: 'msp_owner',
        titleVariations: ['MSP Owner', 'Managing Partner'],
        description: 'MSP owners hunting high-value SMB clients',
        painPoints: [
          'Competing on price',
          'Clients churn for internal hires',
          'Need better-qualified leads'
        ],
        outcomes: [
          'Land clients valuing security + uptime',
          'Predictable MRR growth',
          'Higher retainers with premium positioning'
        ],
        tone: 'direct'
      },
      {
        key: 'cio',
        titleVariations: ['CIO', 'IT Director'],
        description: 'In-house IT leadership augmenting teams',
        painPoints: [
          'Limited staff, endless tickets',
          'Security threats rising',
          'Need partners who understand compliance'
        ],
        outcomes: [
          'Shift workload off internal team',
          'Improve security posture',
          'Predictable IT spend'
        ],
        tone: 'analytical'
      }
    ],
    hook: 'SMBs fire MSPs when all they see is “cheap help desk.”',
    whyItMatters: 'Decision makers buy uptime, security, and strategic support.',
    solutionOneLiner: 'Positions MSP as strategic partner with security-backed proof.',
    differentiation: 'Sequences tie outages, compliance, and ROI together for execs.',
    proof: {
      label: 'Regional MSP',
      before: 'Project work with inconsistent retainers',
      after: '8 managed clients at $5k+ MRR each',
      metrics: ['MRR +120%', 'Churn <5%']
    },
    commonLanguage: [
      'Need to sleep at night about security',
      'Our IT person is slammed',
      'Systems go down too often'
    ]
  },
  education: {
    code: 'education',
    industry: 'Education (Higher Ed + K-12)',
    defaultPersona: 'superintendent',
    personas: [
      {
        key: 'superintendent',
        titleVariations: ['Superintendent', 'Principal'],
        description: 'K-12 leaders balancing budgets and outcomes',
        painPoints: [
          'Limited budgets, competing priorities',
          'Teacher burnout',
          'Need measurable student outcomes'
        ],
        outcomes: [
          'Unlock funding for impactful programs',
          'Support teachers with less admin',
          'Improve student metrics'
        ],
        tone: 'relationship'
      },
      {
        key: 'vp_enrollment',
        titleVariations: ['VP Enrollment', 'Director Admissions'],
        description: 'Higher-ed teams fighting enrollment declines',
        painPoints: [
          'Enrollment slipping',
          'Need to attract the right students',
          'Proof of career outcomes'
        ],
        outcomes: [
          'Boost application yield',
          'Prove ROI to families',
          'Broaden recruitment pipelines'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'Education buyers demand student outcome data and budget sensitivity.',
    whyItMatters: 'No superintendent buys without a clear plan to improve metrics.',
    solutionOneLiner: 'Connects classroom impact with funding pathways in plain language.',
    differentiation: 'Sequences include grant angles, peer district proof, and opt-in compliance language.',
    proof: {
      label: 'EdTech Platform',
      before: 'Cold emails ignored',
      after: '12 districts piloting within 6 months',
      metrics: ['Pilot-to-district 70%', 'Budget approvals +40%']
    },
    commonLanguage: [
      'Student outcomes matter most',
      'Our teachers are stretched thin',
      'Need board-ready justification'
    ]
  },
  startups: {
    code: 'startups',
    industry: 'Startups (Segment)',
    defaultPersona: 'founder',
    personas: [
      {
        key: 'founder',
        titleVariations: ['Founder', 'Co-Founder', 'CEO'],
        description: 'Scrappy founders figuring out GTM',
        painPoints: [
          'Doing everything themselves',
          'Need signal before next raise',
          'Cannot afford full teams'
        ],
        outcomes: [
          'Automate top-of-funnel',
          'Show investor traction',
          'Stretch runway'
        ],
        tone: 'direct'
      },
      {
        key: 'first_sales',
        titleVariations: ['Head of Sales', 'First Sales Hire'],
        description: 'First sales leaders building process',
        painPoints: [
          'No playbook yet',
          'Need to prove repeatability',
          'Limited tooling budget'
        ],
        outcomes: [
          'Document repeatable motion',
          'Hit targets without extra headcount',
          'Make founder look good to investors'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'Startups win when they turn chaos into a repeatable motion fast.',
    whyItMatters: 'Investors fund momentum and systems, not hustle stories alone.',
    solutionOneLiner: 'Automates prospecting so founders can focus on product and fundraising.',
    differentiation: 'Specifically tuned for low-budget stacks with board-friendly reporting.',
    proof: {
      label: 'Pre-seed SaaS',
      before: 'Founder doing manual LinkedIn outreach',
      after: '35 demos/month, raised $2.5M seed',
      metrics: ['7x demos', 'Time back 20 hrs/wk']
    },
    commonLanguage: [
      'Need traction for the next round',
      'Wearing every hat',
      'Can’t hire yet'
    ]
  },
  sme: {
    code: 'sme',
    industry: 'SMEs (Segment)',
    defaultPersona: 'owner',
    personas: [
      {
        key: 'owner',
        titleVariations: ['Owner', 'President'],
        description: 'SMB owners juggling growth and operations',
        painPoints: [
          'Competition with bigger players',
          'Manual processes burning time',
          'Need reliable growth engine'
        ],
        outcomes: [
          'Compete without hiring big teams',
          'Free owner from day-to-day sales work',
          'Predictable revenue each quarter'
        ],
        tone: 'direct'
      },
      {
        key: 'sales_manager',
        titleVariations: ['Sales Manager', 'Director of Sales'],
        description: 'SMB sales leaders with small teams',
        painPoints: [
          'Reps stretched',
          'Inconsistent pipeline',
          'Limited tooling budget'
        ],
        outcomes: [
          'Keep reps selling, not researching',
          'Smooth out pipeline dips',
          'Affordable automation'
        ],
        tone: 'consultative'
      }
    ],
    hook: 'SMBs need enterprise-grade motion without enterprise budget.',
    whyItMatters: 'Owners choose solutions that free their time and hit revenue goals.',
    solutionOneLiner: 'Brings SDR-quality outreach to lean teams in one subscription.',
    differentiation: 'Combines affordable tech with human review checkpoints to protect brand.',
    proof: {
      label: '50-person Manufacturer',
      before: 'Owner handling sales personally',
      after: 'Pipeline +3x, owner back on strategy',
      metrics: ['Revenue +35%', 'Owner time +15hrs/wk']
    },
    commonLanguage: [
      'Competing with bigger firms',
      'Need more meetings without hiring',
      'I already work 60-hour weeks'
    ]
  }
};

export function findBlueprintByIndustry(industry: string): IndustryBlueprint | null {
  const key = industry.trim().toLowerCase();
  if (INDUSTRY_BLUEPRINTS[key]) return INDUSTRY_BLUEPRINTS[key];

  const match = Object.values(INDUSTRY_BLUEPRINTS).find(bp => bp.industry.toLowerCase() === key);
  return match || null;
}
