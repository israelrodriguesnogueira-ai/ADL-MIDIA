import test from "node:test";
import assert from "node:assert/strict";
import { executarLocal } from "../integracoes/ion-executor-local.mjs";
test("diagnostico tecnico separado do conteudo do proprietario",()=>{
 const r=executarLocal({acao:"diagnosticar_falha",componente:"motor-video",codigoErro:"RENDER_FAILED",fase:"teste",conversa:"SEGREDO",conteudo:"PRIVADO"});
 assert.equal(r.status,"concluido");
 assert.equal(r.diagnostico.implantado,false);
 assert.equal(r.diagnostico.estado,"pendente_de_correcao");
 assert.ok(!r.artefato.conteudo.includes("SEGREDO"));
 assert.ok(!r.artefato.conteudo.includes("PRIVADO"));
 assert.equal(r.custoAdicional,0);
});
test("diagnostico exige metadados tecnicos validos",()=>{
 assert.equal(executarLocal({acao:"diagnosticar_falha",componente:"x",codigoErro:"y",fase:"outra"}).status,"erro");
 assert.equal(executarLocal({acao:"diagnosticar_falha",componente:"x\nprivate",codigoErro:"y",fase:"teste"}).status,"erro");
 assert.equal(executarLocal([]).status,"erro");
});
