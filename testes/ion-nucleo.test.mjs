import test from "node:test";
import assert from "node:assert/strict";
import {criarNucleoION} from "../integracoes/ion-nucleo.mjs";

test("operador financeiro sem executor não inventa carteira",async()=>{
 const r=await criarNucleoION().processar("Criar carteira de investimentos");
 assert.equal(r.operador,"financeiro");assert.equal(r.executado,false);assert.equal(r.status,"sem_executor");
});
test("executor com evidência produz resultado",async()=>{
 const nucleo=criarNucleoION({executores:{desenvolvimento:async()=>({status:"concluido",resultado:"arquivo",evidencia:"sha:123"})}});
 const r=await nucleo.processar("Corrija o código");
 assert.equal(r.status,"concluido");assert.equal(r.evidencia,"sha:123");
});
test("sem evidência não declara conclusão",async()=>{
 const nucleo=criarNucleoION({executores:{midia:async()=>({status:"concluido",resultado:"vídeo"})}});
 assert.equal((await nucleo.processar("Crie um vídeo")).status,"nao_comprovado");
});
test("ação sensível exige autorização",async()=>{
 const nucleo=criarNucleoION({executores:{financeiro:async()=>({status:"concluido",evidencia:"ok"})}});
 assert.equal((await nucleo.processar("Criar carteira de investimentos",{acaoSensivel:true})).status,"autorizacao_necessaria");
});
