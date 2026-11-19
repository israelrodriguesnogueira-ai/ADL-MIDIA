import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";

const env = { ION_API_ACCESS_TOKEN: "token-de-teste", AION_RENDER_DISPATCH_ENABLED: "0" };
const send = (path, body, token = "token-de-teste") => worker.fetch(new Request(
  "https://ion.example" + path,
  { method: "POST", headers: { authorization: "Bearer " + token, "content-type": "application/json" }, body: JSON.stringify(body) }
), env);

test("video remoto desligado nao dispara processamento nem custo externo", async () => {
  const response = await send("/api/video/iniciar", { produto: "vestido preto" });
  assert.equal(response.status, 503);
  const result = await response.json();
  assert.equal(result.status, "indisponivel");
});

test("video remoto recusa descricao invalida", async () => {
  for (const produto of ["", "a".repeat(121), "vestido\ncom quebra"]) {
    const response = await send("/api/video/iniciar", { produto });
    assert.equal(response.status, 400);
  }
});

test("consulta de video exige autenticacao antes de acessar GitHub", async () => {
  for (const path of ["/api/video/iniciar", "/api/video/status", "/api/video/artefato", "/api/video/baixar"]) {
    const response = await send(path, { produto: "vestido", runId: 1 }, "incorreto");
    assert.equal(response.status, 401);
  }
});

test("consulta de video nao revela credenciais quando desabilitada", async () => {
  for (const path of ["/api/video/status", "/api/video/artefato", "/api/video/baixar"]) {
    const response = await send(path, { runId: 1 });
    assert.equal(response.status, 503);
    assert.doesNotMatch(JSON.stringify(await response.json()), /token-de-teste/);
  }
});
