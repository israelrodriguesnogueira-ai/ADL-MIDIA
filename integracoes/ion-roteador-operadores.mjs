// ION: roteamento determinístico de intenções. Não realiza operações financeiras.
export function identificarOperador(comando) {
  if (typeof comando !== "string" || !comando.trim()) return { operador: "entrada", erro: "Comando vazio" };
  const t = comando.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const regras = [
    ["financeiro", /carteira|investiment|ibovespa|acoes|bolsa|renda fixa|tesouro|dividend|risco financeiro/],
    ["desenvolvimento", /codigo|program|software|aplicativ|sistema|corrig|bug|deploy|github|motor|desenvolv/],
    ["cientifico", /pesquis|cientific|patente|experimento|prototip|simulac|hipotese|laboratorio/],
    ["midia", /video|shorts|film|narrac|legenda|renderiz|imagem|audio/],
    ["shopee", /shopee|loja|produto|anuncio|venda|pedido/],
  ];
  const encontrados = regras.filter(([, re]) => re.test(t)).map(([nome]) => nome);
  return { operador: encontrados[0] || "geral", candidatos: encontrados, comando };
}
export function respostaSemExecutor(roteamento) {
  const nome = roteamento.operador;
  if (nome === "financeiro") return { status: "aguardando_executor", operador: nome, mensagem: "Operador financeiro identificado. Ainda não há consulta de cotações ou execução de análise conectada. Posso preparar uma carteira simulada somente após definir horizonte, perfil de risco e capital de referência; não efetuarei ordens reais." };
  return { status: "aguardando_executor", operador: nome, mensagem: `Operador ${nome} identificado, mas o executor correspondente ainda não está conectado. Nenhum arquivo ou tarefa foi produzido.` };
}
