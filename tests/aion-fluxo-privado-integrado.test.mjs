import test from 'node:test';
import assert from 'node:assert/strict';
import upload from '../integracoes/aion-upload-privado-worker.mjs';
import download from '../integracoes/aion-download-privado-worker.mjs';
const base='https://example.invalid/api/anexos',token='token-isolado';
function bucketEmMemoria(){const objects=new Map();return {put:async(key,bytes,metadata)=>objects.set(key,{bytes:new Uint8Array(bytes),metadata}),get:async(key)=>{const obj=objects.get(key);return obj?{body:obj.bytes,httpMetadata:obj.metadata.httpMetadata}:null}}}
test('fluxo real de bytes upload -> leitura privada, sem R2 ou rede externa',async()=>{
 const env={AION_UPLOAD_TOKEN:token,AION_UPLOAD_BUCKET:bucketEmMemoria()};
 const payload=new Uint8Array([0,1,2,3,4,255]);
 const saved=await upload.fetch(new Request(base,{method:'POST',headers:{authorization:'Bearer '+token,'content-type':'video/mp4'},body:payload}),env);
 assert.equal(saved.status,201);
 const info=await saved.json();
 assert.match(info.id,/^[0-9a-f-]{36}$/);
 assert.equal(info.tamanho,payload.length);
 const uri=base+'/'+info.id;
 assert.equal((await download.fetch(new Request(uri),env)).status,401);
 const result=await download.fetch(new Request(uri,{headers:{authorization:'Bearer '+token}}),env);
 assert.equal(result.status,200);
 assert.equal(result.headers.get('content-type'),'video/mp4');
 assert.equal(result.headers.get('content-disposition'),'attachment');
 assert.deepEqual(new Uint8Array(await result.arrayBuffer()),payload);
});
