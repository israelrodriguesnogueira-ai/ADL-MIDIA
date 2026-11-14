// Núcleo ION independente: roteamento de intenções e execução verificável.
// Sem dependência de API paga, sem acesso a contas externas, sem execução financeira.
// Este módulo não substitui um modelo de linguagem; ferramentas são registradas explicitamente.
export const intents = Object.freeze({
 video: /v[ií]deo|short|film|mp4/i,
 traducao: /traduz|tradu[cç][aã]o|legenda|idioma/i,
 financeiro: /ibovespa|investimento|bolsa|financeir/i,
 codigo: /c[oó]digo|program|desenvolv|github/i
});
export function interpretar(comando){
 if(typeof comando!=='string'||!comando.trim()||comando.length>3000)throw new Error('Comando inválido');
 const texto=comando.trim();
 const categoria=Object.entries(intents).find(([,re])=>re.test(texto))?.[0]||'geral';
 return {texto,categoria};
}
export function criarMotor({ferramentas={},autorizar=()=>false}={}){
 return {
  interpretar,
  async executar(comando,{confirmado=false,contexto={}}={}){
   let tarefa;try{tarefa=interpretar(comando)}catch{return {status:'erro',detalhe:'Comando inválido'};}
   const ferramenta=ferramentas[tarefa.categoria];
   if(!ferramenta)return {status:'indisponivel',categoria:tarefa.categoria,detalhe:'Ferramenta ainda não conectada; nenhuma tarefa executada'};
   if(!confirmado||!autorizar(tarefa,contexto))return {status:'aguardando_autorizacao',categoria:tarefa.categoria};
   try{
    const resultado=await ferramenta(tarefa,contexto);
    if(!resultado||resultado.verificado!==true)return {status:'nao_verificado',categoria:tarefa.categoria,detalhe:'A ferramenta não comprovou o resultado'};
    return {status:'concluido',categoria:tarefa.categoria,resultado:resultado.dados??null};
   }catch{return {status:'erro',categoria:tarefa.categoria,detalhe:'Falha da ferramenta; consultar logs protegidos'};}
  }
 };
}
