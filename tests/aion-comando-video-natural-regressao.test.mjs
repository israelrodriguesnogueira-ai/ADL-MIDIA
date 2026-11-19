import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
const send=comando=>worker.fetch(new Request("https://ion.example/api/comando",{
 method:"POST",headers:{"authorization":"Bearer teste","content-type":"application/json"},
 body:JSON.stringify({comando})
}),{ION_API_ACCESS_TOKEN:"teste"});
test("comando natural de video produz roteiro sem afirmar MP4 pronto",async()=>{
 const response=await send("Criar vídeo de vestido preto de alfaiataria 15 segundos");
 assert.equal(response.status,200);
 const result=await response.json();
 assert.equal(result.operador,"midia");
 assert.equal(result.origem,"comando_natural");
 assert.equal(result.renderizado,false);
 assert.match(JSON.stringify(result),/vestido preto/i);
});
test("comando de duracao fora do permitido nao executa render",async()=>{
 const response=await send("Criar vídeo de vestido preto de 99 segundos");
 assert.equal(response.status,400);
});
