import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
const env={ION_API_ACCESS_TOKEN:"token-de-teste"};
const call=(path,body,token="token-de-teste")=>worker.fetch(new Request("https://ion.example"+path,{
 method:"POST",headers:{"authorization":"Bearer "+token,"content-type":"application/json"},
 body:JSON.stringify(body)
}),env);
test("rota local exige autenticacao",async()=>{
 const r=await call("/api/executar-local",{acao:"capacidades"},"errado");
 assert.equal(r.status,401);
});
test("rota local produz artefato sem API de IA",async()=>{
 const r=await call("/api/executar-local",{acao:"criar_texto",titulo:"Teste",conteudo:"Ola"});
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.artefato.conteudo,"Teste\n\nOla");
 assert.equal(data.custoAdicional,0);
});
test("rota local recusa comando arbitrario",async()=>{
 const r=await call("/api/executar-local",{acao:"shell",comando:"ls"});
 assert.equal(r.status,422);
});
