// ION: execução controlada do gerador gratuito via GitHub Actions.
// Módulo experimental. Não publica nem aciona workflow sem implantação explícita.
// Secrets no Worker: ION_API_ACCESS_TOKEN e ION_GITHUB_TOKEN (fine-grained Actions: write).
// Não coloque tokens em HTML, URL, repositório ou resposta ao navegador.
const respond=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{"content-type":"application/json; charset=utf-8","cache-control":"no-store","x-content-type-options":"nosniff"}});
const REPO="israelrodriguesnogueira-ai/ADL-MIDIA";
const WORKFLOW="ion-video-gratuito.yml";
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==="/health"&&request.method==="GET")
   return respond({status:"online",mode:"experimental",execucao:"somente comando explícito"});
  if(url.pathname!=="/api/video/transito")return respond({erro:"Rota inexistente"},404);
  if(request.method!=="POST")return respond({erro:"Método não permitido"},405);
  if(!env.ION_API_ACCESS_TOKEN||request.headers.get("authorization")!==`Bearer ${env.ION_API_ACCESS_TOKEN}`)
   return respond({erro:"Não autorizado"},401);
  if(!env.ION_GITHUB_TOKEN)return respond({erro:"Integração GitHub não configurada"},503);
  let payload;
  try { payload=await request.json(); } catch { return respond({erro:"JSON inválido"},400); }
  if(payload?.acao!=="criar_video_transito_15s"||payload?.confirmado!==true)
   return respond({erro:"Ação não autorizada ou desconhecida"},400);
  // Este workflow produz um vídeo de teste predefinido. Não aceita roteiro arbitrário.
  const target=`https://api.github.com/repos/${REPO}/actions/workflows/${WORKFLOW}/dispatches`;
  try {
   const response=await fetch(target,{method:"POST",headers:{
    "authorization":`Bearer ${env.ION_GITHUB_TOKEN}`,
    "accept":"application/vnd.github+json",
    "x-github-api-version":"2022-11-28",
    "user-agent":"ION-ADL-MIDIA",
    "content-type":"application/json"
   },body:JSON.stringify({ref:"main"})});
   if(response.status!==204)
    return respond({status:"erro",detalhe:"GitHub não aceitou o acionamento",http_status:response.status},502);
   return respond({status:"solicitado",detalhe:"Workflow acionado; geração e áudio ainda precisam ser validados.",resultados:`https://github.com/${REPO}/actions/workflows/${WORKFLOW}`},202);
  }catch{return respond({status:"erro",detalhe:"Falha de conexão com GitHub"},502);}
 }
};
