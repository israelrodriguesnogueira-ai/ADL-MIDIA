import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
const url="https://preview.example/api/comando";
const env={ION_API_ACCESS_TOKEN:"token-de-teste",AI_ENABLED:"0"};
const request=(comando,token="token-de-teste",download=false)=>worker.fetch(new Request(url+(download?"?download=1":""),{
 method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},
 body:JSON.stringify({comando})
}),env);
test("comando de video cria roteiro no Worker autenticado sem custo",async()=>{
 const r=await request("Criar vídeo de vestido preto de alfaiataria 15 segundos");
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.operador,"midia");
 assert.equal(data.renderizado,false);
 assert.equal(data.custoAdicional,0);
 const roteiro=JSON.parse(data.artefato.conteudo);
 assert.equal(roteiro.duracaoSegundos,15);
 assert.equal(roteiro.cenas.at(-1).fim,15);
});
test("roteiro pode ser baixado com autorizacao",async()=>{
 const r=await request("Criar vídeo de vestido preto 15 segundos","token-de-teste",true);
 assert.equal(r.status,200);
 assert.match(r.headers.get("content-disposition"),/ion-roteiro-video.json/);
 assert.equal((await r.json()).renderizado,false);
});
test("sem token nao executa nem entrega roteiro",async()=>{
 assert.equal((await request("Criar vídeo de vestido preto 15 segundos","invalido")).status,401);
});
test("duracao invalida nao e executada",async()=>{
 assert.equal((await request("Criar vídeo de vestido preto 120 segundos")).status,400);
});
