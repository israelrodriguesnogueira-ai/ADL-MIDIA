import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
test("comando natural cria Markdown sem provedor externo",async()=>{
 const r=await worker.fetch(new Request("https://ion.example/api/comando",{method:"POST",headers:{authorization:"Bearer teste","content-type":"application/json"},body:JSON.stringify({comando:"Crie um documento markdown chamado Relatorio com texto: Conteudo aprovado"})}),{ION_API_ACCESS_TOKEN:"teste"});
 assert.equal(r.status,200);
 const data=await r.json();
 assert.equal(data.artefato.nome,"ion-documento.md");
 assert.equal(data.artefato.conteudo,"# Relatorio\n\nConteudo aprovado");
 assert.equal(data.custoAdicional,0);
});
