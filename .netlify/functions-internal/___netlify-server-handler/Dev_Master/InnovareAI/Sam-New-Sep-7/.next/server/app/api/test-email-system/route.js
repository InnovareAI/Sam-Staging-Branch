(()=>{var a={};a.id=1081,a.ids=[1081],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},12412:a=>{"use strict";a.exports=require("assert")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},27910:a=>{"use strict";a.exports=require("stream")},28354:a=>{"use strict";a.exports=require("util")},29021:a=>{"use strict";a.exports=require("fs")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{"use strict";a.exports=require("path")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{"use strict";a.exports=require("crypto")},55591:a=>{"use strict";a.exports=require("https")},57729:()=>{},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},74075:a=>{"use strict";a.exports=require("zlib")},78335:()=>{},79551:a=>{"use strict";a.exports=require("url")},81630:a=>{"use strict";a.exports=require("http")},83997:a=>{"use strict";a.exports=require("tty")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},87366:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>F,patchFetch:()=>E,routeModule:()=>A,serverHooks:()=>D,workAsyncStorage:()=>B,workUnitAsyncStorage:()=>C});var d={};c.r(d),c.d(d,{GET:()=>y,POST:()=>z});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(10641),v=c(13333),w=c(79362);let x={innovareai:{name:"InnovareAI",api_key:process.env.POSTMARK_INNOVAREAI_API_KEY,from_email:"sp@innovareai.com",from_name:"Sarah Powell - SAM AI",test_email:"tl@innovareai.com"},cubedai:{name:"3CubedAI",api_key:process.env.POSTMARK_3CUBEDAI_API_KEY,from_email:"noreply@3cubed.ai",from_name:"3CubedAI Team",test_email:"tl@3cubed.ai"}};async function y(){let a={timestamp:new Date().toISOString(),email_system_tests:{},summary:{passed:0,failed:0,total:0}};for(let[b,c]of Object.entries(x))try{let d=new v.hA(c.api_key),e=await d.getServer(),f=await d.sendEmail({From:c.from_email,To:c.test_email,Subject:`${c.name} Email System Test - ${new Date().toISOString()}`,HtmlBody:`
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>🧪 Email System Integration Test</h2>
            <p><strong>Company:</strong> ${c.name}</p>
            <p><strong>Test Time:</strong> ${new Date().toISOString()}</p>
            <p><strong>Server ID:</strong> ${e.ID}</p>
            <p><strong>Server Name:</strong> ${e.Name}</p>
            <div style="background: #f0f9ff; padding: 15px; border-left: 4px solid #0ea5e9; margin: 20px 0;">
              <p><strong>✅ Status:</strong> Email delivery system is operational</p>
              <p><strong>🎯 Purpose:</strong> System integration testing by Engineering Subagent #2</p>
            </div>
            <hr style="margin: 20px 0;">
            <p style="color: #666; font-size: 12px;">
              This is an automated test email generated during system integration testing.
            </p>
          </div>
        `,MessageStream:"outbound",TrackOpens:!0,TrackLinks:w.LinkTrackingOptions.TextOnly});a.email_system_tests[b]={company_name:c.name,status:"PASS",server_info:{id:e.ID,name:e.Name,color:e.Color,smtp_api_activated:e.SmtpApiActivated,raw_email_enabled:e.RawEmailEnabled,delivery_hook_url:e.DeliveryHookUrl,bounce_hook_url:e.BounceHookUrl,open_hook_url:e.OpenHookUrl,postfirst_hook_url:e.PostFirstOpenOnly,click_hook_url:e.ClickHookUrl,inbound_address:e.InboundAddress,inbound_hook_url:e.InboundHookUrl},email_test:{message_id:f.MessageID,submitted_at:f.SubmittedAt,to:f.To,error_code:f.ErrorCode,message:f.Message},performance:{api_response_time:"measured",delivery_status:"sent"}},a.summary.passed++}catch(d){a.email_system_tests[b]={company_name:c.name,status:"FAIL",error:d.message,error_details:d},a.summary.failed++}return a.summary.total=a.summary.passed+a.summary.failed,u.NextResponse.json(a,{status:0===a.summary.failed?200:500})}async function z(a){let{company:b,recipient_email:c,test_type:d="invitation"}=await a.json();if(!b||!x[b])return u.NextResponse.json({error:"Invalid company specified"},{status:400});if(!c)return u.NextResponse.json({error:"Recipient email required"},{status:400});let e=x[b],f=new v.hA(e.api_key);try{var g,h;let a;if("invitation"===d){a={From:e.from_email,To:c,Subject:`You're invited to join SAM AI - ${e.name}`,HtmlBody:(g=e.name,`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #7C3AED; margin: 0;">${g} - SAM AI</h1>
        <p style="color: #6B7280; margin: 5px 0;">AI-Powered Sales Assistant Platform</p>
      </div>
      
      <div style="background: #F9FAFB; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
        <h2 style="color: #1F2937; margin-top: 0;">🎉 You're invited to collaborate!</h2>
        <p style="color: #4B5563; line-height: 1.6;">
          You've been invited to join the workspace <strong>"Test Workspace"</strong> 
          on SAM AI platform by ${g}.
        </p>
        <p style="color: #4B5563; line-height: 1.6;">
          This is a test invitation generated during system integration testing.
        </p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="#" 
           style="background: #7C3AED; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
          Join Workspace (Test Link)
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
      
      <p style="color: #6B7280; font-size: 14px; text-align: center;">
        This is a test email for system integration testing purposes.
      </p>
    </div>
  `),MessageStream:"outbound",TrackOpens:!0,TrackLinks:w.LinkTrackingOptions.TextOnly}}else{if("welcome"!==d)return u.NextResponse.json({error:"Invalid test type"},{status:400});a={From:e.from_email,To:c,Subject:`Welcome to ${e.name} - SAM AI`,HtmlBody:(h=e.name,`
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 30px;">
        <h1 style="color: #7C3AED; margin: 0;">${h} - SAM AI</h1>
        <p style="color: #6B7280; margin: 5px 0;">AI-Powered Sales Assistant Platform</p>
      </div>
      
      <div style="background: #F0FDF4; padding: 30px; border-radius: 12px; margin-bottom: 30px;">
        <h2 style="color: #1F2937; margin-top: 0;">🚀 Welcome to the team!</h2>
        <p style="color: #4B5563; line-height: 1.6;">
          You've successfully joined ${h} on the SAM AI platform.
        </p>
        <p style="color: #4B5563; line-height: 1.6;">
          This is a test welcome email generated during system integration testing.
        </p>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="#" 
           style="background: #10B981; color: white; padding: 15px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; display: inline-block;">
          Access Dashboard (Test Link)
        </a>
      </div>
      
      <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;">
      
      <p style="color: #6B7280; font-size: 14px; text-align: center;">
        This is a test email for system integration testing purposes.
      </p>
    </div>
  `),MessageStream:"outbound",TrackOpens:!0,TrackLinks:w.LinkTrackingOptions.TextOnly}}let b=await f.sendEmail(a);return u.NextResponse.json({success:!0,company:e.name,test_type:d,recipient:c,message_id:b.MessageID,submitted_at:b.SubmittedAt,error_code:b.ErrorCode,message:b.Message})}catch(a){return u.NextResponse.json({success:!1,company:e.name,error:a.message},{status:500})}}let A=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/test-email-system/route",pathname:"/api/test-email-system",filename:"route",bundlePath:"app/api/test-email-system/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/test-email-system/route.ts",nextConfigOutput:"standalone",userland:d}),{workAsyncStorage:B,workUnitAsyncStorage:C,serverHooks:D}=A;function E(){return(0,g.patchFetch)({workAsyncStorage:B,workUnitAsyncStorage:C})}async function F(a,b,c){var d;let e="/api/test-email-system/route";"/index"===e&&(e="/");let g=await A.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[D]);if(F&&!x){let a=!!y.routes[D],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||A.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===A.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>A.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>A.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await A.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})},z),b}},l=await A.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(L||b instanceof s.NoFallbackError||await A.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},94735:a=>{"use strict";a.exports=require("events")},96487:()=>{}};var b=require("../../../webpack-runtime.js");b.C(a);var c=b.X(0,[4586,1692,3333],()=>b(b.s=87366));module.exports=c})();