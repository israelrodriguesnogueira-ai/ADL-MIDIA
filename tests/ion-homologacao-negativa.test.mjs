import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";

const endpoint="https://ion.invalid/api/executar-local";
const env={ION_API_ACCESS_TOKEN:"segredo-apenas-do-teste"};
const request=(path,method,body,authorization)=>new Request("https://ion.invalid"+path,{
 method,headers:{"content-type":"application/json",...(authorization?{authorization}:{})},
 ...(body===undefined?{}:{body:typeof body==="string"?body:JSON.stringify(body)})
});

test("sem segredo configurado falha fechado",async()=>{
 const response=await worker.fetch(request("/api/executar-local","POST",{acao:"capacidades"},"Bearer qualquer"),{});
 assert.equal(response.status,401);
});
test("token incorreto nao autoriza",async()=>{
 const response=await worker.fetch(request("/api/executar-local","POST",{acao:"capacidades"},"Bearer incorreto"),env);
 assert.equal(response.status,401);
});
test("metodo GET nao executa comando",async()=>{
 const response=await worker.fetch(request("/api/executar-local","GET"),env);
 assert.equal(response.status,405);
});
test("JSON malformado e recusado apos autenticar",async()=>{
 const response=await worker.fetch(request("/api/executar-local","POST","{","Bearer segredo-apenas-do-teste"),env);
 assert.equal(response.status,400);
});
test("acao nao autorizada e recusada com token valido",async()=>{
 const response=await worker.fetch(request("/api/executar-local","POST",{acao:"publicar",destino:"producao"},"Bearer segredo-apenas-do-teste"),env);
 assert.equal(response.status,422);
});
test("operador sem executor nao alega tarefa executada",async()=>{
 const response=await worker.fetch(request("/api/comando","POST",{comando:"produza um video de 15 segundos"},"Bearer segredo-apenas-do-teste"),env);
 assert.equal(response.status,200);
 const data=await response.json();
 assert.equal(data.status,"aguardando_executor");
 assert.equal(data.operador,"midia");
 assert.match(data.detalhe,/nenhuma tarefa externa foi executada/i);
});

test("corpo maior que 16KB sem Content-Length e rejeitado",async()=>{
 const payload=JSON.stringify({acao:"criar_texto",titulo:"x",conteudo:"a".repeat(17000)});
 const req=new Request(endpoint,{method:"POST",headers:{"authorization":"Bearer segredo-apenas-do-teste","content-type":"application/json"},body:new ReadableStream({
  start(controller){controller.enqueue(new TextEncoder().encode(payload));controller.close();}
 }),duplex:"half"});
 const response=await worker.fetch(req,env);
 assert.equal(response.status,413);
});
test("corpo valido abaixo do limite continua aceito",async()=>{
 const response=await worker.fetch(request("/api/executar-local","POST",{acao:"capacidades"},"Bearer segredo-apenas-do-teste"),env);
 assert.equal(response.status,200);
});
