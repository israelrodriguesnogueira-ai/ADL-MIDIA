import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import worker from '../integracoes/ion-motor-worker.mjs';
import upload from '../integracoes/aion-upload-privado-worker.mjs';
import download from '../integracoes/aion-download-privado-worker.mjs';
const endpoint='https://preview.example.invalid';
test('rota publica do motor nao apresenta comandos ou credenciais',async()=>{const r=await worker.fetch(new Request(endpoint+'/'),{});assert.equal(r.status,200);const html=await r.text();assert.doesNotMatch(html,/ION_API_ACCESS_TOKEN|AION_UPLOAD_TOKEN|type="file"|id="comando"/)});
test('motor nega comandos sem credencial',async()=>{for(const path of ['/api/comando','/api/executar-local','/api/operadores-local']){const r=await worker.fetch(new Request(endpoint+path,{method:'POST',body:'{}'}),{});assert.equal(r.status,401)}});
test('anexos privados negam leitura e escrita anonima',async()=>{assert.equal((await upload.fetch(new Request(endpoint+'/api/anexos',{method:'POST',body:'x'}),{})).status,401);assert.equal((await download.fetch(new Request(endpoint+'/api/anexos/123e4567-e89b-42d3-a456-426614174000'),{})).status,401)});
test('configuracao de deploy nao aponta para modulo de upload isolado',()=>{const config=JSON.parse(readFileSync(new URL('../wrangler.jsonc',import.meta.url),'utf8'));assert.equal(config.main,'integracoes/ion-motor-worker.mjs');assert.notEqual(config.name,'ion-validacao')});
