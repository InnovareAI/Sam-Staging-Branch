'use client';

import React, { useState } from 'react';
import { Brain, Search, Filter, MessageSquare, Target, HelpCircle, CheckCircle, Building2, Users, TrendingUp } from 'lucide-react';

// Extended Inquiry Response Data
const INQUIRY_RESPONSES = {
  saas: {
    CTO: {
      tone: "Technical, concise, credibility-first",
      faqs: [
        { q: "How do you integrate with our stack?", a: "Pre-built connectors and open APIs. Most CTOs integrate in under 2 weeks." },
        { q: "What about SOC 2 & HIPAA compliance?", a: "We're SOC 2 Type II and HIPAA compliant with full audit logs." },
        { q: "How do you handle uptime?", a: "99.99% SLA backed by redundant architecture and 24/7 monitoring." },
        { q: "Do you integrate with Salesforce/HubSpot?", a: "Yes, with native integrations for Salesforce, HubSpot, and Slack." },
        { q: "What security framework do you follow?", a: "Zero-trust, RBAC, encryption at rest and in transit, ISO27001 aligned." },
        { q: "What's the typical implementation time?", a: "10–14 days with guided onboarding and sandbox testing." },
        { q: "Who else uses this?", a: "Adopted by SaaS scaleups ($50M–$500M ARR) and public SaaS firms." },
        { q: "Do you support compliance reporting for audits?", a: "Yes, aligned with SEC and SOX requirements." }
      ],
      objections: [
        { o: "We already use [Competitor X].", a: "Clients migrated for faster integrations and better compliance support." },
        { o: "Budget frozen this quarter.", a: "Start with a pilot — ROI in 60 days helps unlock budget." },
        { o: "Implementation is risky.", a: "Phased rollout with sandbox validation minimizes risk." },
        { o: "Too complex for our team.", a: "Guided onboarding and dedicated success managers reduce workload." },
        { o: "Data security risk.", a: "Annual SOC audits + HIPAA compliance mitigate risk." },
        { o: "Vendor lock-in concerns.", a: "We ensure data portability and open APIs." }
      ],
      stage_adaptation: {
        awareness: [
          { q: "Why modernize now?", a: "Churn and compliance pressures demand modernization." }
        ],
        consideration: [
          { q: "How do you compare?", a: "We combine compliance + personalization in one solution." }
        ],
        decision: [
          { q: "Why you vs competitor?", a: "Lower integration cost, stronger compliance, faster ROI." }
        ]
      }
    },
    CFO: {
      tone: "Outcome-focused, ROI-driven",
      faqs: [
        { q: "What ROI can we expect?", a: "3x ROI in <12 months via churn reduction and pipeline acceleration." },
        { q: "What's your pricing model?", a: "Subscription or usage-based — most CFOs prefer usage for scalability." },
        { q: "How do you prove ROI quickly?", a: "Pilot programs deliver measurable ROI in 60–90 days." },
        { q: "What KPIs improve?", a: "CAC:LTV ratio, churn %, pipeline velocity." },
        { q: "Are you audit-ready?", a: "Yes — SOC 2 + SOX-aligned reporting reduces audit prep time by 50%." },
        { q: "How do you bill enterprise customers?", a: "Enterprise licensing with volume discounts." },
        { q: "Do you integrate with finance systems?", a: "Native connectors for ERP, NetSuite, QuickBooks." },
        { q: "Who else uses this?", a: "Public SaaS CFOs preparing for IPOs or compliance audits." }
      ],
      objections: [
        { o: "We're cutting budgets.", a: "ROI offsets spend — pilots prove payback within the quarter." },
        { o: "Competitors are cheaper.", a: "But lack compliance coverage and scalability." },
        { o: "Timing isn't right.", a: "Acting now secures ROI in the current fiscal cycle." },
        { o: "No bandwidth internally.", a: "Managed onboarding minimizes effort from your team." },
        { o: "Hidden costs?", a: "Transparent, usage-based pricing — no lock-in fees." },
        { o: "Adoption risk.", a: "Adoption playbooks and dedicated onboarding mitigate this." }
      ]
    },
    VP_Sales: {
      tone: "Practical, growth-focused, enablement-first",
      faqs: [
        { q: "How does this help pipeline growth?", a: "Increases pipeline velocity by 25–30% with better outreach personalization." },
        { q: "What about rep adoption?", a: "UX designed for sales reps — adoption >85% within 2 weeks." },
        { q: "Do you integrate with Salesforce/HubSpot?", a: "Yes, with plug-and-play CRM integrations." },
        { q: "How do you improve conversion rates?", a: "Personalized sequences + ICP targeting improve conversion by 20%." },
        { q: "What training is needed?", a: "Minimal — reps are productive within days." },
        { q: "What KPIs improve?", a: "Pipeline velocity, conversion %, quota attainment." },
        { q: "Do you support outbound + inbound?", a: "Yes, across LinkedIn, email, and inbound forms." },
        { q: "Who else uses this?", a: "Mid-market SaaS teams scaling outbound + inbound simultaneously." }
      ],
      objections: [
        { o: "Our reps hate new tools.", a: "Simple UX ensures reps prefer it over generic CRM add-ons." },
        { o: "Too much overlap with CRM.", a: "We enhance CRM by automating manual steps and improving targeting." },
        { o: "No time to onboard.", a: "Guided onboarding takes <1 week for full team." },
        { o: "Competitors are cheaper.", a: "We outperform on conversion and adoption metrics." },
        { o: "Not enough outbound leads.", a: "We enrich ICP data and drive new lead sources." },
        { o: "Sales cycles are long.", a: "We accelerate cycle time by aligning reps with ICP pain points." }
      ]
    }
  },
  financial_services: {
    CFO: {
      tone: "Risk-aware, compliance-first",
      faqs: [
        { q: "How do you ensure SEC/FINRA compliance?", a: "We provide audit-ready logs and data lineage aligned with SEC 17a-4 and FINRA 4511." },
        { q: "What ROI can we expect?", a: "Most CFOs see a 3x ROI in <12 months through reduced audit costs and faster reporting cycles." },
        { q: "Do you support SOX compliance?", a: "Yes, our workflows align with SOX Section 404 and provide documentation for auditors." },
        { q: "How do you reduce audit prep time?", a: "On average, we reduce prep time by 50% with automated evidence generation." },
        { q: "Do you integrate with ERP and reporting systems?", a: "Yes, APIs connect with Oracle, SAP, Workday, and NetSuite." },
        { q: "What KPIs improve?", a: "Audit pass rate, cost-to-income ratio, reporting cycle time." },
        { q: "How do you price your solution?", a: "Tiered subscription based on assets under management or transaction volume." },
        { q: "Who else uses this?", a: "Tier 1 U.S. banks, regional credit unions, and investment firms." }
      ],
      objections: [
        { o: "We already use compliance software.", a: "We complement existing systems by automating manual gaps and reducing duplication." },
        { o: "Budget is frozen this year.", a: "Many CFOs start with a pilot that proves ROI in 90 days, unlocking budget." },
        { o: "Implementation risk is high.", a: "Phased rollout and sandbox testing reduce risk." },
        { o: "We're worried about lock-in.", a: "All data is portable, with open APIs to ensure flexibility." },
        { o: "Regulators here are stricter.", a: "We adapt frameworks for SEC, FINRA, and state-level regulations." },
        { o: "Other vendors are cheaper.", a: "Our ROI offsets cost by avoiding fines and reducing audit hours." }
      ]
    },
    CRO: {
      tone: "Analytical, risk-mitigation focused",
      faqs: [
        { q: "How do you help with risk monitoring?", a: "We provide dashboards that track market, credit, and operational risks in real time." },
        { q: "Do you integrate with risk systems?", a: "Yes, we connect with SAS, Moody's, and in-house risk models." },
        { q: "What about stress testing?", a: "We support CCAR and DFAST stress testing scenarios required by the Fed." },
        { q: "How do you reduce risk exposure?", a: "Our clients reduce operational risk incidents by 20% through automation." },
        { q: "What compliance reports do you generate?", a: "Audit-ready reports for SOX, SEC, and Basel III standards." },
        { q: "How fast are alerts triggered?", a: "Alerts are real-time, with configurable thresholds by risk category." },
        { q: "Do you support scenario analysis?", a: "Yes, built-in scenario engines allow what-if planning across risk types." },
        { q: "Who else uses this?", a: "Chief Risk Officers at banks, insurers, and credit providers." }
      ],
      objections: [
        { o: "We already have a risk system.", a: "We complement it by automating reporting and unifying risk data." },
        { o: "Implementation is too complex.", a: "We use phased rollouts by risk category (credit, operational, market)." },
        { o: "Too expensive.", a: "Avoided losses + audit readiness deliver ROI > costs." },
        { o: "Data accuracy concerns.", a: "We integrate directly with source systems to avoid manual errors." },
        { o: "Regulators won't accept this.", a: "Reports align with Fed, SEC, and Basel III guidelines." },
        { o: "Staff won't adopt it.", a: "User-friendly dashboards drive adoption across risk teams." }
      ]
    },
    ComplianceOfficer: {
      tone: "Detail-oriented, reassurance-focused",
      faqs: [
        { q: "Do you cover SEC, FINRA, and state laws?", a: "Yes, we monitor and update frameworks for SEC, FINRA, and all state-level banking regulations." },
        { q: "What about GDPR or CCPA?", a: "We include GDPR, CCPA, and U.S. state privacy laws." },
        { q: "How often are rules updated?", a: "Weekly updates ensure compliance with the latest regulatory changes." },
        { q: "Do you track employee compliance?", a: "Yes, dashboards monitor certifications, training, and breaches." },
        { q: "Do you support evidence collection?", a: "Yes, automated evidence logging with timestamps and user attribution." },
        { q: "Can regulators access this data?", a: "Yes, regulator access modules support secure external sharing." },
        { q: "How do you manage reporting deadlines?", a: "Calendar-based alerts ensure filings (SEC, FINRA, SOX) are never missed." },
        { q: "Who else uses this?", a: "Compliance teams in U.S. banks, broker-dealers, and fintechs." }
      ],
      objections: [
        { o: "We can't handle another system.", a: "Our dashboards unify multiple compliance systems in one place." },
        { o: "Change management risk.", a: "We roll out role-specific modules to reduce friction." },
        { o: "Too costly.", a: "ROI proven by reducing audit prep hours and avoiding penalties." },
        { o: "Security risk.", a: "SOC 2, ISO27001, and U.S. banking security standards are built in." },
        { o: "Staff won't use it.", a: "Role-based training and UX designed for compliance teams ensure adoption." },
        { o: "Other tools claim the same.", a: "We differentiate with regulator-accepted templates and reports." }
      ]
    }
  },

  pharma: {
    RegulatoryAffairs: {
      tone: "Precise, compliance-heavy",
      faqs: [
        { q: "How do you align with FDA requirements?", a: "Our workflows are fully compliant with FDA 21 CFR Part 11 and include audit trails." },
        { q: "Do you support EMA submissions?", a: "Yes, we generate eCTD-ready packages for EMA submissions." },
        { q: "What about labeling compliance?", a: "Automated tracking ensures all content aligns with the most current FDA/EMA-approved label." },
        { q: "Do you integrate with Veeva or Medidata?", a: "Yes, native connectors streamline submission document flow." },
        { q: "How do you reduce approval risk?", a: "Evidence packaging and consistency reduce regulator rejections by 20–30%." },
        { q: "Do you handle MLR reviews?", a: "Yes, templates reduce MLR review time by up to 40%." },
        { q: "Do you support global submissions?", a: "We adapt workflows for FDA, EMA, and PMDA requirements." },
        { q: "Who else uses this?", a: "Top-20 pharma companies and U.S.-based biotechs." }
      ],
      objections: [
        { o: "Our submission process is unique.", a: "Our workflows are configurable to your SOPs without disrupting compliance." },
        { o: "We already invested in systems like Veeva.", a: "We complement Veeva with automation and analytics, not replace it." },
        { o: "Regulatory rules change often.", a: "Our system updates weekly to match FDA and EMA changes." },
        { o: "Implementation risk.", a: "Phased rollout + sandbox testing ensures continuity." },
        { o: "Too expensive.", a: "ROI is proven by faster approvals and fewer resubmissions." },
        { o: "Staff won't adopt new tools.", a: "Role-based UX for RA teams ensures adoption." }
      ],
      stage_adaptation: {
        awareness: [
          { q: "Why modernize regulatory processes now?", a: "FDA/EMA increasingly require digital-first, audit-ready submissions." }
        ],
        consideration: [
          { q: "How do you compare to legacy systems?", a: "We complement legacy RA tools with automation and global compliance coverage." }
        ],
        decision: [
          { q: "Why you?", a: "Proven reduction in submission cycle time and rejections." }
        ]
      }
    },

    MedicalAffairs: {
      tone: "Evidence-based, educational",
      faqs: [
        { q: "Do you help with KOL engagement?", a: "Yes, compliant workflows for capturing insights and distributing education materials." },
        { q: "What about medical information requests?", a: "Automated intake ensures compliant, fast responses to MI inquiries." },
        { q: "Do you support congress activities?", a: "Yes, we track abstracts, posters, and booth interactions in compliance with PhRMA standards." },
        { q: "Do you align with FDA/EMA promotional guidelines?", a: "Yes, all materials follow OPDP (FDA) and EMA standards." },
        { q: "How do you manage adverse event reporting?", a: "Integrated workflows ensure AE reports are captured and sent to pharmacovigilance within 24h." },
        { q: "Do you integrate with CRM tools like Veeva Medical?", a: "Yes, native connectors support Veeva and Salesforce Health Cloud." },
        { q: "What KPIs improve?", a: "Faster MI responses, higher KOL engagement rates, reduced MLR cycle time." },
        { q: "Who else uses this?", a: "U.S. biopharmas, specialty pharma, and top-10 pharma MA teams." }
      ],
      objections: [
        { o: "Our medical teams are too busy.", a: "Automation reduces manual work, freeing teams for high-value tasks." },
        { o: "Regulators are strict about promotional vs medical.", a: "We maintain strict firewalls between promotional and medical content." },
        { o: "Competitors are cheaper.", a: "Our compliance-first approach avoids regulatory risk, which offsets cost." },
        { o: "Implementation will disrupt our congress cycle.", a: "We deploy in phases around medical congress schedules." },
        { o: "Too complex for field MSLs.", a: "Our mobile-friendly UX is built for field medical teams." },
        { o: "Global requirements vary.", a: "Templates are adapted per region (FDA, EMA, PMDA)." }
      ],
      stage_adaptation: {
        awareness: [
          { q: "Why modernize medical affairs now?", a: "Digital KOL engagement and compliant MI response times are regulator priorities." }
        ],
        consideration: [
          { q: "How do you compare?", a: "We combine MI, congress, and KOL engagement in one compliant platform." }
        ],
        decision: [
          { q: "Why you?", a: "Trusted by U.S. medical affairs teams with proven compliance ROI." }
        ]
      }
    },

    CFO: {
      tone: "Financial, compliance-focused", 
      faqs: [
        { q: "What ROI can we expect from this investment?", a: "ROI is typically 2–3x within 18 months, driven by faster approvals and reduced resubmissions." },
        { q: "Do you support SOX and SEC reporting?", a: "Yes, built-in templates align with SOX Section 404 and SEC audit frameworks." },
        { q: "What about integration with ERP?", a: "Yes, SAP, Oracle, and NetSuite connectors included." },
        { q: "How do you reduce compliance costs?", a: "Automation reduces audit and resubmission costs by 25–30%." },
        { q: "Do you handle pharmacovigilance data?", a: "Yes, integrated AE reporting reduces compliance risk." },
        { q: "What KPIs improve?", a: "Approval timelines, R&D ROI, compliance costs, audit pass rates." },
        { q: "Do you work with public companies?", a: "Yes, we support 10-K/10-Q reporting integration." },
        { q: "Who else uses this?", a: "Top-10 pharma and U.S.-based biotech CFOs." }
      ],
      objections: [
        { o: "This is too expensive.", a: "ROI is proven through faster approvals and compliance cost reduction." },
        { o: "Budget cycle already closed.", a: "Start with a pilot — quick ROI builds case for next cycle." },
        { o: "Implementation risk.", a: "We roll out in phases to minimize risk and disruption." },
        { o: "We already have compliance staff.", a: "We enhance their work by automating repetitive tasks." },
        { o: "Competitors are cheaper.", a: "But they lack multi-framework coverage (FDA + EMA)." },
        { o: "Too complex.", a: "Role-based dashboards ensure simplicity for non-technical CFOs." }
      ],
      stage_adaptation: {
        awareness: [
          { q: "Why invest in compliance tech now?", a: "Regulators are increasing scrutiny, and manual methods are costly." }
        ],
        consideration: [
          { q: "How do you compare?", a: "We cover FDA + EMA in one platform, unlike U.S.-only competitors." }
        ],
        decision: [
          { q: "Why you?", a: "Proven ROI from faster approvals and reduced compliance overhead." }
        ]
      }
    }
  },

  healthcare: {
    CMO: {
      tone: "Clinical, trustworthy, outcome-focused",
      faqs: [
        { q: "Do you integrate with EHR/EMR systems?", a: "Yes, we support HL7/FHIR standards and integrate with Epic, Cerner, and Meditech." },
        { q: "How do you improve patient outcomes?", a: "By providing real-time analytics and decision support, reducing readmissions by up to 15%." },
        { q: "Do you support HIPAA compliance?", a: "Yes, HIPAA safeguards are built in, with encrypted workflows and audit trails." },
        { q: "How do you reduce clinician burnout?", a: "Automation reduces manual data entry by 40%, giving clinicians more time for patients." },
        { q: "What about interoperability with labs and imaging?", a: "Native interfaces ensure smooth data exchange with LIS and PACS systems." },
        { q: "What's the deployment timeline?", a: "Pilot in 6–8 weeks, phased rollouts across departments in 3–6 months." },
        { q: "What KPIs improve?", a: "Patient satisfaction, readmission rates, quality scores (HEDIS, STAR)." },
        { q: "Who else uses this?", a: "Adopted by leading U.S. health systems and regional providers." }
      ],
      objections: [
        { o: "Our clinicians resist new tech.", a: "We co-design workflows with clinicians to ensure adoption and minimize disruption." },
        { o: "We can't afford downtime.", a: "Deployments are phased with zero-downtime strategies." },
        { o: "Patient data risk is too high.", a: "All data is encrypted in transit and at rest, with HIPAA-compliant logging." },
        { o: "Budget is constrained.", a: "ROI comes from improved reimbursement and reduced readmissions." },
        { o: "We already have EHR integrations.", a: "We enhance existing EHRs by adding analytics and workflow automation." },
        { o: "Staff training is burdensome.", a: "Role-based micro-learning ensures fast adoption with minimal training hours." }
      ],
      stage_adaptation: {
        awareness: [
          { q: "Why modernize healthcare IT now?", a: "Value-based care and payer mandates require digital-first workflows." }
        ],
        consideration: [
          { q: "How do you compare?", a: "Unlike standalone tools, we extend EHRs with analytics and automation." }
        ],
        decision: [
          { q: "Why you?", a: "Trusted by U.S. hospital systems with proven clinical outcomes." }
        ]
      }
    },

    CFO: {
      tone: "Financial, compliance-driven",
      faqs: [
        { q: "How does this impact reimbursement?", a: "We optimize coding accuracy and claim submissions, boosting reimbursement rates." },
        { q: "Do you integrate with finance and billing systems?", a: "Yes, with Epic Resolute, Oracle, and other billing systems." },
        { q: "What ROI can we expect?", a: "ROI is achieved within 12 months through increased reimbursement and reduced denials." },
        { q: "What KPIs improve?", a: "Days in AR, clean claim rates, reimbursement %." },
        { q: "Do you support CMS compliance?", a: "Yes, all workflows are CMS audit-ready." },
        { q: "What's the pricing model?", a: "Subscription-based, scaled to patient volume." },
        { q: "Who else uses this?", a: "U.S. IDNs, community hospitals, and health systems." },
        { q: "How do you handle security?", a: "SOC 2 and HIPAA-compliant, with audit logs for every transaction." }
      ],
      objections: [
        { o: "Budgets are shrinking.", a: "We demonstrate ROI in reimbursement gains and reduced denials." },
        { o: "We already have revenue cycle tools.", a: "We complement them with automation and predictive analytics." },
        { o: "Implementation risk.", a: "Phased rollout ensures minimal disruption to finance operations." },
        { o: "Data security concerns.", a: "Encrypted, HIPAA-aligned data handling with access controls." },
        { o: "Competitors are cheaper.", a: "Our clients recover millions in revenue leakage, offsetting cost." },
        { o: "No staff capacity.", a: "Our team supports implementation and provides managed services." }
      ],
      stage_adaptation: {
        awareness: [
          { q: "Why prioritize this now?", a: "Shrinking reimbursements make automation critical." }
        ],
        consideration: [
          { q: "How do you compare?", a: "We go beyond RCM tools with AI-driven denial prevention." }
        ],
        decision: [
          { q: "Why you?", a: "Proven ROI in U.S. hospitals with faster reimbursement cycles." }
        ]
      }
    },

    Procurement: {
      tone: "Operational, contract-focused",
      faqs: [
        { q: "How do you integrate into existing vendor contracts?", a: "We align with current IT vendor agreements and provide modular contracts." },
        { q: "Do you support group purchasing organizations (GPOs)?", a: "Yes, we're pre-approved with leading U.S. GPOs." },
        { q: "What's your pricing model?", a: "Subscription per facility, with enterprise discounts." },
        { q: "Do you offer managed services?", a: "Yes, optional services reduce internal resource requirements." },
        { q: "How do you handle vendor risk assessments?", a: "We provide SOC 2 Type II reports and HIPAA compliance attestations." },
        { q: "What KPIs improve?", a: "Vendor consolidation, contract compliance, cost savings." },
        { q: "Deployment timeline?", a: "4–6 weeks for procurement integration." },
        { q: "Who else uses this?", a: "Procurement teams at U.S. health systems and IDNs." }
      ],
      objections: [
        { o: "Our vendor list is full.", a: "We consolidate multiple point solutions into one vendor." },
        { o: "GPO rules are restrictive.", a: "We're already listed with major GPOs for healthcare." },
        { o: "Implementation risk.", a: "Procurement pilots prove value before full rollout." },
        { o: "Budget cycles are rigid.", a: "We align proposals with annual capital planning cycles." },
        { o: "Competitors underbid.", a: "We deliver ROI in contract compliance and vendor consolidation." },
        { o: "Regulatory approvals take too long.", a: "We provide pre-cleared compliance documentation for procurement reviews." }
      ],
      stage_adaptation: {
        awareness: [
          { q: "Why change vendors now?", a: "Vendor consolidation and ROI are top hospital priorities." }
        ],
        consideration: [
          { q: "How do you compare?", a: "We deliver compliance + consolidation beyond point vendors." }
        ],
        decision: [
          { q: "Why you?", a: "Proven with U.S. health systems, reducing vendor sprawl and cost." }
        ]
      }
    }
  },

  legal: {
    ManagingPartner: {
      tone: "Consultative, credibility-driven",
      faqs: [
        { q: "How do you help us win more clients?", a: "We enable faster turnaround and differentiated services that clients value." },
        { q: "How do you reduce non-billable hours?", a: "Automation cuts admin tasks by 40%, freeing lawyers for billable client work." },
        { q: "Is client confidentiality ensured?", a: "Yes — end-to-end encryption and ABA/State Bar compliant workflows." },
        { q: "Do you handle conflict checks?", a: "Yes, automated conflict management integrated into case intake." },
        { q: "How fast is onboarding?", a: "4–6 weeks for firmwide rollout, faster for small teams." },
        { q: "Can you integrate with practice management systems?", a: "Yes, with iManage, NetDocuments, Clio, and other leading PMS tools." },
        { q: "What KPIs improve?", a: "Utilization rates, realization rates, client satisfaction." },
        { q: "Who else uses this?", a: "Adopted by AmLaw 200 firms and U.S. boutique practices." }
      ],
      objections: [
        { o: "We already use a practice management system.", a: "We complement, not replace, existing PMS with automation + compliance." },
        { o: "Change management is risky.", a: "We phase implementation by practice group to minimize disruption." },
        { o: "Cloud solutions are insecure.", a: "We meet U.S. Bar Association cloud security standards, with SOC 2 reports." },
        { o: "We can't afford downtime.", a: "Zero-downtime migrations proven in AmLaw deployments." },
        { o: "Budget is tight.", a: "ROI is demonstrated in billable hour recovery within 3–6 months." },
        { o: "Lawyers resist new tools.", a: "Our UX is designed for lawyers — adoption >80% in first 90 days." }
      ],
      stage_adaptation: {
        awareness: [
          { q: "Why modernize now?", a: "Clients demand faster, tech-enabled services, and competition is rising." }
        ],
        consideration: [
          { q: "How do you compare?", a: "We integrate compliance and automation where PMS tools stop." }
        ],
        decision: [
          { q: "Why you?", a: "Trusted by U.S. firms, proven to improve utilization + client retention." }
        ]
      }
    },

    GeneralCounsel: {
      tone: "Protective, risk-aware",
      faqs: [
        { q: "How do you ensure data confidentiality?", a: "We encrypt data end-to-end and restrict access by matter + role." },
        { q: "Do you align with ABA Model Rules?", a: "Yes, our workflows follow ABA confidentiality and competence rules." },
        { q: "Can you handle eDiscovery?", a: "Yes, integrated eDiscovery reduces cycle time by 30%." },
        { q: "Do you support contract lifecycle management?", a: "Yes, from intake to approval with audit logs." },
        { q: "How do you reduce outside counsel spend?", a: "By centralizing matter tracking and leveraging analytics." },
        { q: "Can regulators audit your system?", a: "Yes, we generate regulator-ready logs and reports." },
        { q: "What KPIs improve?", a: "Cycle time, spend visibility, matter closure rates." },
        { q: "Who else uses this?", a: "In-house legal teams at Fortune 500 and mid-market U.S. firms." }
      ],
      objections: [
        { o: "We already use external counsel.", a: "We help optimize which matters to insource, cutting spend by 15%." },
        { o: "Too complex to implement.", a: "Modular rollout ensures quick wins with minimal disruption." },
        { o: "Budget is limited.", a: "Cost recovery in reduced outside counsel spend covers investment." },
        { o: "Confidentiality risks.", a: "Encryption + audit trails ensure compliance with ABA/SEC standards." },
        { o: "We don't have IT bandwidth.", a: "Our managed services handle deployment and maintenance." },
        { o: "Staff adoption is low.", a: "Legal-specific training ensures rapid adoption." }
      ],
      stage_adaptation: {
        awareness: [
          { q: "Why change now?", a: "GCs face pressure to cut costs and improve compliance transparency." }
        ],
        consideration: [
          { q: "How do you compare?", a: "Unlike generic CLM, we align with ABA + SEC compliance needs." }
        ],
        decision: [
          { q: "Why you?", a: "Proven adoption in U.S. in-house teams, reducing legal risk." }
        ]
      }
    },

    ITDirector: {
      tone: "Technical, security-first",
      faqs: [
        { q: "What security frameworks do you meet?", a: "SOC 2, ISO27001, ABA cloud guidelines." },
        { q: "Do you support MFA and SSO?", a: "Yes, Okta, Azure AD, and other IdPs are supported." },
        { q: "How do you handle backups?", a: "Automated daily backups with 30-day recovery SLA." },
        { q: "Do you offer on-prem or cloud?", a: "Both, depending on firm preference and jurisdiction rules." },
        { q: "How do you manage permissions?", a: "Role- and matter-based access controls with full audit logs." },
        { q: "What about integrations?", a: "We integrate with DMS, PMS, and billing tools natively." },
        { q: "What KPIs improve?", a: "System uptime, IT workload reduction, adoption rates." },
        { q: "Who else uses this?", a: "IT teams in AmLaw firms and U.S. regional practices." }
      ],
      objections: [
        { o: "Cloud is insecure.", a: "We meet ABA and state Bar cloud standards with SOC 2 certifications." },
        { o: "Implementation will disrupt lawyers.", a: "Deployment is staged, with zero-downtime migrations." },
        { o: "Our systems are too old.", a: "We integrate with legacy PMS/DMS without replacing them." },
        { o: "Competitors are cheaper.", a: "We deliver higher ROI by improving lawyer adoption and uptime." },
        { o: "No IT staff capacity.", a: "We provide managed IT support to free internal staff." },
        { o: "Vendor lock-in.", a: "Open APIs ensure portability and no lock-in." }
      ],
      stage_adaptation: {
        awareness: [
          { q: "Why modernize legal IT now?", a: "Cybersecurity threats and client demands are rising." }
        ],
        consideration: [
          { q: "How do you compare?", a: "We deliver compliance + integration beyond competitors." }
        ],
        decision: [
          { q: "Why you?", a: "Proven adoption by AmLaw IT teams, SOC-certified and secure." }
        ]
      }
    }
  },

  startups: {
    Founder: {
      tone: "Fast-paced, supportive, growth-minded",
      faqs: [
        { q: "How quickly can we get value?", a: "Most startups see impact within 30 days of implementation." },
        { q: "Do you offer startup pricing?", a: "Yes, discounted tiers for early-stage companies, with growth-aligned pricing." },
        { q: "Can this scale as we grow?", a: "Yes, usage-based pricing and modular architecture adapt to your runway." },
        { q: "How much support do we get?", a: "Dedicated onboarding + 24/7 chat support tailored for lean teams." },
        { q: "What about integrations?", a: "Pre-built connectors with popular startup stacks: HubSpot, Slack, Notion." },
        { q: "What ROI can we expect?", a: "Startups typically see 2–3x ROI in <6 months, mainly via faster GTM." },
        { q: "How do you handle investor reporting?", a: "Automated dashboards export directly for investor decks." },
        { q: "Who else uses this?", a: "High-growth startups across SaaS, FinTech, and marketplaces." }
      ],
      objections: [
        { o: "We don't have time to implement.", a: "Implementation takes <2 weeks with plug-and-play templates." },
        { o: "We can't afford it.", a: "Startup tiers start lean — designed for early cash flow realities." },
        { o: "We're too early.", a: "Early adoption builds investor credibility and scalable foundations." },
        { o: "Switching tools is risky.", a: "Data portability ensures no vendor lock-in." },
        { o: "Our investors already push other vendors.", a: "We integrate with their systems, not replace them." },
        { o: "Competitors are cheaper.", a: "Our ROI benchmarks prove faster scaling offsets small price difference." }
      ],
      stage_adaptation: {
        awareness: [
          { q: "Why invest in tools at this stage?", a: "Early adoption accelerates GTM and builds scalable foundations." }
        ],
        consideration: [
          { q: "How do you compare to others?", a: "We focus on speed + startup-specific integrations." }
        ],
        decision: [
          { q: "Why now?", a: "Faster traction improves fundraising and investor confidence." }
        ]
      }
    }
  },

  smes: {
    Owner: {
      tone: "Simple, supportive, ROI-clear",
      faqs: [
        { q: "Is this affordable for SMEs?", a: "Yes, pricing scales by company size with predictable monthly fees." },
        { q: "We don't have IT staff — can you help?", a: "We manage end-to-end setup and provide ongoing support." },
        { q: "What's the ROI?", a: "Most SMEs see 20–30% efficiency gains and breakeven in <6 months." },
        { q: "How long does onboarding take?", a: "Typically 3–4 weeks, with minimal disruption." },
        { q: "Do you support compliance (GDPR, SOC 2)?", a: "Yes, pre-configured compliance templates for SMEs." },
        { q: "What KPIs improve?", a: "Revenue per employee, cost per transaction, customer satisfaction." },
        { q: "What integrations are supported?", a: "QuickBooks, Xero, MS Teams, Salesforce, HubSpot." },
        { q: "Who else uses this?", a: "Thousands of SMEs across industries from retail to services." }
      ],
      objections: [
        { o: "Too expensive for our size.", a: "ROI in 6 months offsets cost — efficiency gains are proven." },
        { o: "We lack technical staff.", a: "We deliver managed onboarding and ongoing support." },
        { o: "Change will disrupt operations.", a: "Phased rollout keeps disruption minimal." },
        { o: "We're happy with current systems.", a: "We enhance, not replace, existing SME systems." },
        { o: "Competitors are cheaper.", a: "Our compliance and ROI coverage set us apart." },
        { o: "Scaling is risky.", a: "Our modular design ensures growth without re-platforming." }
      ],
      stage_adaptation: {
        awareness: [
          { q: "Why modernize now?", a: "SMEs that digitalize early grow 20% faster." }
        ],
        consideration: [
          { q: "How do you compare?", a: "We combine affordability + compliance in one platform." }
        ],
        decision: [
          { q: "Why you?", a: "Proven ROI, trusted by SMEs globally, simple onboarding." }
        ]
      }
    }
  }
};

