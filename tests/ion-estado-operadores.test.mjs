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
 for(const nome of ["midia","financeiro","cientifico","shopee"]){
   const operador=resposta.operadores.find(o=>o.nome===nome);
   assert.equal(operador.estado,"nao_conectado");
   assert.deepEqual(operador.capacidades,[]);
 }
});
test("inclui consulta de estado nas capacidades", () => {
 assert.ok(executarLocal({acao:"capacidades"}).capacidades.includes("estado_operadores"));
});
