(()=>{var a={};a.id=4411,a.ids=[4411],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10131:(a,b,c)=>{"use strict";c.d(b,{Eu:()=>h,Y0:()=>i,mf:()=>f,o0:()=>g});var d=c(13333);class e{constructor(a){this.client=new d.hA(a.apiKey),this.config=a}async checkEmailSuppression(a){try{let b=await this.client.getSuppressions("outbound"),c=b.Suppressions?.find(b=>b.EmailAddress.toLowerCase()===a.toLowerCase());if(c)return{canSend:!1,reason:this.getSuppressionReasonMessage(c.SuppressionReason),suppressionInfo:c};return{canSend:!0}}catch(b){return console.error(`Error checking email suppression for ${a}:`,b),{canSend:!0,reason:"Unable to verify suppression status - will attempt to send"}}}getSuppressionReasonMessage(a){switch(a){case"HardBounce":return"Email address has hard bounced (invalid/non-existent)";case"SpamComplaint":return"Recipient has marked emails as spam";case"ManualSuppression":return"Email address has been manually suppressed";case"Unsubscribe":return"Recipient has unsubscribed from emails";default:return`Email is suppressed (${a})`}}async reactivateEmail(a){try{return await this.client.deleteSuppressions("outbound",{Suppressions:[{EmailAddress:a}]}),{success:!0,message:"Email address reactivated successfully"}}catch(a){return{success:!1,message:a.Message||"Failed to reactivate email address"}}}async sendEmailSafely(a){try{let b=await this.checkEmailSuppression(a.To);if(!b.canSend)return{success:!1,error:`Cannot send email: ${b.reason}`,suppressionInfo:b.suppressionInfo,canRetryAfterReactivation:!0};let c=await this.client.sendEmail({From:a.From||this.config.fromEmail,To:a.To,Subject:a.Subject,HtmlBody:a.HtmlBody,TextBody:a.TextBody,MessageStream:a.MessageStream||"outbound"});return{success:!0,messageId:c.MessageID}}catch(b){if(b.Message?.includes("InactiveRecipientsError")||b.Message?.includes("inactive"))return{success:!1,error:"Recipient is marked as inactive/suppressed in Postmark",suppressionInfo:(await this.checkEmailSuppression(a.To)).suppressionInfo,canRetryAfterReactivation:!0};return{success:!1,error:b.Message||"Unknown email sending error",canRetryAfterReactivation:!1}}}generateTestEmails(){return{safe:["test@innovareai.com","sandbox@3cubed.ai","demo@meet-sam.com"],forTesting:["test@blackhole.postmarkapp.com","bounce@simulator.postmarkapp.com"],description:"Use safe emails for production testing, test emails for development"}}createBypassEmail(a){return Date.now(),console.log(`EMAIL_BYPASS_MODE: Original recipient: ${a}, redirected to test email at ${new Date().toISOString()}`),"test@blackhole.postmarkapp.com"}async bulkCheckSuppressions(a){let b=new Map;try{let c=await this.client.getSuppressions("outbound"),d=new Set(c.Suppressions?.map(a=>a.EmailAddress.toLowerCase())||[]);for(let e of a)if(d.has(e.toLowerCase())){let a=c.Suppressions?.find(a=>a.EmailAddress.toLowerCase()===e.toLowerCase());b.set(e,{canSend:!1,reason:a?this.getSuppressionReasonMessage(a.SuppressionReason):"Suppressed",suppressionInfo:a})}else b.set(e,{canSend:!0})}catch(c){for(let d of(console.error("Error in bulk suppression check:",c),a))b.set(d,{canSend:!0,reason:"Unable to verify suppression status"})}return b}}function f(a){let b=function(a){let b={InnovareAI:{apiKey:process.env.POSTMARK_INNOVAREAI_API_KEY||"",fromEmail:"sp@innovareai.com",companyName:"InnovareAI",contactEmail:"sp@innovareai.com",contactName:"Sarah Powell"},"3cubedai":{apiKey:process.env.POSTMARK_3CUBEDAI_API_KEY||"",fromEmail:"sophia@3cubed.ai",companyName:"3CubedAI",contactEmail:"sophia@3cubed.ai",contactName:"Sophia Caldwell"}}[a];return b?.apiKey?b:(console.error(`Missing Postmark API key for ${a}`),null)}(a);return b?new e(b):null}let g="true"===process.env.EMAIL_BYPASS_MODE;function h(a){return g}function i(){return"test@blackhole.postmarkapp.com"}},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},11997:a=>{"use strict";a.exports=require("punycode")},12412:a=>{"use strict";a.exports=require("assert")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},27910:a=>{"use strict";a.exports=require("stream")},28354:a=>{"use strict";a.exports=require("util")},29021:a=>{"use strict";a.exports=require("fs")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{"use strict";a.exports=require("path")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{"use strict";a.exports=require("crypto")},55591:a=>{"use strict";a.exports=require("https")},57029:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>G,patchFetch:()=>F,routeModule:()=>B,serverHooks:()=>E,workAsyncStorage:()=>C,workUnitAsyncStorage:()=>D});var d={};c.r(d),c.d(d,{POST:()=>A});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(10641),v=c(82461),w=c(13333),x=c(10131);let y=(0,v.UU)("https://latxadqrvrrrcvkktrog.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY),z=new w.hA(process.env.POSTMARK_SERVER_TOKEN);async function A(a){try{let{email:b,workspaceId:c,role:d="member"}=await a.json();if(!b||!c)return u.NextResponse.json({error:"Email and workspace ID required"},{status:400});let{data:e,error:f}=await y.from("workspaces").select("name, owner_id, users!workspaces_owner_id_fkey(first_name, last_name, email)").eq("id",c).single();if(f||!e)return u.NextResponse.json({error:"Workspace not found"},{status:404});let{data:g}=await y.from("users").select("id").eq("email",b).single(),h=null,i=!g;if(g){let{data:a}=await y.from("workspace_members").select("id").eq("workspace_id",c).eq("user_id",g.id).single();if(a)return u.NextResponse.json({error:"User already a member"},{status:400});await y.from("workspace_members").insert({workspace_id:c,user_id:g.id,role:d})}else h=`invite_${Date.now()}_${Math.random().toString(36).substr(2,9)}`,await y.from("workspace_invitations").insert({email:b,workspace_id:c,role:d,invite_token:h,invited_by:e.owner_id,expires_at:new Date(Date.now()+6048e5).toISOString(),company:"InnovareAI"});let j=Array.isArray(e.users)?e.users[0]:e.users,k=`${j?.first_name||""} ${j?.last_name||""}`.trim()||j?.email,l=(0,x.mf)("InnovareAI");if(l){let a=b,c="";(0,x.Eu)(b)&&(a=(0,x.Y0)(),c=` (BYPASS MODE: Original recipient was ${b})`,console.warn(`EMAIL_BYPASS_MODE: Redirecting workspace invite from ${b} to ${a}`));let f=i?`You're invited to join ${e.name} on SAM AI${c}`:`You've been added to ${e.name} on SAM AI${c}`,g=i?`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${c?`<div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 20px; color: #856404;"><strong>TEST MODE:</strong> This email was originally intended for ${b}</div>`:""}
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7C3AED; margin: 0;">SAM AI</h1>
            <p style="color: #6B7280; margin: 5px 0;">AI-Powered Sales Assistant Platform</p>
          </div>
          
          <div style="background: #F9FAFB; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
            <h2 style="color: #1F2937; margin-top: 0;">You're invited to collaborate!</h2>
            <p style="color: #4B5563; line-height: 1.6;">
              <strong>${k}</strong> has invited you to join the workspace 
              <strong>"${e.name}"</strong> on SAM AI as a <strong>${d}</strong>.
            </p>
            <p style="color: #4B5563; line-height: 1.6;">
              SAM AI is an intelligent sales assistant platform that helps teams automate 
              prospecting, lead generation, and customer engagement.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://app.meet-sam.com/invite/${h}" 
               style="background: #7C3AED; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
              Accept Invitation & Join Workspace
            </a>
          </div>
          
          <div style="background: #FEF3C7; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p style="color: #92400E; margin: 0; font-size: 14px;">
              <strong>⏰ This invitation expires in 7 days.</strong><br>
              Click the button above to create your account and join the workspace.
            </p>
          </div>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
          
          <p style="color: #6B7280; font-size: 14px; text-align: center;">
            This invitation was sent to ${c?b+" (redirected for testing)":a}. If you didn't expect this email, you can safely ignore it.
          </p>
        </div>
      `:`
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          ${c?`<div style="background: #fff3cd; padding: 10px; border-radius: 4px; margin-bottom: 20px; color: #856404;"><strong>TEST MODE:</strong> This email was originally intended for ${b}</div>`:""}
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #7C3AED; margin: 0;">SAM AI</h1>
            <p style="color: #6B7280; margin: 5px 0;">AI-Powered Sales Assistant Platform</p>
          </div>
          
          <div style="background: #F0FDF4; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
            <h2 style="color: #1F2937; margin-top: 0;">Welcome to the team!</h2>
            <p style="color: #4B5563; line-height: 1.6;">
              <strong>${k}</strong> has added you to the workspace 
              <strong>"${e.name}"</strong> as a <strong>${d}</strong>.
            </p>
            <p style="color: #4B5563; line-height: 1.6;">
              You can now access the workspace and collaborate with your team using SAM AI.
            </p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="https://app.meet-sam.com" 
               style="background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
              Access Your Workspace
            </a>
          </div>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
          
          <p style="color: #6B7280; font-size: 14px; text-align: center;">
            This email was sent to ${c?b+" (redirected for testing)":a} because you've been added to a SAM AI workspace.
          </p>
        </div>
      `,j=i?`
        You're invited to join ${e.name} on SAM AI
        ${c}
        
        ${k} has invited you to join the workspace "${e.name}" as a ${d}.
        
        SAM AI is an intelligent sales assistant platform that helps teams automate prospecting, lead generation, and customer engagement.
        
        Accept your invitation: https://app.meet-sam.com/invite/${h}
        
        This invitation expires in 7 days.
        
        If you didn't expect this email, you can safely ignore it.
      `:`
        You've been added to ${e.name} on SAM AI
        ${c}
        
        Welcome to the team!
        
        ${k} has added you to the workspace "${e.name}" as a ${d}.
        
        Access your workspace: https://app.meet-sam.com
        
        You can now collaborate with your team using SAM AI.
      `,m=await l.sendEmailSafely({To:a,Subject:f,HtmlBody:g,TextBody:j});m.success?console.log(`Workspace invite email sent successfully to ${a} (MessageID: ${m.messageId})`):(console.error("Workspace invite email failed:",{error:m.error,targetEmail:a,originalEmail:b,suppressionInfo:m.suppressionInfo,canRetryAfterReactivation:m.canRetryAfterReactivation}),m.suppressionInfo&&console.warn(`Email suppression detected for workspace invite to ${b}:`,{reason:m.suppressionInfo.SuppressionReason,origin:m.suppressionInfo.Origin,createdAt:m.suppressionInfo.CreatedAt}))}else{console.warn("Postmark helper not available for workspace invite");let a=i?{To:b,From:"noreply@meet-sam.com",Subject:`You're invited to join ${e.name} on SAM AI`,HtmlBody:`<div>Fallback email content for ${k} inviting you to ${e.name}</div>`,MessageStream:"outbound"}:{To:b,From:"noreply@meet-sam.com",Subject:`You've been added to ${e.name} on SAM AI`,HtmlBody:`<div>Fallback email content - you've been added to ${e.name}</div>`,MessageStream:"outbound"};await z.sendEmail(a)}return u.NextResponse.json({success:!0,message:i?"Invitation sent successfully":"User added to workspace and notified"})}catch(a){return console.error("Workspace invite error:",a),u.NextResponse.json({error:"Failed to send invitation"},{status:500})}}let B=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/workspaces/invite/route",pathname:"/api/workspaces/invite",filename:"route",bundlePath:"app/api/workspaces/invite/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/workspaces/invite/route.ts",nextConfigOutput:"standalone",userland:d}),{workAsyncStorage:C,workUnitAsyncStorage:D,serverHooks:E}=B;function F(){return(0,g.patchFetch)({workAsyncStorage:C,workUnitAsyncStorage:D})}async function G(a,b,c){var d;let e="/api/workspaces/invite/route";"/index"===e&&(e="/");let g=await B.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:A,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[D]);if(F&&!x){let a=!!y.routes[D],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||B.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===B.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>B.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>B.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&A&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await B.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})},z),b}},l=await B.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:A,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",A?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(L||b instanceof s.NoFallbackError||await B.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:A})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},57729:()=>{},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},74075:a=>{"use strict";a.exports=require("zlib")},78335:()=>{},79551:a=>{"use strict";a.exports=require("url")},81630:a=>{"use strict";a.exports=require("http")},83997:a=>{"use strict";a.exports=require("tty")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},94735:a=>{"use strict";a.exports=require("events")},96487:()=>{}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[4586,1692,4842,3333],()=>b(b.s=57029));module.exports=c})();