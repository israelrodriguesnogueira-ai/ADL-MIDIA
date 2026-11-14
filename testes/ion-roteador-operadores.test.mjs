import test from "node:test";
import assert from "node:assert/strict";
import { identificarOperador, respostaSemExecutor } from "../integracoes/ion-roteador-operadores.mjs";

test("carteira de investimentos vai para financeiro, não mídia", () => {
 const r=identificarOperador("Criar carteira de investimentos conforme sua análise");
 assert.equal(r.operador,"financeiro");
 assert.doesNotMatch(respostaSemExecutor(r).mensagem,/criar um vídeo/i);
});
test("código vai para desenvolvimento",()=>assert.equal(identificarOperador("Corrija o código do sistema").operador,"desenvolvimento"));
test("ciência vai para científico",()=>assert.equal(identificarOperador("Desenvolva uma hipótese científica").operador,"cientifico"));
test("vídeo vai para mídia",()=>assert.equal(identificarOperador("Crie um vídeo educativo").operador,"midia"));
test("não afirma executar o que não está conectado",()=>assert.equal(respostaSemExecutor(identificarOperador("Crie um vídeo")).status,"aguardando_executor"));
