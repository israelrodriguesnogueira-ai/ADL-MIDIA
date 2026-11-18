import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
const env={ION_API_ACCESS_TOKEN:"token-de-teste"};
const enviar=(path,body,token="token-de-teste")=>worker.fetch(new Request("https://ion.example"+path,{method:"POST",headers:{authorization:"Bearer "+token,"content-type":"application/json"},body:JSON.stringify(body)}),env);
test("download autenticado de texto entrega anexo",async()=>{
 const r=await enviar("/api/comando?download=1",{comando:"Crie um documento chamado Teste com texto: Entregue"});
 assert.equal(r.status,200);
 assert.match(r.headers.get("content-disposition"),/attachment; filename="ion-documento.txt"/);
 assert.equal(await r.text(),"Teste\n\nEntregue");
});
test("download autenticado de Markdown entrega anexo",async()=>{
 const r=await enviar("/api/executar-local?download=1",{acao:"criar_markdown",titulo:"Relatorio",conteudo:"Aprovado"});
 assert.equal(r.status,200);
 assert.equal(r.headers.get("content-type"),"text/markdown; charset=utf-8");
 assert.equal(await r.text(),"# Relatorio\n\nAprovado");
});
test("download bloqueado sem token valido",async()=>{
 const r=await enviar("/api/comando?download=1",{comando:"Crie um documento chamado Teste com texto: Entregue"},"invalido");
 assert.equal(r.status,401);
});
test("acao nao permitida nao gera download",async()=>{
 const r=await enviar("/api/executar-local?download=1",{acao:"shell",comando:"ls"});
 assert.equal(r.status,422);
 assert.equal(r.headers.get("content-disposition"),null);
});
