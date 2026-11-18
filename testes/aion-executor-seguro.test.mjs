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
