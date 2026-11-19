import { executarLocal } from "./ion-executor-local.mjs";
import { interpretarComandoLocal } from "./ion-comando-natural-local.mjs";
import { identificarOperador, respostaSemExecutor } from "./ion-roteador-operadores.mjs";
// ION - motor experimental para Cloudflare Workers.
// NÃO publicar sem configurar autenticação e testar em ambiente isolado.
// Secrets: ION_API_ACCESS_TOKEN; opcionais AI_API_KEY, AI_BASE_URL, AI_MODEL.
// AI_ENABLED=1 somente após aprovação explícita dos custos e do provedor.
const json=(value,status=200)=>new Response(JSON.stringify(value),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
function responderArtefato(resultado,download) {
 if(!download || resultado.status!=="concluido" || !resultado.artefato) return null;
 const {nome,tipo,conteudo}=resultado.artefato;
 if(!["ion-documento.txt","ion-documento.md","ion-roteiro-video.json"].includes(nome) || typeof conteudo!=="string") return null;
 return new Response(conteudo,{status:200,headers:{
  "content-type":tipo,"content-disposition":'attachment; filename="'+nome+'"',
  "cache-control":"no-store","x-content-type-options":"nosniff",
  "content-security-policy":"default-src 'none'; sandbox"
 }});
}
function classify(command){
 const operador=identificarOperador(command).operador;
 const etapas={
 financeiro:["identificar objetivo e perfil","obter dados verificáveis","construir carteira simulada","avaliar riscos"],
 desenvolvimento:["definir requisitos","gerar código","executar testes","entregar artefato"],
 cientifico:["formular hipótese","identificar fontes","projetar experimento","validar resultados"],
 midia:["roteiro","imagens","narração","legendas","renderização","validação MP4"],
 shopee:["verificar dados da loja","analisar produto","propor melhorias"],
 geral:["compreender solicitação","selecionar executor","validar resultado"]
 };
 return {operador,etapas:etapas[operador]||etapas.geral};
}
export default {async fetch(request,env){
 const url=new URL(request.url);
 if(url.pathname==="/"&&request.method==="GET")return new Response(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AION — Ambiente experimental</title><style>body{font:16px system-ui;background:#101827;color:#f2f5fc;margin:0;padding:28px;line-height:1.6}main{max-width:680px;margin:auto}a{color:#9ccaff}section{background:#1d293b;padding:20px;border-radius:14px;margin:16px 0}</style></head><body><main><h1>AION — Ambiente experimental</h1><section><p>Este ambiente não é o AION de produção. O executor local possui recursos limitados de criação de texto, Markdown e diagnóstico técnico.</p><p>Operador de mídia: roteiro local disponível com autenticação. Renderização remota, financeiro, científico e Shopee ainda não estão conectados neste Preview.</p><p><a href="/health">Consultar estado do motor</a></p></section><section><h2>Segurança</h2><p>Comandos exigem autenticação por API. Não insira senhas, tokens ou chaves nesta página. A interface de comandos autenticados ainda não foi homologada.</p></section></main></body></html>`,{status:200,headers:{"content-type":"text/html; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff","content-security-policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'","referrer-policy":"no-referrer"}});
 if(url.pathname==="/health"&&request.method==="GET")return json({status:"online",motor:"experimental",prontoParaProducao:false,autenticacaoProprietarioIntegrada:false,interfaceConectada:false,renderRemotoConfigurado:env.AION_RENDER_DISPATCH_ENABLED==="1"&&Boolean(env.AION_GITHUB_DISPATCH_TOKEN),iaConfigurada:Boolean(env.AI_API_KEY&&env.AI_MODEL&&env.AI_ENABLED==="1")});
 if(!["/api/comando","/api/executar-local","/api/video/iniciar","/api/video/status","/api/video/artefato","/api/video/localizar","/api/video/baixar"].includes(url.pathname))return json({erro:"Rota inexistente"},404);
 if(request.method!=="POST")return json({erro:"Método não permitido"},405);
 if(!env.ION_API_ACCESS_TOKEN||request.headers.get("authorization")!==`Bearer ${env.ION_API_ACCESS_TOKEN}`)return json({erro:"Não autorizado"},401);
 const size=Number(request.headers.get("content-length")||0);if(size>16000)return json({erro:"Pedido muito grande"},413);
 let body;
 try {
  const reader=request.body?.getReader();
  if(!reader)return json({erro:"JSON inválido"},400);
  const chunks=[];let total=0;
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   total+=value.byteLength;
   if(total>16000){await reader.cancel();return json({erro:"Pedido muito grande"},413);}
   chunks.push(value);
  }
  const bytes=new Uint8Array(total);let offset=0;
  for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
  body=JSON.parse(new TextDecoder("utf-8",{fatal:true}).decode(bytes));
 }catch{return json({erro:"JSON inválido"},400)}
 if(url.pathname==="/api/video/baixar") {
  const runId=body?.runId;
  if(!Number.isSafeInteger(runId)||runId<=0)return json({erro:"Identificador invalido"},400);
  if(env.AION_RENDER_DISPATCH_ENABLED!=="1"||!env.AION_GITHUB_DISPATCH_TOKEN)
   return json({status:"indisponivel",erro:"Download remoto desativado"},503);
  const headers={"authorization":"Bearer "+env.AION_GITHUB_DISPATCH_TOKEN,
   "accept":"application/vnd.github+json","user-agent":"aion-render-download"};
  const prefix="https://api.github.com/repos/israelrodriguesnogueira-ai/ADL-MIDIA/actions/runs/";
  try {
   const runResponse=await fetch(prefix+runId,{headers,signal:AbortSignal.timeout(10000)});
   if(!runResponse.ok)return json({erro:"Falha ao verificar execucao"},502);
   const run=await runResponse.json();
   if(run?.repository?.full_name!=="israelrodriguesnogueira-ai/ADL-MIDIA"||
      run?.path!==".github/workflows/aion-roteiro-render.yml"||
      run?.event!=="workflow_dispatch")return json({erro:"Execucao nao autorizada"},404);
   if(run.status!=="completed"||run.conclusion!=="success")
    return json({status:"aguardando",artefatoDisponivel:false},202);
   const listing=await fetch(prefix+runId+"/artifacts?per_page=30",{headers,signal:AbortSignal.timeout(10000)});
   if(!listing.ok)return json({erro:"Falha ao listar artefatos"},502);
   const data=await listing.json();
   const artifact=Array.isArray(data?.artifacts)?data.artifacts.find(a=>
    a.name==="aion-roteiro-15s"&&!a.expired&&Number.isSafeInteger(a.id)&&
    Number.isSafeInteger(a.size_in_bytes)&&a.size_in_bytes>0&&a.size_in_bytes<=25000000):null;
   if(!artifact)return json({erro:"Artefato indisponivel ou acima do limite de 25 MB"},404);
   const archiveUrl="https://api.github.com/repos/israelrodriguesnogueira-ai/ADL-MIDIA/actions/artifacts/"+artifact.id+"/zip";
   const redirect=await fetch(archiveUrl,{headers,redirect:"manual",signal:AbortSignal.timeout(10000)});
   if(![301,302,303,307,308].includes(redirect.status))
    return json({erro:"Arquivo nao disponibilizado pelo GitHub"},502);
   const target=redirect.headers.get("location");
   let signed;try{signed=new URL(target)}catch{return json({erro:"Destino de download invalido"},502)}
   if(signed.protocol!=="https:"||!signed.hostname.endsWith(".blob.core.windows.net"))
    return json({erro:"Destino de download nao autorizado"},502);
   const archive=await fetch(signed.toString(),{redirect:"error",signal:AbortSignal.timeout(20000)});
   if(!archive.ok||!archive.body)return json({erro:"Falha ao obter arquivo"},502);
   const length=Number(archive.headers.get("content-length")||0);
   if(length>25000000){await archive.body.cancel();return json({erro:"Arquivo excede limite"},413)}
   let transferred=0;
   const bounded=new TransformStream({
    transform(chunk,controller){
     transferred+=chunk.byteLength;
     if(transferred>25000000){controller.error(new Error("Arquivo excede limite de 25 MB"));return}
     controller.enqueue(chunk);
    }
   });
   return new Response(archive.body.pipeThrough(bounded),{status:200,headers:{
    "content-type":"application/zip",
    "content-disposition":'attachment; filename="aion-video-'+runId+'.zip"',
    "cache-control":"no-store","x-content-type-options":"nosniff",
    "content-security-policy":"default-src 'none'; sandbox"
   }});
  }catch{return json({erro:"Falha no download protegido"},502)}
 }
 if(url.pathname==="/api/video/localizar") {
  const id=body?.solicitacaoId;
  if(typeof id!=="string"||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id))
   return json({erro:"Identificador de solicitacao invalido"},400);
  if(env.AION_RENDER_DISPATCH_ENABLED!=="1"||!env.AION_GITHUB_DISPATCH_TOKEN)
   return json({status:"indisponivel",erro:"Consulta remota desativada"},503);
  try {
   const response=await fetch("https://api.github.com/repos/israelrodriguesnogueira-ai/ADL-MIDIA/actions/workflows/aion-roteiro-render.yml/runs?event=workflow_dispatch&per_page=100",{
    headers:{"authorization":"Bearer "+env.AION_GITHUB_DISPATCH_TOKEN,
     "accept":"application/vnd.github+json","user-agent":"aion-render-correlacao"},
    signal:AbortSignal.timeout(10000)
   });
   if(!response.ok)return json({status:"erro",erro:"Falha ao localizar processamento"},502);
   const data=await response.json();
   const run=Array.isArray(data?.workflow_runs)?data.workflow_runs.find(r=>
    r.display_title==="AION video "+id&&r.event==="workflow_dispatch"&&r.head_branch==="main"):null;
   if(!run)return json({status:"aguardando",solicitacaoId:id,runId:null,
    observacao:"A execucao pode ainda nao estar listada ou estar fora das 100 mais recentes."},202);
   return json({status:"localizado",solicitacaoId:id,runId:run.id,
    processamento:run.status,resultado:run.conclusion??null});
  }catch{return json({status:"erro",erro:"Falha ao localizar processamento"},502)}
 }
 if(url.pathname==="/api/video/artefato") {
  const runId=body?.runId;
  if(!Number.isSafeInteger(runId)||runId<=0)return json({erro:"Identificador invalido"},400);
  if(env.AION_RENDER_DISPATCH_ENABLED!=="1"||!env.AION_GITHUB_DISPATCH_TOKEN)
   return json({status:"indisponivel",erro:"Consulta de artefatos desativada"},503);
  const headers={"authorization":"Bearer "+env.AION_GITHUB_DISPATCH_TOKEN,
   "accept":"application/vnd.github+json","user-agent":"aion-render-artifact"};
  const prefix="https://api.github.com/repos/israelrodriguesnogueira-ai/ADL-MIDIA/actions/runs/";
  try {
   const runResponse=await fetch(prefix+runId,{headers,signal:AbortSignal.timeout(10000)});
   if(!runResponse.ok)return json({status:"erro",erro:"Falha na consulta da execucao"},502);
   const run=await runResponse.json();
   if(run?.repository?.full_name!=="israelrodriguesnogueira-ai/ADL-MIDIA"||
      run?.path!==".github/workflows/aion-roteiro-render.yml"||
      run?.event!=="workflow_dispatch")return json({erro:"Execucao nao autorizada"},404);
   if(run.status!=="completed"||run.conclusion!=="success")
    return json({status:"aguardando",runId,artefatoDisponivel:false},202);
   const artifactsResponse=await fetch(prefix+runId+"/artifacts?per_page=30",{headers,signal:AbortSignal.timeout(10000)});
   if(!artifactsResponse.ok)return json({status:"erro",erro:"Falha na consulta dos artefatos"},502);
   const data=await artifactsResponse.json();
   const artifact=Array.isArray(data?.artifacts)?data.artifacts.find(a=>
    a.name==="aion-roteiro-15s"&&!a.expired&&Number.isSafeInteger(a.id)&&
    Number.isSafeInteger(a.size_in_bytes)&&a.size_in_bytes>0&&a.size_in_bytes<=25000000):null;
   if(!artifact)return json({status:"indisponivel",runId,artefatoDisponivel:false},404);
   return json({status:"disponivel",runId,artefatoDisponivel:true,
    nome:artifact.name,tamanhoBytes:artifact.size_in_bytes??null,
    expiracao:artifact.expires_at??null,
    paginaGitHub:"https://github.com/israelrodriguesnogueira-ai/ADL-MIDIA/actions/runs/"+runId,
    downloadDireto:false,observacao:"O download requer autenticacao no GitHub; o Worker nao repassa credenciais."});
  }catch{return json({status:"erro",erro:"Falha na consulta do artefato"},502)}
 }
 if(url.pathname==="/api/video/status") {
  const runId=body?.runId;
  if(!Number.isSafeInteger(runId)||runId<=0)return json({erro:"Identificador de execucao invalido"},400);
  if(env.AION_RENDER_DISPATCH_ENABLED!=="1"||!env.AION_GITHUB_DISPATCH_TOKEN)
   return json({status:"indisponivel",erro:"Consulta remota desativada"},503);
  try {
   const response=await fetch("https://api.github.com/repos/israelrodriguesnogueira-ai/ADL-MIDIA/actions/runs/"+runId,{
    headers:{"authorization":"Bearer "+env.AION_GITHUB_DISPATCH_TOKEN,
     "accept":"application/vnd.github+json","user-agent":"aion-render-status"},
    signal:AbortSignal.timeout(10000)
   });
   if(!response.ok)return json({status:"erro",erro:"Nao foi possivel consultar execucao",codigo:response.status},502);
   const run=await response.json();
   if(run?.repository?.full_name!=="israelrodriguesnogueira-ai/ADL-MIDIA"||
      run?.path!==".github/workflows/aion-roteiro-render.yml"||
      run?.event!=="workflow_dispatch")return json({erro:"Execucao nao corresponde ao renderizador autorizado"},404);
   return json({status:"consultado",runId,processamento:run.status,
    resultado:run.conclusion??null,concluido:run.status==="completed",
    renderizacaoConcluida:run.conclusion==="success",videoDisponivel:false,artefatoVerificado:false,proximaEtapa:"Consultar /api/video/artefato para confirmar a existencia do arquivo"});
  }catch{return json({status:"erro",erro:"Falha na consulta do processamento"},502)}
 }
 if(url.pathname==="/api/video/iniciar") {
  const produto=body?.produto;
  if(typeof produto!=="string"||!produto.trim()||produto.length>120||/[\r\n]/.test(produto))
   return json({erro:"Descricao de produto invalida"},400);
  if(env.AION_RENDER_DISPATCH_ENABLED!=="1"||!env.AION_GITHUB_DISPATCH_TOKEN)
   return json({status:"indisponivel",erro:"Disparo remoto desativado ou sem credencial do servidor"},503);
  const solicitacaoId=crypto.randomUUID();
  try {
   const response=await fetch("https://api.github.com/repos/israelrodriguesnogueira-ai/ADL-MIDIA/actions/workflows/aion-roteiro-render.yml/dispatches",{
    method:"POST",headers:{"authorization":"Bearer "+env.AION_GITHUB_DISPATCH_TOKEN,
     "accept":"application/vnd.github+json","content-type":"application/json","user-agent":"aion-render-dispatch"},
    body:JSON.stringify({ref:"main",inputs:{produto:produto.trim(),solicitacao_id:solicitacaoId}}),
    signal:AbortSignal.timeout(10000)
   });
   if(response.status!==204)return json({status:"erro",erro:"GitHub recusou iniciar a tarefa",codigo:response.status},502);
   return json({status:"solicitado",solicitacaoId,operador:"midia",renderizado:false,
    mensagem:"Workflow solicitado; aguarde o processamento e a validacao do MP4.",custoAdicionalContratado:0},202);
  }catch{return json({status:"erro",erro:"Falha de comunicacao com o renderizador"},502)}
 }
 if(url.pathname==="/api/executar-local") {
  const resultado=executarLocal(body);
  const arquivo=responderArtefato(resultado,url.searchParams.get("download")==="1");
  if(arquivo)return arquivo;
  return json(resultado,resultado.status==="erro"?400:resultado.status==="nao_suportado"?422:200);
 }
 const comando=body?.comando;
 if(typeof comando!=="string"||!comando.trim()||comando.length>3000)return json({erro:"Comando inválido"},400);
 const pedidoLocal=interpretarComandoLocal(comando);
 if(pedidoLocal){
  const resultado=executarLocal(pedidoLocal);
  const arquivo=responderArtefato(resultado,url.searchParams.get("download")==="1");
  if(arquivo)return arquivo;
  return json({...resultado,origem:"comando_natural",operador:"desenvolvimento"},resultado.status==="concluido"?200:400);
 }
 const comandoVideo=/\b(?:v[ií]deo|video|clipe)\b/i.test(comando);
 if(comandoVideo) {
  const duracao=Number(comando.match(/(\d{1,3})\s*(?:segundos?|s\b)/i)?.[1]||15);
  const produto=comando.replace(/\b(?:criar|fa[cç]a|gerar|produzir|produza|um|uma|v[ií]deo|video|clipe|de|do|da|com|dura[cç][aã]o|segundos?|vertical)\b/gi," ").replace(/\b\d{1,3}\b/g," ").replace(/\s+/g," ").trim();
  if(!produto)return json({...respostaSemExecutor(identificarOperador(comando)),detalhe:"Nenhuma tarefa externa foi executada; informe qual produto ou tema deve aparecer no vídeo."});
  const resultado=executarLocal({acao:"criar_roteiro_video",produto,duracaoSegundos:duracao});
  const arquivo=responderArtefato(resultado,url.searchParams.get("download")==="1");
  if(arquivo)return arquivo;
  return json({...resultado,origem:"comando_natural",operador:"midia",renderizado:false},
    resultado.status==="concluido"?200:400);
 }
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