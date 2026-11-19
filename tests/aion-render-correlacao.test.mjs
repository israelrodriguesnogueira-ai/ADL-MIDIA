import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
const env={ION_API_ACCESS_TOKEN:"teste",AION_RENDER_DISPATCH_ENABLED:"1",AION_GITHUB_DISPATCH_TOKEN:"segredo"};
const call=(path,body,token="teste")=>worker.fetch(new Request("https://ion.example"+path,{
 method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify(body)
}),env);
test("iniciar video retorna identificador rastreavel",async()=>{
 const original=globalThis.fetch;let id;
 globalThis.fetch=async(url,options)=>{const input=JSON.parse(options.body).inputs;id=input.solicitacao_id;return new Response(null,{status:204})};
 try{
  const r=await call("/api/video/iniciar",{produto:"Vestido preto"});
  assert.equal(r.status,202);
  const data=await r.json();
  assert.equal(data.solicitacaoId,id);
  assert.match(id,/^[0-9a-f-]{36}$/);
 }finally{globalThis.fetch=original}
});
test("localizar encontra execucao correta por id",async()=>{
 const id="12345678-1234-4123-8123-123456789abc";
 const original=globalThis.fetch;
 globalThis.fetch=async()=>Response.json({workflow_runs:[
  {id:44,display_title:"AION video "+id,event:"workflow_dispatch",head_branch:"main",status:"completed",conclusion:"success"}
 ]});
 try{
  const r=await call("/api/video/localizar",{solicitacaoId:id});
  assert.equal(r.status,200);
  assert.equal((await r.json()).runId,44);
 }finally{globalThis.fetch=original}
});
test("localizar exige autenticacao e id valido",async()=>{
 const id="12345678-1234-4123-8123-123456789abc";
 assert.equal((await call("/api/video/localizar",{solicitacaoId:id},"errado")).status,401);
 assert.equal((await call("/api/video/localizar",{solicitacaoId:"invalido"})).status,400);
});
