import test from "node:test";
import assert from "node:assert/strict";
import { executarTarefa } from "../integracoes/aion-executor-seguro.mjs";
test("recusa tarefa fora da lista", async () => {
 const r = await executarTarefa({ tarefa: "apagar-repositorio", comando: "apagar repositorio", aprovado: true });
 assert.equal(r.status, "aguardando_executor");
});
test("exige aprovacao antes de executar", async () => {
 const r = await executarTarefa({ tarefa: "testar-sistema" });
 assert.equal(r.status, "aguardando_aprovacao");
});

test("executa de verdade tarefa permitida", async () => {
 const r = await executarTarefa({ tarefa: "verificar-runtime", aprovado: true });
 assert.equal(r.status, "executado");
 assert.match(r.saida, /^v[0-9]+[.][0-9]+[.][0-9]+/);
});