interface InquiryResponsesProps {
  onResponseSelect?: (response: string) => void;
}

const InquiryResponses: React.FC<InquiryResponsesProps> = ({ onResponseSelect }) => {
  const [selectedIndustry, setSelectedIndustry] = useState<'saas' | 'financial_services'>('saas');
  const [selectedRole, setSelectedRole] = useState<string>('CTO');
  const [activeTab, setActiveTab] = useState<'faqs' | 'objections' | 'stage_adaptation'>('faqs');
  const [searchQuery, setSearchQuery] = useState('');

  const currentRoleData = INQUIRY_RESPONSES[selectedIndustry][selectedRole as keyof typeof INQUIRY_RESPONSES[typeof selectedIndustry]];
  
  const filteredContent = () => {
    if (!currentRoleData) return [];
    
    const content = activeTab === 'stage_adaptation' && currentRoleData.stage_adaptation 
      ? Object.values(currentRoleData.stage_adaptation).flat()
      : currentRoleData[activeTab] || [];
    
    if (!searchQuery) return content;
    
    return content.filter((item: any) => 
      (item.q && item.q.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.o && item.o.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (item.a && item.a.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  const getAvailableRoles = () => {
    return Object.keys(INQUIRY_RESPONSES[selectedIndustry]);
  };

  return (
    <div className="bg-gray-800 border border-gray-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-semibold text-white flex items-center">
          <Brain className="mr-2 text-blue-400" size={24} />
          Inquiry Response System
        </h2>
        <div className="text-sm text-gray-400">
          {currentRoleData?.tone}
        </div>
      </div>

      {/* Industry & Role Selector */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Industry</label>
          <select
            value={selectedIndustry}
            onChange={(e) => {
              setSelectedIndustry(e.target.value as 'saas' | 'financial_services');
              setSelectedRole(Object.keys(INQUIRY_RESPONSES[e.target.value as 'saas' | 'financial_services'])[0]);
            }}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
          >
            <option value="saas">SaaS Technology</option>
            <option value="financial_services">Financial Services</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Target Role</label>
          <select
            value={selectedRole}
            onChange={(e) => setSelectedRole(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-purple-500"
          >
            {getAvailableRoles().map(role => (
              <option key={role} value={role}>{role.replace('_', ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={16} />
          <input
            type="text"
            placeholder="Search FAQs, objections, or responses..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-gray-700 border border-gray-600 rounded-lg pl-10 pr-4 py-2 text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
          />
        </div>
      </div>

      {/* Content Tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-700 rounded-lg p-1">
        {['faqs', 'objections', 'stage_adaptation'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`flex-1 py-2 px-4 text-sm font-medium rounded-md transition-colors ${
              activeTab === tab
                ? 'bg-purple-600 text-white'
                : 'text-gray-300 hover:text-white hover:bg-gray-600'
            }`}
          >
            {tab === 'faqs' && <HelpCircle className="inline mr-1" size={14} />}
            {tab === 'objections' && <Target className="inline mr-1" size={14} />}
            {tab === 'stage_adaptation' && <TrendingUp className="inline mr-1" size={14} />}
            {tab.replace('_', ' ').toUpperCase()}
          </button>
        ))}
      </div>

      {/* Content Display */}
      <div className="space-y-4 max-h-96 overflow-y-auto">
        {filteredContent().map((item: any, index: number) => (
          <div key={index} className="bg-gray-700 border border-gray-600 rounded-lg p-4 hover:bg-gray-650 transition-colors">
            <div className="mb-2">
              <h4 className="text-sm font-medium text-purple-300 mb-2">
                {activeTab === 'objections' ? 'Objection:' : 'Question:'}
              </h4>
              <p className="text-gray-200 text-sm">
                {item.q || item.o}
              </p>
            </div>
            <div className="mb-3">
              <h4 className="text-sm font-medium text-green-300 mb-2">Response:</h4>
              <p className="text-gray-300 text-sm leading-relaxed">
                {item.a}
              </p>
            </div>
            <div className="flex justify-end">
              <button
                onClick={() => onResponseSelect?.(item.a)}
                className="px-3 py-1 bg-purple-600 hover:bg-purple-500 text-white text-xs rounded transition-colors"
              >
                Use Response
              </button>
            </div>
          </div>
        ))}
        
        {filteredContent().length === 0 && (
          <div className="text-center py-8 text-gray-400">
            <MessageSquare className="mx-auto mb-2" size={32} />
            <p>No responses found matching your search.</p>
          </div>
        )}
      </div>

      {/* Statistics */}
      <div className="mt-6 pt-4 border-t border-gray-700">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-lg font-semibold text-white">{currentRoleData?.faqs?.length || 0}</div>
            <div className="text-xs text-gray-400">FAQs</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-white">{currentRoleData?.objections?.length || 0}</div>
            <div className="text-xs text-gray-400">Objections</div>
          </div>
          <div>
            <div className="text-lg font-semibold text-white">
              {currentRoleData?.stage_adaptation ? Object.values(currentRoleData.stage_adaptation).flat().length : 0}
            </div>
            <div className="text-xs text-gray-400">Stage Responses</div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default InquiryResponses;