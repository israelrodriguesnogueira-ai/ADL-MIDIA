// Testes locais sem rede, credenciais reais ou cobrança.
// Executar: node --test tests/ion-video-dispatch.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const source = await readFile(new URL('../integracoes/ion-video-dispatch-worker.mjs', import.meta.url), 'utf8');
const { default: worker } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));
const env = { ION_API_ACCESS_TOKEN: 'test-only-secret', ION_GITHUB_TOKEN: 'test-only-github' };
const request = (path, method='POST', token, body={acao:'criar_video_transito_15s',confirmado:true}) =>
 new Request('https://ion.example'+path,{method,headers:token?{'authorization':'Bearer '+token,'content-type':'application/json'}:{'content-type':'application/json'},body:method==='POST'?JSON.stringify(body):undefined});
test('nega acesso sem autenticação',async()=>{
 const response=await worker.fetch(request('/api/video/transito'),env);
 assert.equal(response.status,401);
});
test('não aceita ação diferente',async()=>{
 const response=await worker.fetch(request('/api/video/transito','POST',env.ION_API_ACCESS_TOKEN,{acao:'publicar',confirmado:true}),env);
 assert.equal(response.status,400);
});
test('exige confirmação explícita',async()=>{
 const response=await worker.fetch(request('/api/video/transito','POST',env.ION_API_ACCESS_TOKEN,{acao:'criar_video_transito_15s',confirmado:false}),env);
 assert.equal(response.status,400);
});
test('sem integração configurada não despacha',async()=>{
 const response=await worker.fetch(request('/api/video/transito','POST',env.ION_API_ACCESS_TOKEN),{ION_API_ACCESS_TOKEN:env.ION_API_ACCESS_TOKEN});
 assert.equal(response.status,503);
});
test('requisição autenticada despacha somente workflow autorizado',async()=>{
 const original=globalThis.fetch;
 let calls=0;
 globalThis.fetch=async (url,opts)=>{
  calls++;
  assert.equal(String(url),'https://api.github.com/repos/israelrodriguesnogueira-ai/ADL-MIDIA/actions/workflows/ion-video-gratuito.yml/dispatches');
  assert.equal(JSON.parse(opts.body).ref,'main');
  return new Response(null,{status:204});
 };
 try{
  const response=await worker.fetch(request('/api/video/transito','POST',env.ION_API_ACCESS_TOKEN),env);
  assert.equal(response.status,202);
  assert.equal(calls,1);
  assert.equal((await response.json()).status,'solicitado');
 }finally{globalThis.fetch=original;}
});
