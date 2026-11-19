import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
const env={ION_API_ACCESS_TOKEN:"teste",AION_RENDER_DISPATCH_ENABLED:"1",AION_GITHUB_DISPATCH_TOKEN:"segredo"};
const send=(runId,token="teste")=>worker.fetch(new Request("https://ion.example/api/video/artefato",{
 method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({runId})
}),env);
test("artefatos exigem autorizacao",async()=>{assert.equal((await send(123,"errado")).status,401)});
test("id invalido e rejeitado",async()=>{assert.equal((await send("123")).status,400)});
test("consulta de MP4 confirma metadados sem expor token",async()=>{
 const original=globalThis.fetch;let chamadas=0;
 globalThis.fetch=async(url,options)=>{
  chamadas++;
  assert.equal(options.headers.authorization,"Bearer segredo");
  if(String(url).endsWith("/artifacts?per_page=30"))
   return Response.json({artifacts:[{name:"aion-roteiro-15s",expired:false,size_in_bytes:104381,expires_at:"2026-11-20T00:00:00Z"}]});
  return Response.json({repository:{full_name:"israelrodriguesnogueira-ai/ADL-MIDIA"},path:".github/workflows/aion-roteiro-render.yml",event:"workflow_dispatch",status:"completed",conclusion:"success"});
 };
 try{
  const r=await send(123);assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.artefatoDisponivel,true);
  assert.equal(data.downloadDireto,false);
  assert.equal(chamadas,2);
  assert.doesNotMatch(JSON.stringify(data),/segredo/);
 }finally{globalThis.fetch=original}
});
test("workflow nao autorizado nao permite listar artefatos",async()=>{
 const original=globalThis.fetch;let chamadas=0;
 globalThis.fetch=async()=>{chamadas++;return Response.json({repository:{full_name:"outro/repositorio"},path:".github/workflows/aion-roteiro-render.yml",event:"workflow_dispatch",status:"completed",conclusion:"success"})};
 try{assert.equal((await send(123)).status,404);assert.equal(chamadas,1)}
 finally{globalThis.fetch=original}
});
