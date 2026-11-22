// Simulador deterministico: nao consulta mercado, nao movimenta dinheiro.
export function simularPlanoFinanceiro({capitalInicial=50,meta=15000,operacoes=300,retornoPorOperacao=null}={}) {
  if (![capitalInicial,meta,operacoes].every(Number.isFinite) || capitalInicial<=0 || meta<=0 ||
      !Number.isInteger(operacoes) || operacoes<1 || operacoes>10000 ||
      (retornoPorOperacao!==null && (!Number.isFinite(retornoPorOperacao)||retornoPorOperacao<=-1)))
    return {status:"erro",erro:"Parametros invalidos"};
  const taxaNecessaria=Math.expm1(Math.log(meta/capitalInicial)/operacoes);
  const taxa=retornoPorOperacao===null?taxaNecessaria:retornoPorOperacao;
  const registros=[];let saldo=capitalInicial;
  for(let i=1;i<=operacoes;i++){
    const anterior=saldo;saldo=anterior*(1+taxa);
    if(!Number.isFinite(saldo))return {status:"erro",erro:"Resultado numerico invalido"};
    registros.push({operacao:i,saldoInicial:Number(anterior.toFixed(8)),resultado:Number((saldo-anterior).toFixed(8)),saldoFinal:Number(saldo.toFixed(8))});
  }
  return {status:"concluido",tipo:"simulacao_matematica",operador:"financeiro",
    capitalInicial,meta,operacoes,taxaNecessaria,taxaAplicada:taxa,
    saldoFinal:Number(saldo.toFixed(8)),metaAtingida:saldo>=meta*(1-1e-10),
    registros,custoAdicional:0,ordensReaisExecutadas:false,
    aviso:"Cenario hipotetico de retorno fixo, sem perdas, taxas, spreads ou impostos. Nao e previsao nem recomendacao de investimento."};
}
