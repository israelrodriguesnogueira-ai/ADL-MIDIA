import test from 'node:test';
import assert from 'node:assert/strict';
import {executarLocal} from '../integracoes/ion-executor-local.mjs';
import worker from '../integracoes/ion-motor-worker.mjs';
for(let i=1;i<=100;i++){
 const n=(i-1)%20,group=Math.floor((i-1)/20);
 test('ciclo '+String(i).padStart(3,'0')+' - '+['nucleo','autenticacao','operadores','video-audio','estabilidade'][group],async()=>{
 if(group===0){const r=executarLocal({acao:n%2?'criar_markdown':'criar_texto',titulo:'Ciclo '+i,conteudo:'teste '+n});assert.equal(r.status,'concluido');assert.equal(r.custoAdicional,0);assert.match(r.artefato.conteudo,/Ciclo/);}
 else if(group===1){const r=await worker.fetch(new Request('https://preview.invalid/'+(n%2?'api/comando':'api/executar-local'),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({acao:'capacidades'})}),{});assert.equal(r.status,401);assert.equal((await r.json()).erro,'Não autorizado');}
 else if(group===2){const r=executarLocal({acao:'estado_operadores'});assert.equal(r.status,'concluido');assert.equal(r.escopo,'executor_local_experimental');assert.equal(r.operadores.length,5);assert.equal(r.operadores[1+n%4].estado,'nao_conectado');}
 else if(group===3){const r=executarLocal({acao:'capacidades'});assert.equal(r.status,'concluido');assert.ok(r.limites.includes('sem publicacao'));assert.ok(!r.capacidades.includes('gerar_video'));assert.ok(!r.capacidades.includes('gerar_audio'));}
 else{const r=executarLocal({acao:'diagnosticar_falha',componente:'modulo_'+n,codigoErro:'E_'+i,fase:['teste','integracao','implantacao'][n%3]});assert.equal(r.status,'concluido');assert.equal(r.diagnostico.implantado,false);assert.equal(r.custoAdicional,0);}
 });
}
