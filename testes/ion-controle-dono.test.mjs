import assert from "node:assert/strict";
import test from "node:test";
import { protectOwnerRoute } from "../integracoes/ion-controle-dono.mjs";

const owner = { issuer: "https://identity.example", subject: "owner-id" };

test("autoriza somente a identidade confirmada do dono", async () => {
  const events = [];
  const request = new Request("https://ion.example/comandos", {
    method: "POST",
    headers: { "X-Owner": owner.subject },
    body: JSON.stringify({ role: "owner", subject: owner.subject }),
  });
  let identity;
  let calls = 0;
  const route = protectOwnerRoute({
    owner: { ...owner },
    verifySession: async () => identity,
    audit: async event => events.push(event),
  }, async () => {
    calls++;
    return new Response("comando aceito");
  });

  for (const [session, expected] of [
    [null, 401],
    [{ ...owner, subject: "agente" }, 403],
    [{ ...owner, issuer: "https://other.example" }, 403],
    [owner, 200],
  ]) {
    identity = session;
    const result = await route(request);
    assert.equal(result.status, expected);
    assert.equal(result.headers.get("Cache-Control"), "no-store");
  }

  assert.equal(calls, 1);
  assert.equal(request.bodyUsed, false);
  assert.deepEqual(events.map(event => event.reason), [
    "sessao_ausente_ou_invalida",
    "identidade_sem_permissao",
    "identidade_sem_permissao",
  ]);
});

test("falhas do verificador e da auditoria mantêm a rota bloqueada", async () => {
  const route = protectOwnerRoute({
    owner,
    verifySession: async () => { throw new Error("offline"); },
    audit: async () => { throw new Error("offline"); },
  }, () => assert.fail("comando executado"));
  assert.equal((await route(new Request("https://ion.example"))).status, 503);
});

test("não inicializa sem dono configurado", () => {
  assert.throws(() => protectOwnerRoute({
    verifySession: async () => null,
    audit: async () => {},
  }, () => new Response()), TypeError);
});
