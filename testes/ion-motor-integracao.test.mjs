import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";

const base="https://ion.local";
const env={ION_API_ACCESS_TOKEN:"token-de-teste",AI_ENABLED:"0"};
const call=(comando,auth=true)=>worker.fetch(new Request(base+"/api/comando",{
 method:"POST",headers:{"content-type":"application/json",...(auth?{authorization:"Bearer token-de-teste"}:{})},
 body:JSON.stringify({comando})
}),env);
test("bloqueia acesso sem autenticação",async()=>{
 const r=await call("Criar carteira de investimentos",false);assert.equal(r.status,401);
});
test("pedido financeiro nunca recebe sugestão de vídeo",async()=>{
 const r=await call("Criar carteira de investimentos conforme sua análise");
 assert.equal(r.status,200);
 const data=await r.json();assert.equal(data.operador,"financeiro");
 assert.equal(data.plano.operador,"financeiro");
 assert.equal(data.status,"aguardando_executor");
 assert.doesNotMatch(JSON.stringify(data),/posso criar um vídeo/i);
});
test("vídeo vai ao operador mídia sem afirmar que produziu arquivo",async()=>{
 const data=await (await call("Crie um vídeo educativo")).json();
 assert.equal(data.operador,"midia");assert.equal(data.status,"aguardando_executor");
});
test("endpoint de saúde não expõe segredo",async()=>{
 const r=await worker.fetch(new Request(base+"/health"),env);
 assert.equal(r.status,200);
 assert.doesNotMatch(await r.text(),/token-de-teste/);
});
