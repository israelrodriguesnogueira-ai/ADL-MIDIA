// Operadores locais verificaveis, sem acesso a contas externas nem ordens financeiras.
// Cada resposta declara precisamente o que foi produzido.
const result=(operador,artefato,detalhe)=>({status:"concluido_local",operador,artefato,detalhe,custoAdicional:0,integracaoExterna:false});
const text=x=>typeof x==="string"?x.trim():"";
export function executarOperadorLocal({operador,comando,dados}={}){
 const cmd=text(comando);if(!cmd||cmd.length>3000)return {status:"erro",erro:"Comando invalido"};
 switch(operador){
 case "midia":{
  const roteiro={titulo:cmd,cenas:[{segundos:"0-5",descricao:"Abertura e apresentacao"},{segundos:"5-10",descricao:"Demonstracao visual"},{segundos:"10-15",descricao:"Encerramento e chamada"}],formato:"vertical 9:16",duracaoSegundos:15};
  return result("midia",{tipo:"application/json",nome:"roteiro-video.json",conteudo:JSON.stringify(roteiro,null,2)},"Roteiro produzido; video e audio ainda nao renderizados");
 }
 case "financeiro":{
  const capital=Number(dados?.capital);const taxa=Number(dados?.taxaAnual);const anos=Number(dados?.anos);
  if(!Number.isFinite(capital)||capital<=0||capital>1e9||!Number.isFinite(taxa)||taxa< -1||taxa>2||!Number.isInteger(anos)||anos<1||anos>40)return {status:"aguardando_dados",operador:"financeiro",campos:["capital","taxaAnual","anos"],detalhe:"Simulacao matematica, sem cotacoes reais"};
  const valor=Number((capital*Math.pow(1+taxa,anos)).toFixed(2));
  return result("financeiro",{tipo:"application/json",nome:"simulacao.json",conteudo:JSON.stringify({capital,taxaAnual:taxa,anos,valorFinal:valor,carater:"hipotetico"},null,2)},"Projecao matematica; nao e recomendacao nem operacao");
 }
 case "cientifico":{
  const doc={questao:cmd,hipotese:"A ser definida e testada",metodo:["Definir variaveis e controle","Registrar procedimento","Coletar dados","Analisar resultados"],limitacao:"Nenhuma pesquisa externa executada"};
  return result("cientifico",{tipo:"application/json",nome:"protocolo.json",conteudo:JSON.stringify(doc,null,2)},"Protocolo experimental estruturado");
 }
 case "shopee":{
  const doc={produto:cmd,checklist:["Conferir titulo e descricao","Verificar fotos e direitos de uso","Revisar preco e estoque","Validar video antes de publicar"],publicado:false,lojaConectada:false};
  return result("shopee",{tipo:"application/json",nome:"checklist-shopee.json",conteudo:JSON.stringify(doc,null,2)},"Checklist gerado; sem acesso a loja");
 }
 default:return {status:"nao_suportado",operador,detalhe:"Executor local nao disponivel"};
 }
}
