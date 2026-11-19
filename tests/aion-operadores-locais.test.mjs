import test from 'node:test';
import assert from 'node:assert/strict';
import {executarOperadorLocal} from '../integracoes/aion-operadores-locais.mjs';
for(const operador of ['midia','cientifico','shopee'])test('executor '+operador,()=>{const r=executarOperadorLocal({operador,comando:'Teste seguro'});assert.equal(r.status,'concluido_local');assert.equal(r.integracaoExterna,false);assert.equal(r.custoAdicional,0);assert.ok(JSON.parse(r.artefato.conteudo))});
test('financeiro requer dados',()=>assert.equal(executarOperadorLocal({operador:'financeiro',comando:'Simular'}).status,'aguardando_dados'));
test('financeiro calcula projeção hipotetica',()=>{const r=executarOperadorLocal({operador:'financeiro',comando:'Simular',dados:{capital:1000,taxaAnual:0.1,anos:2}});assert.equal(JSON.parse(r.artefato.conteudo).valorFinal,1210)});
test('financeiro rejeita valores invalidos',()=>assert.equal(executarOperadorLocal({operador:'financeiro',comando:'Simular',dados:{capital:-1,taxaAnual:0.1,anos:2}}).status,'aguardando_dados'));
test('rejeita comando vazio',()=>assert.equal(executarOperadorLocal({operador:'midia',comando:''}).status,'erro'));
test('operador desconhecido nao executa',()=>assert.equal(executarOperadorLocal({operador:'outro',comando:'Teste'}).status,'nao_suportado'));
