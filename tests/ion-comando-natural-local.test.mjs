import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
import { interpretarComandoLocal } from "../integracoes/ion-comando-natural-local.mjs";
const env={ION_API_ACCESS_TOKEN:"token-de-teste"};
const request=(comando,token="token-de-teste")=>worker.fetch(new Request("https://ion.example/api/comando",{
 method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify({comando})
}),env);
test("comando natural cria arquivo real sem API externa",async()=>{
 const r=await request("Crie um documento chamado Relatorio com texto: Entrega validada");
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.status,"concluido");
 assert.equal(data.artefato.conteudo,"Relatorio\n\nEntrega validada");
 assert.equal(data.custoAdicional,0);
 assert.equal(data.origem,"comando_natural");
});
test("comando natural ainda exige token",async()=>{
 assert.equal((await request("Crie um documento chamado T com texto: x","errado")).status,401);
});
test("nao interpreta pedidos vagos nem aciona publicacao",()=>{
 assert.equal(interpretarComandoLocal("publique o documento"),null);
 assert.equal(interpretarComandoLocal("crie um video"),null);
});
