interface Statement { bind(...values: unknown[]): Statement; first<T=Record<string,unknown>>(): Promise<T|null>; run(): Promise<unknown>; }
interface Env { RFQ_DB?: {prepare(sql:string):Statement}; RFQ_HASH_SALT?:string; PUBLIC_CONTACT_EMAIL?:string; RFQ_RETENTION_DAYS?:string; }
type Context={request:Request;env:Env};
const json=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
const ready=(env:Env)=>Boolean(env.RFQ_DB&&env.RFQ_HASH_SALT&&env.RFQ_HASH_SALT.length>=32&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.PUBLIC_CONTACT_EMAIL||'')&&Number.isInteger(Number(env.RFQ_RETENTION_DAYS))&&Number(env.RFQ_RETENTION_DAYS)>=1&&Number(env.RFQ_RETENTION_DAYS)<=365);
export async function onRequestGet({env}:Context){return json({ready:ready(env)});}
export async function onRequestPost({request,env}:Context){
 if(!ready(env))return json({message:'在线接收尚未启用，信息未发送。请先下载询价清单。'},503);
 const origin=request.headers.get('Origin');if(origin!==new URL(request.url).origin)return json({message:'请求来源无效，请在本站询价页重试。'},403);
 if(!request.headers.get('Content-Type')?.startsWith('application/json'))return json({message:'不支持的提交格式。'},415);
 let data:Record<string,unknown>;
 try{const reader=request.body?.getReader();if(!reader)return json({message:'请填写询价信息。'},400);let bytes=0;const parts:Uint8Array[]=[];while(true){const {value,done}=await reader.read();if(done)break;bytes+=value.byteLength;if(bytes>20000){await reader.cancel();return json({message:'内容过长，请精简后重试。'},413);}parts.push(value);}const all=new Uint8Array(bytes);let offset=0;for(const p of parts){all.set(p,offset);offset+=p.length;}data=JSON.parse(new TextDecoder().decode(all));if(!data||Array.isArray(data)||typeof data!=='object')throw new Error();}catch{return json({message:'提交格式有误，请刷新后重试。'},400);}
 const limits:Record<string,number>={type:20,name:60,contact:150,company:120,product:200,quantity:100,date:10,details:5000,website:200,consent:5};
 for(const [key,max] of Object.entries(limits)){if(data[key]!==undefined&&(typeof data[key]!=='string'||(data[key] as string).length>max))return json({message:'字段格式或长度不符合要求。'},400);}
 if(data.website)return json({message:'无法处理此请求，请从本站重新填写。'},400);
 const age=Date.now()-Number(data.started);if(!Number.isFinite(age)||age<2500||age>86400000)return json({message:'请检查填写内容，或刷新页面后重新提交。'},400);
 const name=String(data.name||'').trim(), contact=String(data.contact||'').trim(),details=String(data.details||'').trim();
 if(!name||details.length<5||data.consent!=='on'||!['standard','custom','mixed'].includes(String(data.type)))return json({message:'请填写必填项，并同意隐私说明。'},400);
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact)&&!/^\+?[\d\s()-]{7,25}$/.test(contact))return json({message:'请提供有效的手机号或邮箱。'},400);
 if(data.date&&!/^\d{4}-\d{2}-\d{2}$/.test(String(data.date)))return json({message:'请检查期望到货日期。'},400);
 const now=Date.now(),hour=Math.floor(now/3600000);const ip=request.headers.get('CF-Connecting-IP');if(!ip)return json({message:'暂时无法验证网络请求，请稍后重试。'},503);
 try{
 const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${env.RFQ_HASH_SALT}:${hour}:${ip}`));const bucket=Array.from(new Uint8Array(hash)).map(x=>x.toString(16).padStart(2,'0')).join('');const db=env.RFQ_DB!;
 await db.prepare('DELETE FROM rfq_limits WHERE expires_at < ?').bind(now).run();
 const rate=await db.prepare('INSERT INTO rfq_limits (bucket,count,expires_at) VALUES (?,1,?) ON CONFLICT(bucket) DO UPDATE SET count=count+1 RETURNING count').bind(bucket,(hour+2)*3600000).first<{count:number}>();
 if(!rate||rate.count>5)return json({message:'提交较频繁，请稍后再试。'},429);
 await db.prepare('DELETE FROM inquiries WHERE created_at < ?').bind(now-Number(env.RFQ_RETENTION_DAYS)*86400000).run();
 const id=crypto.randomUUID();await db.prepare('INSERT INTO inquiries (id,created_at,type,name,contact,company,product,quantity,delivery_date,details) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,now,data.type,name,contact,data.company||'',data.product||'',data.quantity||'',data.date||'',details).run();
 return json({id},201);
 }catch{return json({message:'暂时无法保存询价，尚未确认接收。请下载清单并稍后重试。'},503);}
}
export const onRequestOptions=()=>new Response(null,{status:405});
