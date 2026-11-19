import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
import { identificarOperador } from "../integracoes/ion-roteador-operadores.mjs";

const env = { ION_API_ACCESS_TOKEN: "token-de-teste", AI_ENABLED: "0" };
const call = (comando, token = "token-de-teste") => worker.fetch(
  new Request("https://ion.example/api/comando", {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify({ comando })
  }), env
);

test("roteador identifica operadores sem executar efeitos externos", () => {
  for (const [comando, esperado] of [
    ["Avaliar carteira de investimentos", "financeiro"],
    ["Pesquisar hipótese científica", "cientifico"],
    ["Corrigir bug do aplicativo", "desenvolvimento"],
    ["Criar imagem de produto", "midia"],
    ["Verificar pedidos Shopee", "shopee"]
  ]) assert.equal(identificarOperador(comando).operador, esperado);
});

test("comando de operador nao conectado retorna estado verificavel sem inventar entrega", async () => {
  for (const [comando, operador] of [
    ["Avaliar carteira de investimentos", "financeiro"],
    ["Pesquisar hipótese científica", "cientifico"],
    ["Verificar pedidos Shopee", "shopee"]
  ]) {
    const response = await call(comando);
    assert.equal(response.status, 200);
    const body = await response.json();
    assert.equal(body.status, "aguardando_executor");
    assert.equal(body.operador, operador);
    assert.match(body.detalhe, /nenhuma tarefa externa foi executada/i);
  }
});

test("comandos de operadores exigem autenticacao", async () => {
  const response = await call("Verificar pedidos Shopee", "token-incorreto");
  assert.equal(response.status, 401);
});

test("imagem de carteira digital e encaminhada a midia, nao a investimentos", () => {
  assert.equal(identificarOperador("Crie uma imagem de carteira digital").operador, "midia");
});
