import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
const base="https://preview.example";
test("raiz apresenta pagina informativa segura",async()=>{const r=await worker.fetch(new Request(base+"/"),{});const html=await r.text();assert.equal(r.status,200);assert.match(r.headers.get("content-type"),/text\/html/);assert.match(html,/Ambiente experimental/);assert.match(html,/não estão conectados/);assert.match(r.headers.get("content-security-policy"),/form-action 'none'/);assert.doesNotMatch(html,/<form/i);});
test("health continua publico",async()=>{const r=await worker.fetch(new Request(base+"/health"),{});assert.equal(r.status,200);assert.equal((await r.json()).status,"online");});
test("api continua protegida sem token",async()=>{const r=await worker.fetch(new Request(base+"/api/executar-local",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({acao:"capacidades"})}),{});assert.equal(r.status,401);});
test("rota desconhecida continua 404",async()=>{const r=await worker.fetch(new Request(base+"/desconhecida"),{});assert.equal(r.status,404);});
