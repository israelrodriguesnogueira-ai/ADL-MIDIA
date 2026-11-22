import test from "node:test";
import assert from "node:assert/strict";
import {simularPlanoFinanceiro} from "../integracoes/ion-simulador-financeiro.mjs";
test("gera 300 registros e meta matematica sem ordens",()=>{
 const r=simularPlanoFinanceiro({});
 assert.equal(r.status,"concluido");assert.equal(r.registros.length,300);
 assert.ok(Math.abs(r.saldoFinal-15000)<0.01);
 assert.ok(Math.abs(r.taxaNecessaria-0.019196)<0.0001);
 assert.equal(r.ordensReaisExecutadas,false);assert.equal(r.custoAdicional,0);
});
test("rejeita entradas invalidas",()=>{
 assert.equal(simularPlanoFinanceiro({operacoes:0}).status,"erro");
 assert.equal(simularPlanoFinanceiro({retornoPorOperacao:-1}).status,"erro");
});
test("retorno zero preserva saldo",()=>{
 const r=simularPlanoFinanceiro({retornoPorOperacao:0});
 assert.equal(r.saldoFinal,50);assert.equal(r.metaAtingida,false);
});
