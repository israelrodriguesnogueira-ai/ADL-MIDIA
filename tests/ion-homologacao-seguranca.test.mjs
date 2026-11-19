import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";

const env = {ION_API_ACCESS_TOKEN:"token-ficticio-de-teste"};
const post = (path, body, authorization) => worker.fetch(
  new Request("https://ion.example"+path, {
    method:"POST",
    headers:{"content-type":"application/json",...(authorization?{authorization}:{})},
    body:JSON.stringify(body)
  }),env
);

test("health identifica motor experimental sem IA habilitada", async () => {
  const r=await worker.fetch(new Request("https://ion.example/health"),env);
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.motor,"experimental");
  assert.equal(data.iaConfigurada,false);
});
test("rota de executor rejeita acesso sem token",async()=>{
  const r=await post("/api/executar-local",{acao:"estado_operadores"});
  assert.equal(r.status,401);
});
test("rota de comandos rejeita acesso sem token",async()=>{
  const r=await post("/api/comando",{comando:"mostre operadores"});
  assert.equal(r.status,401);
});
test("consulta autenticada declara operadores nao conectados",async()=>{
  const r=await post("/api/executar-local",{acao:"estado_operadores"},"Bearer token-ficticio-de-teste");
  assert.equal(r.status,200);
  const data=await r.json();
  assert.equal(data.escopo,"executor_local_experimental");
  assert.equal(data.custoAdicional,0);
  assert.equal(data.operadores.length,5);
  assert.equal(data.operadores.filter(o=>o.estado==="nao_conectado").length,3);
  const midia=data.operadores.find(o=>o.nome==="midia");
  assert.equal(midia.estado,"parcial");
  assert.deepEqual(midia.capacidades,["criar_roteiro_video"]);
  for(const nome of ["financeiro","cientifico","shopee"])
    assert.equal(data.operadores.find(o=>o.nome===nome).estado,"nao_conectado");
});
test("executor nao permite shell mesmo com token valido",async()=>{
  const r=await post("/api/executar-local",{acao:"shell",comando:"ls"},"Bearer token-ficticio-de-teste");
  assert.equal(r.status,422);
});
