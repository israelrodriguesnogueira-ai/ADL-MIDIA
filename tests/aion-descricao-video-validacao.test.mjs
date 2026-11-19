import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
const env={ION_API_ACCESS_TOKEN:"teste",AION_RENDER_DISPATCH_ENABLED:"1",AION_GITHUB_DISPATCH_TOKEN:"segredo"};
const call=produto=>worker.fetch(new Request("https://ion.example/api/video/iniciar",{
 method:"POST",headers:{authorization:"Bearer teste","content-type":"application/json"},body:JSON.stringify({produto})
}),env);
test("descricao comum contendo letras r e n e aceita",async()=>{
 const original=globalThis.fetch;
 globalThis.fetch=async()=>new Response(null,{status:204});
 try{assert.equal((await call("Vestido preto com renda")).status,202)}
 finally{globalThis.fetch=original}
});
test("quebra de linha e rejeitada antes de acionar workflow",async()=>{
 assert.equal((await call("Vestido\\npreto".replace("\\n","\n"))).status,400);
 assert.equal((await call("Vestido\\rpreto".replace("\\r","\r"))).status,400);
});
