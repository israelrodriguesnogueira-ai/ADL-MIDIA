import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
const env={ION_API_ACCESS_TOKEN:"teste",AION_RENDER_DISPATCH_ENABLED:"1",AION_GITHUB_DISPATCH_TOKEN:"segredo"};
test("download rejeita artefato com tamanho fracionario antes de buscar ZIP",async()=>{
 const original=globalThis.fetch;let chamadas=0;
 globalThis.fetch=async(url)=>{
  chamadas++;
  const path=String(url);
  if(path.endsWith("/actions/runs/42"))return Response.json({
   repository:{full_name:"israelrodriguesnogueira-ai/ADL-MIDIA"},
   path:".github/workflows/aion-roteiro-render.yml",
   event:"workflow_dispatch",status:"completed",conclusion:"success"
  });
  if(path.includes("/actions/runs/42/artifacts?"))return Response.json({
   artifacts:[{id:55,name:"aion-roteiro-15s",expired:false,size_in_bytes:1.5}]
  });
  throw new Error("Download ZIP indevido: "+path);
 };
 try{
  const r=await worker.fetch(new Request("https://ion.example/api/video/baixar",{
   method:"POST",headers:{authorization:"Bearer teste","content-type":"application/json"},
   body:JSON.stringify({runId:42})
  }),env);
  assert.equal(r.status,404);
  assert.equal(chamadas,2);
 }finally{globalThis.fetch=original}
});
