import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
const endpoint="https://ion.example/api/video/iniciar";
const send=(produto,env={},token="teste")=>worker.fetch(new Request(endpoint,{
 method:"POST",headers:{"authorization":"Bearer "+token,"content-type":"application/json"},
 body:JSON.stringify({produto})
}),{ION_API_ACCESS_TOKEN:"teste",...env});
test("disparo remoto exige autorizacao do proprietario",async()=>{
 const r=await send("Vestido preto",{AION_RENDER_DISPATCH_ENABLED:"1",AION_GITHUB_DISPATCH_TOKEN:"segredo"},"invalido");
 assert.equal(r.status,401);
});
test("disparo remoto fica desativado por padrao",async()=>{
 const r=await send("Vestido preto");
 assert.equal(r.status,503);
 assert.equal((await r.json()).status,"indisponivel");
});
test("produto invalido nao aciona renderizador",async()=>{
 assert.equal((await send(" ")).status,400);
 assert.equal((await send("x".repeat(121))).status,400);
});
test("disparo autenticado usa somente token de servidor e confirma aceite",async()=>{
 const original=globalThis.fetch;
 let chamadas=0;
 globalThis.fetch=async(url,options)=>{
  chamadas++;
  assert.match(String(url),/github.com\\/repos\\/israelrodriguesnogueira-ai/);
  assert.equal(options.headers.authorization,"Bearer segredo-de-teste");
  assert.equal(JSON.parse(options.body).inputs.produto,"Vestido preto");
  return new Response(null,{status:204});
 };
 try {
  const r=await send("Vestido preto",{AION_RENDER_DISPATCH_ENABLED:"1",AION_GITHUB_DISPATCH_TOKEN:"segredo-de-teste"});
  assert.equal(r.status,202);
  const data=await r.json();
  assert.equal(data.status,"solicitado");
  assert.equal(data.renderizado,false);
  assert.equal(chamadas,1);
 }finally{globalThis.fetch=original}
});
