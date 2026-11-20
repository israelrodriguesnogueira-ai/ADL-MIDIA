import test from "node:test";
import assert from "node:assert/strict";
import { pesquisarInternet, consultarCambio } from "../src/aion-pesquisa-externa.mjs";
test("pesquisa valida fontes e horario", async () => {
  const fetchFake = async () => ({ok:true,json:async()=>({query:{pages:{1:{title:"Teste",fullurl:"https://pt.wikipedia.org/wiki/Teste",extract:"Resumo"}}}})});
  const r = await pesquisarInternet("teste", fetchFake);
  assert.equal(r.ok,true); assert.equal(r.fontes.length,1); assert.ok(r.consultadoEm);
});
test("pesquisa nao envia consultas excessivas", async () => {
  const r = await pesquisarInternet("x".repeat(181), async()=>{throw Error("nao chamar")});
  assert.equal(r.ok,false);
});
test("cambio indica referencia diaria, nunca tempo real", async () => {
  const fetchFake=async()=>({ok:true,json:async()=>({date:"2026-11-19",rates:{BRL:5.2}})});
  const r=await consultarCambio("USD","BRL",fetchFake);
  assert.equal(r.taxa,5.2);assert.match(r.aviso,/nao e cotacao em tempo real/);
});
test("falha externa nao vira resposta inventada", async () => {
  const r=await pesquisarInternet("teste",async()=>{throw Error("sem rede")});
  assert.equal(r.ok,false);
});
