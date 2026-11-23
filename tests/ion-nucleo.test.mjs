import test from 'node:test';
import assert from 'node:assert/strict';
import {interpretar,criarMotor} from '../integracoes/ion-nucleo.mjs';
test('identifica tradução e vídeo',()=>{
 assert.equal(interpretar('ION traduza o que estou ouvindo').categoria,'traducao');
 assert.equal(interpretar('Crie um vídeo de trânsito').categoria,'video');
});
test('não inventa execução quando falta ferramenta',async()=>{
 const r=await criarMotor().executar('Crie um vídeo',{confirmado:true});
 assert.equal(r.status,'indisponivel');
});
test('exige confirmação e autorização',async()=>{
 const motor=criarMotor({ferramentas:{video:async()=>({verificado:true})},autorizar:()=>false});
 assert.equal((await motor.executar('vídeo',{confirmado:true})).status,'aguardando_autorizacao');
});
test('não declara sucesso sem evidência',async()=>{
 const motor=criarMotor({ferramentas:{video:async()=>({dados:{url:'teste'}})},autorizar:()=>true});
 assert.equal((await motor.executar('vídeo',{confirmado:true})).status,'nao_verificado');
});
test('retorna sucesso apenas após verificação',async()=>{
 const motor=criarMotor({ferramentas:{video:async()=>({verificado:true,dados:{arquivo:'teste.mp4'}})},autorizar:()=>true});
 assert.equal((await motor.executar('vídeo',{confirmado:true})).status,'concluido');
});
