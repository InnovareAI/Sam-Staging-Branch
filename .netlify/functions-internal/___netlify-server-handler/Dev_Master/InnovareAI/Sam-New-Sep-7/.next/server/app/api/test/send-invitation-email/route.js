(()=>{var a={};a.id=5546,a.ids=[5546],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},11997:a=>{"use strict";a.exports=require("punycode")},12412:a=>{"use strict";a.exports=require("assert")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},27910:a=>{"use strict";a.exports=require("stream")},28354:a=>{"use strict";a.exports=require("util")},29021:a=>{"use strict";a.exports=require("fs")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},33873:a=>{"use strict";a.exports=require("path")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55511:a=>{"use strict";a.exports=require("crypto")},55591:a=>{"use strict";a.exports=require("https")},57729:()=>{},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},63733:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>F,patchFetch:()=>E,routeModule:()=>A,serverHooks:()=>D,workAsyncStorage:()=>B,workUnitAsyncStorage:()=>C});var d={};c.r(d),c.d(d,{GET:()=>z,POST:()=>y});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(10641),v=c(91788),w=c(86802),x=c(13333);async function y(a){try{let b=(0,w.UL)();(0,v.createRouteHandlerClient)({cookies:()=>b});let{userEmail:c,company:d}=await a.json();if(!c||!d)return u.NextResponse.json({error:"userEmail and company are required"},{status:400});console.log("\uD83E\uDDEA TEST: Sending invitation email to:",c,"from company:",d);let e="3cubedai"===d?process.env.POSTMARK_3CUBEDAI_API_KEY:process.env.POSTMARK_INNOVAREAI_API_KEY;if(!e)return u.NextResponse.json({error:`Postmark API key not configured for company: ${d}`},{status:500});let f=new x.Kj(e),g="3cubedai"===d?{from:"sophia@3cubed.ai",fromName:"Sophia - 3CubedAI",companyName:"3CubedAI"}:{from:"sp@innovareai.com",fromName:"Sarah Powell - InnovareAI",companyName:"InnovareAI"},h=Math.random().toString(36).substring(2)+Date.now().toString(36),i=`https://app.meet-sam.com/accept-invitation?token=${h}`,j={From:`${g.fromName} <${g.from}>`,To:c,Subject:`Welcome to SAM AI - ${g.companyName}`,HtmlBody:`
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to SAM AI</title>
          <style>
            body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; background: #f8f9fa; }
            .card { background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
            .header { text-align: center; margin-bottom: 32px; }
            .logo { width: 80px; height: 80px; border-radius: 50%; object-fit: cover; margin: 0 auto 16px; display: block; }
            .button { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 16px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; margin: 24px 0; }
            .footer { text-align: center; margin-top: 32px; font-size: 14px; color: #666; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="card">
              <div class="header">
                <img src="https://app.meet-sam.com/SAM.jpg" alt="SAM AI" class="logo">
                <h1>Welcome to SAM AI!</h1>
                <p>You've been invited to join ${g.companyName}'s Sales Assistant Platform</p>
              </div>
              
              <div class="content">
                <h2>🎉 Your SAM AI Account is Ready!</h2>
                <p>Hi there!</p>
                <p>You've been invited to join <strong>${g.companyName}</strong> on the SAM AI platform. SAM is your intelligent sales assistant that helps streamline your sales processes and boost productivity.</p>
                
                <p><strong>What you can do with SAM AI:</strong></p>
                <ul>
                  <li>💬 Chat with SAM for sales insights and recommendations</li>
                  <li>📊 Access your personalized sales dashboard</li>
                  <li>🎯 Manage leads and track your sales pipeline</li>
                  <li>📚 Build and access your team's knowledge base</li>
                  <li>🚀 Launch targeted sales campaigns</li>
                </ul>
                
                <div style="text-align: center; margin: 32px 0;">
                  <a href="${i}" class="button">Accept Invitation & Get Started</a>
                </div>
                
                <p><small>This invitation link will expire in 7 days. If you have any questions, please contact your team administrator.</small></p>
              </div>
              
              <div class="footer">
                <p>Best regards,<br>
                <strong>${g.fromName}</strong><br>
                ${g.companyName}</p>
                <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
                <p><small>This email was sent from SAM AI Platform. If you believe this was sent in error, please ignore this email.</small></p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,TextBody:`
Welcome to SAM AI - ${g.companyName}!

You've been invited to join ${g.companyName} on the SAM AI platform.

Accept your invitation: ${i}

What you can do with SAM AI:
- Chat with SAM for sales insights and recommendations
- Access your personalized sales dashboard  
- Manage leads and track your sales pipeline
- Build and access your team's knowledge base
- Launch targeted sales campaigns

This invitation link will expire in 7 days.

Best regards,
${g.fromName}
${g.companyName}
      `,MessageStream:"outbound",Tag:"sam-ai-invitation"};console.log("\uD83D\uDCE7 Sending test invitation email via Postmark..."),console.log("\uD83D\uDCE7 Email details:",{from:j.From,to:j.To,subject:j.Subject,company:d,apiKey:e?"configured":"missing"});let k=await f.sendEmail(j);return console.log("✅ Test invitation email sent successfully!",k),u.NextResponse.json({success:!0,message:"Test invitation email sent successfully",emailResult:{messageId:k.MessageID,to:k.To,submittedAt:k.SubmittedAt}})}catch(a){return console.error("❌ Test email send error:",a),u.NextResponse.json({error:"Failed to send test invitation email",details:a.message,code:a.code||"UNKNOWN_ERROR"},{status:500})}}async function z(){let a=`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Test Invitation Email Sender</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 min-h-screen flex items-center justify-center">
    <div class="max-w-md w-full mx-auto bg-gray-800 rounded-lg shadow-xl p-8">
        <div class="text-center mb-8">
            <h1 class="text-2xl font-bold text-white mb-2">🧪 Test Invitation Email</h1>
            <p class="text-gray-400">Send invitation email to already created users</p>
        </div>
        
        <form id="email-form" class="space-y-6">
            <div>
                <label for="userEmail" class="block text-sm font-medium text-gray-300 mb-2">User Email</label>
                <input 
                    type="email" 
                    id="userEmail" 
                    name="userEmail"
                    required
                    value="tl@3cubed.ai"
                    class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="user@company.com"
                >
            </div>
            
            <div>
                <label for="company" class="block text-sm font-medium text-gray-300 mb-2">Company</label>
                <select 
                    id="company" 
                    name="company"
                    required
                    class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                    <option value="">Select Company</option>
                    <option value="InnovareAI">InnovareAI</option>
                    <option value="3cubedai" selected>3CubedAI</option>
                </select>
            </div>
            
            <button 
                type="submit"
                class="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
                Send Test Email
            </button>
        </form>
        
        <div id="result" class="mt-6 hidden"></div>
    </div>
    
    <script>
        document.getElementById('email-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const userEmail = document.getElementById('userEmail').value;
            const company = document.getElementById('company').value;
            const resultDiv = document.getElementById('result');
            
            try {
                const response = await fetch('/api/test/send-invitation-email', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ userEmail, company })
                });
                
                const data = await response.json();
                
                resultDiv.className = 'mt-6 p-4 rounded-lg';
                
                if (response.ok) {
                    resultDiv.className += ' bg-green-600 text-white';
                    resultDiv.innerHTML = \`
                        <h3 class="font-bold">✅ Success!</h3>
                        <p>\${data.message}</p>
                        <p class="text-sm mt-2">Message ID: \${data.emailResult?.messageId}</p>
                    \`;
                } else {
                    resultDiv.className += ' bg-red-600 text-white';
                    resultDiv.innerHTML = \`
                        <h3 class="font-bold">❌ Error</h3>
                        <p>\${data.error}</p>
                        \${data.details ? \`<p class="text-sm mt-2">Details: \${data.details}</p>\` : ''}
                    \`;
                }
                
                resultDiv.classList.remove('hidden');
                
            } catch (error) {
                resultDiv.className = 'mt-6 p-4 bg-red-600 text-white rounded-lg';
                resultDiv.innerHTML = \`
                    <h3 class="font-bold">❌ Network Error</h3>
                    <p>Failed to send request: \${error.message}</p>
                \`;
                resultDiv.classList.remove('hidden');
            }
        });
    </script>
</body>
</html>
  `;return new u.NextResponse(a,{headers:{"Content-Type":"text/html"}})}let A=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/test/send-invitation-email/route",pathname:"/api/test/send-invitation-email",filename:"route",bundlePath:"app/api/test/send-invitation-email/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/test/send-invitation-email/route.ts",nextConfigOutput:"standalone",userland:d}),{workAsyncStorage:B,workUnitAsyncStorage:C,serverHooks:D}=A;function E(){return(0,g.patchFetch)({workAsyncStorage:B,workUnitAsyncStorage:C})}async function F(a,b,c){var d;let e="/api/test/send-invitation-email/route";"/index"===e&&(e="/");let g=await A.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:z,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[D]);if(F&&!x){let a=!!y.routes[D],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||A.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===A.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>A.onRequestError(a,b,d,z)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>A.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await A.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})},z),b}},l=await A.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(L||b instanceof s.NoFallbackError||await A.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},74075:a=>{"use strict";a.exports=require("zlib")},78335:()=>{},79428:a=>{"use strict";a.exports=require("buffer")},79551:a=>{"use strict";a.exports=require("url")},81630:a=>{"use strict";a.exports=require("http")},83997:a=>{"use strict";a.exports=require("tty")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},94735:a=>{"use strict";a.exports=require("events")},96487:()=>{}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[4586,1692,4842,3333,6717],()=>b(b.s=63733));module.exports=c})();