(()=>{var a={};a.id=2147,a.ids=[2147],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},11997:a=>{"use strict";a.exports=require("punycode")},12412:a=>{"use strict";a.exports=require("assert")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},27910:a=>{"use strict";a.exports=require("stream")},28354:a=>{"use strict";a.exports=require("util")},29021:a=>{"use strict";a.exports=require("fs")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{"use strict";a.exports=require("path")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{"use strict";a.exports=require("crypto")},55591:a=>{"use strict";a.exports=require("https")},57729:()=>{},61688:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>F,patchFetch:()=>E,routeModule:()=>A,serverHooks:()=>D,workAsyncStorage:()=>B,workUnitAsyncStorage:()=>C});var d={};c.r(d),c.d(d,{POST:()=>z});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(82461),v=c(10641),w=c(13333);let x={InnovareAI:{postmarkApiKey:process.env.POSTMARK_INNOVAREAI_API_KEY,fromEmail:"sp@innovareai.com",companyName:"InnovareAI",contactEmail:"sp@innovareai.com",contactName:"Sarah Powell"},"3cubedai":{postmarkApiKey:process.env.POSTMARK_3CUBEDAI_API_KEY,fromEmail:"sophia@3cubed.ai",companyName:"3CubedAI",contactEmail:"sophia@3cubed.ai",contactName:"Sophia Caldwell"}},y=["tl@innovareai.com","cl@innovareai.com"];async function z(a){try{let b,c=a.headers.get("authorization");if(!c)return v.NextResponse.json({error:"Authorization required"},{status:401});let d="https://latxadqrvrrrcvkktrog.supabase.co",e=process.env.SUPABASE_SERVICE_ROLE_KEY,f=(0,u.UU)(d,e),g=(0,u.UU)(d,"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTk5ODYsImV4cCI6MjA2ODI3NTk4Nn0.3WkAgXpk_MyQioVf_SED9O_ArjcT9nH0uy9we2okftE",{global:{headers:{Authorization:c}}}),{data:{user:h},error:i}=await g.auth.getUser();if(i||!h)return v.NextResponse.json({error:"Unauthorized"},{status:401});if(!y.includes(h.email?.toLowerCase()||""))return v.NextResponse.json({error:"Forbidden - Super admin access required"},{status:403});let{email:j,firstName:k,lastName:l,organizationId:m,workspaceId:n,company:o="InnovareAI",role:p="member"}=await a.json();if(!j||!k||!l)return v.NextResponse.json({error:"Email, first name, and last name are required"},{status:400});if(!x[o])return v.NextResponse.json({error:"Invalid company"},{status:400});if(m){let{data:a,error:b}=await f.from("organizations").select("id, name").eq("id",m).single();if(b||!a)return v.NextResponse.json({error:"Organization not found"},{status:404})}console.log("Sending invitation to:",j);let{data:q,error:r}=await f.auth.admin.listUsers();if(r)return console.error("Error checking existing users:",r),v.NextResponse.json({error:"Failed to check existing users: "+r.message},{status:500});let s=q.users.find(a=>a.email?.toLowerCase()===j.toLowerCase());if(s)console.log(`User ${j} already exists, using existing user ID: ${s.id}`),b={user:s};else{let{data:a,error:c}=await f.auth.admin.inviteUserByEmail(j,{data:{first_name:k,last_name:l,invited_by:h.id,organization_id:m,role:p},redirectTo:"https://app.meet-sam.com/auth/callback"});if(c)return console.error("Invitation error:",c),v.NextResponse.json({error:"Failed to send invitation: "+c.message},{status:500});b=a}try{let a=x[o];if(a.postmarkApiKey){let b=new w.hA(a.postmarkApiKey),c="https://app.meet-sam.com",d=!s,e=d?"Welcome to SAM AI - Your Account is Ready!":`You've been added to SAM AI by ${a.companyName}`,f=d?`
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #7c3aed;">Welcome to SAM AI!</h1>
            <p>Hello ${k},</p>
            <p>You've been invited to join SAM AI by ${a.companyName}. Your intelligent sales assistant is ready to help you streamline your sales process and boost productivity.</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${c}/auth/callback" 
                 style="background-color: #7c3aed; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                Access SAM AI Platform
              </a>
            </div>
            <p><strong>What you can do with SAM AI:</strong></p>
            <ul>
              <li>Chat with your AI sales assistant for personalized guidance</li>
              <li>Access comprehensive knowledge base</li>
              <li>Manage your lead pipeline efficiently</li>
              <li>Track campaign performance and analytics</li>
              <li>Collaborate with your team in shared workspaces</li>
            </ul>
            <p style="color: #666; font-size: 14px;">
              If you have any questions, please contact ${a.contactName} at ${a.contactEmail} or our support team.
            </p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">
              This invitation was sent by ${a.companyName}. 
              If you didn't expect this invitation, you can safely ignore this email.
            </p>
          </div>
        `:`
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #7c3aed;">You've been added to SAM AI!</h1>
            <p>Hello ${k},</p>
            <p>Good news! ${a.companyName} has added you to their SAM AI workspace. You can now access the platform with your existing account.</p>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${c}" 
                 style="background-color: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">
                Access Your Workspace
              </a>
            </div>
            <p><strong>What you can do with SAM AI:</strong></p>
            <ul>
              <li>Chat with your AI sales assistant for personalized guidance</li>
              <li>Access comprehensive knowledge base</li>
              <li>Manage your lead pipeline efficiently</li>
              <li>Track campaign performance and analytics</li>
              <li>Collaborate with your team in shared workspaces</li>
            </ul>
            <p style="color: #666; font-size: 14px;">
              If you have any questions, please contact ${a.contactName} at ${a.contactEmail} or our support team.
            </p>
            <hr style="margin: 30px 0; border: none; border-top: 1px solid #eee;">
            <p style="color: #999; font-size: 12px;">
              You received this email because ${a.companyName} added you to their SAM AI workspace.
            </p>
          </div>
        `;await b.sendEmail({From:a.fromEmail,To:j,Subject:e,HtmlBody:f,TextBody:d?`
            Welcome to SAM AI!
            
            Hello ${k},
            
            You've been invited to join SAM AI by ${a.companyName}. Your intelligent sales assistant is ready to help you streamline your sales process and boost productivity.
            
            Access your account at: ${c}/auth/callback
            
            What you can do with SAM AI:
            - Chat with your AI sales assistant for personalized guidance
            - Access comprehensive knowledge base  
            - Manage your lead pipeline efficiently
            - Track campaign performance and analytics
            - Collaborate with your team in shared workspaces
            
            If you have any questions, please contact ${a.contactName} at ${a.contactEmail} or our support team.
            
            This invitation was sent by ${a.companyName}.
          `:`
            You've been added to SAM AI!
            
            Hello ${k},
            
            Good news! ${a.companyName} has added you to their SAM AI workspace. You can now access the platform with your existing account.
            
            Access your workspace at: ${c}
            
            What you can do with SAM AI:
            - Chat with your AI sales assistant for personalized guidance
            - Access comprehensive knowledge base  
            - Manage your lead pipeline efficiently
            - Track campaign performance and analytics
            - Collaborate with your team in shared workspaces
            
            If you have any questions, please contact ${a.contactName} at ${a.contactEmail} or our support team.
            
            You received this email because ${a.companyName} added you to their SAM AI workspace.
          `}),console.log(`Custom ${d?"welcome":"notification"} email sent to ${j} from ${a.companyName}`)}}catch(a){console.error("Failed to send custom welcome email:",a)}if(n||m){let a=n||m,c=x[o],d=new Date;if(d.setDate(d.getDate()+7),!b.user?.id)return console.error("CRITICAL: No user ID available for workspace assignment"),v.NextResponse.json({error:"User ID required for workspace assignment but not available"},{status:500});let{data:e,error:g}=await f.from("workspace_members").select("id").eq("workspace_id",a).eq("user_id",b.user.id).maybeSingle();if(g)return console.error("ERROR: Failed to check existing membership:",g),v.NextResponse.json({error:"Failed to check existing membership",details:g.message},{status:500});if(e)console.log(`✅ INFO: User ${j} already a member of workspace ${a}`);else{console.log(`👥 Adding user ${j} to workspace ${a} as ${p}`);let{error:c}=await f.from("workspace_members").insert({workspace_id:a,user_id:b.user.id,role:p,invited_by:h.id,joined_at:new Date().toISOString()});if(c)return console.error("CRITICAL: Failed to add user to workspace_members:",c),v.NextResponse.json({error:"Failed to assign user to workspace",details:c.message},{status:500});console.log(`✅ SUCCESS: User ${j} ASSIGNED to workspace ${a} with role ${p}`)}let{error:i}=await f.from("workspace_invitations").insert({workspace_id:a,email:j,role:p,company:o,expires_at:d.toISOString(),invited_by:h.id});i?(console.error("WARNING: Failed to store workspace invitation record (but membership succeeded):",i),console.log(`⚠️ User ${j} added to workspace but invitation record not stored`)):console.log(`✅ COMPLETE: User ${j} invited and invitation record stored by ${c.companyName}`)}let t=x[o];return v.NextResponse.json({message:s?"User added to workspace successfully":"Invitation sent successfully",company:t.companyName,isNewUser:!s,user:{id:b.user?.id,email:b.user?.email,invited_at:b.user?.invited_at}})}catch(a){return console.error("Server error sending invitation:",a),v.NextResponse.json({error:"Internal server error"},{status:500})}}let A=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/admin/invite-user/route",pathname:"/api/admin/invite-user",filename:"route",bundlePath:"app/api/admin/invite-user/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/admin/invite-user/route.ts",nextConfigOutput:"standalone",userland:d}),{workAsyncStorage:B,workUnitAsyncStorage:C,serverHooks:D}=A;function E(){return(0,g.patchFetch)({workAsyncStorage:B,workUnitAsyncStorage:C})}async function F(a,b,c){var d;let e="/api/admin/invite-user/route";"/index"===e&&(e="/");let g=await A.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[D]);if(F&&!x){let a=!!y.routes[D],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||A.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===A.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>A.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>A.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await A.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})},z),b}},l=await A.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(L||b instanceof s.NoFallbackError||await A.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},74075:a=>{"use strict";a.exports=require("zlib")},78335:()=>{},79551:a=>{"use strict";a.exports=require("url")},81630:a=>{"use strict";a.exports=require("http")},83997:a=>{"use strict";a.exports=require("tty")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},94735:a=>{"use strict";a.exports=require("events")},96487:()=>{}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[4586,1692,4842,3333],()=>b(b.s=61688));module.exports=c})();