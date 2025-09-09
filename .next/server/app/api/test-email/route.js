(()=>{var a={};a.id=573,a.ids=[573],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},3421:(a,b,c)=>{"use strict";Object.defineProperty(b,"I",{enumerable:!0,get:function(){return g}});let d=c(71237),e=c(55088),f=c(17679);async function g(a,b,c,g){if((0,d.isNodeNextResponse)(b)){var h;b.statusCode=c.status,b.statusMessage=c.statusText;let d=["set-cookie","www-authenticate","proxy-authenticate","vary"];null==(h=c.headers)||h.forEach((a,c)=>{if("x-middleware-set-cookie"!==c.toLowerCase())if("set-cookie"===c.toLowerCase())for(let d of(0,f.splitCookiesString)(a))b.appendHeader(c,d);else{let e=void 0!==b.getHeader(c);(d.includes(c.toLowerCase())||!e)&&b.appendHeader(c,a)}});let{originalResponse:i}=b;c.body&&"HEAD"!==a.method?await (0,e.pipeToNodeResponse)(c.body,i,g):i.end()}}},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},12412:a=>{"use strict";a.exports=require("assert")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},27910:a=>{"use strict";a.exports=require("stream")},28354:a=>{"use strict";a.exports=require("util")},29021:a=>{"use strict";a.exports=require("fs")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{"use strict";a.exports=require("path")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},50230:(a,b,c)=>{"use strict";c.d(b,{J:()=>f,Z:()=>e});let d=new(c(13333)).Kj(process.env.POSTMARK_SERVER_TOKEN),e=async a=>{if(!process.env.POSTMARK_SERVER_TOKEN)return console.warn("POSTMARK_SERVER_TOKEN not configured, skipping email send"),{success:!1,error:"Email service not configured"};try{let b=await d.sendEmail({From:a.from||process.env.POSTMARK_FROM_EMAIL||"noreply@meet-sam.com",To:a.to,Subject:a.subject,HtmlBody:a.htmlBody,TextBody:a.textBody,MessageStream:"outbound"});return console.log("Email sent successfully:",b),{success:!0,messageId:b.MessageID}}catch(a){return console.error("Failed to send email:",a),{success:!1,error:a instanceof Error?a.message:"Unknown email error"}}},f=a=>{let b=a.inviteeName?`Hi ${a.inviteeName}`:"Hello",c="admin"===a.role?"an administrator":`a ${a.role}`;return{htmlBody:`
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
`}}},55511:a=>{"use strict";a.exports=require("crypto")},55591:a=>{"use strict";a.exports=require("https")},57729:()=>{},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},74075:a=>{"use strict";a.exports=require("zlib")},78335:()=>{},79551:a=>{"use strict";a.exports=require("url")},81630:a=>{"use strict";a.exports=require("http")},83055:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>C,patchFetch:()=>B,routeModule:()=>x,serverHooks:()=>A,workAsyncStorage:()=>y,workUnitAsyncStorage:()=>z});var d={};c.r(d),c.d(d,{POST:()=>w});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(10641),v=c(50230);async function w(a){try{let{to:b}=await a.json();if(!b)return u.NextResponse.json({error:"Email address required"},{status:400});let c=await (0,v.Z)({to:b,subject:"SAM AI - Test Email from Postmark",htmlBody:`
        <h2>🎉 Test Email Success!</h2>
        <p>This email was sent successfully from SAM AI using Postmark.</p>
        <p><strong>Configuration verified:</strong></p>
        <ul>
          <li>✅ Postmark API token is working</li>
          <li>✅ Email service is properly configured</li>
          <li>✅ SMTP delivery is functional</li>
        </ul>
        <p style="color: #6d28d9; font-weight: bold;">Your email system is ready! 🚀</p>
      `,textBody:`
SAM AI - Test Email Success!

This email was sent successfully from SAM AI using Postmark.

Configuration verified:
✅ Postmark API token is working
✅ Email service is properly configured  
✅ SMTP delivery is functional

Your email system is ready! 🚀
      `});return u.NextResponse.json({success:c.success,messageId:c.messageId,error:c.error})}catch(a){return console.error("Test email error:",a),u.NextResponse.json({error:"Internal server error"},{status:500})}}let x=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/test-email/route",pathname:"/api/test-email",filename:"route",bundlePath:"app/api/test-email/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/test-email/route.ts",nextConfigOutput:"standalone",userland:d}),{workAsyncStorage:y,workUnitAsyncStorage:z,serverHooks:A}=x;function B(){return(0,g.patchFetch)({workAsyncStorage:y,workUnitAsyncStorage:z})}async function C(a,b,c){var d;let e="/api/test-email/route";"/index"===e&&(e="/");let g=await x.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:y,prerenderManifest:z,routerServerContext:A,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(z.dynamicRoutes[E]||z.routes[D]);if(F&&!y){let a=!!z.routes[D],b=z.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||x.isDev||y||(G="/index"===(G=D)?"/":G);let H=!0===x.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:z,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>x.onRequestError(a,b,d,A)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>x.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await x.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})},A),b}},l=await x.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:z,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),y&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(L||b instanceof s.NoFallbackError||await x.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},83997:a=>{"use strict";a.exports=require("tty")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},94735:a=>{"use strict";a.exports=require("events")},95736:(a,b,c)=>{"use strict";a.exports=c(44870)},96487:()=>{}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[996,641,333],()=>b(b.s=83055));module.exports=c})();