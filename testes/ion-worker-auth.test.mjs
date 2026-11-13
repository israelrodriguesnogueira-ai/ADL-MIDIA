import test from "node:test";
import assert from "node:assert/strict";
import worker from "../worker-ion/index.mjs";

const url = "https://example.workers.dev";
const owner = "owner@gmail.com";
const clientId = "123456-example.apps.googleusercontent.com";

test("missing configuration fails closed with 503", async () => {
  const response = await worker.fetch(new Request(url), {});
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("Cache-Control"), "no-store");
});

test("valid configuration serves login page", async () => {
  const response = await worker.fetch(new Request(url), {
    ION_OWNER_EMAIL: "  OWNER@GMAIL.COM ",
    ION_GOOGLE_CLIENT_ID: clientId,
  });
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Validar acesso ao Ion/);
});

test("unverified requests never gain owner access", async () => {
  const response = await worker.fetch(new Request(url + "/verificar-acesso"), {
    ION_OWNER_EMAIL: owner,
    ION_GOOGLE_CLIENT_ID: clientId,
  });
  assert.equal(response.status, 401);
});

test("invalid client ID fails closed", async () => {
  const response = await worker.fetch(new Request(url), {
    ION_OWNER_EMAIL: owner,
    ION_GOOGLE_CLIENT_ID: "123456",
  });
  assert.equal(response.status, 503);
});
