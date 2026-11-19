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

test('upload valido grava bytes exatos e identificador privado',async()=>{
 let key='',bytes,metadata;
 const bucket={put:async(k,data,options)=>{key=k;bytes=data;metadata=options}};
 const response=await worker.fetch(req('abc'),{AION_UPLOAD_TOKEN:token,AION_UPLOAD_BUCKET:bucket});
 assert.equal(response.status,201);
 const result=await response.json();
 assert.equal(result.tamanho,3);
 assert.match(result.id,/^[0-9a-f-]{36}$/);
 assert.equal(key,'privado/'+result.id);
 assert.deepEqual([...bytes],[97,98,99]);
 assert.equal(metadata.httpMetadata.contentType,'text/plain');
 assert.equal(response.headers.get('cache-control'),'no-store');
});
test('arquivo vazio nao grava',async()=>{
 const response=await worker.fetch(req(''),env);
 assert.equal(response.status,400);
});
test('conteudo maior que limite e rejeitado mesmo sem content-length',async()=>{
 const data=new Uint8Array(15*1024*1024+1);
 const response=await worker.fetch(req(data),env);
 assert.equal(response.status,413);
});
