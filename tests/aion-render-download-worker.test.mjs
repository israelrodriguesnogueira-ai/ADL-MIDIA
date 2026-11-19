import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
const env={ION_API_ACCESS_TOKEN:"teste",AION_RENDER_DISPATCH_ENABLED:"1",AION_GITHUB_DISPATCH_TOKEN:"segredo"};
const send=(runId,token="teste")=>worker.fetch(new Request("https://ion.example/api/video/baixar",{
 method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},
 body:JSON.stringify({runId})
}),env);
test("download exige autenticacao",async()=>assert.equal((await send(123,"invalido")).status,401));
test("download rejeita identificador invalido",async()=>assert.equal((await send("123")).status,400));
test("download protege token e entrega ZIP do MP4",async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async(url,options)=>{
  calls++;
  if(String(url).includes("/actions/runs/123/artifacts"))
   return Response.json({artifacts:[{id:55,name:"aion-roteiro-15s",expired:false,size_in_bytes:5000}]});
  if(String(url).endsWith("/actions/artifacts/55/zip")){
   assert.equal(options.redirect,"manual");
   assert.equal(options.headers.authorization,"Bearer segredo");
   return new Response(null,{status:302,headers:{location:"https://storage.blob.core.windows.net/file?sig=teste"}});
  }
  if(String(url).startsWith("https://storage.blob.core.windows.net/")){
   assert.equal(options.headers,undefined);
   return new Response(new Uint8Array([80,75,3,4]),{status:200,headers:{"content-length":"4"}});
  }
  return Response.json({repository:{full_name:"israelrodriguesnogueira-ai/ADL-MIDIA"},path:".github/workflows/aion-roteiro-render.yml",event:"workflow_dispatch",status:"completed",conclusion:"success"});
 };
 try{
  const r=await send(123);
  assert.equal(r.status,200);
  assert.equal(r.headers.get("content-type"),"application/zip");
  assert.equal((await r.arrayBuffer()).byteLength,4);
  assert.equal(calls,4);
 }finally{globalThis.fetch=original}
});
test("download recusa artefato de workflow nao autorizado",async()=>{
 const original=globalThis.fetch;let calls=0;
 globalThis.fetch=async()=>{calls++;return Response.json({repository:{full_name:"outro/repo"},path:".github/workflows/aion-roteiro-render.yml",event:"workflow_dispatch",status:"completed",conclusion:"success"})};
 try{assert.equal((await send(123)).status,404);assert.equal(calls,1)}
 finally{globalThis.fetch=original}
});

test("download interrompe fluxo maior que 25 MB mesmo sem Content-Length",async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async(url)=>{
  if(String(url).includes("/actions/runs/123/artifacts"))
   return Response.json({artifacts:[{id:55,name:"aion-roteiro-15s",expired:false,size_in_bytes:1000}]});
  if(String(url).endsWith("/actions/artifacts/55/zip"))
   return new Response(null,{status:302,headers:{location:"https://storage.blob.core.windows.net/file?sig=teste"}});
  if(String(url).startsWith("https://storage.blob.core.windows.net/"))
   return new Response(new ReadableStream({
    start(controller){controller.enqueue(new Uint8Array(16000000));controller.enqueue(new Uint8Array(10000000));controller.close()}
   }),{status:200});
  return Response.json({repository:{full_name:"israelrodriguesnogueira-ai/ADL-MIDIA"},path:".github/workflows/aion-roteiro-render.yml",event:"workflow_dispatch",status:"completed",conclusion:"success"});
 };
 try{
  const r=await send(123);
  assert.equal(r.status,200);
  await assert.rejects(()=>r.arrayBuffer(),/25 MB/);
 }finally{globalThis.fetch=original}
});
