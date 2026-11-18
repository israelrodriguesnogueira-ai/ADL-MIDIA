import test from "node:test";
import assert from "node:assert/strict";
import worker from "../integracoes/ion-motor-worker.mjs";
import { executarLocal } from "../integracoes/ion-executor-local.mjs";
import { identificarOperador } from "../integracoes/ion-roteador-operadores.mjs";
const env={ION_API_ACCESS_TOKEN:"token-ficticio"};
const send=(path,body,token="Bearer token-ficticio")=>worker.fetch(new Request("https://ion.invalid"+path,{method:"POST",headers:{"authorization":token,"content-type":"application/json"},body:JSON.stringify(body)}),env);
const cases=[
{"name":"bloquear acao shell","kind":"deny","value":"shell"},
{"name":"bloquear acao publicar","kind":"deny","value":"publicar"},
{"name":"bloquear acao transferir","kind":"deny","value":"transferir"},
{"name":"bloquear acao investir","kind":"deny","value":"investir"},
{"name":"bloquear acao comprar","kind":"deny","value":"comprar"},
{"name":"bloquear acao deletar","kind":"deny","value":"deletar"},
{"name":"bloquear acao deploy","kind":"deny","value":"deploy"},
{"name":"bloquear acao executar_codigo","kind":"deny","value":"executar_codigo"},
{"name":"bloquear acao enviar_email","kind":"deny","value":"enviar_email"},
{"name":"bloquear acao modificar_producao","kind":"deny","value":"modificar_producao"},
{"name":"rotear video","kind":"route","value":"video","expected":"midia"},
{"name":"rotear narração","kind":"route","value":"narração","expected":"midia"},
{"name":"rotear legenda","kind":"route","value":"legenda","expected":"midia"},
{"name":"rotear Ibovespa","kind":"route","value":"Ibovespa","expected":"financeiro"},
{"name":"rotear carteira de investimentos","kind":"route","value":"carteira de investimentos","expected":"financeiro"},
{"name":"rotear dividendos","kind":"route","value":"dividendos","expected":"financeiro"},
{"name":"rotear pesquisa científica","kind":"route","value":"pesquisa científica","expected":"cientifico"},
{"name":"rotear protótipo","kind":"route","value":"protótipo","expected":"cientifico"},
{"name":"rotear experimento","kind":"route","value":"experimento","expected":"cientifico"},
{"name":"rotear código","kind":"route","value":"código","expected":"desenvolvimento"},
{"name":"rotear corrigir bug","kind":"route","value":"corrigir bug","expected":"desenvolvimento"},
{"name":"rotear GitHub","kind":"route","value":"GitHub","expected":"desenvolvimento"},
{"name":"rotear Shopee","kind":"route","value":"Shopee","expected":"shopee"},
{"name":"rotear anúncio","kind":"route","value":"anúncio","expected":"shopee"},
{"name":"rotear vendas da loja","kind":"route","value":"vendas da loja","expected":"shopee"},
{"name":"rejeitar pedido invalido 1","kind":"bad","value":null},
{"name":"rejeitar pedido invalido 2","kind":"bad","value":[]},
{"name":"rejeitar pedido invalido 3","kind":"bad","value":42},
{"name":"rejeitar pedido invalido 4","kind":"bad","value":"x"},
{"name":"rejeitar pedido invalido 5","kind":"bad","value":{}},
{"name":"rejeitar pedido invalido 6","kind":"bad","value":{"acao":"criar_texto","titulo":"","conteudo":"x"}},
{"name":"rejeitar pedido invalido 7","kind":"bad","value":{"acao":"criar_texto","titulo":"x","conteudo":4}},
{"name":"rejeitar pedido invalido 8","kind":"bad","value":{"acao":"criar_markdown","titulo":"","conteudo":"x"}},
{"name":"rejeitar pedido invalido 9","kind":"bad","value":{"acao":"diagnosticar_falha","componente":"x","codigoErro":"x","fase":"producao"}},
{"name":"rejeitar pedido invalido 10","kind":"bad","value":{"acao":"diagnosticar_falha","componente":"../etc","codigoErro":"x","fase":"teste"}},
{"name":"aceitar capacidade local 1","kind":"valid","value":{"acao":"capacidades"}},
{"name":"aceitar capacidade local 2","kind":"valid","value":{"acao":"estado_operadores"}},
{"name":"aceitar capacidade local 3","kind":"valid","value":{"acao":"criar_texto","titulo":"Titulo","conteudo":"Texto"}},
{"name":"aceitar capacidade local 4","kind":"valid","value":{"acao":"criar_markdown","titulo":"Titulo","conteudo":"Texto"}},
{"name":"aceitar capacidade local 5","kind":"valid","value":{"acao":"diagnosticar_falha","componente":"worker","codigoErro":"E_1","fase":"teste"}}];
for(const item of cases){
 test(item.name,async()=>{
  if(item.kind==="route"){assert.equal(identificarOperador(item.value).operador,item.expected);return;}
  if(item.kind==="bad"){assert.ok(["erro","nao_suportado"].includes(executarLocal(item.value).status));return;}
  if(item.kind==="valid"){assert.equal(executarLocal(item.value).status,"concluido");return;}
  const r=await send("/api/executar-local",{acao:item.value});
  assert.equal(r.status,422);
 });
}
