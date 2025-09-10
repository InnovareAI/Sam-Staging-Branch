(()=>{var a={};a.id=20,a.ids=[20],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},11997:a=>{"use strict";a.exports=require("punycode")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},27910:a=>{"use strict";a.exports=require("stream")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55591:a=>{"use strict";a.exports=require("https")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},74075:a=>{"use strict";a.exports=require("zlib")},78335:()=>{},79551:a=>{"use strict";a.exports=require("url")},81630:a=>{"use strict";a.exports=require("http")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},88420:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>D,patchFetch:()=>C,routeModule:()=>y,serverHooks:()=>B,workAsyncStorage:()=>z,workUnitAsyncStorage:()=>A});var d={};c.r(d),c.d(d,{POST:()=>x});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(10641),v=c(82461);async function w(a,b){let c=process.env.OPENROUTER_API_KEY;if(!c)throw Error("OpenRouter API key not configured");let d=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${c}`,"Content-Type":"application/json","HTTP-Referer":"https://app.meet-sam.com","X-Title":"SAM AI Platform"},body:JSON.stringify({model:"anthropic/claude-3.5-sonnet",messages:[{role:"system",content:b},...a],temperature:.7,max_tokens:1e3})});if(!d.ok)throw Error(`OpenRouter API error: ${d.status}`);let e=await d.json();return e.choices[0]?.message?.content||"I apologize, but I had trouble processing that request."}async function x(a){try{let b,c=(0,v.UU)("https://latxadqrvrrrcvkktrog.supabase.co","eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTk5ODYsImV4cCI6MjA2ODI3NTk4Nn0.3WkAgXpk_MyQioVf_SED9O_ArjcT9nH0uy9we2okftE",{auth:{autoRefreshToken:!1,persistSession:!1}}),d=a.headers.get("Authorization");if(d){let a=d.replace("Bearer ","");await c.auth.setSession({access_token:a,refresh_token:""})}let{data:{user:e},error:f}=await c.auth.getUser(),g=null;e&&!f&&(g={id:e.id,email:e.email,supabaseId:e.id});let{message:h,conversationHistory:i=[]}=await a.json();if(!h)return u.NextResponse.json({error:"Message is required"},{status:400});i.length;let j="greeting",k=i.filter(a=>"assistant"===a.role).pop()?.content?.toLowerCase()||"";i.filter(a=>"user"===a.role).pop()?.content?.toLowerCase(),0===i.length?j="greeting":k.includes("how's your day going")?j="dayResponse":k.includes("chat with sam")&&k.includes("does that make sense")?j="knowledgeBase":k.includes("knowledge base")&&k.includes("clear so far")?j="contactCenter":k.includes("contact center")&&k.includes("following along")?j="campaignHub":k.includes("campaign hub")&&k.includes("still with me")?j="leadPipeline":k.includes("lead pipeline")&&k.includes("all good")?j="analytics":(k.includes("analytics")||k.includes("overview")||k.includes("jump straight"),j="discovery");let l=`You are Sam, an AI-powered Sales Assistant. You MUST follow the exact conversation scripts from the SAM training data methodically.

CRITICAL RULE: Use the EXACT wording from the scripts below. Do not paraphrase or improvise.

SCRIPT POSITION: ${j}

=== EXACT CONVERSATION SCRIPTS FROM TRAINING DATA ===

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

MANDATORY RULES:
- BE CONVERSATIONAL & FLEXIBLE: When users ask sales-related questions (ICPs, prospecting, campaigns, etc.), engage with them directly and provide helpful answers
- BALANCE STRUCTURE & FLOW: Use the script as a guide but allow natural conversation flow when topics are relevant to sales/business
- SALES EXPERTISE: You are a sales expert - if they want to discuss ICPs, lead gen, outreach, campaigns, etc., dive into those topics immediately
- GENTLE GUIDANCE: After discussing their topics, you can say something like "This is exactly the kind of thing I help with. Let me show you how this works in the platform..."
- NATURAL TRANSITIONS: Use their questions as bridges to relevant platform features rather than strict script adherence
- CURRENT POSITION: You are at the ${j} stage, but prioritize being helpful over rigid script following

INSTRUCTIONS:
- BE AN AI SALES EXPERT: Use your full AI intelligence to provide detailed, helpful answers to sales questions
- ANSWER QUESTIONS THOROUGHLY: When they ask about ICPs, prospecting, campaigns, lead gen strategies, etc. - give comprehensive, expert-level responses
- PROVIDE REAL VALUE: Share specific tactics, frameworks, best practices, and actionable advice 
- THEN CONNECT TO PLATFORM: After giving a helpful answer, connect it to how the platform can help: "This is exactly what I help automate in the platform..."
- SHOW YOUR EXPERTISE: Demonstrate deep sales knowledge - don't just deflect to scripts
- SALES FOCUS ONLY: Only discuss sales, business, marketing, prospecting, ICPs, lead generation, campaigns, CRM, and related business topics
- REDIRECT OFF-TOPIC: If they ask about anything unrelated to sales/business, politely redirect: "I'm focused on helping with your sales challenges. Let's get back to discussing how I can help with your prospecting and lead generation..."
- BE THE CONSULTANT: Act like a senior sales consultant who happens to have a platform - lead with expertise, not just features
- NATURAL FLOW: Let conversations develop naturally around sales topics while ensuring they eventually see the platform capabilities`,m={greeting:"greeting"!==j,dayResponse:i.length>2,tour:k.includes("knowledge base")||"contactCenter"===j||"campaignHub"===j||"leadPipeline"===j||"analytics"===j,discovery:"discovery"===j||k.includes("overview")||k.includes("challenges")},n=i.map(a=>({role:"user"===a.role?"user":"assistant",content:a.content}));n.push({role:"user",content:h});try{b=await w(n,l)}catch(a){console.error("OpenRouter API error:",a),b="I'm experiencing some technical difficulties right now, but I'm here to help with your sales challenges. What specific area of sales would you like to discuss - lead generation, outreach, or pipeline management?"}let o=null;try{let a=(0,v.UU)("https://latxadqrvrrrcvkktrog.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{autoRefreshToken:!1,persistSession:!1}});if(g)try{let{data:b}=await a.from("user_organizations").select("organization_id").eq("user_id",g.id).single();b&&(o=b.organization_id)}catch(a){console.log("Could not fetch user organization:",a)}let{error:c}=await a.from("sam_conversations").insert({user_id:g?g.id:null,organization_id:o,message:h,response:b,metadata:{scriptPosition:j,scriptProgress:m,timestamp:new Date().toISOString(),userType:g?"authenticated":"anonymous",sessionId:g?g.id:`anonymous_${Date.now()}_${Math.random().toString(36).substr(2,9)}`}});c&&console.error("Error saving conversation:",c)}catch(a){console.error("Error saving conversation:",a)}return u.NextResponse.json({response:b,timestamp:new Date().toISOString(),aiPowered:!0,conversationSaved:!0,user:g?{id:g.id,email:g.email,authenticated:!0,organizationId:o}:{authenticated:!1,anonymous:!0}})}catch(a){return console.error("SAM Chat API error:",a),u.NextResponse.json({error:"Internal server error"},{status:500})}}let y=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/sam/chat/route",pathname:"/api/sam/chat",filename:"route",bundlePath:"app/api/sam/chat/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/sam/chat/route.ts",nextConfigOutput:"standalone",userland:d}),{workAsyncStorage:z,workUnitAsyncStorage:A,serverHooks:B}=y;function C(){return(0,g.patchFetch)({workAsyncStorage:z,workUnitAsyncStorage:A})}async function D(a,b,c){var d;let e="/api/sam/chat/route";"/index"===e&&(e="/");let g=await y.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:z,routerServerContext:A,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(z.dynamicRoutes[E]||z.routes[D]);if(F&&!x){let a=!!z.routes[D],b=z.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||y.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===y.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:z,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>y.onRequestError(a,b,d,A)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>y.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await y.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})},A),b}},l=await y.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:z,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(L||b instanceof s.NoFallbackError||await y.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},96487:()=>{}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[586,692,461],()=>b(b.s=88420));module.exports=c})();