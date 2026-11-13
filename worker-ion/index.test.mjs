import test from "node:test";
import assert from "node:assert/strict";
import worker from "./index.mjs";

const origin = "https://ion-validacao.example";
const env = {
  ION_OWNER_EMAIL: "owner@gmail.com",
  ION_GOOGLE_CLIENT_ID: "12345-abc.apps.googleusercontent.com",
};
const request = (path, options) => new Request(origin + path, options);

test("página de login disponível com configuração válida", async () => {
  const response = await worker.fetch(request("/"), env);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Validar acesso ao Ion/);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("configuração incompleta bloqueia o acesso (503)", async () => {
  for (const bad of [{}, { ION_OWNER_EMAIL: env.ION_OWNER_EMAIL },
    { ...env, ION_GOOGLE_CLIENT_ID: "invalido" }]) {
    const response = await worker.fetch(request("/"), bad);
    assert.equal(response.status, 503);
  }
});

test("rota privada sem credencial retorna 401", async () => {
  const response = await worker.fetch(request("/verificar-acesso"), env);
  assert.equal(response.status, 401);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("token inventado não libera acesso", async () => {
  const response = await worker.fetch(request("/verificar-acesso", {
    headers: { Authorization: "Bearer aaa.bbb.ccc" },
  }), env);
  assert.equal(response.status, 401);
});

test("rotas e métodos não previstos são recusados", async () => {
  assert.equal((await worker.fetch(request("/admin"), env)).status, 404);
  assert.equal((await worker.fetch(request("/", { method: "POST" }), env)).status, 405);
});

test("resposta de negação não revela identidade nem segredos", async () => {
  const response = await worker.fetch(request("/verificar-acesso"), env);
  const body = await response.text();
  assert.doesNotMatch(body, /owner@gmail.com|12345-abc|Bearer/i);
});
