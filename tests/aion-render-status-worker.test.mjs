import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
const endpoint="https://ion.example/api/video/status";
const send=(runId,env={},token="teste")=>worker.fetch(new Request(endpoint,{
 method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},
 body:JSON.stringify({runId})
}),{ION_API_ACCESS_TOKEN:"teste",...env});
const configured={AION_RENDER_DISPATCH_ENABLED:"1",AION_GITHUB_DISPATCH_TOKEN:"segredo-de-teste"};
test("status exige token do proprietario",async()=>{assert.equal((await send(123,configured,"incorreto")).status,401)});
test("status desativado por padrao",async()=>{assert.equal((await send(123)).status,503)});
test("status rejeita id invalido",async()=>{assert.equal((await send("123",configured)).status,400)});
test("status retorna somente metadados de workflow autorizado",async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url,options)=>{
  assert.match(String(url),/actions\\/runs\\/123$/);
  assert.equal(options.headers.authorization,"Bearer segredo-de-teste");
  return Response.json({repository:{full_name:"israelrodriguesnogueira-ai/ADL-MIDIA"},path:".github/workflows/aion-roteiro-render.yml",event:"workflow_dispatch",status:"completed",conclusion:"success"});
 };
 try{
  const r=await send(123,configured);
  assert.equal(r.status,200);
  const result=await r.json();
  assert.equal(result.resultado,"success");
  assert.equal(result.artefatoVerificado,false);
 }finally{globalThis.fetch=original}
});
test("status recusa workflow diferente",async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({repository:{full_name:"israelrodriguesnogueira-ai/ADL-MIDIA"},path:".github/workflows/outro.yml",event:"workflow_dispatch",status:"completed",conclusion:"success"});
 try{assert.equal((await send(123,configured)).status,404)}
 finally{globalThis.fetch=original}
});
