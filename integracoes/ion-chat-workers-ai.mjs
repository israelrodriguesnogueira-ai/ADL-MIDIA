// ION — núcleo conversacional para Cloudflare Workers AI.
// Requer binding Workers AI (env.AI) e autenticação do proprietário no gateway.
// Não publicar sem confirmar cota gratuita, controle de acesso e testes.
const headers={"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"};
const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
const allowedOrigins=(env)=>String(env.ION_ALLOWED_ORIGIN||"").split(",").map(s=>s.trim()).filter(Boolean);
const SYSTEM=`Você é ION, assistente pessoal em português brasileiro. Seja útil, claro e contextual. Não finja executar ações. Se uma ferramenta não estiver conectada, diga explicitamente. Não realize operações financeiras, gastos, publicação ou mudanças de segurança sem confirmação específica. Proteja informações privadas.`;
function validateMessages(messages){
 if(!Array.isArray(messages)||messages.length>20)return null;
 const out=[];
 for(const m of messages){
  if(!m||!["user","assistant"].includes(m.role)||typeof m.content!=="string"||m.content.length>4000)return null;
  out.push({role:m.role,content:m.content});
 }
 if(!out.length||out.at(-1).role!=="user")return null;
 return out;
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname==="/health")return reply({status:"online",engine:"workers-ai",configured:Boolean(env.AI),authenticated:false});
 if(url.pathname!=="/api/chat")return reply({error:"Rota inexistente"},404);
 if(request.method!=="POST")return reply({error:"Método não permitido"},405);
 // Token somente servidor-servidor; não colocar no JavaScript do navegador.
 if(!env.ION_API_ACCESS_TOKEN||request.headers.get("authorization")!==`Bearer ${env.ION_API_ACCESS_TOKEN}`)return reply({error:"Não autorizado"},401);
 const origin=request.headers.get("origin");
 if(origin&&(!allowedOrigins(env).length||!allowedOrigins(env).includes(origin)))return reply({error:"Origem não permitida"},403);
 if(Number(request.headers.get("content-length")||0)>40000)return reply({error:"Pedido muito grande"},413);
 let payload;try{payload=await request.json()}catch{return reply({error:"JSON inválido"},400)}
 const messages=validateMessages(payload?.messages);
 if(!messages)return reply({error:"Histórico inválido"},400);
 if(!env.AI)return reply({status:"unavailable",error:"Binding Workers AI ausente; nenhuma inferência executada"},503);
 try{
  const model=env.ION_AI_MODEL||"@cf/meta/llama-3.1-8b-instruct";
  const result=await env.AI.run(model,{messages:[{role:"system",content:SYSTEM},...messages],max_tokens:700});
  if(typeof result?.response!=="string")return reply({error:"Resposta inválida do modelo"},502);
  return reply({status:"answered",response:result.response,engine:"workers-ai",toolsExecuted:[]});
 }catch(e){return reply({error:"Falha na inferência",detail:"Verificar binding, disponibilidade e cota do modelo"},502)}
}};