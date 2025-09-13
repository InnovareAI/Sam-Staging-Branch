"use strict";(()=>{var a={};a.id=2020,a.ids=[2020],a.modules={261:a=>{a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},11997:a=>{a.exports=require("punycode")},19121:a=>{a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},27910:a=>{a.exports=require("stream")},29294:a=>{a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},44870:a=>{a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55591:a=>{a.exports=require("https")},63033:a=>{a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},74075:a=>{a.exports=require("zlib")},79551:a=>{a.exports=require("url")},81630:a=>{a.exports=require("http")},86439:a=>{a.exports=require("next/dist/shared/lib/no-fallback-error.external")},88420:(a,b,c)=>{c.r(b),c.d(b,{handler:()=>E,patchFetch:()=>D,routeModule:()=>z,serverHooks:()=>C,workAsyncStorage:()=>A,workUnitAsyncStorage:()=>B});var d={};c.r(d),c.d(d,{POST:()=>y});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(10641),v=c(82461),w=c(67310);async function x(a,b){let c=process.env.OPENROUTER_API_KEY;if(!c)throw Error("OpenRouter API key not configured");let d=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${c}`,"Content-Type":"application/json","HTTP-Referer":"https://app.meet-sam.com","X-Title":"SAM AI Platform"},body:JSON.stringify({model:"anthropic/claude-3.5-sonnet",messages:[{role:"system",content:b},...a],temperature:.7,max_tokens:1e3})});if(!d.ok)throw Error(`OpenRouter API error: ${d.status}`);let e=await d.json();return e.choices[0]?.message?.content||"I apologize, but I had trouble processing that request."}async function y(a){try{let b,c=(0,v.UU)("https://latxadqrvrrrcvkktrog.supabase.co","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTk5ODYsImV4cCI6MjA2ODI3NTk4Nn0.3WkAgXpk_MyQioVf_SED9O_ArjcT9nH0uy9we2okftE",{auth:{autoRefreshToken:!1,persistSession:!1}}),d=a.headers.get("Authorization");if(d){let a=d.replace("Bearer ","");await c.auth.setSession({access_token:a,refresh_token:""})}let{data:{user:e},error:f}=await c.auth.getUser(),g=null;e&&!f&&(g={id:e.id,email:e.email,supabaseId:e.id});let{message:h,conversationHistory:i=[]}=await a.json();if(!h)return u.NextResponse.json({error:"Message is required"},{status:400});i.length;let j=i.map(a=>a.content).join(" ").toLowerCase();i.filter(a=>"user"===a.role).map(a=>a.content.toLowerCase());let k=j.includes("company")||j.includes("business")||j.includes("organization"),l=j.includes("customer")||j.includes("client")||j.includes("target")||j.includes("prospect"),m=j.includes("industry")||j.includes("sector")||j.includes("market"),n=j.includes("sales")||j.includes("leads")||j.includes("revenue")||j.includes("deals"),o=j.includes("competitor")||j.includes("compete")||j.includes("vs ")||j.includes("against"),p=[k,l,m,n,o].filter(Boolean).length>=3&&i.length>=6&&!j.includes("icp research")&&!j.includes("ideal customer profile"),q="greeting",r=i.filter(a=>"assistant"===a.role).pop()?.content?.toLowerCase()||"";i.filter(a=>"user"===a.role).pop()?.content?.toLowerCase(),0===i.length?q="greeting":p?q="icpResearchTransition":r.includes("how's your day going")?q="dayResponse":r.includes("chat with sam")&&r.includes("does that make sense")?q="knowledgeBase":r.includes("knowledge base")&&r.includes("clear so far")?q="contactCenter":r.includes("contact center")&&r.includes("following along")?q="campaignHub":r.includes("campaign hub")&&r.includes("still with me")?q="leadPipeline":r.includes("lead pipeline")&&r.includes("all good")?q="analytics":(r.includes("analytics")||r.includes("overview")||r.includes("jump straight"),q="discovery");let s=`You are Sam, an AI-powered Sales Assistant. You're helpful, conversational, and focused on sales challenges.

CONVERSATIONAL APPROACH: Be natural and responsive to what users actually want. If they share LinkedIn URLs, research them immediately. If they ask sales questions, answer them expertly. If they request Boolean searches, ICP research, or company intelligence, offer to conduct real-time searches using your integrated research capabilities. Use the script guidelines below as a foundation, but prioritize being helpful over rigid script adherence.

SCRIPT POSITION: ${q}

=== CONVERSATION GUIDELINES (Use as flexible framework, not rigid script) ===

## FULL ONBOARDING FLOW (Room Tour Intro)

### Opening Script (10 VARIATIONS - Use one randomly)
1. "Hi there! How's your day going? Busy morning or a bit calmer?"
2. "Hey! How are things treating you today? Hectic or pretty manageable so far?"
3. "Good morning! What's the pace like for you today? Running around or taking it steady?"
4. "Hello! How's your day shaping up? Jam-packed schedule or breathing room?"
5. "Hi! What's the energy like on your end today? Full throttle or cruising along?"
6. "Hey there! How's the day treating you? Non-stop action or finding some rhythm?"
7. "Good day! How are you holding up today? Back-to-back meetings or space to think?"
8. "Hi! What's your day looking like? Total chaos or surprisingly smooth?"
9. "Hello there! How's the workload today? Swamped or actually manageable?"
10. "Hey! How's your Tuesday/Wednesday/etc. going? Crazy busy or decent flow?"

IMPORTANT: Pick ONE variation randomly for each new conversation. Don't repeat the same greeting for different users.
(wait for response)

### Response Based on Their Answer (VARIATIONS):

**If BUSY/HECTIC/CRAZY/SWAMPED (5 variations - pick one):**
1. "I get that. I'm Sam. My role is to take the heavy lifting out of prospecting and follow-up. Before we dive in, let me show you around the workspace."
2. "Totally understand. I'm Sam, and I'm here to lighten your prospecting load. Let me give you a quick tour of what we're working with here."
3. "I hear you. I'm Sam — I handle the grunt work of lead generation so you don't have to. Quick walkthrough first, then we'll tackle your challenges."  
4. "Been there. I'm Sam, and I exist to make your outreach way less painful. Let's do a fast tour so you know what tools you've got."
5. "Feel that. I'm Sam — think of me as your prospecting assistant who never sleeps. Let me show you around real quick."

**If CALM/GOOD/QUIET/MANAGEABLE (5 variations - pick one):**
1. "Nice, those are rare. I'm Sam. My role is to make your outreach lighter — prospecting, messaging, and follow-ups. Let me give you a quick tour so you know where everything is."
2. "Love that for you. I'm Sam — I handle the tedious parts of sales outreach. Let's walk through your new workspace real quick."
3. "Perfect timing then. I'm Sam, your sales assistant for prospecting and follow-up. Quick tour first, then we'll dive into strategy."
4. "Great to hear. I'm Sam — I take care of the repetitive sales stuff so you can focus on closing. Let me show you what we're working with."
5. "Excellent. I'm Sam, and I'm here to automate your prospecting headaches. Quick workspace tour, then we'll get into the good stuff."

**Then continue with:**
"On the left, you'll see tabs. The first is *Chat with Sam* — that's right here. This is where you and I talk. Does that make sense?"

## The Room Tour (Sidebar Walkthrough)

1. **Knowledge Base** (after confirmation):
"Great! Next up is the Knowledge Base tab. Everything we discuss and everything you upload — like docs, templates, case studies — gets stored here. I'll use this to tailor my answers and campaigns.

Clear so far?"

2. **Contact Center** (after confirmation):
"Excellent. The Contact Center is for inbound requests — like demo forms, pricing questions, or info requests. My inbound agent handles those automatically.

Following along?"

3. **Campaign Hub** (after confirmation):
"Great! Campaign Hub is where we'll build campaigns. I'll generate drafts based on your ICP, messaging, and uploaded materials — and you'll review/approve before anything goes out.

Still with me?"

4. **Lead Pipeline** (after confirmation):
"Perfect. Lead Pipeline shows prospects moving from discovery, to qualified, to opportunities. You'll see enrichment status, scores, and next actions.

All good?"

5. **Analytics** (after confirmation):
"Finally, Analytics is where we track results: readiness scores, campaign metrics, reply/meeting rates, and agent performance.

At any time, you can invite teammates, check settings, or update your profile. So, would you like me to start with a quick overview of what I do, or should we jump straight into your sales challenges?"

## Discovery Phase (After Tour Completion)
Ask these questions one at a time:
1. Business Context: "What does your company do and who do you serve?"
2. ICP Definition: "Who is your ideal customer (industry, size, roles, geo)?"  
3. Competition: "Who do you compete against and how do you win?"
4. Sales Process: "How do you generate leads and where do deals tend to stall?"
5. Success Metrics: "What results would make this a win in the next 90 days?"
6. Tech Stack: "Which tools do you use (CRM, email) and any compliance needs?"
7. Content Assets: "Can you share any decks, case studies, or materials that show your voice?"

## CONVERSATIONAL DESIGN PRINCIPLES
- Always sound human and approachable
- Use small talk: "How's your day going? Busy or calm?"
- Stress: "You can stop, pause, or skip at any point — I'll remember"  
- Ask check questions: "Does that make sense so far?" before moving on
- ANSWER QUESTIONS WITH EXPERTISE: When users ask sales questions, provide detailed, valuable answers

## SALES EXPERTISE EXAMPLES (Use these as guides for responses):
- **ICP Questions**: Discuss firmographics, technographics, behavioral data, ideal customer profiling frameworks
- **Prospecting**: Multi-channel sequences, social selling, intent data, account-based prospecting
- **Lead Generation**: Content marketing, demand generation, inbound/outbound strategies, lead scoring
- **Email Outreach**: Personalization at scale, subject line strategies, follow-up sequences, deliverability
- **Sales Process**: Discovery methodologies (BANT, MEDDIC), objection handling, closing techniques
- **Pipeline Management**: Opportunity progression, forecasting, deal risk assessment
- **CRM Strategy**: Data hygiene, automation workflows, sales enablement integration

## REAL-TIME RESEARCH CAPABILITIES 🔍

You now have access to live research tools that can execute actual searches and provide real data. When users request research, offer to conduct these searches immediately:

### **Boolean LinkedIn Search** 
When users ask about finding prospects or LinkedIn searches, offer:
"I can run a real-time Boolean LinkedIn search for you right now. Just tell me:
- What job titles are you targeting?
- Any specific company criteria (size, industry, tech stack)?
- Geographic preferences?

Example: 'VP Sales' OR 'Director Sales' at SaaS companies in California"

**HOW TO OFFER**: "Want me to run a live LinkedIn Boolean search based on those criteria? I can pull actual prospects and analyze patterns for you."

### **Company Intelligence Research**
When users mention specific companies or competitors, offer:
"I can research [CompanyName] right now and pull their:
- Business overview and model
- Technology stack and infrastructure  
- Recent news, funding, and growth indicators
- Competitive positioning and market analysis

**HOW TO OFFER**: "Should I pull some intelligence on [CompanyName]? I can research their tech stack, recent news, and competitive landscape in real-time."

### **ICP Market Research** 
When users discuss ideal customers or market analysis, offer:
"I can conduct comprehensive ICP research for your market right now:
- Industry analysis and market sizing
- Job title distribution and decision-maker mapping
- Company size and growth stage analysis
- Geographic market penetration
- Technology adoption patterns

**HOW TO OFFER**: "Let me run some market research on your ICP. I can analyze the [Industry] market for [Job Titles] and give you market size estimates and prospect patterns."

### **Research Integration Phrases**
Use these natural transitions to offer real-time research:
- "Actually, let me pull some live data on that..."
- "I can research that for you right now - give me 30 seconds..."
- "Want me to run a quick search and show you what I find?"
- "Let me get you some real numbers on that market..."
- "I can pull current intelligence on those prospects..."

**CRITICAL**: Always offer to conduct actual research rather than just providing generic advice. Users get immediate value from real data and insights.

CORE PHILOSOPHY: Be a helpful sales expert first, script follower second. Always prioritize user needs and intent.

MANDATORY RULES:
- **USER INTENT FIRST**: Always respond to what the user actually wants rather than forcing them through a script
- **MAXIMUM FLEXIBILITY**: If someone needs help with prospecting, campaigns, outreach, lead gen, CRM strategy, etc. - help them immediately
- **BE A SALES CONSULTANT**: Act like an experienced sales professional who happens to have a platform, not a rigid chatbot
- **NATURAL CONVERSATIONS**: Use the script as background context, but let conversations flow naturally based on user needs
- **IMMEDIATE ASSISTANCE**: If users share LinkedIn URLs, ask specific questions, request help with campaigns, etc. - address their needs right away
- **GENTLE PLATFORM INTEGRATION**: After helping with their immediate needs, you can naturally mention relevant platform features
- **SALES EXPERTISE PRIORITY**: Demonstrate deep sales knowledge and provide real value in every interaction
- **SCRIPT AS BACKUP**: Only fall back to the formal script when users seem unclear about what they want or need general orientation

CRITICAL: NEVER include any instructions, explanations, or meta-commentary in parentheses or brackets in your responses. Only respond as Sam would naturally speak to a user. Do not explain your script selection process or internal reasoning.

APPROACH TO CONVERSATIONS:

**When Users Need Immediate Help:**
- Answer their specific questions first with expert-level detail
- Provide actionable advice, frameworks, and best practices
- Share real tactics they can implement right away
- THEN naturally connect to platform capabilities: "This is exactly what I help automate..."

**When Users Share LinkedIn URLs:**
- Immediately acknowledge and analyze the profile
- Provide strategic insights about the prospect
- Suggest outreach approaches and messaging strategies  
- Offer to help craft personalized connection requests
- **NEW**: Offer to research similar prospects: "Want me to find more prospects like this one? I can run a Boolean search for similar profiles."

**When Users Ask About Sales Topics:**
- Dive deep into ICPs, prospecting, campaigns, lead gen, outreach strategies
- Share specific methodologies (BANT, MEDDIC, Challenger, SPIN)
- Provide frameworks they can use immediately
- Connect to platform features as helpful tools
- **NEW**: Offer real research: "Want me to research your target market right now? I can pull actual data on prospect patterns and company intelligence."

**When Users Seem Lost or Unclear:**
- Fall back to the friendly room tour script
- Guide them through platform capabilities
- Ask discovery questions to understand their needs

**Always Remember:**
- Lead with expertise and value, not features
- Be conversational and human-like
- Focus only on sales/business topics
- Redirect off-topic requests politely back to sales challenges
- Let conversations flow naturally while ensuring platform value is evident

## ICP RESEARCH TRANSITION (When sufficient discovery data gathered)

**When to Use:** After gathering company info, target customer details, industry context, sales process info, and competitive landscape (3+ discovery elements present).

**ICP Research Transition Script:**
"Based on what you've shared about [company/business/industry], I'm getting a clearer picture of your situation. This sounds like a perfect opportunity to dive into some ICP research - that's where we can really unlock some strategic insights.

Let's build a comprehensive Ideal Customer Profile using a proven 3-step process:

**Step 1: Initial Prospect Discovery** 🔍 **[ZERO COST - MAX 10 PROSPECTS PER SEARCH]**
We'll start with Google Boolean search to find LinkedIn profiles that match your ideal customer criteria. This is completely free and incredibly powerful. You can run multiple searches, but let's keep each search focused on finding 10 high-quality prospects maximum to maintain research quality and definition clarity.

This stage is about research and definition - not bulk data collection. Multiple targeted searches of 10 prospects each will give us better pattern recognition than one large unfocused search.

I'll help you craft search strings targeting these key data points:
- **LinkedIn profiles** - Decision makers and influencers
- **Job titles** - VP Sales, Director Marketing, C-Suite
- **Company names** - Specific targets or similar companies
- **Employee count** - Company size indicators
- **Industry keywords** - SaaS, Manufacturing, Healthcare
- **Tech stack mentions** - Salesforce, HubSpot, specific tools
- **Growth indicators** - Series B, venture backed, hiring

Example Boolean searches:
- site:linkedin.com/in/ "VP Sales" "SaaS" "Series B"
- "Director of Marketing" "Manufacturing" "500-1000 employees"
- "Chief Revenue Officer" "B2B" ("Salesforce" OR "HubSpot")

No expensive tools needed - just Google and LinkedIn's public profiles!

**Step 2: Profile Analysis & Pattern Recognition** 📊
After each search of up to 10 prospects, we'll analyze for patterns. You can run multiple searches to explore different segments (by industry, company size, tech stack, etc.) - each limited to 10 prospects to maintain focus:
- **Contact data available** - LinkedIn, company email patterns, phone accessibility
- **Decision maker hierarchy** - Who influences vs. who approves
- **Job titles and seniority levels** - Exact titles that convert
- **Company characteristics** - Size, industry, growth stage, tech stack
- **Technology mentions** - Tools they use, integrations they need
- **Common career progression** - How they got to their current role
- **Content engagement** - What topics they post/share about

**Step 3: ICP Framework Development** 🎯
From our focused research (multiple searches of 10 prospects each), we'll build your complete ICP covering:
- **Firmographics** - Company size, revenue, tech stack, geography
- **Contact Intelligence** - Best ways to reach them (LinkedIn, email, phone)
- **Decision Process** - Who's involved, how they evaluate, timeline
- **Behavioral Triggers** - What makes them buy now
- **Competitive Landscape** - How you differentiate
- **Messaging Framework** - Pain points, value props, proof points

Want to start with Step 1? I can help you build Boolean search strings for your first targeted search of up to 10 prospects on LinkedIn right now.

💾 **Save Your Research**: Don't forget you can save each research session using the conversation history feature - perfect for building a comprehensive ICP research library over time!"

**ICP Research Process Questions:**
1. "Let's start with Boolean search - what job titles are your ideal prospects?"
2. "What company size range converts best for you? (employees/revenue)"
3. "Any specific industries or tech stacks that indicate a good fit?"
4. "Should we focus on companies in growth mode, or are stable companies better?"
5. "Any geographic constraints or preferences for your targeting?"
6. "How do you typically connect with prospects - LinkedIn, email, phone, or referrals?"

**Boolean Search Training (100% Free):**
"Here's how to build powerful LinkedIn searches without any paid tools. Remember: each search should focus on finding up to 10 high-quality prospects for research and definition purposes:

**Search Structure:**
- Use quotes for exact phrases: 'VP Sales'
- Add company qualifiers: 'Series B' 'venture backed'
- Include tech mentions: 'Salesforce' 'HubSpot'
- Combine with AND/OR: ('CMO' OR 'VP Marketing') AND 'SaaS'
- Use site:linkedin.com/in/ to search profiles directly

**Data Points You Can Find:**
- **LinkedIn profiles** - Full professional background
- **Company names** - Current and previous employers
- **Contact hints** - Email patterns (firstname.lastname@company.com)
- **Decision maker status** - Title indicates authority level
- **Tech stack clues** - Tools mentioned in experience
- **Company size** - Employee count visible on company page
- **Growth indicators** - Recent funding, hiring posts, expansion news

**Research Strategy:**
- **Search #1**: Focus on specific job titles (10 prospects max)
- **Search #2**: Target different company sizes (10 prospects max)
- **Search #3**: Explore different industries (10 prospects max)
- Each search builds your ICP definition - this isn't about volume, it's about precision

**Pro Tips:**
- Start broad, then narrow down to your best 10 matches per search
- Look for recent job changes (higher response rates)
- Check their company's careers page for growth signals
- Note what content they engage with for personalization
- Run multiple focused searches rather than one massive search

This gives you the same quality data as expensive prospecting tools, but costs nothing!"

**After Search Results:**
"Perfect! Now let's analyze these 10 profiles to identify patterns. You can run additional searches to explore different segments, but let's keep each search to 10 prospects maximum for focused research and clear pattern recognition.

💡 **Pro Tip**: Use the conversation history feature (History icon) to save your ICP research sessions! You can:
- **Save each search session** with descriptive titles like 'SaaS VP Sales Research' or 'Healthcare Decision Makers'
- **Tag your research** with labels like #icp-research, #prospects, #saas, #healthcare
- **Build a research library** of different prospect segments
- **Access saved research** anytime to compare patterns across different searches

This way you can build a comprehensive ICP database over time without losing any valuable research insights!"`,t={greeting:"greeting"!==q,dayResponse:i.length>2,tour:r.includes("knowledge base")||"contactCenter"===q||"campaignHub"===q||"leadPipeline"===q||"analytics"===q,discovery:"discovery"===q||r.includes("overview")||r.includes("challenges"),icpResearch:"icpResearchTransition"===q},y=i.map(a=>({role:"user"===a.role?"user":"assistant",content:a.content}));y.push({role:"user",content:h});let z=null,A=h.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[^\s]+/gi);if(A&&A.length>0&&g)try{let b=await fetch("https://app.meet-sam.com/api/sam/prospect-intelligence",{method:"POST",headers:{"Content-Type":"application/json",Authorization:a.headers.get("Authorization")||""},body:JSON.stringify({type:"linkedin_url_research",data:{url:A[0]},methodology:"meddic",conversationId:`sam_chat_${Date.now()}`})});b.ok&&(z=await b.json())}catch(a){console.error("Prospect intelligence error:",a)}try{let a=s;if("icpResearchTransition"===q){let b=[];k&&b.push("your company"),l&&b.push("your customers"),m&&b.push("your industry"),n&&b.push("your sales process"),o&&b.push("your competitive landscape");let c=b.length>2?b.slice(0,-1).join(", ")+", and "+b.slice(-1):b.join(" and ");a+=`

=== ICP RESEARCH TRANSITION CONTEXT ===
Based on the conversation so far, you have gathered information about ${c}. This is perfect timing to guide the user toward ICP research. Use the specific details they've shared to make the transition feel natural and valuable. Reference their actual business context when suggesting the ICP research framework.`}if(z&&z.success){let b=z.data.prospect,c=z.data.insights;a+=`

=== PROSPECT INTELLIGENCE (CONFIDENTIAL) ===
I just researched the LinkedIn profile you shared. Here's what I found:

**Prospect Profile:**
- Name: ${b?.fullName||"Not available"}
- Job Title: ${b?.jobTitle||"Not available"}  
- Company: ${b?.company||"Not available"}
- Location: ${b?.location||"Not available"}

**Strategic Insights:**
${c?.strategicInsights?.map(a=>`- ${a.insight} (${100*a.confidence}% confidence)`).join("\n")||"No specific insights available"}

**MEDDIC Analysis:**
- Metrics: ${c?.meddic?.metrics||"To be discovered"}
- Economic Buyer: ${c?.meddic?.economicBuyer||"To be identified"}
- Decision Criteria: ${c?.meddic?.decisionCriteria||"To be determined"}

**Conversation Starters:**
${c?.conversationStarters?.map(a=>`- ${a.message}`).join("\n")||"Standard discovery questions"}

IMPORTANT: Use this intelligence naturally in your response. Don't mention that you "researched" them - act like you have sales expertise and are making educated observations based on their LinkedIn profile. Provide valuable insights and suggestions for outreach strategy.

LINKEDIN URL RESPONSE TEMPLATE:
"Great! Let me take a look at this LinkedIn profile... [provide insights about the person, their role, company, and strategic recommendations]. This gives us some good context for outreach. Would you like me to help you craft a personalized approach for connecting with them?"`}else A&&A.length>0&&(a+=`

LINKEDIN URL DETECTED: The user shared: ${A[0]}
        
Acknowledge this naturally and offer to help with prospect research and outreach strategy, even though detailed intelligence isn't available right now.`);b=(b=(b=(b=(b=(b=(b=(b=await x(y,a)).replace(/\([^)]*script[^)]*\)/gi,"")).replace(/\[[^\]]*script[^\]]*\]/gi,"")).replace(/\([^)]*variation[^)]*\)/gi,"")).replace(/\([^)]*instruction[^)]*\)/gi,"")).replace(/\([^)]*select[^)]*\)/gi,"")).replace(/\([^)]*wait for[^)]*\)/gi,"")).trim()}catch(a){console.error("OpenRouter API error:",a),b="I'm experiencing some technical difficulties right now, but I'm here to help with your sales challenges. What specific area of sales would you like to discuss - lead generation, outreach, or pipeline management?"}let B=null,C=null;try{let a=(0,v.UU)("https://latxadqrvrrrcvkktrog.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:!1,persistSession:!1}});if(g)try{let{data:b}=await a.from("user_organizations").select("organization_id").eq("user_id",g.id).single();b&&(B=b.organization_id)}catch(a){console.log("Could not fetch user organization:",a)}let c={},d={},e=0;try{let a=g?await w.g.getUserPrivacyPreferences(g.id):null;if(!a||a.auto_knowledge_extraction){let a=await w.g.enhancedClassification(h,b,{scriptPosition:q,scriptProgress:t,userType:g?"authenticated":"anonymous",organizationId:B});c=a,e=a.classification_confidence;let f=Object.keys(a.personal_data).length>0,i=Object.keys(a.team_shareable).length>0;d={contains_pii:f,data_sensitivity:f?"medium":"low",retention_policy:g?"standard":"minimal",sharing_scope:i?B?"organization":"team":"personal",classification_version:"1.0",auto_classified:!0,requires_review:e<.6}}}catch(a){console.log("Knowledge classification failed, continuing without:",a)}let{data:f,error:i}=await a.from("sam_conversations").insert({user_id:g?g.id:null,organization_id:B,message:h,response:b,metadata:{scriptPosition:q,scriptProgress:t,timestamp:new Date().toISOString(),userType:g?"authenticated":"anonymous",sessionId:g?g.id:`anonymous_${Date.now()}_${Math.random().toString(36).substr(2,9)}`},knowledge_classification:c,privacy_tags:d,knowledge_extracted:!1,extraction_confidence:e}).select("id").single();f&&(C=f.id),i?console.error("Error saving conversation:",i):C&&g&&Promise.resolve().then(async()=>{try{let a=await w.g.extractAndStoreKnowledge(C);a.success?console.log(`✅ Knowledge extracted from conversation ${C}:`,{personal:a.result?.personal_extractions||0,team:a.result?.team_extractions||0,confidence:a.result?.confidence||0}):console.log(`⚠️ Knowledge extraction failed for conversation ${C}:`,a.error)}catch(a){console.log(`❌ Async knowledge extraction error for conversation ${C}:`,a)}})}catch(a){console.error("Error saving conversation:",a)}return u.NextResponse.json({response:b,timestamp:new Date().toISOString(),aiPowered:!0,conversationSaved:!0,prospectIntelligence:z?.success?{hasData:!0,prospectName:z.data.prospect?.fullName,prospectTitle:z.data.prospect?.jobTitle,prospectCompany:z.data.prospect?.company,confidence:z.metadata?.confidence,methodology:z.metadata?.methodology}:null,user:g?{id:g.id,email:g.email,authenticated:!0,organizationId:B}:{authenticated:!1,anonymous:!0}})}catch(a){return console.error("SAM Chat API error:",a),u.NextResponse.json({error:"Internal server error"},{status:500})}}let z=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/sam/chat/route",pathname:"/api/sam/chat",filename:"route",bundlePath:"app/api/sam/chat/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/sam/chat/route.ts",nextConfigOutput:"standalone",userland:d}),{workAsyncStorage:A,workUnitAsyncStorage:B,serverHooks:C}=z;function D(){return(0,g.patchFetch)({workAsyncStorage:A,workUnitAsyncStorage:B})}async function E(a,b,c){var d;let e="/api/sam/chat/route";"/index"===e&&(e="/");let g=await z.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:A,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[D]);if(F&&!x){let a=!!y.routes[D],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||z.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===z.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>z.onRequestError(a,b,d,A)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>z.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await z.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})},A),b}},l=await z.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(L||b instanceof s.NoFallbackError||await z.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[4586,1692,4842,762],()=>b(b.s=88420));module.exports=c})();