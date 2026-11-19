import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../experimentos/aion-chat-operadores-preview.html',import.meta.url),'utf8');
for(const [name,pattern] of [['ponte de operadores',/import \{executarComandoChat\}/],['acionamento do chat',/executarComandoChat\(cmd\)/],['resposta exibida',/JSON\.stringify\(r,null,2\)/],['sintese de voz',/SpeechSynthesisUtterance/],['reproducao de video',/media\.controls=true/],['selecao de arquivos',/type="file"/],['limite de cinco anexos',/files\.length>5/],['limite de 15 MB',/15\*1024\*1024/],['liberacao de memoria',/revokeObjectURL/]])test(name,()=>assert.match(html,pattern));
test('interface nao faz upload remoto',()=>assert.doesNotMatch(html,/\bfetch\s*\(|XMLHttpRequest/));

test('campo de texto com tamanho adaptavel ao celular',()=>{assert.match(html,/max-height:45dvh/);assert.match(html,/font-size:16px/);assert.match(html,/resize:vertical/)});
test('botoes com area minima para toque',()=>assert.match(html,/min-height:44px/));
test('limpa URLs de anexos substituidos',()=>assert.match(html,/urls\.splice\(0\)\.forEach\(URL\.revokeObjectURL\)/));
