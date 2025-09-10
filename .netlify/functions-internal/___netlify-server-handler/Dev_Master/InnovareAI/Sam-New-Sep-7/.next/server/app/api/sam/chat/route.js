(()=>{var a={};a.id=20,a.ids=[20],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},11997:a=>{"use strict";a.exports=require("punycode")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},27910:a=>{"use strict";a.exports=require("stream")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55591:a=>{"use strict";a.exports=require("https")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},73024:a=>{"use strict";a.exports=require("node:fs")},74075:a=>{"use strict";a.exports=require("zlib")},76531:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>O,patchFetch:()=>N,routeModule:()=>J,serverHooks:()=>M,workAsyncStorage:()=>K,workUnitAsyncStorage:()=>L});var d={};c.r(d),c.d(d,{POST:()=>I});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(10641),v=c(50698),w=c(40082),x=c(45299),y=c(65200),z=c(73582);let A=new(require("node:async_hooks")).AsyncLocalStorage;var B=c(66079);let C=async()=>{var a,b;let c;try{let a=await (0,x.TG)(),b=(0,z._b)(a,w.AA.Headers.ClerkRequestData);c=(0,B.Kk)(b)}catch(a){if(a&&(0,x.Sz)(a))throw a}let d=null!=(b=null==(a=A.getStore())?void 0:a.get("requestData"))?b:c;return(null==d?void 0:d.secretKey)||(null==d?void 0:d.publishableKey)?(0,y.n)(d):(0,y.n)({})};async function D(){c(77925);let{userId:a}=await (0,v.j)();return a?(await C()).users.getUser(a):null}var E=c(82461);async function F(){try{let{userId:a,orgId:b,orgSlug:c,orgRole:d}=await (0,v.j)();if(!a)return null;let e=await D();if(!e)return null;return{id:a,clerkId:a,email:e.emailAddresses[0]?.emailAddress||"",firstName:e.firstName||void 0,lastName:e.lastName||void 0,imageUrl:e.imageUrl||void 0,organizationId:b||void 0,organizationSlug:c||void 0,role:d||void 0}}catch(a){return console.error("Error getting current user:",a),null}}async function G(a,b){let c=process.env.OPENROUTER_API_KEY;if(!c)throw Error("OpenRouter API key not configured");let d=await fetch("https://openrouter.ai/api/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${c}`,"Content-Type":"application/json","HTTP-Referer":"https://app.meet-sam.com","X-Title":"SAM AI Platform"},body:JSON.stringify({model:"anthropic/claude-3.5-sonnet",messages:[{role:"system",content:b},...a],temperature:.7,max_tokens:1e3})});if(!d.ok)throw Error(`OpenRouter API error: ${d.status}`);let e=await d.json();return e.choices[0]?.message?.content||"I apologize, but I had trouble processing that request."}(0,E.UU)("https://latxadqrvrrrcvkktrog.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY);let H=(0,E.UU)("https://latxadqrvrrrcvkktrog.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY);async function I(a){try{let b,c=await F();if(!c)return u.NextResponse.json({error:"Unauthorized"},{status:401});let{message:d,conversationHistory:e=[]}=await a.json();if(!d)return u.NextResponse.json({error:"Message is required"},{status:400});e.length;let f="greeting",g=e.filter(a=>"assistant"===a.role).pop()?.content?.toLowerCase()||"";e.filter(a=>"user"===a.role).pop()?.content?.toLowerCase(),0===e.length?f="greeting":g.includes("how's your day going")?f="dayResponse":g.includes("chat with sam")&&g.includes("does that make sense")?f="knowledgeBase":g.includes("knowledge base")&&g.includes("clear so far")?f="contactCenter":g.includes("contact center")&&g.includes("following along")?f="campaignHub":g.includes("campaign hub")&&g.includes("still with me")?f="leadPipeline":g.includes("lead pipeline")&&g.includes("all good")?f="analytics":(g.includes("analytics")||g.includes("overview")||g.includes("jump straight"),f="discovery");let h=`You are Sam, an AI-powered Sales Assistant. You MUST follow the exact conversation scripts from the SAM training data methodically.

CRITICAL RULE: Use the EXACT wording from the scripts below. Do not paraphrase or improvise.

SCRIPT POSITION: ${f}

=== EXACT CONVERSATION SCRIPTS FROM TRAINING DATA ===

## FULL ONBOARDING FLOW (Room Tour Intro)

### Opening Script
"Hi there! How's your day going? Busy morning or a bit calmer?"
(wait for response)

### Response Based on Their Answer:
- If BUSY/HECTIC/CRAZY: "I get that. I'm Sam. My role is to take the heavy lifting out of prospecting and follow-up. Before we dive in, let me show you around the workspace.

On the left, you'll see tabs. The first is *Chat with Sam* — that's right here. This is where you and I talk. Does that make sense?"

- If CALM/GOOD/QUIET: "Nice, those are rare. I'm Sam. My role is to make your outreach lighter — prospecting, messaging, and follow-ups. Before we dive in, let me give you a quick tour so you know where everything is.

This is where we'll talk. You can ask me questions here anytime. If you need to stop or take a break, I'll remember and we'll resume later. Does that sound good?"

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
- If users ask questions, briefly answer but say "Before we dive deeper into that, let me finish showing you around"

MANDATORY RULES:
- FOLLOW THE SCRIPT SEQUENCE: Stick to the script progression above 
- BUT BE FLEXIBLE: Answer any questions the user asks naturally and helpfully
- SCRIPT PRIORITY: When moving to the next script section, use the EXACT wording provided
- HANDLE INTERRUPTIONS: If they ask questions during the script, answer them, then gently return to the script with "Let me continue showing you around" or similar
- ONE QUESTION AT A TIME: In discovery phase, ask one question, get their answer, provide insight, then move to next question
- CURRENT POSITION: You are at the ${f} stage

INSTRUCTIONS:
- If this is the exact next script step, use the exact script wording above
- If they're asking a question or making a comment, respond naturally and helpfully
- Always maintain your identity as Sam, the sales assistant
- Be conversational and helpful while progressing through the script when appropriate`,i={greeting:"greeting"!==f,dayResponse:e.length>2,tour:g.includes("knowledge base")||"contactCenter"===f||"campaignHub"===f||"leadPipeline"===f||"analytics"===f,discovery:"discovery"===f||g.includes("overview")||g.includes("challenges")},j=e.map(a=>({role:"user"===a.role?"user":"assistant",content:a.content}));j.push({role:"user",content:d});try{b=await G(j,h)}catch(a){console.error("OpenRouter API error:",a),b="I'm experiencing some technical difficulties right now, but I'm here to help with your sales challenges. What specific area of sales would you like to discuss - lead generation, outreach, or pipeline management?"}try{let{error:a}=await H.from("sam_conversations").insert({user_id:c.clerkId,organization_id:c.organizationId||null,message:d,response:b,metadata:{scriptPosition:f,scriptProgress:i,timestamp:new Date().toISOString()}});a&&console.error("Error saving conversation:",a)}catch(a){console.error("Error saving conversation:",a)}return u.NextResponse.json({response:b,timestamp:new Date().toISOString(),aiPowered:!0,user:{id:c.clerkId,organizationId:c.organizationId}})}catch(a){return console.error("SAM Chat API error:",a),u.NextResponse.json({error:"Internal server error"},{status:500})}}let J=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/sam/chat/route",pathname:"/api/sam/chat",filename:"route",bundlePath:"app/api/sam/chat/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/sam/chat/route.ts",nextConfigOutput:"standalone",userland:d}),{workAsyncStorage:K,workUnitAsyncStorage:L,serverHooks:M}=J;function N(){return(0,g.patchFetch)({workAsyncStorage:K,workUnitAsyncStorage:L})}async function O(a,b,c){var d;let e="/api/sam/chat/route";"/index"===e&&(e="/");let g=await J.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,resolvedPathname:C}=g,D=(0,j.normalizeAppPath)(e),E=!!(y.dynamicRoutes[D]||y.routes[C]);if(E&&!x){let a=!!y.routes[C],b=y.dynamicRoutes[D];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let F=null;!E||J.isDev||x||(F="/index"===(F=C)?"/":F);let G=!0===J.isDev||!E,H=E&&!G,I=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:G,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:H,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>J.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>J.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${I} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${I} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&A&&B&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!E)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await J.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:H,isOnDemandRevalidate:A})},z),b}},l=await J.handleResponse({req:a,nextConfig:w,cacheKey:F,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:B,responseGenerator:k,waitUntil:c.waitUntil});if(!E)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",A?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&E||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${I} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":I,"http.target":a.url}},g))}catch(b){if(L||b instanceof s.NoFallbackError||await J.onRequestError(a,b,{routerKind:"App Router",routePath:D,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:H,isOnDemandRevalidate:A})}),E)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},76760:a=>{"use strict";a.exports=require("node:path")},77598:a=>{"use strict";a.exports=require("node:crypto")},78335:()=>{},79551:a=>{"use strict";a.exports=require("url")},81630:a=>{"use strict";a.exports=require("http")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},96487:()=>{}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[745,856,331],()=>b(b.s=76531));module.exports=c})();