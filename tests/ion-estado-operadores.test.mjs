import test from "node:test";
import assert from "node:assert/strict";
import { executarLocal } from "../integracoes/ion-executor-local.mjs";

test("informa capacidades sem alegar operadores conectados", () => {
 const resposta = executarLocal({acao:"estado_operadores"});
 assert.equal(resposta.status,"concluido");
 assert.equal(resposta.escopo,"executor_local_experimental");
 assert.equal(resposta.custoAdicional,0);
 assert.equal(resposta.operadores.length,5);
 assert.equal(resposta.operadores.find(o=>o.nome==="desenvolvimento").estado,"parcial");
 assert.equal(resposta.operadores.find(o=>o.nome==="midia").estado,"parcial");
  assert.ok(resposta.operadores.find(o=>o.nome==="midia").capacidades.includes("criar_roteiro_video"));
  for(const nome of ["financeiro","cientifico","shopee"]){
   const operador=resposta.operadores.find(o=>o.nome===nome);
   assert.equal(operador.estado,"nao_conectado");
   assert.deepEqual(operador.capacidades,[]);
 }
});
test("inclui consulta de estado nas capacidades", () => {
 assert.ok(executarLocal({acao:"capacidades"}).capacidades.includes("estado_operadores"));
});

test("operador midia produz roteiro estruturado sem alegar renderizacao", () => {
 const r=executarLocal({acao:"criar_roteiro_video",produto:"Vestido preto",duracaoSegundos:15});
 assert.equal(r.status,"concluido");
 assert.equal(r.operador,"midia");
 assert.equal(r.renderizado,false);
 const roteiro=JSON.parse(r.artefato.conteudo);
 assert.equal(roteiro.cenas.at(-1).fim,15);
 assert.equal(roteiro.renderizado,false);
 assert.equal(r.custoAdicional,0);
});
test("operador midia rejeita duracao invalida", () => {
 assert.equal(executarLocal({acao:"criar_roteiro_video",produto:"Vestido",duracaoSegundos:100}).status,"erro");
});
