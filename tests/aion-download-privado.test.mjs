import test from 'node:test';import assert from 'node:assert/strict';import worker from '../integracoes/aion-download-privado-worker.mjs';
const id='123e4567-e89b-42d3-a456-426614174000',url='https://example.invalid/api/anexos/'+id,token='teste';
const request=(path=url,auth=true)=>new Request(path,{headers:auth?{authorization:'Bearer '+token}:{}});
test('download anonimo bloqueado',async()=>assert.equal((await worker.fetch(request(url,false),{})).status,401));
test('download sem bucket bloqueado',async()=>assert.equal((await worker.fetch(request(),{AION_UPLOAD_TOKEN:token})).status,503));
test('id malformado nao acessa R2',async()=>{let called=false;const r=await worker.fetch(request('https://example.invalid/api/anexos/../../segredo'),{AION_UPLOAD_TOKEN:token,AION_UPLOAD_BUCKET:{get:async()=>{called=true}}});assert.equal(r.status,400);assert.equal(called,false)});
test('arquivo ausente retorna 404',async()=>assert.equal((await worker.fetch(request(),{AION_UPLOAD_TOKEN:token,AION_UPLOAD_BUCKET:{get:async()=>null}})).status,404));
test('download autenticado retorna bytes e cabecalhos privados',async()=>{let key='';const r=await worker.fetch(request(),{AION_UPLOAD_TOKEN:token,AION_UPLOAD_BUCKET:{get:async(k)=>{key=k;return {body:new Uint8Array([1,2,3]),httpMetadata:{contentType:'video/mp4'}}}}});assert.equal(r.status,200);assert.equal(key,'privado/'+id);assert.equal(r.headers.get('content-type'),'video/mp4');assert.equal(r.headers.get('cache-control'),'private, no-store');assert.equal(r.headers.get('content-disposition'),'attachment');assert.deepEqual([...new Uint8Array(await r.arrayBuffer())],[1,2,3])});

test('token incorreto nao consulta armazenamento',async()=>{
 let called=false;
 const r=await worker.fetch(new Request(url,{headers:{authorization:'Bearer incorreto'}}),{AION_UPLOAD_TOKEN:token,AION_UPLOAD_BUCKET:{get:async()=>{called=true}}});
 assert.equal(r.status,401);assert.equal(called,false);
});
test('metodo nao permitido nao consulta armazenamento',async()=>{
 let called=false;
 const r=await worker.fetch(new Request(url,{method:'POST'}),{AION_UPLOAD_TOKEN:token,AION_UPLOAD_BUCKET:{get:async()=>{called=true}}});
 assert.equal(r.status,405);assert.equal(called,false);
});
test('identificador valido diferente nao acessa objeto de outro id',async()=>{
 const other='123e4567-e89b-42d3-a456-426614174001';
 let key='';
 const r=await worker.fetch(request('https://example.invalid/api/anexos/'+other),{AION_UPLOAD_TOKEN:token,AION_UPLOAD_BUCKET:{get:async(k)=>{key=k;return null}}});
 assert.equal(r.status,404);assert.equal(key,'privado/'+other);
});
test('download define protecoes contra execucao de conteudo',async()=>{
 const r=await worker.fetch(request(),{AION_UPLOAD_TOKEN:token,AION_UPLOAD_BUCKET:{get:async()=>({body:new Uint8Array([1]),httpMetadata:{contentType:'text/plain'}})}});
 assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 assert.match(r.headers.get('content-security-policy')||'',/sandbox/);
 assert.equal(r.headers.get('referrer-policy'),'no-referrer');
});
