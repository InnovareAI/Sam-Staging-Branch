(()=>{var a={};a.id=6478,a.ids=[6478],a.modules={261:a=>{"use strict";a.exports=require("next/dist/shared/lib/router/utils/app-paths")},3295:a=>{"use strict";a.exports=require("next/dist/server/app-render/after-task-async-storage.external.js")},10846:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-page.runtime.prod.js")},11997:a=>{"use strict";a.exports=require("punycode")},19121:a=>{"use strict";a.exports=require("next/dist/server/app-render/action-async-storage.external.js")},27910:a=>{"use strict";a.exports=require("stream")},29294:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-async-storage.external.js")},44870:a=>{"use strict";a.exports=require("next/dist/compiled/next-server/app-route.runtime.prod.js")},55591:a=>{"use strict";a.exports=require("https")},63033:a=>{"use strict";a.exports=require("next/dist/server/app-render/work-unit-async-storage.external.js")},74075:a=>{"use strict";a.exports=require("zlib")},78335:()=>{},79551:a=>{"use strict";a.exports=require("url")},80118:(a,b,c)=>{"use strict";c.r(b),c.d(b,{handler:()=>E,patchFetch:()=>D,routeModule:()=>z,serverHooks:()=>C,workAsyncStorage:()=>A,workUnitAsyncStorage:()=>B});var d={};c.r(d),c.d(d,{GET:()=>y,POST:()=>x});var e=c(95736),f=c(9117),g=c(4044),h=c(39326),i=c(32324),j=c(261),k=c(54290),l=c(85328),m=c(38928),n=c(46595),o=c(3421),p=c(17679),q=c(41681),r=c(63446),s=c(86439),t=c(51356),u=c(10641);let v=(0,c(82461).UU)("https://latxadqrvrrrcvkktrog.supabase.co",process.env.SUPABASE_SERVICE_ROLE_KEY);async function w(a,b,c){if(!process.env.POSTMARK_SERVER_TOKEN)throw Error("Postmark not configured");let d=await fetch("https://api.postmarkapp.com/email",{method:"POST",headers:{Accept:"application/json","Content-Type":"application/json","X-Postmark-Server-Token":process.env.POSTMARK_SERVER_TOKEN},body:JSON.stringify({From:process.env.POSTMARK_FROM_EMAIL||"noreply@innovareai.com",To:a,Subject:b,HtmlBody:c,MessageStream:"outbound"})});if(!d.ok){let a=await d.text();throw Error(`Email send failed: ${a}`)}return await d.json()}async function x(a){try{let{email:b}=await a.json();if(!b)return u.NextResponse.json({error:"Email is required"},{status:400});console.log("Sending password reset to:",b);let{data:c,error:d}=await v.auth.admin.listUsers();if(d&&console.error("Error checking users:",d),!c?.users?.find(a=>a.email===b))return u.NextResponse.json({success:!0,message:"If this email exists in our system, you will receive a password reset link."});if(process.env.POSTMARK_SERVER_TOKEN){let a="https://app.meet-sam.com",{data:c,error:d}=await v.auth.admin.generateLink({type:"recovery",email:b,options:{redirectTo:`${a}/reset-password`}});if(d)return console.error("Password reset generation error:",d),u.NextResponse.json({error:"Unable to generate password reset. Please try again later."},{status:503});let e=`${a}/reset-password?email=${encodeURIComponent(b)}&recovery=true`,f=`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <title>Your SAM AI Magic Link</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { text-align: center; margin-bottom: 30px; }
                .button { display: inline-block; padding: 12px 24px; background: #7c3aed; color: white; text-decoration: none; border-radius: 6px; }
                .footer { margin-top: 30px; font-size: 14px; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>✨ Your SAM AI Magic Link</h1>
                </div>
                
                <p>Hi there,</p>
                
                <p>We received a request to reset your password for your SAM AI account (<strong>${b}</strong>).</p>
                
                <p>Click the button below to reset your password and sign in to SAM AI:</p>
                
                <p style="text-align: center; margin: 30px 0;">
                    <a href="${e}" class="button">Reset Password</a>
                </p>
                
                <p><small>If the button doesn't work, copy and paste this link:</small></p>
                <p style="word-break: break-all; background: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 12px;">
                    ${e}
                </p>
                
                <p><em>This link will expire in 24 hours for security.</em></p>
                
                <p>If you didn't request this password reset, you can safely ignore this email.</p>
                
                <div class="footer">
                    <p>Best regards,<br><strong>The SAM AI Team</strong></p>
                    <p style="color: #999; font-size: 12px;">SAM AI - Your AI-powered Sales Assistant Platform</p>
                </div>
            </div>
        </body>
        </html>
      `;return await w(b,"\uD83D\uDD11 Reset Your SAM AI Password",f),console.log("✅ Password reset email sent via Postmark successfully"),u.NextResponse.json({success:!0,message:"Password reset email sent! Check your email and click the link to reset your password."})}return u.NextResponse.json({error:"Email service not configured. Please try again later."},{status:503})}catch(a){return console.error("Reset password API error:",a),u.NextResponse.json({error:"Internal server error during password reset"},{status:500})}}async function y(){let a=`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Reset Password - SAM AI</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-900 min-h-screen flex items-center justify-center">
    <div class="max-w-md w-full mx-auto bg-gray-800 rounded-lg shadow-xl p-8">
        <div class="text-center mb-8">
            <img src="/SAM.jpg" alt="SAM AI" class="w-16 h-16 rounded-full object-cover mx-auto mb-4" style="object-position: center 30%;">
            <h1 class="text-2xl font-bold text-white">Get Magic Link</h1>
            <p class="text-gray-400">Enter your email address and we'll send you a magic link to instantly sign in to SAM AI.</p>
        </div>
        
        <form id="reset-form" class="space-y-6">
            <div>
                <label for="email" class="block text-sm font-medium text-gray-300 mb-2">Email Address</label>
                <input 
                    type="email" 
                    id="email" 
                    name="email"
                    required
                    class="w-full px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                    placeholder="Enter your email"
                >
            </div>
            
            <button 
                type="submit"
                class="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-lg transition-colors"
            >
                Send Magic Link
            </button>
            
            <div class="text-center">
                <p class="text-gray-400 text-sm">
                    Remember your password? 
                    <a href="/api/auth/signin" class="text-purple-400 hover:text-purple-300">Sign in</a>
                </p>
            </div>
        </form>
        
        <div id="error-message" class="hidden mt-4 p-4 bg-red-600 text-white rounded-lg"></div>
        <div id="success-message" class="hidden mt-4 p-4 bg-green-600 text-white rounded-lg"></div>
    </div>
    
    <script>
        document.getElementById('reset-form').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const email = document.getElementById('email').value;
            const errorDiv = document.getElementById('error-message');
            const successDiv = document.getElementById('success-message');
            
            // Clear previous messages
            errorDiv.classList.add('hidden');
            successDiv.classList.add('hidden');
            
            try {
                const response = await fetch('/api/auth/reset-password', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ email })
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    successDiv.textContent = 'Magic link sent! Check your email and click the link to instantly sign in to SAM AI.';
                    successDiv.classList.remove('hidden');
                    document.getElementById('email').value = '';
                } else {
                    errorDiv.textContent = data.error || 'Failed to send magic link. Please try again.';
                    errorDiv.classList.remove('hidden');
                }
            } catch (error) {
                errorDiv.textContent = 'Network error. Please try again.';
                errorDiv.classList.remove('hidden');
            }
        });
    </script>
</body>
</html>
  `;return new u.NextResponse(a,{headers:{"Content-Type":"text/html"}})}let z=new e.AppRouteRouteModule({definition:{kind:f.RouteKind.APP_ROUTE,page:"/api/auth/reset-password/route",pathname:"/api/auth/reset-password",filename:"route",bundlePath:"app/api/auth/reset-password/route"},distDir:".next",relativeProjectDir:"",resolvedPagePath:"/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/app/api/auth/reset-password/route.ts",nextConfigOutput:"standalone",userland:d}),{workAsyncStorage:A,workUnitAsyncStorage:B,serverHooks:C}=z;function D(){return(0,g.patchFetch)({workAsyncStorage:A,workUnitAsyncStorage:B})}async function E(a,b,c){var d;let e="/api/auth/reset-password/route";"/index"===e&&(e="/");let g=await z.prepare(a,b,{srcPage:e,multiZoneDraftMode:!1});if(!g)return b.statusCode=400,b.end("Bad Request"),null==c.waitUntil||c.waitUntil.call(c,Promise.resolve()),null;let{buildId:u,params:v,nextConfig:w,isDraftMode:x,prerenderManifest:y,routerServerContext:A,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,resolvedPathname:D}=g,E=(0,j.normalizeAppPath)(e),F=!!(y.dynamicRoutes[E]||y.routes[D]);if(F&&!x){let a=!!y.routes[D],b=y.dynamicRoutes[E];if(b&&!1===b.fallback&&!a)throw new s.NoFallbackError}let G=null;!F||z.isDev||x||(G="/index"===(G=D)?"/":G);let H=!0===z.isDev||!F,I=F&&!H,J=a.method||"GET",K=(0,i.getTracer)(),L=K.getActiveScopeSpan(),M={params:v,prerenderManifest:y,renderOpts:{experimental:{cacheComponents:!!w.experimental.cacheComponents,authInterrupts:!!w.experimental.authInterrupts},supportsDynamicResponse:H,incrementalCache:(0,h.getRequestMeta)(a,"incrementalCache"),cacheLifeProfiles:null==(d=w.experimental)?void 0:d.cacheLife,isRevalidate:I,waitUntil:c.waitUntil,onClose:a=>{b.on("close",a)},onAfterTaskError:void 0,onInstrumentationRequestError:(b,c,d)=>z.onRequestError(a,b,d,A)},sharedContext:{buildId:u}},N=new k.NodeNextRequest(a),O=new k.NodeNextResponse(b),P=l.NextRequestAdapter.fromNodeNextRequest(N,(0,l.signalFromNodeResponse)(b));try{let d=async c=>z.handle(P,M).finally(()=>{if(!c)return;c.setAttributes({"http.status_code":b.statusCode,"next.rsc":!1});let d=K.getRootSpanAttributes();if(!d)return;if(d.get("next.span_type")!==m.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${d.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let e=d.get("next.route");if(e){let a=`${J} ${e}`;c.setAttributes({"next.route":e,"http.route":e,"next.span_name":a}),c.updateName(a)}else c.updateName(`${J} ${a.url}`)}),g=async g=>{var i,j;let k=async({previousCacheEntry:f})=>{try{if(!(0,h.getRequestMeta)(a,"minimalMode")&&B&&C&&!f)return b.statusCode=404,b.setHeader("x-nextjs-cache","REVALIDATED"),b.end("This page could not be found"),null;let e=await d(g);a.fetchMetrics=M.renderOpts.fetchMetrics;let i=M.renderOpts.pendingWaitUntil;i&&c.waitUntil&&(c.waitUntil(i),i=void 0);let j=M.renderOpts.collectedTags;if(!F)return await (0,o.I)(N,O,e,M.renderOpts.pendingWaitUntil),null;{let a=await e.blob(),b=(0,p.toNodeOutgoingHttpHeaders)(e.headers);j&&(b[r.NEXT_CACHE_TAGS_HEADER]=j),!b["content-type"]&&a.type&&(b["content-type"]=a.type);let c=void 0!==M.renderOpts.collectedRevalidate&&!(M.renderOpts.collectedRevalidate>=r.INFINITE_CACHE)&&M.renderOpts.collectedRevalidate,d=void 0===M.renderOpts.collectedExpire||M.renderOpts.collectedExpire>=r.INFINITE_CACHE?void 0:M.renderOpts.collectedExpire;return{value:{kind:t.CachedRouteKind.APP_ROUTE,status:e.status,body:Buffer.from(await a.arrayBuffer()),headers:b},cacheControl:{revalidate:c,expire:d}}}}catch(b){throw(null==f?void 0:f.isStale)&&await z.onRequestError(a,b,{routerKind:"App Router",routePath:e,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})},A),b}},l=await z.handleResponse({req:a,nextConfig:w,cacheKey:G,routeKind:f.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:y,isRoutePPREnabled:!1,isOnDemandRevalidate:B,revalidateOnlyGenerated:C,responseGenerator:k,waitUntil:c.waitUntil});if(!F)return null;if((null==l||null==(i=l.value)?void 0:i.kind)!==t.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(j=l.value)?void 0:j.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});(0,h.getRequestMeta)(a,"minimalMode")||b.setHeader("x-nextjs-cache",B?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),x&&b.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return(0,h.getRequestMeta)(a,"minimalMode")&&F||m.delete(r.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||b.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,q.getCacheControlHeader)(l.cacheControl)),await (0,o.I)(N,O,new Response(l.value.body,{headers:m,status:l.value.status||200})),null};L?await g(L):await K.withPropagatedContext(a.headers,()=>K.trace(m.BaseServerSpan.handleRequest,{spanName:`${J} ${a.url}`,kind:i.SpanKind.SERVER,attributes:{"http.method":J,"http.target":a.url}},g))}catch(b){if(L||b instanceof s.NoFallbackError||await z.onRequestError(a,b,{routerKind:"App Router",routePath:E,routeType:"route",revalidateReason:(0,n.c)({isRevalidate:I,isOnDemandRevalidate:B})}),F)throw b;return await (0,o.I)(N,O,new Response(null,{status:500})),null}}},81630:a=>{"use strict";a.exports=require("http")},86439:a=>{"use strict";a.exports=require("next/dist/shared/lib/no-fallback-error.external")},96487:()=>{}};var b=require("../../../../webpack-runtime.js");b.C(a);var c=b.X(0,[4586,1692,4842],()=>b(b.s=80118));module.exports=c})();