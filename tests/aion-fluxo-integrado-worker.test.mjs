import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";

const env={ION_API_ACCESS_TOKEN:"teste",AION_RENDER_DISPATCH_ENABLED:"1",AION_GITHUB_DISPATCH_TOKEN:"segredo-de-teste"};
const send=(path,body,token="teste")=>worker.fetch(new Request("https://ion.example"+path,{
 method:"POST",headers:{"authorization":"Bearer "+token,"content-type":"application/json"},
 body:JSON.stringify(body)
}),env);
const run={repository:{full_name:"israelrodriguesnogueira-ai/ADL-MIDIA"},path:".github/workflows/aion-roteiro-render.yml",event:"workflow_dispatch",head_branch:"main",status:"completed",conclusion:"success"};

test("fluxo integrado simulado: bloqueio -> disparo -> localizar -> status -> artefato -> download",async()=>{
 const original=globalThis.fetch;
 let solicitacaoId="";
 let chamadas=0;
 globalThis.fetch=async(url,options={})=>{
  chamadas++;
  const target=String(url);
  if(target.endsWith("/dispatches")){
   assert.equal(options.headers.authorization,"Bearer segredo-de-teste");
   const payload=JSON.parse(options.body);
   assert.equal(payload.inputs.produto,"vestido preto");
   solicitacaoId=payload.inputs.solicitacao_id;
   return new Response(null,{status:204});
  }
  if(target.includes("/workflows/aion-roteiro-render.yml/runs?"))
   return Response.json({workflow_runs:[{...run,id:123,display_title:"AION video "+solicitacaoId}]});
  if(target.endsWith("/actions/runs/123"))
   return Response.json(run);
  if(target.includes("/actions/runs/123/artifacts?"))
   return Response.json({artifacts:[{id:55,name:"aion-roteiro-15s",expired:false,size_in_bytes:4000}]});
  if(target.endsWith("/actions/artifacts/55/zip"))
   return new Response(null,{status:302,headers:{location:"https://storage.blob.core.windows.net/aion.zip?sig=teste"}});
  if(target.startsWith("https://storage.blob.core.windows.net/")){
   assert.equal(options.headers,undefined,"credencial nao pode seguir para storage");
   return new Response(new Uint8Array([80,75,3,4]),{status:200});
  }
  throw new Error("Requisicao inesperada: "+target);
 };
 try{
  assert.equal((await send("/api/video/iniciar",{produto:"vestido preto"},"invalido")).status,401);
  const inicio=await send("/api/video/iniciar",{produto:"vestido preto"});
  assert.equal(inicio.status,202);
  const pedido=await inicio.json();
  assert.equal(pedido.status,"solicitado");
  assert.equal(pedido.renderizado,false);
  assert.equal(pedido.solicitacaoId,solicitacaoId);
  const localizado=await send("/api/video/localizar",{solicitacaoId});
  assert.equal(localizado.status,200);
  assert.equal((await localizado.json()).runId,123);
  const status=await send("/api/video/status",{runId:123});
  assert.equal(status.status,200);
  const estado=await status.json();
  assert.equal(estado.renderizacaoConcluida,true);
  assert.equal(estado.videoDisponivel,false,"status isolado nao comprova artefato");
  const artefato=await send("/api/video/artefato",{runId:123});
  assert.equal(artefato.status,200);
  assert.equal((await artefato.json()).artefatoDisponivel,true);
  const arquivo=await send("/api/video/baixar",{runId:123});
  assert.equal(arquivo.status,200);
  assert.equal(arquivo.headers.get("content-type"),"application/zip");
  assert.deepEqual([...new Uint8Array(await arquivo.arrayBuffer())],[80,75,3,4]);
  assert.equal(chamadas,9);
 }finally{globalThis.fetch=original}
});
