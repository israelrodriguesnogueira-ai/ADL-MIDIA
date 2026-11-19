// Endpoint isolado de leitura privada R2. Nao e deploy nem exposicao publica.
const respond=(body,status)=>new Response(JSON.stringify(body),{status,headers:{"content-type":"application/json","cache-control":"no-store","x-content-type-options":"nosniff"}});
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(request.method!=="GET")return respond({erro:"Metodo nao permitido"},405);
 if(!env.AION_UPLOAD_TOKEN||request.headers.get("authorization")!==`Bearer ${env.AION_UPLOAD_TOKEN}`)return respond({erro:"Nao autorizado"},401);
 if(!env.AION_UPLOAD_BUCKET||typeof env.AION_UPLOAD_BUCKET.get!=="function")return respond({erro:"Armazenamento privado nao configurado"},503);
 const match=/^\/api\/anexos\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})$/i.exec(url.pathname);
 if(!match)return respond({erro:"Identificador invalido"},400);
 try{
  const obj=await env.AION_UPLOAD_BUCKET.get("privado/"+match[1].toLowerCase());
  if(!obj)return respond({erro:"Arquivo nao encontrado"},404);
  const type=obj.httpMetadata?.contentType||"application/octet-stream";
  return new Response(obj.body,{headers:{"content-type":type,"content-disposition":"attachment","cache-control":"private, no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; sandbox","referrer-policy":"no-referrer"}});
 }catch{return respond({erro:"Falha na leitura privada"},502)}
}};