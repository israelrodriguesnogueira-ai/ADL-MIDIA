import test from "node:test";
import assert from "node:assert/strict";
import { executarLocal } from "../integracoes/ion-executor-local.mjs";
import worker from "../integracoes/ion-motor-worker.mjs";
// Cem ciclos independentes, cada qual executando um pedido e verificando o resultado.
// Não são cem implantações nem testes de motores externos.
for (let i=1;i<=100;i++){
 const grupo=Math.floor((i-1)/20), n=(i-1)%20;
 test(`ciclo ${String(i).padStart(3,"0")} - grupo ${grupo+1} caso ${n+1}`,async()=>{
  if(grupo===0){
   const r=executarLocal({acao:"criar_texto",titulo:`Documento ${i}`,conteudo:`Conteudo ${n} - ${"x".repeat(n)}`});
   assert.equal(r.status,"concluido");assert.equal(r.custoAdicional,0);
   assert.match(r.artefato.conteudo,new RegExp(`Documento ${i}`));
  }else if(grupo===1){
   const r=executarLocal({acao:"criar_markdown",titulo:`Relatorio #${i}`,conteudo:`Secao ${n}`});
   assert.equal(r.status,"concluido");assert.equal(r.artefato.nome,"ion-documento.md");
   assert.match(r.artefato.conteudo,/^# Relatorio/);assert.equal(r.custoAdicional,0);
  }else if(grupo===2){
   const r=executarLocal({acao:"diagnosticar_falha",componente:`modulo_${n}`,codigoErro:`E_${i}`,fase:["teste","integracao","implantacao"][n%3]});
   assert.equal(r.status,"concluido");assert.equal(r.diagnostico.implantado,false);
   assert.equal(r.diagnostico.codigoErro,`E_${i}`);assert.equal(r.custoAdicional,0);
  }else if(grupo===3){
   const r=executarLocal({acao:"criar_texto",titulo:"",conteudo:`invalido ${n}`});
   assert.equal(r.status,"erro");assert.equal(executarLocal({acao:`shell_${n}`}).status,"nao_suportado");
  }else{
   const url=`https://preview.example/api/executar-local?caso=${n}`;
   const r=await worker.fetch(new Request(url,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({acao:"criar_texto",titulo:`T${i}`,conteudo:"teste"})}),{});
   assert.equal(r.status,401);assert.equal((await r.json()).erro,"Não autorizado");
  }
 });
}
