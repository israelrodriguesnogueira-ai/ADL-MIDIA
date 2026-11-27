const URL_PTAX = "https://olinda.bcb.gov.br/olinda/servico/PTAX/versao/v1/odata/CotacaoDolarPeriodo(dataInicial=@dataInicial,dataFinalCotacao=@dataFinalCotacao)";
const URL_FRANKFURTER = "https://api.frankfurter.dev/v1/latest?base=USD&symbols=BRL";
const fuso = "America/Sao_Paulo";
const dataConsulta = new Intl.DateTimeFormat("en-US", {
  timeZone: fuso, month: "2-digit", day: "2-digit", year: "numeric",
});
const horaConsulta = new Intl.DateTimeFormat("pt-BR", {
  timeZone: fuso, dateStyle: "short", timeStyle: "medium",
});
const formatarTaxa = new Intl.NumberFormat("pt-BR", {
  style: "currency", currency: "BRL", minimumFractionDigits: 4, maximumFractionDigits: 4,
});

export function pedidoDeCotacaoDolar(pedido) {
  const texto = pedido.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  if (/\b(?:euro|eur|iene|jpy|libra|gbp|cad|aud|peso|historico|historica|previsao|projecao|simulacao|carteira|investir|converter|futuro|turismo|paralelo|ontem|anteontem|semana passada|mes passado)\b/.test(texto)
    || /\b\d{1,2}\/\d{1,2}\b|\b20\d{2}-\d{2}-\d{2}\b/.test(texto)) return false;
  return /\b(?:dolar(?:es)?|usd)\b/.test(texto)
    && /\b(?:cotacao|cambio|taxa|valor|quanto (?:vale|esta|custa)|ptax)\b|\busd\s*\/\s*brl\b/.test(texto);
}

async function obterJsonCotacao(url, fonte, fetchImpl) {
  try {
    const resposta = await fetchImpl(String(url), {
      headers: { Accept: "application/json" },
      redirect: "error",
      signal: AbortSignal.timeout(5000),
    });
    if (resposta.ok) return await resposta.json();
    console.warn(JSON.stringify({ event: "aion.cotacao_fonte_http", fonte, status: resposta.status }));
  } catch (erro) {
    console.warn(JSON.stringify({ event: "aion.cotacao_fonte_falhou", fonte, tipo: erro?.name }));
  }
  return null;
}

export async function consultarCotacaoDolar(fetchImpl = fetch, agora = new Date()) {
  const consulta = () => "Consulta feita em " + horaConsulta.format(new Date()) + " (Brasília).";
  const diasAtras = new Date(agora.getTime() - 7 * 86400000);
  const url = new URL(URL_PTAX);
  url.search = new URLSearchParams({
    "@dataInicial": "'" + dataConsulta.format(diasAtras).replaceAll("/", "-") + "'",
    "@dataFinalCotacao": "'" + dataConsulta.format(agora).replaceAll("/", "-") + "'",
    "$format": "json",
  }).toString();
  try {
    const dados = await obterJsonCotacao(url, "ptax", fetchImpl);
    const ultimo = (Array.isArray(dados?.value) ? dados.value : []).filter(item =>
      /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(item?.dataHoraCotacao)
      && Number.isFinite(item.cotacaoVenda) && item.cotacaoVenda > 0
    ).sort((a, b) => b.dataHoraCotacao.localeCompare(a.dataHoraCotacao))[0];
    if (ultimo) {
      const [dia, hora] = ultimo.dataHoraCotacao.split(" ");
      return "USD/BRL · Última PTAX de fechamento (venda): " + formatarTaxa.format(ultimo.cotacaoVenda)
        + " por US$ 1.\nBoletim de " + dia.split("-").reverse().join("/") + " às " + hora.slice(0, 8)
        + " (Brasília). " + consulta()
        + "\nFonte: Banco Central do Brasil — " + url.href
        + "\nTaxa oficial de referência diária, sem cotação intradiária em tempo real.";
    }
  } catch {
    // O provedor de referência diário mantém a consulta disponível quando a PTAX falha.
  }
  try {
    const dados = await obterJsonCotacao(URL_FRANKFURTER, "frankfurter", fetchImpl);
    const taxa = dados?.rates?.BRL;
    if (dados?.base === "USD" && Number.isFinite(taxa) && taxa > 0 && /^\d{4}-\d{2}-\d{2}$/.test(dados.date)) {
      return "USD/BRL · Última taxa de referência diária: " + formatarTaxa.format(taxa)
        + " por US$ 1.\nData de referência: " + dados.date.split("-").reverse().join("/")
        + ". " + consulta() + "\nFonte: Frankfurter — " + URL_FRANKFURTER
        + "\nA fonte não publica o horário da taxa nem fornece cotação em tempo real.";
    }
  } catch {
    // O chat informa a indisponibilidade sem estimar um valor.
  }
  return null;
}
