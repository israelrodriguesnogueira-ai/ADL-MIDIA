import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../experimentos/aion-laboratorio-operadores-multimidia.html',import.meta.url),'utf8');
const checks=[
 ['interface de comando',/id="comando"/],
 ['roteamento financeiro',/\['financeiro'/],
 ['roteamento científico',/\['científico'/],
 ['roteamento Shopee',/\['Shopee'/],
 ['roteamento mídia',/\['mídia'/],
 ['síntese de voz',/SpeechSynthesisUtterance/],
 ['reprodução de áudio',/<audio id="audio" controls>/],
 ['microfone com permissão',/getUserMedia\(\{audio:true\}\)/],
 ['gravação de áudio',/new MediaRecorder\(stream\)/],
 ['geração de vídeo',/canvas\.captureStream\(12\)/],
 ['download de vídeo WebM',/a\.download='aion-teste\.webm'/],
 ['seleção de anexos',/type="file" multiple/],
 ['limite de anexos',/files\.length>5/],
 ['limite de tamanho',/15\*1024\*1024/],
 ['pré-visualização local',/URL\.createObjectURL\(file\)/],
 ['limpeza de URLs temporárias',/URL\.revokeObjectURL/],
 ['sem envio a servidor',/Nenhum upload foi realizado/],
 ['sem credenciais embutidas',/Nenhuma conta externa ou executor remoto está conectado/]
];
for(const [name,pattern] of checks)test(name,()=>assert.match(html,pattern));
test('não possui chamadas de envio remoto',()=>{assert.doesNotMatch(html,/\bfetch\s*\(|XMLHttpRequest|sendBeacon\s*\(/);});
test('não contém script remoto',()=>assert.doesNotMatch(html,/<script[^>]+src=/i));
