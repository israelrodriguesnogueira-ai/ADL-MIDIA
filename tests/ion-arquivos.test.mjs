import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { readFileSync } from "node:fs";
import { arquivosEmD1 } from "../worker-ion/arquivos-d1.mjs";
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
    ION_VIDEOS_DB: { prepare() { assert.fail("Não pode consultar o bucket sem login"); } },
  };
  const response = await worker.fetch(request("/api/arquivos/8e8db426-1cae-41d4-b2fa-19c295eaae8f"), config);
  assert.equal(response.status, 401);
});

test("limite real do upload é aplicado mesmo sem Content-Length", async () => {
  const corpo = new Uint8Array(1_500_001);
  const r = await arquivosDoDono(request("/api/arquivos", { method: "POST", body: corpo,
    headers: { "Content-Type": "video/mp4" } }), { put() { assert.fail("Arquivo excedeu o limite"); } });
  assert.equal(r.status, 413);
});

test("renderização salva no endereço reservado e token deixa de funcionar após entrega", async () => {
  const sqlite = new DatabaseSync(":memory:");
  sqlite.exec(readFileSync(new URL("../worker-ion/migrations/0001_arquivos_ion.sql", import.meta.url), "utf8"));
  const db = {
    prepare(query) {
      const statement = sqlite.prepare(query);
      return { bind: (...args) => {
        const values = args.map(value => value instanceof ArrayBuffer ? new Uint8Array(value) : value);
        return {
          first: async () => statement.get(...values) ?? null,
          run: async () => ({ meta: { changes: statement.run(...values).changes } }),
        };
      } };
    },
  };
  const bucket = arquivosEmD1(db);
  const { id, token } = await reservarVideo3D(bucket);
  const original = Uint8Array.of(0, 0, 0, 24, 102, 116, 121, 112);
  const route = "/api/video/3d/resultado/" + id;
  const callback = value => request(route, { method: "POST", body: original,
    headers: { Authorization: "Bearer " + value, "Content-Type": "video/mp4" } });
  const config = { ION_VIDEOS_DB: db };
  assert.equal((await worker.fetch(callback("a".repeat(72)), config)).status, 403);
  assert.equal((await worker.fetch(callback(token), config)).status, 201);
  assert.equal((await receberVideo3D(callback(token), bucket, id)).status, 403);
  const download = await arquivosDoDono(request("/api/arquivos/" + id), bucket, id);
  assert.deepEqual(new Uint8Array(await download.arrayBuffer()), original);
});
