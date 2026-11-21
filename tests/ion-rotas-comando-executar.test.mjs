import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";

const env = { ION_API_ACCESS_TOKEN: "token-de-teste" };
function chamar(rota, body, token = "token-de-teste") {
  return worker.fetch(new Request("https://ion.example" + rota, {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify(body)
  }), env);
}

test("comando e executar compartilham o mesmo roteamento", async () => {
  const body = { comando: "analise o Ibovespa" };
  const a = await chamar("/api/comando", body);
  const b = await chamar("/api/executar", body);
  assert.equal(a.status, b.status);
  assert.deepEqual(await a.json(), await b.json());
});

test("ambas as rotas recusam acesso sem credencial valida", async () => {
  for (const rota of ["/api/comando", "/api/executar"]) {
    const r = await chamar(rota, { comando: "analise o Ibovespa" }, "invalido");
    assert.equal(r.status, 401);
  }
});

test("nenhuma rota alega executar o operador financeiro desconectado", async () => {
  for (const rota of ["/api/comando", "/api/executar"]) {
    const r = await chamar(rota, { comando: "analise o Ibovespa" });
    const body = await r.json();
    assert.equal(body.status, "aguardando_executor");
    assert.equal(body.operador, "financeiro");
  }
});
