interface Context {request:Request;env:{CANONICAL_REDIRECT_ENABLED?:string};next:()=>Promise<Response>}
export async function onRequest({request,env,next}:Context){
 const url=new URL(request.url);
 const productionAlias=url.hostname==='ribloxen-website.pages.dev';
 if(env.CANONICAL_REDIRECT_ENABLED==='true'&&(url.hostname==='www.ribloxen.com'||productionAlias)){
  url.protocol='https:';url.hostname='ribloxen.com';url.port='';return Response.redirect(url.toString(),301);
 }
 const response=await next();
 const privatePath=url.pathname==='/office'||url.pathname.startsWith('/office/')||url.pathname.startsWith('/api/office/');
 if(url.hostname.endsWith('.pages.dev')||privatePath){
  const copy=new Response(response.body,response);
  copy.headers.set('X-Robots-Tag','noindex, nofollow, noarchive');
  return copy;
 }
 return response;
}
