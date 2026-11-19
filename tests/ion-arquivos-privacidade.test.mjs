import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";

const endpoint = "https://ion.example";
const post = (path, token, payload) => worker.fetch(new Request(endpoint + path, {
  method: "POST",
  headers: { authorization: "Bearer " + token, "content-type": "application/json" },
  body: JSON.stringify(payload)
}), { ION_API_ACCESS_TOKEN: "token-de-teste" });

test("API nao oferece armazenamento publico de anexos", async () => {
  for (const path of ["/api/anexos", "/api/arquivos", "/api/tarefas/persistir"]) {
    const response = await post(path, "token-de-teste", { conteudo: "privado" });
    assert.equal(response.status, 404);
    assert.equal(response.headers.get("cache-control"), "no-store");
  }
});

test("arquivo local e entregue sem gravacao persistente nem dependencia externa", async () => {
  const response = await post("/api/executar-local?download=1", "token-de-teste", {
    acao: "criar_texto", titulo: "Teste", conteudo: "Conteudo temporario"
  });
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition"), /attachment/);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(await response.text(), "Teste\n\nConteudo temporario");
});

test("acesso a arquivo exige autenticacao", async () => {
  const response = await post("/api/executar-local?download=1", "invalido", {
    acao: "criar_texto", titulo: "Privado", conteudo: "Nao revelar"
  });
  assert.equal(response.status, 401);
  assert.doesNotMatch(await response.text(), /Nao revelar/);
});
