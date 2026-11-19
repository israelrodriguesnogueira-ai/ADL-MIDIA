import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
test("health distingue processo online de entrega homologada",async()=>{
 const r=await worker.fetch(new Request("https://ion.example/health"),{});
 assert.equal(r.status,200);
 const body=await r.json();
 assert.equal(body.status,"online");
 assert.equal(body.prontoParaProducao,false);
 assert.equal(body.autenticacaoProprietarioIntegrada,false);
 assert.equal(body.interfaceConectada,false);
 assert.equal(body.renderRemotoConfigurado,false);
});
test("configurar render remoto nao implica homologacao",async()=>{
 const r=await worker.fetch(new Request("https://ion.example/health"),{
  AION_RENDER_DISPATCH_ENABLED:"1",AION_GITHUB_DISPATCH_TOKEN:"teste"
 });
 const body=await r.json();
 assert.equal(body.renderRemotoConfigurado,true);
 assert.equal(body.prontoParaProducao,false);
});
