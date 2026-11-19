import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";

const env = { ION_API_ACCESS_TOKEN: "token-apenas-para-teste" };
const comando = 'Crie um documento chamado Relatorio contendo: Etapa validada';
const enviar = (token, download = false) => worker.fetch(
  new Request("https://ion.example/api/comando" + (download ? "?download=1" : ""), {
    method: "POST",
    headers: { authorization: "Bearer " + token, "content-type": "application/json" },
    body: JSON.stringify({ comando })
  }), env
);

test("comando natural autentica, executa localmente e devolve resultado", async () => {
  const response = await enviar(env.ION_API_ACCESS_TOKEN);
  assert.equal(response.status, 200);
  const result = await response.json();
  assert.equal(result.status, "concluido");
  assert.equal(result.origem, "comando_natural");
  assert.equal(result.artefato.conteudo, "Relatorio\n\nEtapa validada");
  assert.equal(result.custoAdicional, 0);
});

test("mesmo comando permite baixar artefato sem servico externo", async () => {
  const response = await enviar(env.ION_API_ACCESS_TOKEN, true);
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-disposition"), /attachment/);
  assert.equal(await response.text(), "Relatorio\n\nEtapa validada");
});

test("comando natural nao executa sem autenticacao", async () => {
  const response = await enviar("token-incorreto");
  assert.equal(response.status, 401);
});
