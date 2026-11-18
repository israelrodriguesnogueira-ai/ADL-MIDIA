// ION - executor local deterministico e sem chamadas externas.
// Acoes permitidas: criar um artefato de texto ou consultar capacidades.
// Nao aceita comandos arbitrarios, shell, pagamentos ou publicacao.
export function executarLocal(pedido) {
  if (!pedido || typeof pedido !== "object") return {status:"erro",erro:"Pedido invalido"};
  if (pedido.acao === "capacidades") return {
    status:"concluido",capacidades:["capacidades","criar_texto"],
    limites:["sem execucao de shell","sem publicacao","sem operacoes financeiras","sem custos externos"]
  };
  if (pedido.acao !== "criar_texto") return {status:"nao_suportado",erro:"Executor nao autorizado"};
  if (typeof pedido.titulo !== "string" || typeof pedido.conteudo !== "string" ||
      !pedido.titulo.trim() || pedido.titulo.length > 120 || pedido.conteudo.length > 12000)
    return {status:"erro",erro:"Titulo ou conteudo invalido"};
  return {status:"concluido",artefato:{
    nome:"ion-documento.txt",tipo:"text/plain; charset=utf-8",
    conteudo:pedido.titulo.trim()+"\n\n"+pedido.conteudo
  },execucao:"local",custoAdicional:0};
}
