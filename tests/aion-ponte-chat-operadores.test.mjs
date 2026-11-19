import test from 'node:test';
import assert from 'node:assert/strict';
import {executarComandoChat} from '../integracoes/aion-ponte-chat-operadores.mjs';
for(const [comando,operador] of [['Criar video educativo','midia'],['Simular carteira de investimento','financeiro'],['Planejar experimento cientifico','cientifico'],['Revisar anuncio da Shopee','shopee']]){
 test('chat direciona '+operador,()=>{const r=executarComandoChat(comando);assert.equal(r.operador,operador);assert.equal(r.origem,'chat');assert.equal(r.executadoExternamente,false);assert.equal(r.publicado,false)});
}
test('chat rejeita comando vazio',()=>assert.equal(executarComandoChat('').status,'erro'));
test('chat retorna nao suportado para comando desconhecido',()=>assert.equal(executarComandoChat('ola').status,'nao_suportado'));
