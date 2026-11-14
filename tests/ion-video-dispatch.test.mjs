import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker-ion/index.mjs";

const url = "https://ion.example.test/api/video/transito";

test("video endpoint rejects GET", async () => {
  const response = await worker.fetch(new Request(url), {});
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});

test("video endpoint refuses to run without configured owner", async () => {
  const response = await worker.fetch(new Request(url, { method: "POST" }), {});
  assert.equal(response.status, 503);
  assert.match((await response.json()).erro, /Autenticação/);
});

test("video endpoint refuses invalid Google client id", async () => {
  const response = await worker.fetch(new Request(url, { method: "POST" }), {
    ION_OWNER_EMAIL: "owner@gmail.com",
    ION_GOOGLE_CLIENT_ID: "invalid-client-id",
  });
  assert.equal(response.status, 503);
});

test("login page remains available with configured owner", async () => {
  const response = await worker.fetch(new Request("https://ion.example.test/"), {
    ION_OWNER_EMAIL: "owner@gmail.com",
    ION_GOOGLE_CLIENT_ID: "12345-abc.apps.googleusercontent.com",
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes('/api/video/transito'));
  assert.ok(html.includes('showPanel((await result.json()).areas, credential)'));
});

test("interface separates dictation from message submission", async () => {
  const response = await worker.fetch(new Request("https://ion.example.test/"), {
    ION_OWNER_EMAIL: "owner@gmail.com",
    ION_GOOGLE_CLIENT_ID: "12345-abc.apps.googleusercontent.com",
  });
  const html = await response.text();
  assert.ok(html.includes('id="pedido-ion"'));
  assert.ok(html.includes('id="voz-ion"'));
  assert.ok(html.includes('id="enviar-ion"'));
  assert.ok(html.includes('id="cancelar-video"'));
  assert.ok(!html.includes('id="transito-ion"'));
  assert.ok(html.includes('Texto reconhecido. Revise e toque em Enviar'));
  assert.ok(!html.includes('help.textContent = "Comando de voz enviado.";'));
  assert.ok(html.includes('signal: recording.signal'));
  assert.ok(html.includes('microphone.setAttribute("aria-label", "Parar ditado")'));
});
