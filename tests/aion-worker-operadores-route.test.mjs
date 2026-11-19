import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../integracoes/ion-motor-worker.mjs';
const base='https://aion.example.invalid/api/operadores-local';
const env={ION_API_ACCESS_TOKEN:'token-de-teste',AI_ENABLED:'0'};
const post=(body,token)=>worker.fetch(new Request(base,{method:'POST',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}),env);
test('rota de operadores rejeita anonimos',async()=>assert.equal((await post({comando:'Criar video'})).status,401));
test('rota de operadores executa midia local autenticada',async()=>{const r=await post({comando:'Criar video educativo'},'token-de-teste');assert.equal(r.status,200);const d=await r.json();assert.equal(d.operador,'midia');assert.equal(d.executadoExternamente,false)});
test('rota de operadores executa simulacao financeira sem cotacoes',async()=>{const r=await post({comando:'Simular carteira de investimento',dados:{capital:1000,taxaAnual:0.1,anos:2}},'token-de-teste');assert.equal(r.status,200);const d=await r.json();assert.equal(d.operador,'financeiro');assert.equal(d.status,'concluido_local')});
