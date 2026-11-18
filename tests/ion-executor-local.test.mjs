import test from "node:test";
import assert from "node:assert/strict";
import { executarLocal } from "../integracoes/ion-executor-local.mjs";
test("consulta capacidades sem efeitos externos",()=>{
 const r=executarLocal({acao:"capacidades"});
 assert.equal(r.status,"concluido");
 assert.ok(r.capacidades.includes("criar_texto"));
});
test("cria artefato de texto",()=>{
 const r=executarLocal({acao:"criar_texto",titulo:"Teste",conteudo:"Conteudo"});
 assert.equal(r.status,"concluido");
 assert.equal(r.artefato.conteudo,"Teste\n\nConteudo");
 assert.equal(r.custoAdicional,0);
});
test("recusa comandos nao autorizados",()=>{
 for(const acao of ["shell","publicar","transferir","executar_codigo"]){
  assert.equal(executarLocal({acao}).status,"nao_suportado");
 }
});
test("valida entrada",()=>{
 assert.equal(executarLocal(null).status,"erro");
 assert.equal(executarLocal({acao:"criar_texto",titulo:"",conteudo:"x"}).status,"erro");
});
