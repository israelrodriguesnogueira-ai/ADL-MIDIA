import test from "node:test";
import assert from "node:assert/strict";
import { executarLocal } from "../integracoes/ion-executor-local.mjs";

test("consulta capacidades reais sem efeitos externos", () => {
 const r = executarLocal({acao:"capacidades"});
 assert.equal(r.status,"concluido");
 assert.deepEqual(r.capacidades,["capacidades","criar_texto"]);
 assert.ok(r.limites.includes("sem custos externos"));
});
test("cria artefato de texto verificavel", () => {
 const r = executarLocal({acao:"criar_texto",titulo:"Teste",conteudo:"Conteudo"});
 assert.equal(r.status,"concluido");
 assert.equal(r.artefato.conteudo,"Teste\n\nConteudo");
 assert.equal(r.artefato.tipo,"text/plain; charset=utf-8");
 assert.equal(r.custoAdicional,0);
});
test("nao afirma ter gerado video, audio ou publicado", () => {
 for(const acao of ["criar_video","criar_audio","publicar","transferir","shell","executar_codigo"]){
  const r=executarLocal({acao});
  assert.equal(r.status,"nao_suportado");
  assert.equal(r.artefato,undefined);
 }
});
test("valida campos e limites de tamanho", () => {
 assert.equal(executarLocal(null).status,"erro");
 for(const pedido of [
  {acao:"criar_texto",titulo:"",conteudo:"x"},
  {acao:"criar_texto",titulo:"x",conteudo:42},
  {acao:"criar_texto",titulo:"x".repeat(121),conteudo:"a"},
  {acao:"criar_texto",titulo:"x",conteudo:"a".repeat(12001)}
 ]) assert.equal(executarLocal(pedido).status,"erro");
});
