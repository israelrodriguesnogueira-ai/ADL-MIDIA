import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";

const endpoint = "https://ion.example/api/executar-local";
const request = (authorization, body = "{}") => new Request(endpoint, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    ...(authorization ? { authorization } : {})
  },
  body
});

test("executor recusa chamadas sem credencial configurada", async () => {
  const response = await worker.fetch(request(), {});
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("executor recusa credencial ausente ou incorreta", async () => {
  const env = { ION_API_ACCESS_TOKEN: "segredo-de-teste" };
  for (const authorization of [undefined, "Bearer errado", "Basic segredo-de-teste"]) {
    const response = await worker.fetch(request(authorization), env);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { erro: "Não autorizado" });
  }
});

test("executor autentica antes de processar JSON malformado", async () => {
  const response = await worker.fetch(
    request(undefined, "{invalido"),
    { ION_API_ACCESS_TOKEN: "segredo-de-teste" }
  );
  assert.equal(response.status, 401);
});

test("executor rejeita corpo excessivo sem executar", async () => {
  const response = await worker.fetch(
    request("Bearer segredo-de-teste", JSON.stringify({ dados: "x".repeat(17000) })),
    { ION_API_ACCESS_TOKEN: "segredo-de-teste" }
  );
  assert.equal(response.status, 413);
});
