// Ferramenta de pesquisa externa do AION. Sem credenciais ou servicos pagos.
// Nao envia historico, identidade ou dados privados: apenas a consulta autorizada.
const MAX_QUERY = 180;
const TIMEOUT_MS = 8000;

export async function pesquisarInternet(consulta, fetchImpl = fetch) {
  if (typeof consulta !== "string" || !consulta.trim() || consulta.length > MAX_QUERY) {
    return { ok: false, erro: "Consulta vazia ou longa demais." };
  }
  const termo = consulta.trim();
  const url = new URL("https://pt.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({
    action: "query", generator: "search", gsrsearch: termo, gsrlimit: "5",
    prop: "info|extracts", inprop: "url", exintro: "1", explaintext: "1",
    exsentences: "2", format: "json", origin: "*"
  }).toString();
  try {
    const resposta = await fetchImpl(url.toString(), {
      method: "GET", headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!resposta.ok) throw new Error("HTTP " + resposta.status);
    const dados = await resposta.json();
    const paginas = Object.values(dados?.query?.pages ?? {});
    const fontes = paginas.filter(p => p.title && p.fullurl)
      .map(p => ({ titulo: p.title, url: p.fullurl, resumo: (p.extract || "").slice(0, 700) }));
    return { ok: true, consulta: termo, consultadoEm: new Date().toISOString(),
      provedor: "Wikipedia (pesquisa enciclopedica, nao noticias em tempo real)", fontes };
  } catch (erro) {
    return { ok: false, erro: "Fonte externa indisponivel", detalhe: String(erro?.message || erro) };
  }
}

// Taxas indicativas diarias publicadas pela API gratuita Frankfurter.
// Nao sao cotacoes em tempo real nem taxas de compra/venda.
export async function consultarCambio(base = "USD", destino = "BRL", fetchImpl = fetch) {
  if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(destino)) {
    return { ok: false, erro: "Moeda invalida" };
  }
  const url = "https://api.frankfurter.dev/v1/latest?base=" + base + "&symbols=" + destino;
  try {
    const resposta = await fetchImpl(url, {
      method: "GET", headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(TIMEOUT_MS)
    });
    if (!resposta.ok) throw new Error("HTTP " + resposta.status);
    const dados = await resposta.json();
    const taxa = dados?.rates?.[destino];
    if (!Number.isFinite(taxa)) throw new Error("Taxa ausente");
    return { ok: true, base, destino, taxa, dataReferencia: dados.date,
      consultadoEm: new Date().toISOString(), fonte: url,
      aviso: "Taxa de referencia diaria; nao e cotacao em tempo real." };
  } catch (erro) {
    return { ok: false, erro: "Cotacao externa indisponivel", detalhe: String(erro?.message || erro) };
  }
}
