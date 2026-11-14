// Roteador determinístico e seguro da fase 3. Não executa ações nem simula geração.
export function classificarComando(texto) {
  if (typeof texto !== "string" || !texto.trim()) return { tipo: "invalido", executor: null };
  const t = texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const negado = /\b(nao|nunca|sem)\s+(?:quero\s+)?(?:criar|crie|gerar|gere|fazer|faca)\b/.test(t);
  const video = /\b(video|filme|clipe|mp4)\b/.test(t);
  const imagem = /\b(imagem|foto|ilustracao|figura)\b/.test(t);
  const criar = /\b(criar|crie|gerar|gere|fazer|faca|produzir|produza|desenhar|desenhe)\b/.test(t);
  if (negado) return { tipo: "conversa", executor: null };
  if (video && criar) return { tipo: "video", executor: "motor-video" };
  if (imagem && criar) return { tipo: "imagem", executor: "motor-imagem" };
  if (/\b(ibovespa|acoes|bolsa|investimento|carteira de investimentos)\b/.test(t))
    return { tipo: "financeiro", executor: "motor-financeiro" };
  return { tipo: "conversa", executor: "nucleo-inteligencia" };
}
export function planejarExecucao(texto, capacidades = {}) {
  const classificacao = classificarComando(texto);
  if (classificacao.tipo === "invalido") return { estado: "rejeitado", motivo: "Comando vazio.", ...classificacao };
  if (!capacidades[classificacao.executor]) return {
    estado: "indisponivel", motivo: "Executor não conectado ou não validado.", ...classificacao
  };
  return { estado: "pronto_para_autorizacao", ...classificacao };
}
