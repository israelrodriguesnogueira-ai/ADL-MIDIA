import { identificarOperador, respostaSemExecutor } from "./ion-roteador-operadores.mjs";
// ION - motor experimental para Cloudflare Workers.
// NÃO publicar sem configurar autenticação e testar em ambiente isolado.
// Secrets: ION_API_ACCESS_TOKEN; opcionais AI_API_KEY, AI_BASE_URL, AI_MODEL.
// AI_ENABLED=1 somente após aprovação explícita dos custos e do provedor.
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
function classify(command){
 const t=command.toLocaleLowerCase("pt-BR");
 if(/v[ií]deo|short|film/.test(t))return {operador:"Central 6D",etapas:["roteiro","imagens","narração","legendas","renderização","validação MP4"]};
 if(/ibovespa|investimento|financeir/.test(t))return {operador:"Financeiro",etapas:["obter dados verificáveis","registrar hipótese","avaliar desempenho"],restricao:"Sem operações financeiras reais"};
 if(/shopee|loja|an[uú]ncio/.test(t))return {operador:"Shopee",etapas:["analisar solicitação","validar dados","preparar proposta"],restricao:"Sem publicação ou gastos automáticos"};
 return {operador:"Central 6D",etapas:["identificar ferramenta","validar permissões","executar","verificar resultado"]};
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname==="/health"&&request.method==="GET")return json({status:"online",motor:"experimental",iaConfigurada:Boolean(env.AI_API_KEY&&env.AI_MODEL&&env.AI_ENABLED==="1")});
 if(url.pathname!=="/api/comando")return json({erro:"Rota inexistente"},404);
 if(request.method!=="POST")return json({erro:"Método não permitido"},405);
 if(!env.ION_API_ACCESS_TOKEN||request.headers.get("authorization")!==`Bearer ${env.ION_API_ACCESS_TOKEN}`)return json({erro:"Não autorizado"},401);
 const size=Number(request.headers.get("content-length")||0);if(size>16000)return json({erro:"Pedido muito grande"},413);
 let body;try{body=await request.json()}catch{return json({erro:"JSON inválido"},400)}
 const comando=body?.comando;
 if(typeof comando!=="string"||!comando.trim()||comando.length>3000)return json({erro:"Comando inválido"},400);
 const roteamento=identificarOperador(comando);
 const plano={...classify(comando),operador:roteamento.operador};
 if(env.AI_ENABLED!=="1"||!env.AI_API_KEY||!env.AI_MODEL||!env.AI_BASE_URL)
   return json({...respostaSemExecutor(roteamento),plano,detalhe:"Motor de IA não habilitado; nenhuma tarefa externa foi executada."});
 const base=String(env.AI_BASE_URL);
 let endpoint;try{endpoint=new URL(base)}catch{return json({erro:"Configuração do provedor inválida"},503)}
 if(endpoint.protocol!=="https:"||!["api.openai.com"].includes(endpoint.hostname))return json({erro:"Provedor não autorizado nesta versão"},503);
 const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),20000);
 try{
  const response=await fetch(new URL("/v1/chat/completions",endpoint.origin),{
   method:"POST",signal:controller.signal,headers:{"authorization":`Bearer ${env.AI_API_KEY}`,"content-type":"application/json"},
   body:JSON.stringify({model:env.AI_MODEL,max_tokens:500,messages:[{role:"system",content:"Você é o ION. Responda em português. Produza somente um plano textual conciso. Não alegue ter executado ferramentas, criado arquivos ou publicado resultados. Gastos, publicações e operações financeiras requerem aprovação."},{role:"user",content:comando}]})
  });
  if(!response.ok)return json({status:"erro",plano,detalhe:`Provedor respondeu HTTP ${response.status}`},502);
  const data=await response.json();return json({status:"planejado",plano,resposta:data?.choices?.[0]?.message?.content??"",execucao:"Nenhuma ferramenta externa conectada"});
 }catch{return json({status:"erro",plano,detalhe:"Falha ou tempo limite do provedor"},502)}
 finally{clearTimeout(timer)}
}};