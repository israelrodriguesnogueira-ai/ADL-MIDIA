// Adaptador isolado para upload privado em Cloudflare Workers.
// Nao provisiona R2 nem autoriza deploy. Token exclusivo apenas no servidor.
// ATENCAO: token compartilhado nao substitui autenticacao por sessao do proprietario.
const json=(body,status)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff","referrer-policy":"no-referrer"}});
const allowed=new Set(["image/jpeg","image/png","image/webp","video/mp4","video/webm","audio/webm","audio/mpeg","audio/mp4","application/pdf","text/plain"]);
const MAX=15*1024*1024;
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname!=="/api/anexos"||request.method!=="POST")return json({erro:"Rota nao encontrada"},404);
 if(!env.AION_UPLOAD_TOKEN||request.headers.get("authorization")!==`Bearer ${env.AION_UPLOAD_TOKEN}`)return json({erro:"Nao autorizado"},401);
 if(!env.AION_UPLOAD_BUCKET||typeof env.AION_UPLOAD_BUCKET.put!=="function")return json({erro:"Armazenamento privado nao configurado"},503);
 const type=(request.headers.get("content-type")||"").split(";")[0].trim().toLowerCase();
 if(!allowed.has(type))return json({erro:"Tipo nao permitido"},415);
 const declared=request.headers.get("content-length");
 if(declared!==null&&(!/^(0|[1-9][0-9]*)$/.test(declared)||!Number.isSafeInteger(Number(declared))))return json({erro:"Tamanho invalido"},400);
 if(declared!==null&&Number(declared)>MAX)return json({erro:"Arquivo acima de 15 MB"},413);
 if(!request.body)return json({erro:"Arquivo vazio"},400);
 const reader=request.body.getReader();const parts=[];let total=0;
 try{
  while(true){const {done,value}=await reader.read();if(done)break;total+=value.byteLength;if(total>MAX){await reader.cancel();return json({erro:"Arquivo acima de 15 MB"},413)}parts.push(value)}
  if(!total)return json({erro:"Arquivo vazio"},400);
  if(declared!==null&&Number(declared)!==total)return json({erro:"Tamanho divergente"},400);
  const data=new Uint8Array(total);let offset=0;for(const part of parts){data.set(part,offset);offset+=part.length}
  const id=crypto.randomUUID();await env.AION_UPLOAD_BUCKET.put("privado/"+id,data,{httpMetadata:{contentType:type},customMetadata:{origem:"aion-laboratorio"}});
  return json({status:"armazenado",id,tamanho:total,tipo:type},201);
 }catch{return json({erro:"Falha no armazenamento"},502)}
}};
