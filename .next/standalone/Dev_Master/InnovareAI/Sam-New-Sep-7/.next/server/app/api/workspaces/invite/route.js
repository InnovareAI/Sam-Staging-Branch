(()=>{var a={};a.id=792,a.ids=[792],a.modules={87:(a,b,c)=>{"use strict";c.d(b,{E:()=>g});var d=c(82461);let e="https://latxadqrvrrrcvkktrog.supabase.co",f=process.env.SUPABASE_SERVICE_ROLE_KEY||"";(0,d.UU)(e,"eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTI2OTk5ODYsImV4cCI6MjA2ODI3NTk4Nn0.3WkAgXpk_MyQioVf_SED9O_ArjcT9nH0uy9we2okftE");let g=()=>{if(!f)throw Error("SUPABASE_SERVICE_ROLE_KEY is not configured");return(0,d.UU)(e,f,{auth:{autoRefreshToken:!1,persistSession:!1}})}},261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},11997:a=>{"use strict";a.exports=require("punycode")},12412:a=>{"use strict";a.exports=require("assert")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},27910:a=>{"use strict";a.exports=require("stream")},28354:a=>{"use strict";a.exports=require("util")},29021:a=>{"use strict";a.exports=require("fs")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{"use strict";a.exports=require("path")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},50230:(a,b,c)=>{"use strict";c.d(b,{J:()=>f,Z:()=>e});let d=new(c(13333)).Kj(process.env.POSTMARK_SERVER_TOKEN),e=async a=>{if(!process.env.POSTMARK_SERVER_TOKEN)return console.warn("POSTMARK_SERVER_TOKEN not configured, skipping email send"),{success:!1,error:"Email service not configured"};try{let b=await d.sendEmail({From:a.from||process.env.POSTMARK_FROM_EMAIL||"noreply@meet-sam.com",To:a.to,Subject:a.subject,HtmlBody:a.htmlBody,TextBody:a.textBody,MessageStream:"outbound"});return console.log("Email sent successfully:",b),{success:!0,messageId:b.MessageID}}catch(a){return console.error("Failed to send email:",a),{success:!1,error:a instanceof Error?a.message:"Unknown email error"}}},f=a=>{let b=a.inviteeName?`Hi ${a.inviteeName}`:"Hello",c="admin"===a.role?"an administrator":`a ${a.role}`;return{htmlBody:`
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>You're Invited to Join SAM AI</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; background-color: #f8fafc; }
    .container { max-width: 600px; margin: 0 auto; background-color: white; }
    .header { background: linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%); color: white; padding: 40px 30px; text-align: center; }
    .logo { width: 80px; height: 80px; border-radius: 50%; margin: 0 auto 20px; object-fit: cover; }
    .content { padding: 40px 30px; }
    .button { display: inline-block; background: #8b5cf6; color: white; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; margin: 20px 0; }
    .button:hover { background: #7c3aed; }
    .footer { padding: 30px; background-color: #f1f5f9; color: #64748b; font-size: 14px; text-align: center; }
    .workspace-info { background-color: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #8b5cf6; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img src="https://app.meet-sam.com/SAM.jpg" alt="SAM AI" class="logo">
      <h1 style="margin: 0; font-size: 28px;">You're Invited!</h1>
      <p style="margin: 10px 0 0; opacity: 0.9;">Join a SAM AI workspace and start collaborating</p>
    </div>
    
    <div class="content">
      <p style="font-size: 16px; margin-bottom: 24px;">${b},</p>
      
      <p><strong>${a.inviterName}</strong> has invited you to join the <strong>${a.workspaceName}</strong> workspace on SAM AI as ${c}.</p>
      
      <div class="workspace-info">
        <h3 style="margin: 0 0 12px; color: #8b5cf6;">Workspace Details</h3>
        <p style="margin: 4px 0;"><strong>Name:</strong> ${a.workspaceName}</p>
        <p style="margin: 4px 0;"><strong>Role:</strong> ${a.role.charAt(0).toUpperCase()+a.role.slice(1)}</p>
        <p style="margin: 4px 0;"><strong>Invited by:</strong> ${a.inviterName}</p>
      </div>
      
      <p>SAM AI is your intelligent sales assistant platform that helps teams automate sales processes, manage customer relationships, and boost productivity with AI-powered insights.</p>
      
      <div style="text-align: center; margin: 32px 0;">
        <a href="${a.inviteUrl}" class="button">Accept Invitation</a>
      </div>
      
      <p style="font-size: 14px; color: #64748b;">
        <strong>Note:</strong> This invitation will expire on ${new Date(a.expiresAt).toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}. If you don't have a SAM AI account yet, you'll be able to create one when you accept the invitation.
      </p>
      
      <p style="font-size: 14px; color: #64748b;">
        Can't click the button? Copy and paste this link into your browser:<br>
        <a href="${a.inviteUrl}" style="color: #8b5cf6; word-break: break-all;">${a.inviteUrl}</a>
      </p>
    </div>
    
    <div class="footer">
      <p style="margin: 0;">
        This invitation was sent by ${a.inviterName} via SAM AI<br>
        <a href="https://app.meet-sam.com" style="color: #8b5cf6;">app.meet-sam.com</a>
      </p>
    </div>
  </div>
</body>
</html>`,textBody:`
You're Invited to Join SAM AI!

${b},

${a.inviterName} has invited you to join the "${a.workspaceName}" workspace on SAM AI as ${c}.

Workspace Details:
- Name: ${a.workspaceName}
- Role: ${a.role.charAt(0).toUpperCase()+a.role.slice(1)}
- Invited by: ${a.inviterName}

SAM AI is your intelligent sales assistant platform that helps teams automate sales processes, manage customer relationships, and boost productivity with AI-powered insights.

To accept this invitation, visit: ${a.inviteUrl}

Note: This invitation will expire on ${new Date(a.expiresAt).toLocaleDateString("en-US",{weekday:"long",year:"numeric",month:"long",day:"numeric",hour:"2-digit",minute:"2-digit"})}. If you don't have a SAM AI account yet, you'll be able to create one when you accept the invitation.

---
This invitation was sent by ${a.inviterName} via SAM AI
https://app.meet-sam.com
`}}},55511:a=>{"use strict";a.exports=require("crypto")},55591:a=>{"use strict";a.exports=require("https")},57029:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>F,patchFetch:()=>E,routeModule:()=>A,serverHooks:()=>D,workAsyncStorage:()=>B,workUnitAsyncStorage:()=>C});var d={};c.r(d),c.d(d,{GET:()=>z,POST:()=>y});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(50698),v=c(10641),w=c(87),x=c(50230);async function y(a){try{let{userId:b}=await (0,u.j)();if(!b)return v.NextResponse.json({error:"Unauthorized"},{status:401});let{workspace_id:c,email:d,role:e}=await a.json();if(!c||!d||!e)return v.NextResponse.json({error:"Missing required fields: workspace_id, email, role"},{status:400});if(!["admin","member","viewer"].includes(e))return v.NextResponse.json({error:"Invalid role. Must be admin, member, or viewer"},{status:400});let f=(0,w.E)(),{data:g,error:h}=await f.rpc("create_workspace_invitation",{p_workspace_id:c,p_email:d,p_role:e,p_invited_by_clerk_id:b});if(h)return console.error("Error creating invitation:",h),v.NextResponse.json({error:h.message},{status:400});if(!g.success)return v.NextResponse.json({error:g.error},{status:400});let i=`${a.nextUrl.origin}/invite/${g.invite_token}`,{data:j}=await f.from("workspaces").select("name").eq("id",c).single(),{data:k}=await f.from("users").select("first_name, last_name, email").eq("clerk_id",b).single(),l=k?.first_name&&k?.last_name?`${k.first_name} ${k.last_name}`:k?.email||"A team member",m=(0,x.J)({inviterName:l,workspaceName:j?.name||"SAM AI Workspace",inviteUrl:i,role:e,expiresAt:g.expires_at}),n=await (0,x.Z)({to:d,subject:`You're invited to join ${j?.name||"SAM AI"} workspace`,htmlBody:m.htmlBody,textBody:m.textBody});return n.success||console.error("Failed to send invitation email:",n.error),v.NextResponse.json({success:!0,invitation:g,invite_url:i,email_sent:n.success})}catch(a){return console.error("Invitation creation error:",a),v.NextResponse.json({error:"Internal server error"},{status:500})}}async function z(a){try{let{userId:b}=await (0,u.j)();if(!b)return v.NextResponse.json({error:"Unauthorized"},{status:401});let{searchParams:c}=new URL(a.url),d=c.get("workspace_id");if(!d)return v.NextResponse.json({error:"Missing workspace_id parameter"},{status:400});let e=(0,w.E)(),{data:f}=await e.from("workspace_members").select("role").eq("workspace_id",d).eq("user_id",(await e.from("users").select("id").eq("clerk_id",b).single()).data?.id).single();if(!f||!["owner","admin"].includes(f.role))return v.NextResponse.json({error:"Insufficient permissions"},{status:403});let{data:g,error:h}=await e.from("workspace_invitations").select(`
        id,
        email,
        role,
        expires_at,
        created_at,
        accepted_at,
        invited_by:users!workspace_invitations_invited_by_fkey(first_name, last_name, email)
      `).eq("workspace_id",d).order("created_at",{ascending:!1});if(h)return console.error("Error fetching invitations:",h),v.NextResponse.json({error:h.message},{status:400});return v.NextResponse.json({invitations:g})}catch(a){return console.error("Error fetching invitations:",a),v.NextResponse.json({error:"Internal server error"},{status:500})}}let A=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/workspaces/invite/route",pathname:"/api/workspaces/invite",filename:"route",bundlePath:"app/api/workspaces/invite/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/workspaces/invite/route.ts",nextConfigOutput:"standalone",userland:d}),{workAsyncStorage:B,workUnitAsyncStorage:C,serverHooks:D}=A;function E(){return(0,g.patchFetch)({workAsyncStorage:B,workUnitAsyncStorage:C})}async function F(a,b,c){var d;let e="/api/workspaces/invite/route";"/index"===e&&(e="/");let g=await A.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[D]);if(F&&!x){let a=!!y.routes[D],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||A.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===A.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>A.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>A.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await A.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})},z),b}},l=await A.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(L||b instanceof s.NoFallbackError||await A.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},57729:()=>{},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},73024:a=>{"use strict";a.exports=require("node:fs")},74075:a=>{"use strict";a.exports=require("zlib")},76760:a=>{"use strict";a.exports=require("node:path")},77598:a=>{"use strict";a.exports=require("node:crypto")},78335:()=>{},79551:a=>{"use strict";a.exports=require("url")},81630:a=>{"use strict";a.exports=require("http")},83997:a=>{"use strict";a.exports=require("tty")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},94735:a=>{"use strict";a.exports=require("events")},96487:()=>{}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[996,641,698,856,333],()=>b(b.s=57029));module.exports=c})();