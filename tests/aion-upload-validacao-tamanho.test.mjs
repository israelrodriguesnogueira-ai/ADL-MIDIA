import test from 'node:test';
import assert from 'node:assert/strict';
import worker from '../integracoes/aion-upload-privado-worker.mjs';

const url='https://example.invalid/api/anexos';
const token='token-de-teste';
const req=(body,headers={})=>new Request(url,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'text/plain',...headers},body});
const env={AION_UPLOAD_TOKEN:token,AION_UPLOAD_BUCKET:{put:async()=>{throw Error('nao deve armazenar')}}};

test('token ausente ou incorreto nao acessa armazenamento',async()=>{
 assert.equal((await worker.fetch(new Request(url,{method:'POST',body:'x'}),env)).status,401);
 assert.equal((await worker.fetch(req('x',{authorization:'Bearer errado'}),env)).status,401);
});
test('sem bucket nao provisiona armazenamento',async()=>{
 assert.equal((await worker.fetch(req('x'),{AION_UPLOAD_TOKEN:token})).status,503);
});
test('content-length declarado invalido e rejeitado',async()=>{
 for(const size of ['-1','1.5','999999999999999999999999']){
  assert.equal((await worker.fetch(req('abc',{'content-length':size}),env)).status,400);
 }
});
test('content-length divergente nao grava',async()=>{
 assert.equal((await worker.fetch(req('abc',{'content-length':'2'}),env)).status,400);
});
test('tipo nao permitido nao grava',async()=>{
 assert.equal((await worker.fetch(req('abc',{'content-type':'text/html'}),env)).status,415);
});
