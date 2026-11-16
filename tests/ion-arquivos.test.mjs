import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker-ion/index.mjs";
import { arquivosDoDono, receberVideo3D, reservarVideo3D } from "../worker-ion/arquivos.mjs";

const origin = "https://aion.example.test";
const request = (path, init) => new Request(origin + path, init);

test("proprietário autorizado pode recuperar o mesmo vídeo com nova requisição", async () => {
  const objects = new Map();
  const bucket = {
    async put(key, body, metadata) { objects.set(key, { body, ...metadata }); },
    async get(key) { return objects.get(key); },
  };
  const original = Uint8Array.of(0, 0, 0, 24, 102, 116, 121, 112);
  const saved = await arquivosDoDono(request("/api/arquivos", {
    method: "POST", body: original, headers: { "Content-Type": "video/mp4" },
  }), bucket);
  assert.equal(saved.status, 201);
  const { id, caminho } = await saved.json();
  assert.equal(caminho, "/?arquivo=" + id);
  const anotherDevice = await arquivosDoDono(request("/api/arquivos/" + id), bucket, id);
  assert.equal(anotherDevice.status, 200);
  assert.equal(anotherDevice.headers.get("Cache-Control"), "private, no-store");
  assert.match(anotherDevice.headers.get("Content-Disposition"), /attachment/);
  assert.deepEqual(new Uint8Array(await anotherDevice.arrayBuffer()), original);
  assert.equal((await arquivosDoDono(request("/api/arquivos/missing"), bucket, "missing")).status, 404);
});

test("worker exige login para recuperar arquivo", async () => {
  const config = {
    ION_OWNER_EMAIL: "owner@gmail.com",
    ION_GOOGLE_CLIENT_ID: "12345-abc.apps.googleusercontent.com",
    ION_ARQUIVOS: { get() { assert.fail("Não pode consultar o bucket sem login"); } },
  };
  const response = await worker.fetch(request("/api/arquivos/8e8db426-1cae-41d4-b2fa-19c295eaae8f"), config);
  assert.equal(response.status, 401);
});

test("limite real do upload é aplicado mesmo sem Content-Length", async () => {
  const corpo = new Uint8Array(8 * 1024 * 1024 + 1);
  const r = await arquivosDoDono(request("/api/arquivos", { method: "POST", body: corpo,
    headers: { "Content-Type": "video/mp4" } }), { put() { assert.fail("Arquivo excedeu o limite"); } });
  assert.equal(r.status, 413);
});

test("renderização salva no endereço reservado e token deixa de funcionar após entrega", async () => {
  const objects = new Map();
  const bucket = {
    async put(key, body, options) {
      if (options.onlyIf && objects.has(key)) return null;
      objects.set(key, { body, text: async () => body, ...options });
      return { key };
    },
    async get(key) { return objects.get(key); },
    async delete(key) { objects.delete(key); },
  };
  const { id, token } = await reservarVideo3D(bucket);
  const original = Uint8Array.of(0, 0, 0, 24, 102, 116, 121, 112);
  const route = "/api/video/3d/resultado/" + id;
  const callback = value => request(route, { method: "POST", body: original,
    headers: { Authorization: "Bearer " + value, "Content-Type": "video/mp4" } });
  const config = { ION_ARQUIVOS: bucket };
  assert.equal((await worker.fetch(callback("a".repeat(72)), config)).status, 403);
  assert.equal((await worker.fetch(callback(token), config)).status, 201);
  assert.equal((await receberVideo3D(callback(token), bucket, id)).status, 403);
  const download = await arquivosDoDono(request("/api/arquivos/" + id), bucket, id);
  assert.deepEqual(new Uint8Array(await download.arrayBuffer()), original);
});
