import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import vm from 'node:vm';
const html=readFileSync(new URL('./ion-android-web.html',import.meta.url),'utf8');
const script=html.match(/<script>\s*([\s\S]*?)<\/script>/)?.[1];
assert.ok(script,'Script principal presente');
new vm.Script(script,{filename:'ion-android-web.html'});
for(const term of ['accounts.id.initialize','accounts.id.renderButton','SpeechRecognition','/api/executar',"'Authorization':'Bearer '+token",'speechSynthesis','response.status===401||response.status===403']){
 assert.ok(html.includes(term),'Contrato ausente: '+term);
}
assert.ok(!/localStorage|sessionStorage|document\.cookie/.test(script),'Não persistir credenciais no dispositivo');
assert.ok(html.includes('__ION_GOOGLE_CLIENT_ID__'),'Client ID deve ser injetado no servidor');
console.log('Interface Android: sintaxe e contratos básicos aprovados (não equivale a teste no celular).');
