import { caminhosSincronismo, scriptSincronismo } from "./catalogo-sincronismo.mjs";
import { protectOwnerRoute } from "../integracoes/ion-controle-dono.mjs";

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/api/conversa") return responderConversa(request, env);
    if (path === "/api/foto") return analisarFoto(request, env);
    const bento = path === "/api/video/bento";
    if (bento || path === "/api/video/transito") {
      const workflow = bento ? "ion-animacao-bento.yml" : "ion-video-gratuito.yml";
      if (request.method !== "POST") return new Response("Método indisponível.", { status: 405, headers: { Allow: "POST" } });
      const ownerEmail = env.ION_OWNER_EMAIL?.trim().toLowerCase();
      const audience = env.ION_GOOGLE_CLIENT_ID?.trim();
      if (!ownerEmail?.endsWith("@gmail.com") || !/^[a-z0-9-]+\.apps\.googleusercontent\.com$/.test(audience ?? "")) {
        return Response.json({ erro: "Autenticação não configurada." }, { status: 503 });
      }
      const ownerRoute = protectOwnerRoute({
        owner: { issuer: GOOGLE_ISSUER, subject: ownerEmail },
        verifySession: () => verifyGoogleIdentity(request, audience),
        audit: ({ actor, ...event }) => console.warn(JSON.stringify(event)),
        action: "solicitar_video_transito",
        resource: "ion",
      }, async () => {
        const token = env.ION_GITHUB_ACTIONS_TOKEN;
        if (!token) return Response.json({ erro: "Integração de vídeo não configurada." }, { status: 503 });
        let result;
        try {
          result = await fetch("https://api.github.com/repos/israelrodriguesnogueira-ai/ADL-MIDIA/actions/workflows/" + workflow + "/dispatches", {
            method: "POST",
            headers: {
              Authorization: "Bearer " + token,
              Accept: "application/vnd.github+json",
              "X-GitHub-Api-Version": "2022-11-28",
              "User-Agent": "ION-Owner-Worker",
            },
            body: JSON.stringify({ ref: "main" }),
            signal: AbortSignal.timeout(10000),
          });
        } catch {
          return Response.json({ erro: "Não foi possível acionar o gerador." }, { status: 502 });
        }
        if (result.status !== 204) {
          console.warn(JSON.stringify({ event: "ion.video_dispatch_failed", status: result.status }));
          return Response.json({ erro: "O GitHub não aceitou a solicitação.", codigo: result.status }, { status: 502 });
        }
        return Response.json({
          status: "solicitado",
          detalhe: "Workflow acionado. O MP4 ainda precisa ser gerado e validado.",
          acompanhamento: "https://github.com/israelrodriguesnogueira-ai/ADL-MIDIA/actions/workflows/" + workflow,
        }, { status: 202 });
      });
      return ownerRoute(request);
    }
    if (path !== "/" && path !== "/verificar-acesso" && path !== "/painel") {
      return new Response("Rota indisponível.", { status: 404 });
    }
    if (request.method !== "GET") {
      return new Response("Método indisponível.", { status: 405, headers: { Allow: "GET" } });
    }

    if (path === "/verificar-acesso") {
      console.info(JSON.stringify({ event: "ion.access_check_started" }));
    }

    const ownerEmail = env.ION_OWNER_EMAIL?.trim().toLowerCase();
    const audience = env.ION_GOOGLE_CLIENT_ID?.trim();
    if (!ownerEmail?.endsWith("@gmail.com") || !/^[a-z0-9-]+\.apps\.googleusercontent\.com$/.test(audience ?? "")) {
      console.warn(JSON.stringify({ event: "ion.auth_configuration_invalid", ownerEmailConfigured: Boolean(ownerEmail?.endsWith("@gmail.com")), googleClientIdConfigured: /^[a-z0-9-]+\.apps\.googleusercontent\.com$/.test(audience ?? "") }));
      return new Response("Validação ainda indisponível.", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }

    if (path === "/") return loginPage(audience);

    const verifyOwner = protectOwnerRoute({
      owner: { issuer: GOOGLE_ISSUER, subject: ownerEmail },
      verifySession: () => verifyGoogleIdentity(request, audience),
      audit: ({ actor, ...event }) => console.warn(JSON.stringify(event)),
      action: path === "/painel" ? "abrir_painel" : "verificar_acesso",
      resource: "ion",
    }, () => path === "/painel"
      ? Response.json({ areas: [
          { nome: "Central 6D", descricao: "Produção de vídeos", url: "https://adl-midia.israelrodriguesnogueira.workers.dev/" },
          { nome: "Shopee Gestão", descricao: "Conexão com a loja pendente" },
          { nome: "Código-fonte do Ion", descricao: "Cópia ZIP da versão usada pelo Ion.", rotulo: "Baixar código do Ion", url: "https://codeload.github.com/israelrodriguesnogueira-ai/ADL-MIDIA/zip/refs/heads/ion/controle-dono" },
          { nome: "ADL Auto", descricao: "Integração pendente" },
        ] })
      : Response.json({ acesso: "proprietario", modo: "validacao" }));

    return verifyOwner(request);
  },
};

async function analisarFoto(request, env) {
  const json = (body, status = 200) => Response.json(body, {
    status, headers: { "Cache-Control": "no-store" },
  });
  if (request.method !== "POST") return json({ erro: "Método inválido." }, 405);
  const email = env.ION_OWNER_EMAIL?.trim().toLowerCase();
  const audience = env.ION_GOOGLE_CLIENT_ID?.trim();
  if (!email || !audience) return json({ erro: "Acesso indisponível." }, 503);
  return protectOwnerRoute({
    owner: { issuer: GOOGLE_ISSUER, subject: email },
    verifySession: () => verifyGoogleIdentity(request, audience),
    audit: ({ actor, ...event }) => console.warn(JSON.stringify(event)),
    action: "analisar_foto",
    resource: "ion",
  }, async () => {
    if (!env.ION_AI || env.ION_VISION_FREE_ENABLED !== "true") {
      return json({ erro: "A análise de fotos aguarda ativação no Cloudflare." }, 503);
    }
    const pergunta = request.headers.get("X-ION-Pergunta");
    if (!pergunta || pergunta.length > 6000) return json({ erro: "Pergunta inválida." }, 400);
    const tamanho = Number(request.headers.get("Content-Length"));
    if (tamanho > 2_000_000) return json({ erro: "Foto grande demais." }, 413);
    const image = new Uint8Array(await request.arrayBuffer());
    if (image.length < 3 || image.length > 2_000_000 || image[0] !== 255 || image[1] !== 216 || image[2] !== 255) {
      return json({ erro: "Não consegui receber a foto em JPEG." }, 400);
    }
    try {
      const modelo = "@cf/meta/llama-3.2-11b-vision-instruct";
      let binario = "";
      for (let inicio = 0; inicio < image.length; inicio += 8192) {
        binario += String.fromCharCode(...image.subarray(inicio, inicio + 8192));
      }
      const dados = {
        messages: [{ role: "user", content: [
          { type: "text", text: "Responda em português brasileiro. Identifique o que é visível na imagem e diga quando houver dúvida. Pergunta: " + decodeURIComponent(pergunta) },
          { type: "image_url", image_url: { url: "data:image/jpeg;base64," + btoa(binario) } },
        ] }],
        max_tokens: 350,
      };
      const extrairTexto = resposta => resposta?.response ?? resposta?.choices?.[0]?.message?.content;
      const erroDeLicenca = erro => /(?:\bagree\b|license|licence|acceptable use|terms of use)/i.test(String(erro?.message));
      const executar = async entrada => {
        try {
          return await env.ION_AI.run(modelo, entrada);
        } catch (erro) {
          if (!erroDeLicenca(erro)) throw erro;
          await env.ION_AI.run(modelo, { prompt: "agree" });
          return env.ION_AI.run(modelo, entrada);
        }
      };
      let texto;
      try {
        texto = extrairTexto(await executar(dados));
      } catch (erro) {
        if (!/(?:schema|validation|invalid input|required property|must have|required field)/i.test(String(erro?.message))) throw erro;
        texto = extrairTexto(await executar({
          prompt: dados.messages[0].content[0].text,
          image: Array.from(image),
          max_tokens: dados.max_tokens,
        }));
      }
      if (typeof texto !== "string" || !texto.trim()) throw new Error("empty_response");
      return json({ texto });
    } catch (erro) {
      console.warn(JSON.stringify({ event: "ion.vision_failed", code: Number.isInteger(erro?.code) ? erro.code : undefined }));
      if (/(?:quota|daily limit|neurons|rate limit)/i.test(String(erro?.message))) {
        return json({ erro: "O Cloudflare limitou o uso do modelo. O ION continua no plano gratuito." }, 429);
      }
      return json({ erro: "O Cloudflare não concluiu a análise da foto." }, 502);
    }
  })(request);
}

function partituraValida(p) {
  return p && typeof p.titulo === "string" && p.titulo.trim() && p.titulo.length <= 100
    && typeof p.letra === "string" && p.letra.length <= 1000
    && Number.isInteger(p.bpm) && p.bpm >= 55 && p.bpm <= 170
    && Array.isArray(p.notas) && p.notas.length >= 4 && p.notas.length <= 32
    && p.notas.every(n => Array.isArray(n) && n.length === 2
      && Number.isInteger(n[0]) && (n[0] === 0 || (n[0] >= 45 && n[0] <= 86))
      && [0.25, 0.5, 1, 1.5, 2].includes(n[1]));
}

function gerarMelodia(p) {
  const taxa = 24000;
  const segundosPorTempo = 60 / p.bpm;
  const total = Math.ceil(p.notas.reduce((soma, nota) => soma + nota[1], 0) * segundosPorTempo * taxa);
  const amostras = new Float32Array(total);
  let inicio = 0;
  for (const [nota, tempos] of p.notas) {
    const tamanho = Math.min(total - inicio, Math.round(tempos * segundosPorTempo * taxa));
    if (nota) {
      const fase = 2 * Math.PI * 440 * 2 ** ((nota - 69) / 12) / taxa;
      for (let i = 0; i < tamanho; i++) {
        const envelope = Math.min(1, i / 160, (tamanho - i) / 650) * Math.exp(-2 * i / tamanho);
        amostras[inicio + i] = envelope * (0.37 * Math.sin(i * fase) + 0.10 * Math.sin(i * fase * 2));
      }
    }
    inicio += tamanho;
  }
  return { amostras, taxa };
}

function codificarWav(amostras, taxa) {
  const dados = new DataView(new ArrayBuffer(44 + amostras.length * 2));
  function escrever(offset, texto) {
    for (let i = 0; i < texto.length; i++) dados.setUint8(offset + i, texto.charCodeAt(i));
  }
  escrever(0, "RIFF");
  dados.setUint32(4, dados.byteLength - 8, true);
  escrever(8, "WAVE");
  escrever(12, "fmt ");
  dados.setUint32(16, 16, true);
  dados.setUint16(20, 1, true);
  dados.setUint16(22, 1, true);
  dados.setUint32(24, taxa, true);
  dados.setUint32(28, taxa * 2, true);
  dados.setUint16(32, 2, true);
  dados.setUint16(34, 16, true);
  escrever(36, "data");
  dados.setUint32(40, amostras.length * 2, true);
  for (let i = 0; i < amostras.length; i++) {
    dados.setInt16(44 + i * 2, Math.round(Math.max(-1, Math.min(1, amostras[i])) * 32767), true);
  }
  return new Blob([dados.buffer], { type: "audio/wav" });
}

async function tratarGravacao(file) {
  const Contexto = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!Contexto) throw new Error("O navegador não consegue tratar áudio.");
  const taxa = 24000;
  const decodificador = new Contexto(1, 1, taxa);
  const original = await decodificador.decodeAudioData(await file.arrayBuffer());
  if (original.duration > 120) throw new Error("Use uma gravação de até dois minutos.");
  const contexto = new Contexto(1, original.length, taxa);
  const fonte = contexto.createBufferSource();
  fonte.buffer = original;
  const graves = contexto.createBiquadFilter();
  graves.type = "highpass";
  graves.frequency.value = 75;
  graves.Q.value = 0.7;
  const presenca = contexto.createBiquadFilter();
  presenca.type = "peaking";
  presenca.frequency.value = 2750;
  presenca.Q.value = 0.85;
  presenca.gain.value = 1.5;
  const compressor = contexto.createDynamicsCompressor();
  compressor.threshold.value = -20;
  compressor.ratio.value = 1.65;
  compressor.attack.value = 0.018;
  compressor.release.value = 0.14;
  fonte.connect(graves).connect(presenca).connect(compressor).connect(contexto.destination);
  fonte.start();
  const amostras = (await contexto.startRendering()).getChannelData(0);
  let pico = 0;
  let soma = 0;
  for (const amostra of amostras) {
    pico = Math.max(pico, Math.abs(amostra));
    soma += amostra * amostra;
  }
  const ganho = Math.min(4, 0.8 / pico, 0.125 / Math.sqrt(soma / amostras.length));
  for (let i = 0; i < amostras.length; i++) amostras[i] *= ganho;
  return codificarWav(amostras, taxa);
}

async function responderConversa(request, env) {
  if (request.method !== "POST") return new Response(null, { status: 405, headers: { Allow: "POST" } });
  const ownerEmail = env.ION_OWNER_EMAIL?.trim().toLowerCase();
  const audience = env.ION_GOOGLE_CLIENT_ID?.trim();
  if (!ownerEmail?.endsWith("@gmail.com") || !/^[a-z0-9-]+\.apps\.googleusercontent\.com$/.test(audience ?? "")) {
    return Response.json({ erro: "Autenticação não configurada." }, { status: 503 });
  }
  return protectOwnerRoute({
    owner: { issuer: GOOGLE_ISSUER, subject: ownerEmail },
    verifySession: () => verifyGoogleIdentity(request, audience),
    audit: ({ actor, ...event }) => console.warn(JSON.stringify(event)),
    action: "conversar_com_ion",
    resource: "ion",
  }, async () => {
    const body = await request.text();
    if (body.length > 24000) return Response.json({ erro: "Mensagem muito longa." }, { status: 413 });
    let mensagens, ultimaPartitura;
    try { ({ mensagens, ultimaPartitura } = JSON.parse(body)); } catch {
      return Response.json({ erro: "Solicitação inválida." }, { status: 400 });
    }
    if (!Array.isArray(mensagens) || !mensagens.length || mensagens.length > 9
        || mensagens.some(m => !m || !["user", "assistant"].includes(m.role)
          || typeof m.content !== "string" || !m.content.trim() || m.content.length > 2000)
        || mensagens.at(-1).role !== "user") {
      return Response.json({ erro: "Histórico de conversa inválido." }, { status: 400 });
    }
    if (ultimaPartitura != null && !partituraValida(ultimaPartitura)) {
      return Response.json({ erro: "A versão musical anterior é inválida." }, { status: 400 });
    }
    const previsao = await consultarPrevisao(mensagens);
    if (previsao) return Response.json({ texto: previsao }, { headers: { "Cache-Control": "no-store" } });
    if (!env.ION_AI || env.ION_VISION_FREE_ENABLED !== "true") {
      return Response.json({ erro: "Modelo de conversa aguardando ativação no plano gratuito." }, { status: 503 });
    }
    const pedido = mensagens.at(-1).content;
    const trabalhoMusical = ultimaPartitura || /\b(?:cantiga|can[çc][ãa]o|m[úu]sica|melodia|jingle)\b/i.test(pedido);
    const instrucaoMusical = trabalhoMusical
      ? " Quando o pedido for criar ou revisar uma cantiga, gere uma amostra instrumental real usando o motor da interface. "
        + "Responda somente com JSON: {\"acao\":\"melodia\",\"titulo\":\"…\",\"letra\":\"…\",\"bpm\":100,\"notas\":[[60,1],[62,1],[64,1],[60,1]]}. "
        + "Cada par é [nota MIDI 45 a 86 ou 0 para pausa, duração em tempos 0.25, 0.5, 1, 1.5 ou 2]. Use 8 a 24 notas, bpm entre 55 e 170 e letra original curta. "
        + "Em revisões, preserve o que o usuário não pediu para mudar. A amostra é instrumental e a letra aparece como texto. "
        + "Se pedirem voz cantada ou criticarem a voz e uma gravação própria permitir avançar, responda somente com {\"acao\":\"pedir_gravacao\"}. "
        + "Em perguntas sobre outro assunto ou em aprovações sem pedido de alteração, responda normalmente."
        + (ultimaPartitura ? " A última versão é " + JSON.stringify(ultimaPartitura) + "." : "")
      : "";
    try {
      const resposta = await env.ION_AI.run("@cf/meta/llama-3.1-8b-instruct-fast", {
        messages: [{
          role: "system",
          content: "Você é o ION. Responda em português brasileiro e use o contexto da conversa. " + instrucaoMusical + " "
            + "Você pode explicar, analisar texto, elaborar roteiros e produzir código. Quando pedirem um programa ou arquivo de código, entregue o conteúdo completo em um bloco de código identificado pela linguagem, pronto para baixar no menu da resposta. "
            + "A interface do ION pode ler respostas em voz alta. Quando perguntarem como ouvir uma resposta, indique o botão de alto-falante abaixo dela ou o comando \"Leia a última resposta\". Nunca afirme que a reprodução começou sem confirmação da interface. "
            + "Para manutenção automotiva, diferencie correia dentada, que sincroniza virabrequim e comando de válvulas, da correia de acessórios, que pode acionar o alternador. "
            + "Para marcas de sincronismo, torques e procedimentos específicos, só dê instruções fundamentadas em documentação técnica aplicável. Se ela não estiver disponível na conversa, peça modelo, ano, código do motor e o manual ou a página relevante. "
            + "Só confirme ações após receber o resultado do sistema. Um bloco de código produzido no chat pode ser baixado como texto, mas não foi executado. Se pedirem para instalar dependências ou executar testes de um projeto, informe que ainda não há executor conectado. Nunca invente logs, artefatos, links de download ou resultados de testes.",
        }, ...mensagens.map(({ role, content }) => ({ role, content }))],
        max_tokens: 768,
      });
      const texto = resposta?.response;
      if (typeof texto !== "string" || !texto.trim() || texto.length > 12000) throw new Error();
      let producao = null;
      if (trabalhoMusical) {
        try {
          producao = JSON.parse(texto.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
        } catch {}
      }
      const headers = { "Cache-Control": "no-store" };
      if (producao?.acao === "pedir_gravacao") {
        return Response.json({ pedirGravacao: true }, { headers });
      }
      if (producao?.acao === "melodia") {
        if (!partituraValida(producao)) {
          return Response.json({ erro: "A prévia musical saiu incompleta. Você pode pedir para eu tentar de novo." }, { status: 502, headers });
        }
        const { titulo, letra, bpm, notas } = producao;
        return Response.json({ partitura: { titulo, letra, bpm, notas } }, { headers });
      }
      return Response.json({ texto }, { headers });
    } catch {
      return Response.json({ erro: "O núcleo de conversa está temporariamente indisponível." }, { status: 502 });
    }
  })(request);
}

async function consultarPrevisao(mensagens) {
  const pedido = mensagens.at(-1).content.trim();
  const perguntaCidade = "Qual cidade e estado você quer consultar para a previsão do tempo?";
  const anteriores = mensagens.slice(0, -1);
  const continuacao = anteriores.at(-1)?.role === "assistant" && anteriores.at(-1)?.content === perguntaCidade;
  const clima = /previs[aã]o (?:do tempo|para hoje|para amanh[ãa])|vai chover|como est[aá] o tempo/i;
  if (!continuacao && !clima.test(pedido)) return null;
  const limpar = texto => texto.replace(/\b(?:para\s+)?(?:hoje|amanh[ãa])\b/gi, "").replace(/[?.!]\s*$/, "").trim();
  const localDeclarado = texto => texto.match(/\b(?:estou|moro|fico)\s+em\s+(.+)$/i)?.[1];
  const anterior = [...anteriores].reverse().find(m => m.role === "user" && clima.test(m.content))?.content || "";
  const cidadeInformada = [...anteriores].reverse()
    .filter(m => m.role === "user")
    .map(m => localDeclarado(m.content) || (clima.test(m.content) ? m.content.match(/\bem\s+(.+)$/i)?.[1] : null))
    .find(t => t && limpar(t));
  const local = limpar(continuacao && !clima.test(pedido)
    ? localDeclarado(pedido) || pedido
    : pedido.match(/\bem\s+(.+)$/i)?.[1] || cidadeInformada || "");
  const amanha = /\bamanh[ãa]/i.test(continuacao ? anterior : pedido);
  if (!local || local.length > 120) return perguntaCidade;
  try {
    const [cidade, estado] = local.split(/[,/]/).map(t => t.trim());
    const busca = new URL("https://geocoding-api.open-meteo.com/v1/search");
    busca.search = new URLSearchParams({ name: cidade, count: "10", language: "pt", countryCode: "BR" });
    const obter = async url => {
      const resposta = await fetch(url, { signal: AbortSignal.timeout(6000) });
      if (!resposta.ok) throw new Error();
      return resposta.json();
    };
    const { results = [] } = await obter(busca);
    const candidatos = results.filter(r => r.country_code === "BR");
    const normalizar = t => t?.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const estados = ["AC:Acre","AL:Alagoas","AP:Amapá","AM:Amazonas","BA:Bahia","CE:Ceará","DF:Distrito Federal","ES:Espírito Santo","GO:Goiás","MA:Maranhão","MT:Mato Grosso","MS:Mato Grosso do Sul","MG:Minas Gerais","PA:Pará","PB:Paraíba","PR:Paraná","PE:Pernambuco","PI:Piauí","RJ:Rio de Janeiro","RN:Rio Grande do Norte","RS:Rio Grande do Sul","RO:Rondônia","RR:Roraima","SC:Santa Catarina","SP:São Paulo","SE:Sergipe","TO:Tocantins"];
    const uf = estados.find(t => t.startsWith(estado?.toUpperCase() + ":"))?.slice(3) || estado;
    const exatos = candidatos.filter(r => normalizar(r.name) === normalizar(cidade)
      && (!uf || normalizar(r.admin1) === normalizar(uf)));
    if (!exatos.length) return perguntaCidade;
    if (new Set(exatos.map(r => r.admin1)).size > 1) return perguntaCidade;
    const lugar = exatos[0];
    const url = new URL("https://api.open-meteo.com/v1/forecast");
    url.search = new URLSearchParams({
      latitude: lugar.latitude, longitude: lugar.longitude, timezone: "auto", forecast_days: "2",
      daily: "temperature_2m_min,temperature_2m_max,precipitation_probability_max",
    });
    const { daily } = await obter(url);
    const i = amanha ? 1 : 0;
    const min = daily?.temperature_2m_min?.[i], max = daily?.temperature_2m_max?.[i];
    const chuva = daily?.precipitation_probability_max?.[i];
    if (![min, max, chuva].every(Number.isFinite) || !daily.time?.[i]) throw new Error();
    const data = daily.time[i].split("-").reverse().join("/");
    return "Previsão para " + lugar.name + ", " + lugar.admin1 + " (" + data + "). Mínima de "
      + Math.round(min) + " °C, máxima de " + Math.round(max) + " °C e chance máxima de chuva de "
      + chuva + "% durante o dia.\nFonte: Open-Meteo — https://open-meteo.com/";
  } catch {
    return "A fonte de previsão está indisponível agora. Tente novamente em instantes.";
  }
}

const GOOGLE_ISSUER = "https://accounts.google.com";
const GOOGLE_KEYS_URL = "https://www.googleapis.com/oauth2/v3/certs";
const decoder = new TextDecoder();
const encoder = new TextEncoder();

function decodeBase64Url(value) {
  return Uint8Array.from(atob(value.replaceAll("-", "+").replaceAll("_", "/")),
    character => character.charCodeAt(0));
}

async function fetchGoogleKeys() {
  const fetchKeys = () => fetch(GOOGLE_KEYS_URL, {
    // Workers supports manual redirects. The caller rejects non-2xx responses.
    redirect: "manual",
    signal: AbortSignal.timeout(2500),
  });
  try {
    return await fetchKeys();
  } catch {
    // Retry the same trusted endpoint once if the connection fails.
    return fetchKeys();
  }
}

async function verifyGoogleIdentity(request, audience) {
  const authorization = request.headers.get("Authorization") ?? "";
  if (authorization.length > 8192) return null;
  const parts = /^Bearer ([\w-]+)\.([\w-]+)\.([\w-]+)$/i.exec(authorization);
  if (!parts) return null;
  const [, encodedHeader, encodedClaims, encodedSignature] = parts;

  let header, claims, signature;
  try {
    header = JSON.parse(decoder.decode(decodeBase64Url(encodedHeader)));
    claims = JSON.parse(decoder.decode(decodeBase64Url(encodedClaims)));
    signature = decodeBase64Url(encodedSignature);
  } catch {
    return null;
  }

  if (header?.alg !== "RS256" || typeof header.kid !== "string"
      || claims?.aud !== audience || (claims.azp != null && claims.azp !== audience)
      || ![GOOGLE_ISSUER, "accounts.google.com"].includes(claims.iss)
      || !Number.isFinite(claims.exp) || claims.exp <= Date.now() / 1000
      || claims.email_verified !== true || typeof claims.email !== "string") {
    return null;
  }

  let response;
  try {
    response = await fetchGoogleKeys();
  } catch (error) {
    console.warn(JSON.stringify({
      event: "ion.google_keys_unavailable",
      reason: "network_failure",
      errorType: error?.name === "TimeoutError" ? "timeout" : error?.name === "TypeError" ? "fetch_type_error" : "other",
    }));
    throw new Error("Chaves do Google indisponíveis.");
  }
  if (!response.ok) {
    console.warn(JSON.stringify({ event: "ion.google_keys_unavailable", reason: "http_failure", status: response.status }));
    throw new Error("Chaves do Google indisponíveis.");
  }
  let failureStage = "key_response";
  let valid;
  try {
    const { keys } = await response.json();
    if (!Array.isArray(keys)) throw new Error("Resposta de chaves inválida.");
    const jwk = keys.find(key => key?.kid === header.kid && key.kty === "RSA");
    if (!jwk) return null;

    failureStage = "key_import";
    const key = await crypto.subtle.importKey("jwk", jwk,
      { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
    failureStage = "signature_verification";
    valid = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", key, signature,
      encoder.encode(`${encodedHeader}.${encodedClaims}`));
  } catch (error) {
    console.warn(JSON.stringify({ event: "ion.google_verification_error", stage: failureStage }));
    throw error;
  }

  return valid ? { issuer: GOOGLE_ISSUER, subject: claims.email.toLowerCase() } : null;
}

function loginPage(clientId) {
  return new Response(`<!doctype html>
<html lang="pt-BR">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="theme-color" content="#101827">
<title>Ion</title>
<style>
  :root { color-scheme: dark; font-family: system-ui, sans-serif; background: #101827; color: #f3f6fc; }
  body { margin: 0; }
  main { max-width: 48rem; margin: auto; padding: 3rem 1.25rem; }
  h1 { margin-top: 0; }
  p { color: #bfcbe0; line-height: 1.5; }
  ul { list-style: none; padding: 0; display: grid; gap: .75rem; }
  li { border: 1px solid #3b4b66; border-radius: .75rem; padding: 1rem; background: #19253a; }
  li h2 { font-size: 1.1rem; margin: 0; }
  li p { margin: .4rem 0 0; }
  a, button { display: inline-flex; align-items: center; min-height: 44px; }
  a { color: #a8d1ff; }
  button { font: inherit; padding: 0 1rem; }
  #comando-ion { display: grid; gap: .5rem; margin: 1.25rem 0; }
  #pedido-ion { font: inherit; padding: .75rem; border: 1px solid #64748b; border-radius: .5rem; }
  #acoes-ion { display: flex; flex-wrap: wrap; align-items: center; gap: .5rem; }
  #acoes-ion button { border: 0; border-radius: 999px; }
  #enviar-ion { color: #101827; background: #a8d1ff; }
  #transito-ion { color: #e3edff; background: #243a55; }
  #acoes-ion button:disabled { opacity: .55; }
  #areas { margin-top: .75rem; }
  #conversa-ion { max-height: 55vh; overflow: auto; margin-bottom: .5rem; }
  #conversa-ion li p { white-space: pre-wrap; overflow-wrap: anywhere; }
  #conversa-ion .msg-user { margin-left: 12%; background: #243a55; }
  #conversa-ion video { display: block; width: 100%; max-height: 22rem; margin-top: .75rem; }
  #pedido-ion { box-sizing: border-box; width: 100%; resize: vertical; }
  #painel:not([hidden]) { display: flex; flex-direction: column; min-height: 88dvh; }
  main:has(#painel:not([hidden])) { padding: .75rem 1rem 0; }
  .ion-top, .ion-compose { display: flex; align-items: center; gap: .5rem; }
  .ion-top h1 { flex: 1; margin: 0; font-size: 1.25rem; }
  .ion-top button, .ion-compose button, #ion-menu button, #anexos-ion button { border-radius: 999px; border: 1px solid #3b4b66; background: #19253a; color: #f3f6fc; }
  .ion-compose textarea { flex: 1; min-width: 0; background: transparent; }
  #enviar-ion { padding: 0 .7rem; }
  #conversa-ion { flex: 1; max-height: 62dvh; }
  #comando-ion { position: sticky; bottom: 0; background: #101827; padding: .6rem 0 max(.6rem, env(safe-area-inset-bottom)); margin: 0; }
  #ajuda-ion, #anexo-status { margin: 0; font-size: .85rem; }
  #ion-menu { position: fixed; inset: 0 auto 0 0; margin: 0; width: min(85vw, 24rem); height: 100dvh; max-height: 100dvh; box-sizing: border-box; border: 1px solid #3b4b66; background: #101827; color: #f3f6fc; padding: 1rem; }
  #ion-menu::backdrop { background: #0009; }
  #historico-ion button { width: 100%; text-align: left; overflow-wrap: anywhere; }
  #anexos-ion:not([hidden]) { display: flex; gap: .5rem; flex-wrap: wrap; }
  .ion-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  #painel:not([hidden]) { height: calc(100dvh - 1rem); min-height: 0; }
  .ion-top { padding: .35rem 0; flex-shrink: 0; }
  #conversa-ion { min-height: 0; max-height: none; align-content: start; overscroll-behavior: contain; }
  #conversa-ion li { border: 0; background: transparent; padding: .75rem; }
  #conversa-ion .msg-user { justify-self: end; max-width: 88%; background: #243a55; }
  #comando-ion { position: static; flex-shrink: 0; }
  .ion-compose { border: 1px solid #3b4b66; border-radius: 1.5rem; padding: .3rem; }
  .ion-compose #pedido-ion { border: 0; resize: none; min-height: 44px; }
  .ion-compose button { justify-content: center; padding: 0 .6rem; flex-shrink: 0; }
  #enviar-ion { background: #a8d1ff; color: #101827; }
  #cancelar-video { background: #8b3030; color: white; }
  button[hidden] { display: none; }
  .ion-resposta-acoes:not([hidden]) { display: flex; gap: .25rem; flex-wrap: wrap; align-items: center; margin-top: .4rem; }
  .ion-resposta-acoes button, .ion-resposta-acoes summary { min-height: 44px; min-width: 40px; border-radius: .5rem; border: 0; background: transparent; color: #bac8da; padding: 0 .35rem; justify-content: center; cursor: pointer; }
  .ion-resposta-acoes summary { display: flex; list-style: none; }
  .ion-resposta-acoes summary::-webkit-details-marker { display: none; }
  .ion-resposta-acoes button:hover, .ion-resposta-acoes [aria-pressed="true"] { background: #243a55; color: #f3f6fc; }
  .ion-resposta-acoes details[open] button { display: flex; margin-top: .25rem; }
  .ion-resposta-votos { display: inline-flex; }
</style>
<main>
  <section id="entrada">
  <h1>Validar acesso ao Ion</h1>
  <div id="google-login"></div>
  <p id="status" role="status">Entre com sua Conta Google.</p>
  </section>
  <section id="painel" hidden>
    <header class="ion-top">
      <button id="menu-ion" type="button" aria-label="Abrir histórico">☰</button>
      <h1 id="titulo-painel" tabindex="-1">Ion</h1>
      <button id="novo-ion" type="button">Nova conversa</button>
    </header>
    <dialog id="ion-menu" aria-labelledby="historico-titulo">
      <div class="ion-top"><h2 id="historico-titulo">Conversas</h2><button id="fechar-menu" type="button">Fechar</button></div>
      <ul id="historico-ion"></ul>
      <button id="limpar-ion" type="button">Limpar histórico local</button>
      <details><summary>Áreas do Ion</summary><ul id="areas"></ul></details>
      <div id="preferencia-voz-ion" hidden>
        <label for="voz-leitura-ion">Voz do aparelho (opcional)</label>
        <select id="voz-leitura-ion"></select>
      </div>
      <button id="sair" type="button">Sair</button>
    </dialog>
    <ul id="conversa-ion" role="log" aria-label="Conversa com o Ion"></ul>
    <form id="comando-ion">


      <div class="ion-compose">
        <button id="mais-ion" type="button" aria-label="Anexar câmera, fotos ou arquivos" aria-expanded="false" aria-controls="anexos-ion">+</button>
        <label for="pedido-ion" class="ion-label">Mensagem para o Ion</label>
        <textarea id="pedido-ion" rows="2" placeholder="Mensagem para o Ion" maxlength="500"></textarea>
        <button id="voz-ion" type="button" aria-label="Iniciar ditado em português" aria-pressed="false">🎙</button>
        <button id="enviar-ion" type="submit">Enviar</button>
        <button id="cancelar-video" type="button" hidden>Parar</button>
      </div>
      <div id="anexos-ion" hidden>
        <button id="escolher-camera" type="button">Câmera</button>
        <button id="escolher-foto" type="button">Fotos</button>
        <button id="escolher-arquivo" type="button">Arquivos</button>
      </div>
      <input type="file" id="camera-ion" accept="image/*" capture="environment" hidden>
      <input type="file" id="foto-ion" accept="image/*" hidden>
      <input type="file" id="arquivo-ion" accept="image/*,audio/*,.m4a,.mp3,.wav,.ogg,.webm,.txt,text/plain" hidden>
      <p id="anexo-status" role="status"></p>
      <p id="ajuda-ion" role="status"></p>
    </form>
  </section>
</main>
<script src="https://accounts.google.com/gsi/client" defer></script>
<script>
  const caminhosSincronismo = ${JSON.stringify(caminhosSincronismo)};
  ${scriptSincronismo}
  ${partituraValida.toString()}
  ${gerarMelodia.toString()}
  ${codificarWav.toString()}
  ${tratarGravacao.toString()}
  const status = document.getElementById("status");
  document.getElementById("sair").addEventListener("click", () => window.location.reload());

  function connectCommands(areas, credential) {
    const central = areas.find(area => area.nome === "Central 6D" && area.url);
    const input = document.getElementById("pedido-ion");
    const send = document.getElementById("enviar-ion");
    const form = document.getElementById("comando-ion");
    const log = document.getElementById("conversa-ion");
    const get = id => document.getElementById(id);
    const menu = get("ion-menu");
    const history = get("historico-ion");
    const help = get("ajuda-ion");
    const attachmentStatus = get("anexo-status");
    const storageKey = "ion-conversas-v1";
    let saved = [];
    try {
      const previous = JSON.parse(localStorage.getItem(storageKey));
      if (Array.isArray(previous)) {
        saved = previous.filter(chat => Array.isArray(chat) && chat.every(entry =>
          (entry?.who === "Você" || entry?.who === "Ion") && typeof entry.text === "string"));
      }
    } catch {}
    let current = saved[0] ?? [];
    let attachment = null;
    let audioFile = null;
    const audiosDaSessao = new WeakMap();
    const ultimaFotoPorConversa = new WeakMap();
    let textFile = null;
    let recording;
    const cancelVideo = get("cancelar-video");
    cancelVideo.onclick = () => {
      recording?.abort();
      if (recognition) recognition.abort();
      help.textContent = "Interrupção solicitada.";
    };
    const videoUrls = [];
    function saveHistory() {
      if (current.length) saved = [current, ...saved.filter(chat => chat !== current)].slice(0, 20);
      try { localStorage.setItem(storageKey, JSON.stringify(saved)); }
      catch { help.textContent = "O navegador não conseguiu salvar o histórico."; }
    }
    function openConversation(chat) {
      if (send.disabled) return;
      recognition?.abort();
      recognition = null;
      microphone.setAttribute("aria-pressed", "false");
      pararLeitura();
      current = chat;
      audioFile = null;
      textFile = null;
      attachment = null;
      attachmentStatus.textContent = "";
      remove.hidden = true;
      input.value = "";
      log.replaceChildren();
      videoUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
      for (const entry of chat) {
        const { item } = message(entry.who, entry.text, entry);
        if (partituraValida(entry.partitura)) apresentarPartitura(item, entry);
        const gravacao = audiosDaSessao.get(entry);
        if (gravacao) apresentarAudio(item, gravacao, entry.versaoAudio);
      }
      if (menu.open) menu.close();
    }
    get("novo-ion").onclick = () => openConversation([]);
    get("menu-ion").onclick = () => {
      history.replaceChildren();
      for (const chat of saved) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = chat[0]?.text.slice(0, 72) || "Conversa";
        button.onclick = () => openConversation(chat);
        item.append(button);
        history.append(item);
      }
      menu.showModal();
    };
    get("fechar-menu").onclick = () => menu.close();
    get("limpar-ion").onclick = () => {
      if (send.disabled || !window.confirm("Limpar as conversas salvas neste navegador?")) return;
      saved = [];
      openConversation([]);
      saveHistory();
    };

    const attach = get("mais-ion");
    const attachments = get("anexos-ion");
    attach.onclick = () => {
      attachments.hidden = !attachments.hidden;
      attach.setAttribute("aria-expanded", String(!attachments.hidden));
    };
    for (const [buttonId, inputId] of [["escolher-camera","camera-ion"],["escolher-foto","foto-ion"],["escolher-arquivo","arquivo-ion"]]) {
      const picker = get(inputId);
      get(buttonId).onclick = () => picker.click();
      picker.onchange = async () => {
        const file = picker.files[0];
        picker.value = "";
        if (!file || send.disabled) return;
        attachments.hidden = true;
        attach.setAttribute("aria-expanded", "false");
        if (inputId === "arquivo-ion" && (file.type.startsWith("audio/") || /\\.(?:m4a|mp3|wav|ogg|webm)$/i.test(file.name))
            && file.size > 0 && file.size <= 20_000_000) {
          attachment = textFile = null;
          audioFile = file;
          attachmentStatus.textContent = "Áudio escolhido: " + file.name;
          remove.hidden = false;
          return;
        }
        if (file.type.startsWith("image/") && file.size <= 10_000_000) {
          attachment = file;
          audioFile = textFile = null;
          attachmentStatus.textContent = "Foto escolhida: " + file.name;
          remove.hidden = false;
          return;
        }
        if (/\\.txt$/i.test(file.name) && file.size > 0 && file.size <= 1_000_000) {
          attachment = audioFile = null;
          textFile = file;
          attachmentStatus.textContent = "Arquivo escolhido: " + file.name;
          remove.hidden = false;
          return;
        }
        help.textContent = "Use um áudio de até 20 MB, uma foto de até 10 MB ou um TXT de até 1 MB.";
      };
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.hidden = true;
    remove.textContent = "Remover anexo";
    attachmentStatus.after(remove);
    remove.onclick = () => { attachment = audioFile = textFile = null; attachmentStatus.textContent = ""; remove.hidden = true; };

    const microphone = get("voz-ion");
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    microphone.onclick = () => {
      if (send.disabled) return;
      if (recognition) { recognition.stop(); help.textContent = "Ditado interrompido."; return; }
      if (!Recognition) {
        help.textContent = "Use o microfone do teclado. O navegador não oferece ditado na página.";
        input.focus();
        return;
      }
      const session = new Recognition();
      recognition = session;
      session.lang = "pt-BR";
      session.onresult = event => {
        const result = event.results[event.resultIndex];
        if (recognition !== session || send.disabled || !result?.isFinal) return;
        const transcript = result[0]?.transcript.trim();
        if (!transcript) return;
        input.value = transcript.slice(0, 500);
        help.textContent = "Texto reconhecido. Revise e toque em Enviar, ou dite novamente.";
        input.focus();
      };
      session.onerror = () => {
        if (recognition === session) help.textContent = "O ditado falhou. Você pode usar o microfone do teclado.";
      };
      session.onend = () => {
        if (recognition !== session) return;
        recognition = null;
        microphone.setAttribute("aria-pressed", "false");
        microphone.setAttribute("aria-label", "Iniciar ditado em português");
      };
      try {
        session.start();
        microphone.setAttribute("aria-pressed", "true");
        microphone.setAttribute("aria-label", "Parar ditado");
        help.textContent = "Ouvindo em português…";
      } catch {
        recognition = null;
        help.textContent = "Use o microfone do teclado para ditar.";
      }
    };

    const leitor = window.speechSynthesis;
    const seletorVoz = get("voz-leitura-ion");
    const chaveVoz = "ion-voz-leitura";
    const vozesBrasileiras = () => leitor?.getVoices().filter(voz => /^pt[-_]br$/i.test(voz.lang)) ?? [];
    const vozSalva = () => {
      try { return localStorage.getItem(chaveVoz); } catch { return null; }
    };
    const preencherVozes = () => {
      const vozes = vozesBrasileiras();
      get("preferencia-voz-ion").hidden = false;
      seletorVoz.replaceChildren(new Option("Padrão do aparelho", ""), ...vozes.map(voz => new Option(voz.name, voz.voiceURI)));
      seletorVoz.value = vozes.some(voz => voz.voiceURI === vozSalva()) ? vozSalva() : "";
    };
    seletorVoz.onchange = () => {
      try { localStorage.setItem(chaveVoz, seletorVoz.value); } catch {}
    };
    preencherVozes();
    leitor?.addEventListener?.("voiceschanged", preencherVozes);

    const leitoresPorResposta = new WeakMap();
    let leitura;
    function pararLeitura() {
      if (!leitura) return;
      const anterior = leitura;
      leitura = null;
      anterior.botao.textContent = "🔊";
      anterior.botao.setAttribute("aria-label", "Ouvir resposta");
      if (anterior.audio) {
        anterior.audio.pause();
        anterior.audio.remove();
        URL.revokeObjectURL(anterior.url);
      }
      if (anterior.fala) leitor.cancel();
    }

    function pedidoDeLeitura(command) {
      return /^(?:(?:voce )?(?:pode|poderia|consegue) )?(?:(?:leia|ler|reproduza|reproduzir|repita|repetir|fale|falar|diga|dizer)(?: em voz alta)? (?:a )?(?:ultima resposta|resposta anterior|essa resposta|esta resposta|(?:a )?resposta|isso|esse texto|este texto)(?: em voz alta)?|(?:leia|ler|repita|repetir|fale|falar|diga|dizer) em voz alta|(?:reproduza|reproduzir|toque|tocar) (?:o )?audio (?:da resposta|da ultima resposta|dessa resposta))$/.test(command);
    }

    function message(who, content, entrada) {
      const item = document.createElement("li");
      item.className = who === "Você" ? "msg-user" : "msg-ion";
      const label = document.createElement("strong");
      label.textContent = who;
      const body = document.createElement("p");
      body.textContent = content;
      item.append(label, body);
      let ouvir;
      if (who === "Ion") {
        ouvir = document.createElement("button");
        ouvir.type = "button";
        ouvir.textContent = "🔊";
        ouvir.title = "Ouvir com a voz Faber";
        ouvir.setAttribute("aria-label", "Ouvir resposta");
        ouvir.hidden = !content.trim() || content === "Entendendo seu pedido…";
        const reproduzir = async (usarVozLocal = false) => {
          const jaLendo = leitura?.botao === ouvir;
          pararLeitura();
          if (jaLendo) return;
          const texto = body.textContent.replace(/https?:\\/\\/\\S+/g, "").replace(/[*_#]/g, "").trim();
          if (!texto) return;
          const vozes = vozesBrasileiras();
          const preferida = vozes.find(v => v.voiceURI === vozSalva());
          if (!usarVozLocal) {
            const sessao = { botao: ouvir };
            leitura = sessao;
            ouvir.textContent = "■";
            ouvir.setAttribute("aria-label", "Parar leitura");
            help.textContent = "Preparando voz Faber. Na primeira vez, o modelo precisa ser baixado.";
            let prazo;
            try {
              const preparar = async () => {
                const piper = await import("https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/+esm");
                if (leitura !== sessao) return null;
                return piper.predict({ text: texto, voiceId: "pt_BR-faber-medium" }, progresso => {
                  if (leitura === sessao && progresso.total > 0) {
                    help.textContent = "Baixando voz Faber… " + Math.min(100, Math.round(progresso.loaded * 100 / progresso.total)) + "%";
                  }
                });
              };
              const audioWav = await Promise.race([preparar(), new Promise((_, reject) => {
                prazo = setTimeout(() => reject(new Error("Tempo de preparação excedido")), 45000);
              })]);
              if (leitura !== sessao) return;
              const audio = document.createElement("audio");
              sessao.url = URL.createObjectURL(audioWav);
              sessao.audio = audio;
              audio.controls = true;
              audio.src = sessao.url;
              item.append(audio);
              audio.onended = () => { if (leitura === sessao) pararLeitura(); };
              audio.onerror = () => {
                if (leitura !== sessao) return;
                pararLeitura();
                help.textContent = "A voz Faber não pôde ser reproduzida.";
              };
              help.textContent = "";
              try {
                await audio.play();
              } catch {
                if (leitura !== sessao) return;
                help.textContent = "Toque no controle de áudio abaixo da resposta para ouvir.";
              }
            } catch {
              if (leitura !== sessao) return;
              pararLeitura();
              help.textContent = "A voz Faber não ficou pronta. Você pode tentar novamente ou usar a voz do aparelho.";
              if (leitor && window.SpeechSynthesisUtterance && !item.querySelector(".ion-voz-local")) {
                const alternativa = document.createElement("button");
                alternativa.type = "button";
                alternativa.className = "ion-voz-local";
                alternativa.textContent = "Ouvir com a voz do aparelho";
                alternativa.onclick = () => reproduzir(true);
                item.append(alternativa);
              }
            } finally {
              clearTimeout(prazo);
            }
            return;
          }
          if (!leitor || !window.SpeechSynthesisUtterance) {
            help.textContent = "A voz do aparelho não está disponível neste navegador.";
            return;
          }
          const fala = new SpeechSynthesisUtterance(texto);
          fala.lang = "pt-BR";
          if (preferida) fala.voice = preferida;
          leitura = { fala, botao: ouvir };
          ouvir.textContent = "■";
          ouvir.setAttribute("aria-label", "Parar leitura");
          const encerrar = () => {
            if (leitura?.fala !== fala) return;
            leitura = null;
            ouvir.textContent = "🔊";
            ouvir.setAttribute("aria-label", "Ouvir resposta");
          };
          fala.onend = encerrar;
          fala.onerror = evento => {
            if (leitura?.fala === fala) help.textContent = "Não foi possível reproduzir a voz neste navegador.";
            encerrar();
          };
          help.textContent = "";
          leitor.speak(fala);
        };
        leitoresPorResposta.set(entrada, () => reproduzir(Boolean(leitor && window.SpeechSynthesisUtterance)));
        ouvir.onclick = () => reproduzir();
      }
      let acoes;
      if (who === "Ion") {
        acoes = document.createElement("div");
        acoes.className = "ion-resposta-acoes";
        acoes.hidden = !content.trim() || content === "Entendendo seu pedido…";
        const botao = (texto, titulo, acao) => {
          const controle = document.createElement("button");
          controle.type = "button";
          controle.textContent = texto;
          controle.title = titulo;
          controle.setAttribute("aria-label", titulo);
          controle.onclick = acao;
          return controle;
        };
        acoes.append(botao("⧉", "Copiar resposta", async () => {
          try {
            await navigator.clipboard.writeText(body.textContent);
            help.textContent = "Resposta copiada.";
          } catch {
            help.textContent = "Selecione o texto para copiar manualmente.";
          }
        }));
        const grupoVotos = document.createElement("div");
        grupoVotos.className = "ion-resposta-votos";
        grupoVotos.setAttribute("role", "group");
        grupoVotos.setAttribute("aria-label", "Avaliar resposta");
        acoes.append(grupoVotos);
        const votos = [["👍", "Gostei", "positivo"], ["👎", "Não gostei", "negativo"]];
        const atualizarVotos = () => {
          for (const [controle, valor] of controles) {
            controle.setAttribute("aria-pressed", String(entrada.voto === valor));
          }
        };
        const controles = votos.map(([icone, titulo, valor]) => {
          const controle = botao(icone, titulo, () => {
            entrada.voto = entrada.voto === valor ? null : valor;
            atualizarVotos();
            saveHistory();
          });
          grupoVotos.append(controle);
          return [controle, valor];
        });
        atualizarVotos();
        if (ouvir) acoes.append(ouvir);
        acoes.append(botao("↑", "Compartilhar resposta", async () => {
          const texto = body.textContent.trim();
          if (!texto) return;
          try {
            const dados = { text: texto };
            if (navigator.share && (!navigator.canShare || navigator.canShare(dados))) {
              await navigator.share(dados);
            } else {
              await navigator.clipboard.writeText(texto);
              help.textContent = "Resposta copiada. Cole no aplicativo em que quiser compartilhar.";
            }
          } catch (erro) {
            if (erro?.name !== "AbortError") help.textContent = "Não foi possível compartilhar. Use Copiar resposta.";
          }
        }));
        const opcoes = document.createElement("details");
        const resumo = document.createElement("summary");
        resumo.textContent = "⋯";
        resumo.setAttribute("aria-label", "Mais ações da resposta");
        opcoes.append(resumo);
        const pedidoDaResposta = () => {
          const indice = current.indexOf(entrada);
          return indice < 0 ? "" : current.slice(0, indice).reverse().find(msg => msg.who === "Você")?.text || "";
        };
        opcoes.append(
          botao("Criar conversa a partir daqui", "Criar conversa a partir desta mensagem", () => {
            const indice = current.indexOf(entrada);
            if (indice < 0 || send.disabled) return;
            openConversation(current.slice(0, indice + 1).map(msg => ({ ...msg })));
            saveHistory();
          }),
          botao("Repetir pedido", "Repetir o pedido desta resposta", () => {
            const pedido = pedidoDaResposta();
            if (!pedido || send.disabled) return;
            opcoes.open = false;
            input.value = pedido;
            form.requestSubmit();
          }),
          botao("Baixar arquivo", "Baixar código ou texto da resposta", () => {
            const texto = body.textContent;
            const codigo = texto.match(/\`\`\`([a-z0-9_+-]*)[ \\t]*\\r?\\n([\\s\\S]*?)\\r?\\n\`\`\`/i);
            const extensoes = new Map([["python", "py"], ["py", "py"], ["javascript", "js"], ["js", "js"],
              ["typescript", "ts"], ["ts", "ts"], ["html", "html"], ["css", "css"], ["json", "json"],
              ["sql", "sql"], ["java", "java"], ["cpp", "cpp"], ["c", "c"], ["markdown", "md"]]);
            const extensao = extensoes.get(codigo?.[1].toLowerCase()) || "txt";
            const url = URL.createObjectURL(new Blob([codigo?.[2] ?? texto], { type: "text/plain;charset=utf-8" }));
            const link = document.createElement("a");
            link.href = url;
            link.download = "ion-resposta." + extensao;
            item.append(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
            opcoes.open = false;
          }),
          botao("Buscar na web", "Abrir busca na web", () => {
            const termo = window.prompt("Revise os termos que serão enviados ao Google.", pedidoDaResposta());
            if (!termo?.trim()) return;
            const busca = new URL("https://www.google.com/search");
            busca.searchParams.set("q", termo.trim());
            window.open(busca.href, "_blank", "noopener,noreferrer");
            opcoes.open = false;
          })
        );
        acoes.append(opcoes);
        item.append(acoes);
      }
      log.append(item);
      log.scrollTop = log.scrollHeight;
      return { item, body, ouvir, acoes };
    }

    function parseCommand(request) {
      const [instruction, ...scriptParts] = request.split(":");
      const command = instruction.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")
        .toLowerCase().replace(/[.,!?]/g, " ").trim().replace(/\\s+/g, " ")
        .replace(/^(?:ion|i on|aion|ai on) /, "")
        .replace(/^por favor /, "").replace(/ por favor$/, "");
      const videoRequest = /^(?:quero(?: que voce)? |(?:voce )?(?:pode|poderia|consegue) )?(?:gere|gera|gerar|faca|faz|fazer|crie|cria|criar|produza|produzir|criom|criou) (?:para mim )?(?:um )?(?:video|short)(?: vertical)?(?: para mim)?(?: (.+))?$/.exec(command);
      // Dictation can add words before the verb and move modifiers after the topic.
      const trafficRequest = !scriptParts.length
        && (/\\b(?:gere|gera|gerar|faca|faz|fazer|crie|cria|criar|produza|produzir|criom|criacao|quero|preciso)\\b/.test(command)
          || /\\b(?:eu creio|eu crio|criei|criou)\\b/.test(command))
        && /\\b(?:video|short)\\b/.test(command)
        && /\\b(?:transito|seguranca viaria)\\b/.test(command)
        && !/\\b(?:nao|sem|cancele)\\b/.test(command);
      return { command, videoRequest, trafficRequest, scriptParts };
    }

    function apresentarAudio(item, blob, versao) {
      const url = URL.createObjectURL(blob);
      videoUrls.push(url);
      const audio = document.createElement("audio");
      audio.controls = true;
      audio.preload = "none";
      audio.src = url;
      const baixar = document.createElement("a");
      baixar.href = url;
      baixar.download = "ion-audio-v" + versao + ".wav";
      baixar.textContent = "Baixar áudio · versão " + versao;
      item.append(audio, baixar);
    }

    function apresentarPartitura(item, entrada) {
      const { amostras, taxa } = gerarMelodia(entrada.partitura);
      apresentarAudio(item, codificarWav(amostras, taxa), entrada.versaoAudio);
    }

    openConversation(current);
    form.onsubmit = async event => {
      event.preventDefault();
      const request = input.value.trim();
      const file = attachment || textFile || audioFile;
      if (attachment) ultimaFotoPorConversa.set(current, attachment);
      if ((!request && !file) || send.disabled) return;
      let { command, videoRequest, trafficRequest, scriptParts } = parseCommand(request);
      if (!file && !scriptParts.length && pedidoDeLeitura(command)) {
        const ultimaResposta = current.findLast(entry => entry.who === "Ion" && entry.text.trim());
        const lerResposta = leitoresPorResposta.get(ultimaResposta);
        input.value = "";
        if (lerResposta) await lerResposta();
        else help.textContent = "Ainda não há uma resposta para ler nesta conversa.";
        return;
      }
      const { item: sent } = message("Você", request || file.name);
      if (file) {
        const url = URL.createObjectURL(file);
        videoUrls.push(url);
        if (attachment) {
          const preview = document.createElement("img");
          preview.src = url;
          preview.alt = file.name;
          preview.style.cssText = "display:block;max-width:100%;max-height:22rem;object-fit:contain";
          sent.append(preview);
        }
        const download = document.createElement("a");
        download.href = url;
        download.download = file.name;
        download.textContent = attachment ? "Baixar foto" : "Baixar arquivo";
        sent.append(download);
        log.scrollTop = log.scrollHeight;
      }
      current.push({who: "Você", text: request || file.name});
      saveHistory();
      input.value = "";
      const record = {who: "Ion", text: ""};
      const { item, body, ouvir, acoes } = message("Ion", "Entendendo seu pedido…", record);
      current.push(record);
      const update = (reply) => {
        body.textContent = reply;
        if (ouvir) ouvir.hidden = !reply.trim();
        if (acoes) acoes.hidden = !reply.trim();
        record.text = reply;
        saveHistory();
      };
      const versaoAnterior = current.findLast(entrada => Number.isInteger(entrada.versaoAudio))?.versaoAudio || 0;
      if (audioFile) {
        send.disabled = microphone.disabled = true;
        try {
          const gravacao = await tratarGravacao(audioFile);
          record.versaoAudio = versaoAnterior + 1;
          audiosDaSessao.set(record, gravacao);
          apresentarAudio(item, gravacao, record.versaoAudio);
          remove.click();
          update("Versão " + record.versaoAudio + " · Clareza e volume ajustados na sua gravação. Ouça e baixe o áudio nesta sessão.");
        } catch {
          update("Não consegui tratar esse áudio. Tente um arquivo M4A, MP3 ou WAV compatível com seu navegador, com até dois minutos.");
        } finally {
          send.disabled = microphone.disabled = false;
        }
        return;
      }
      if (!file && /^(?:baixar|baixe|quero baixar) (?:o )?(?:codigo(?: fonte)?|projeto|repositorio) (?:do ion|do aion|do adl midia|adl midia)$/.test(command)) {
        const codigo = areas.find(area => area.rotulo === "Baixar código do Ion");
        if (codigo?.url) {
          const link = document.createElement("a");
          link.href = codigo.url;
          link.textContent = codigo.rotulo;
          item.append(link);
          update("Aqui está a cópia ZIP do código que o Ion usa. Você também pode baixá-la no menu, em Áreas do Ion.");
          return;
        }
      }
      const aviso = /\\b(?:avise|comunique|informe)\\s+(?:(?:com|ao|a|o|para o)\\s+)?cliente\\s+([\\p{L}][\\p{L} .'-]{0,60}?)\\s+que\\s+(?:o\\s+)?carro(?:\\s+del[ea])?\\s+(.+)$/iu.exec(request);
      let mensagem;
      if (aviso) {
        const [, cliente, situacao] = aviso;
        const texto = situacao.trim();
        const horario = /[àa]s\\s+([01]?\\d|2[0-3])(?:(?::|h)([0-5]\\d)|\\s*h(?:oras?)?)?[.!]?$/i.exec(texto);
        const pronto = /^(?:j[áa]\\s+)?est[áa]\\s+pronto[.!]?$/i.test(texto);
        const agendado = /^(?:vai ficar|ficar[áa]|estar[áa]) pronto\\b/i.test(texto) && horario;
        if (!pronto && !agendado) {
          update("O carro já está pronto ou ficará pronto em um horário específico?");
          return;
        }
        mensagem = "Olá, " + cliente.trim() + "! " + (pronto
          ? "Seu carro está pronto para retirada."
          : "Seu carro estará pronto para retirada às " + horario[1] + "h" + (horario[2] || "") + ".");
      }
      const marcadorWhatsApp = "\\n\\nRascunho. Escolha o contato no WhatsApp e confirme o envio lá.";
      const anteriorWhatsApp = current.at(-3);
      const telefoneInformado = request.match(/(?:^|\\s)(\\+55[\\s.-]*)?(\\(?[1-9]\\d\\)?)[\\s.-]*(9?\\d{4})[\\s.-]*(\\d{4})(?=$|[\\s.!?,;])/);
      const rascunhoAnterior = anteriorWhatsApp?.who === "Ion" && anteriorWhatsApp.text.endsWith(marcadorWhatsApp);
      if (!mensagem && telefoneInformado && rascunhoAnterior) {
        mensagem = anteriorWhatsApp.text.slice(0, -marcadorWhatsApp.length);
      }
      const pedidoWhatsApp = /\\b(?:whatsapp|whats\\s*app|zap)\\b/i.test(request);
      if (mensagem || (telefoneInformado && pedidoWhatsApp)) {
        const editar = document.createElement("textarea");
        editar.rows = 3;
        editar.value = mensagem || "";
        editar.placeholder = "Escreva ou cole a mensagem";
        editar.setAttribute("aria-label", "Mensagem para o WhatsApp");
        update(mensagem ? mensagem + marcadorWhatsApp
          : "Telefone reconhecido. Escreva ou cole abaixo o texto que você quer enviar pelo WhatsApp.");
        const abrir = document.createElement("a");
        abrir.href = "https://wa.me/?text=" + encodeURIComponent(mensagem);
        abrir.target = "_blank";
        abrir.rel = "noopener noreferrer";
        abrir.textContent = "Abrir rascunho no WhatsApp";
        const telefone = document.createElement("input");
        telefone.type = "tel";
        telefone.autocomplete = "off";
        telefone.placeholder = "+55 DDD número";
        telefone.setAttribute("aria-label", "Número do cliente com código do país e DDD");
        const direto = document.createElement("a");
        direto.target = "_blank";
        direto.rel = "noopener noreferrer";
        direto.textContent = "Abrir conversa com este número";
        direto.hidden = true;
        const atualizarDestino = () => {
          const numero = telefone.value.replace(/\\D/g, "");
          const valido = /^[1-9]\\d{7,14}$/.test(numero) && telefone.value.trim().startsWith("+");
          const texto = editar.value.trim();
          abrir.hidden = !texto || Boolean(telefoneInformado);
          abrir.href = "https://wa.me/?text=" + encodeURIComponent(texto);
          direto.hidden = !valido || !texto;
          if (valido && texto) direto.href = "https://wa.me/" + numero + "?text=" + encodeURIComponent(texto);
          else direto.removeAttribute("href");
        };
        telefone.oninput = editar.oninput = atualizarDestino;
        item.append(editar, document.createElement("br"), abrir, document.createElement("br"), telefone);
        if (navigator.contacts?.select) {
          const escolher = document.createElement("button");
          escolher.type = "button";
          escolher.textContent = "Escolher contato do celular";
          escolher.onclick = async () => {
            try {
              const [contato] = await navigator.contacts.select(["tel"]);
              if (!contato?.tel?.length) return;
              if (contato.tel.length > 1) {
                help.textContent = "Esse contato tem vários números. Informe o número que deseja usar.";
                telefone.focus();
                return;
              }
              const numero = contato.tel[0].trim();
              telefone.value = numero.startsWith("+") ? numero : "+55 " + numero;
              atualizarDestino();
            } catch {
              help.textContent = "Informe o número com o código do país e o DDD.";
            }
          };
          item.append(escolher);
        }
        item.append(direto);
        if (telefoneInformado) {
          telefone.value = "+55 " + telefoneInformado.slice(2).join(" ");
        }
        atualizarDestino();
        log.scrollTop = log.scrollHeight;
        return;
      }
      const assuntoTecnico = /\\b(?:sincronismo|correia dentada|correia da entrada|corrente de distribuicao|ponto da correia|fasagem|marcas de montagem)\\b/;
      const pedidoAnterior = current.at(-4)?.who === "Você" ? current.at(-4).text : "";
      const comandoAnterior = parseCommand(pedidoAnterior).command;
      const pedeManual = /^(?:(?:manda|mande|envia|envie|mostra|mostre|abre|abra|quero|me manda|me mande)\\s+)?(?:o\\s+)?(?:manual|link|figura|desenho|esquema)(?:\\s+(?:tecnico|dele|desse motor|por favor))*$/.test(command);
      const continuaTecnico = pedeManual && assuntoTecnico.test(comandoAnterior);
      if ((assuntoTecnico.test(command) || continuaTecnico)
          && !videoRequest && !trafficRequest) {
        const modelo = /\\bc\\s*4\\s+(?:pallas|palas|pala|palace)\\b/;
        const motor = /\\b(?:2\\s+(?:0|zero)|dois\\s+(?:ponto\\s+)?zero|ew10a|rfj)\\b/;
        const outroMotor = /\\b(?:1\\s+(?:4|6|8)|tu5\\w*|ew10j4\\w*)\\b/;
        const outroAno = /\\b(?:19\\d{2}|20(?!10)\\d{2})\\b/;
        const anterior = current.slice(0, -2).filter(m => m.who === "Você").slice(-5)
          .map(m => parseCommand(m.text).command).reverse().find(t => modelo.test(t)) || "";
        const complemento = continuaTecnico || modelo.test(command) || /\\b(?:desse|deste|dele|mesmo)\\b/.test(command) ? anterior : "";
        const contextoCompativel = complemento && !outroMotor.test(complemento) && !outroAno.test(complemento);
        const aplicacaoC4 = (modelo.test(command) || contextoCompativel) && !outroAno.test(command)
          && !outroMotor.test(command) && (motor.test(command) || (contextoCompativel && motor.test(complemento)))
          && (/\\b2010\\b/.test(command) || (contextoCompativel && /\\b2010\\b/.test(complemento)));
        if (aplicacaoC4) {
          update("Referência de catálogo para o Citroën C4 Pallas 2.0 16V Flex 2010, motor EW10A. A página de catálogo identifica a aplicação. O manual técnico do C4 RFJ, edição de 2005, mostra os comandos e a posição do pino do virabrequim. Na figura B1BP2V3D, A é câmbio manual e B é automático. Esta referência é da família RFJ; a edição brasileira específica de 2010 ainda não foi confirmada.");
          const referencia = document.createElement("a");
          referencia.href = "https://oficinaconectada.com.br/v/Citroen/C4-Pallas/20-16V-L4-EW10A-Flex/2010/Correias-Correntes-Procedimento-de-troca/Sincronismo-do-motor-correia-ou-corrente/";
          referencia.target = "_blank";
          referencia.rel = "noopener noreferrer";
          referencia.textContent = "Ver aplicação no catálogo — C4 Pallas 2.0 Flex 2010";
          const manual = document.createElement("a");
          manual.href = "https://pcgroup.rs/wp-content/uploads/2018/02/CITROEN-C4-2005.God_..pdf#page=209";
          manual.target = "_blank";
          manual.rel = "noopener noreferrer";
          manual.textContent = "Abrir manual técnico do C4 RFJ — figuras de sincronismo";
          item.append(referencia, document.createElement("br"), manual);
          log.scrollTop = log.scrollHeight;
          return;
        }
        const resultados = localizarSincronismo(continuaTecnico ? pedidoAnterior : request, caminhosSincronismo);
        if (resultados.length === 1) {
          const { marca, modelo, motor, caminho } = resultados[0];
          update("Aplicação encontrada no índice público da Oficina Conectada. " + marca + " " + modelo
            + " · " + motor + ". A página identifica a aplicação. O desenho e as marcas de montagem ainda precisam ser conferidos no documento.");
          const pagina = document.createElement("a");
          pagina.href = "https://oficinaconectada.com.br/v/" + caminho.split("/").map(encodeURIComponent).join("/")
            + "/Correias-Correntes-Procedimento-de-troca/Sincronismo-do-motor-correia-ou-corrente/";
          pagina.target = "_blank";
          pagina.rel = "noopener noreferrer";
          pagina.textContent = "Abrir página de sincronismo no catálogo";
          item.append(pagina);
        } else if (resultados.length > 1) {
          update("O catálogo encontrou mais de uma aplicação. Informe a variante do motor: "
            + [...new Set(resultados.map(({ motor }) => motor))].slice(0, 8).join(", ") + ".");
        } else {
          const cht = /\\bc\\s*h\\s*t\\s*1[., ]0\\b/i.test(request);
          update(cht
            ? "Entendi motor CHT 1.0. Não encontrei uma referência confirmada no catálogo atual. Qual é o veículo e o ano?"
            : "Não encontrei uma aplicação correspondente no catálogo indexado. Informe o modelo e o ano com a cilindrada ou o código do motor.");
        }
        log.scrollTop = log.scrollHeight;
        return;
      }

      if (/\\b(?:onde (?:eu )?(?:estou|to)|onde (?:o|meu) celular esta|minha localizacao|localizacao (?:atual|do celular))\\b/.test(command)) {
        if (!navigator.geolocation) {
          update("Este navegador não oferece localização.");
          return;
        }
        send.disabled = microphone.disabled = true;
        body.textContent = "Aguardando a localização do celular…";
        try {
          const { coords } = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, {
              enableHighAccuracy: true, timeout: 12000, maximumAge: 0,
            });
          });
          update("O celular forneceu sua localização, com precisão estimada de " + Math.round(coords.accuracy) + " metros.");
          const mapa = document.createElement("a");
          mapa.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(coords.latitude + "," + coords.longitude);
          mapa.target = "_blank";
          mapa.rel = "noopener noreferrer";
          mapa.textContent = "Abrir localização no mapa";
          item.append(mapa);
          log.scrollTop = log.scrollHeight;
        } catch (erro) {
          update(erro?.code === 1
            ? "Permita a localização para o ION nas configurações do navegador e tente novamente."
            : "O celular não conseguiu determinar a localização agora. Confira se a localização do aparelho está ligada.");
        } finally {
          send.disabled = microphone.disabled = false;
        }
        return;
      }

      if (/^(?:(?:voce )?(?:ja )?pode (?:criar|gerar|fazer|produzir|comecar)|vai em frente)$/.test(command)) {
        const previous = current.slice(0, -2).reverse().find(entry => {
          if (entry.who !== "Você") return false;
          const parsed = parseCommand(entry.text);
          return parsed.videoRequest || parsed.trafficRequest;
        });
        if (!previous) {
          update("Qual vídeo você quer que eu crie?");
          return;
        }
        ({ command, videoRequest, trafficRequest, scriptParts } = parseCommand(previous.text));
      }
      if (/^(abra|abrir|acesse|acessar) (a )?(central 6d|adl midia)$/.test(command) && central) {
        update("Abrindo a Central 6D.");
        window.location.assign(central.url);
        return;
      }
      if (/^(abra|abrir|acesse|acessar) (o )?gerador( de videos?)?$/.test(command) && central) {
        update("Abrindo o gerador.");
        window.location.assign(new URL("gerador", central.url).href);
        return;
      }
      if (textFile || (attachment && (!request || trafficRequest))) {
        const photo = Boolean(attachment);
        remove.click();
        update(photo
          ? "Foto adicionada nesta sessão. Use Baixar foto para salvar. Para analisar, pergunte o que aparece nela."
          : "Arquivo adicionado nesta sessão. Use Baixar arquivo para salvar.");
        return;
      }
      const bentoRequest = /\\b(?:crie|cria|criar|faca|faz|fazer|gere|gerar|anime|animar|produza|quero)\\b/.test(command)
        && /\\b(?:desenho|animacao|video)\\b/.test(command)
        && /\\b(?:bento|cachorro)\\b/.test(command) && /\\bbola\\b/.test(command)
        && !/\\b(?:nao|sem|cancele)\\b/.test(command);
      const fotoAnterior = ultimaFotoPorConversa.get(current);
      const respostaAnterior = current.at(-3);
      const confirmaFoto = /^(?:sim|isso|isso mesmo|exato|exatamente|correto)$/.test(command)
        && respostaAnterior?.who === "Ion"
        && /(?:análise (?:visual|de fotos)|analisar a foto|modelo de visão)/i.test(respostaAnterior.text);
      if (!videoRequest && !trafficRequest && fotoAnterior
          && (attachment || confirmaFoto || /\\b(?:o que (?:e|tem|aparece)|qual (?:e|seria)|identifi\\w*|analis\\w*|descrev\\w*|descri\\w*|foto|imagem)\\b/.test(command))) {
        if (/\\b(?:baix\\w*|salv\\w*|abr\\w*)\\b/.test(command)) {
          const url = URL.createObjectURL(fotoAnterior);
          videoUrls.push(url);
          const download = document.createElement("a");
          download.href = url;
          download.download = fotoAnterior.name;
          download.textContent = "Baixar foto";
          item.append(download);
          update("Aqui está a última foto enviada nesta conversa.");
        } else {
          if (attachment) remove.click();
          send.disabled = microphone.disabled = true;
          body.textContent = "Analisando a foto…";
          try {
            const assinatura = new Uint8Array(await fotoAnterior.slice(0, 3).arrayBuffer());
            let jpeg = fotoAnterior;
            if (fotoAnterior.size > 2_000_000 || assinatura[0] !== 255 || assinatura[1] !== 216 || assinatura[2] !== 255) {
              const url = URL.createObjectURL(fotoAnterior);
              try {
                const foto = new Image();
                await new Promise((resolve, reject) => {
                  foto.onload = resolve;
                  foto.onerror = reject;
                  foto.src = url;
                });
                const tela = document.createElement("canvas");
                const escala = Math.min(1, 1024 / Math.max(foto.naturalWidth, foto.naturalHeight));
                tela.width = Math.max(1, Math.round(foto.naturalWidth * escala));
                tela.height = Math.max(1, Math.round(foto.naturalHeight * escala));
                tela.getContext("2d").drawImage(foto, 0, 0, tela.width, tela.height);
                jpeg = await new Promise(resolve => tela.toBlob(resolve, "image/jpeg", .82));
                if (!jpeg) throw new Error("Conversão indisponível");
              } finally { URL.revokeObjectURL(url); }
            }
            const resposta = await fetch("/api/foto", {
              method: "POST",
              headers: {
                Authorization: "Bearer " + credential,
                "X-ION-Pergunta": encodeURIComponent(confirmaFoto ? "O que aparece nesta foto?" : request),
              },
              body: jpeg,
            });
            const payload = await resposta.json().catch(() => null);
            update(resposta.ok && payload?.texto ? payload.texto : payload?.erro || "A análise da foto não retornou uma descrição (HTTP " + resposta.status + ").");
          } catch {
            update("Não consegui preparar ou enviar a foto para análise.");
          } finally {
            send.disabled = microphone.disabled = false;
          }
        }
        log.scrollTop = log.scrollHeight;
        return;
      }
      if (!videoRequest && !trafficRequest && !bentoRequest) {
        const mensagens = current.slice(0, -1).filter(entry =>
          ["Você", "Ion"].includes(entry.who) && entry.text.trim()).slice(-9).map(entry => ({
          role: entry.who === "Você" ? "user" : "assistant",
          content: entry.text.slice(0, 2000),
        }));
        send.disabled = microphone.disabled = true;
        try {
          const ultimaPartitura = current.findLast(entrada => partituraValida(entrada.partitura))?.partitura;
          const response = await fetch("/api/conversa", {
            method: "POST",
            headers: { Authorization: "Bearer " + credential, "Content-Type": "application/json" },
            body: JSON.stringify({ mensagens, ultimaPartitura }),
          });
          const payload = await response.json();
          if (response.ok && partituraValida(payload.partitura)) {
            record.partitura = payload.partitura;
            record.versaoAudio = versaoAnterior + 1;
            apresentarPartitura(item, record);
            update(record.partitura.titulo + " · Versão " + record.versaoAudio + " (prévia instrumental)"
              + (record.partitura.letra ? "\\n\\n" + record.partitura.letra : ""));
          } else if (response.ok && payload.pedirGravacao) {
            update("Grave você cantando ou falando a letra e envie pelo botão +, em Arquivo. Vou ajustar a clareza e o volume da sua gravação.");
          } else {
            update(response.ok ? payload.texto : payload.erro);
          }
        } catch {
          update("Falha de conexão com o núcleo de conversa.");
        } finally {
          send.disabled = microphone.disabled = false;
        }
        return;
      }
      if (trafficRequest || bentoRequest) {
        send.disabled = microphone.disabled = true;
        cancelVideo.hidden = false;
        recording = new AbortController();
        update("Solicitando a geração do vídeo narrado no servidor…");
        try {
          const response = await fetch(bentoRequest ? "/api/video/bento" : "/api/video/transito", {
            signal: recording.signal,
            method: "POST",
            headers: { Authorization: "Bearer " + credential },
            cache: "no-store",
          });
          const payload = await response.json().catch(() => ({}));
          if (response.ok && payload.status === "solicitado") {
            update("Geração solicitada ao GitHub Actions. O vídeo ainda não está pronto; acompanhe a execução no link abaixo.");
            const link = document.createElement("a");
            link.href = payload.acompanhamento;
            link.textContent = "Acompanhar geração e baixar MP4";
            link.target = "_blank";
            link.rel = "noopener noreferrer";
            item.append(link);
          } else {
            update(response.status === 401
              ? "Sua sessão expirou. Entre novamente para autorizar a execução."
              : "Não foi possível iniciar a geração: " + (payload.erro || "erro HTTP " + response.status) + ". Nenhum vídeo foi produzido.");
          }
        } catch {
          update(recording.signal.aborted ? "Solicitação interrompida. Confirme no GitHub se já foi iniciada." : "Falha de conexão com o gerador. Nenhum vídeo foi produzido.");
        } finally {
          recording = undefined;
          cancelVideo.hidden = true;
          send.disabled = microphone.disabled = false;
        }
        return;
      }
      const script = scriptParts.join(":").trim();
      let scenes = script.match(/[^.!?\\n]+[.!?]*/g)?.map(line => line.trim()).filter(Boolean) ?? [];
      if ((scriptParts.length && !scenes.length) || scenes.length > 6 || scenes.some(line => line.length > 100)) {
        update("Escreva de uma a seis frases, com até 100 caracteres cada.");
        return;
      }
      const topic = videoRequest?.[1]?.replace(/ para mim$/, "");
      let title = scenes.length ? "Vídeo com suas frases" : "Vídeo de teste: A coragem de recomeçar";
      if (!scenes.length && (trafficRequest || (topic && !/^de (teste|exemplo)$/.test(topic)))) {
        if (!trafficRequest && !/^(?:(?:educativo|educacional) )?(?:de|sobre|do|no|para o) (?:o )?(?:educacao (?:no|para o) |seguranca (?:no|do) )?transito$/.test(topic)
            && !/^(?:educativo|educacional) (?:de|sobre) seguranca viaria$/.test(topic)) {
          update("Já posso criar um vídeo educativo de trânsito. Para outro tema, envie as frases depois de dois-pontos.");
          return;
        }
        title = "Trânsito seguro";
        scenes = [
          "Ao dirigir, mantenha o celular guardado.",
          "Reduza a velocidade perto das faixas de pedestres.",
          "A pé, espere os veículos pararem antes de atravessar.",
          "Use o cinto em todos os assentos.",
          "Respeite a sinalização. Cuidar no trânsito protege vidas.",
        ];
      }
      send.disabled = microphone.disabled = true;
      recording = new AbortController();
      cancelVideo.hidden = false;
      body.textContent = "Gerando o vídeo experimental. Mantenha esta tela aberta.";
      try {
        const photo = attachment ? await createImageBitmap(attachment) : null;
        let result;
        try {
          result = await renderSample(scenes, progress => {
            body.textContent = "Gerando vídeo… " + progress + "%";
          }, photo, recording.signal);
        } finally { photo?.close(); }
        const { blob, extension, sceneCount } = result;
        attachment = null;
        attachmentStatus.textContent = "";
        remove.hidden = true;
        const url = URL.createObjectURL(blob);
        videoUrls.push(url);
        const preview = document.createElement("video");
        preview.controls = true;
        preview.playsInline = true;
        preview.src = url;
        const download = document.createElement("a");
        download.href = url;
        download.download = (title === "Trânsito seguro" ? "ion-transito-seguro." : scenes.length ? "ion-meu-video." : "ion-a-coragem-de-recomecar.") + extension;
        download.textContent = "Baixar vídeo";
        update(title
          + " · " + sceneCount + (sceneCount === 1 ? " cena, " : " cenas, ")
          + (sceneCount * 3) + " segundos, sem áudio." + " Baixe o arquivo antes de sair da conversa.");
        item.append(preview, download);
        log.scrollTop = log.scrollHeight;
      } catch (error) {
        update(recording.signal.aborted ? "Geração cancelada." : "Não consegui exportar. " + error.message);
      } finally {
        recording = undefined;
        cancelVideo.hidden = true;
        send.disabled = microphone.disabled = false;
      }
    };
  }

  async function renderSample(customScenes, onProgress, photo, signal) {
    const canvas = document.createElement("canvas");
    canvas.width = 540;
    canvas.height = 960;
    if (!window.MediaRecorder || !canvas.captureStream) {
      throw new Error("Abra o Ion no Safari ou no Chrome atualizado.");
    }
    const mime = ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp8", "video/webm"]
      .find(type => MediaRecorder.isTypeSupported(type));
    if (!mime) throw new Error("Nenhum formato de vídeo compatível.");
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("A tela de vídeo está indisponível.");
    const scenes = customScenes.length ? customScenes.map(text => {
      ctx.font = "bold 32px system-ui";
      const lines = [];
      let line = "";
      for (const word of text.split(/\\s+/)) {
        const next = line ? line + " " + word : word;
        if (line && ctx.measureText(next).width > 460) {
          lines.push(line);
          line = word;
        } else {
          line = next;
        }
      }
      return [...lines, line];
    }) : [
      ["Nem todo recomeço", "começa com uma vitória."],
      ["Solte o peso de ontem."],
      ["Perdoar não apaga", "o passado."],
      ["Mas abre espaço para a paz."],
      ["Dê mais um passo."],
      ["Recomeçar é coragem.", "Perdoar é liberdade."],
    ];
    signal.throwIfAborted();
    const stream = canvas.captureStream(15);
    let timer;
    let deadline;
    let abort;
    let recorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1800000 });
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      await new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = () => reject(new Error("Falha na gravação."));
        const duration = scenes.length * 3000;
        const start = performance.now();
        let lastProgress = -1;
        function draw() {
          const elapsed = Math.min(performance.now() - start, duration);
          const index = Math.min(scenes.length - 1, Math.floor(elapsed / 3000));
          const gradient = ctx.createLinearGradient(0, 0, 540, 960);
          gradient.addColorStop(0, ["#142b50", "#3a244e", "#193b44"][index % 3]);
          gradient.addColorStop(1, "#0b1429");
          ctx.fillStyle = gradient;
          ctx.fillRect(0, 0, 540, 960);
          if (photo) {
            const scale = Math.max(540 / photo.width, 960 / photo.height);
            const width = photo.width * scale, height = photo.height * scale;
            ctx.drawImage(photo, (540 - width) / 2, (960 - height) / 2, width, height);
            ctx.fillStyle = "rgba(0,0,0,.55)";
            ctx.fillRect(0, 0, 540, 960);
          }
          ctx.textAlign = "center";
          ctx.fillStyle = "#9dcfff";
          ctx.font = "bold 24px system-ui";
          ctx.fillText("ADL MÍDIA", 270, 96);
          ctx.fillStyle = "white";
          ctx.font = "bold 32px system-ui";
          scenes[index].forEach((line, row) => ctx.fillText(line, 270, 480 + (row - (scenes[index].length - 1) / 2) * 48, 460));
          ctx.fillStyle = "#8bbcff";
          ctx.fillRect(48, 885, 444 * elapsed / duration, 6);
          const progress = Math.min(100, Math.floor(elapsed / duration * 20) * 5);
          if (progress !== lastProgress) {
            lastProgress = progress;
            onProgress(progress);
          }
          return elapsed >= duration;
        }
        draw();
        recorder.start(500);
        abort = () => reject(signal.reason);
        signal.addEventListener("abort", abort, { once: true });
        deadline = setTimeout(() => reject(new Error("A gravação excedeu o tempo esperado.")), duration + 6000);
        timer = setInterval(() => {
          try {
            if (draw()) {
              clearInterval(timer);
              if (recorder.state !== "inactive") recorder.stop();
            }
          } catch (error) { reject(error); }
        }, 67);
      });
      const type = recorder.mimeType.split(";")[0] || mime.split(";")[0];
      const blob = new Blob(chunks, { type });
      if (blob.size < 1000) throw new Error("O arquivo saiu vazio.");
      return { blob, sceneCount: scenes.length, extension: type === "video/mp4" ? "mp4" : "webm" };
    } finally {
      clearInterval(timer);
      clearTimeout(deadline);
      if (abort) signal.removeEventListener("abort", abort);
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach(track => track.stop());
    }
  }

  function showPanel(areas, credential) {
    connectCommands(areas, credential);
    const list = document.getElementById("areas");
    list.replaceChildren();
    for (const area of areas) {
      const item = document.createElement("li");
      const heading = document.createElement("h2");
      heading.textContent = area.nome;
      const description = document.createElement("p");
      description.textContent = area.descricao;
      item.append(heading, description);
      if (area.url) {
        const link = document.createElement("a");
        link.href = area.url;
        link.textContent = area.rotulo ?? "Abrir " + area.nome;
        item.append(link);
      }
      list.append(item);
    }
    document.getElementById("entrada").hidden = true;
    document.getElementById("painel").hidden = false;
    document.getElementById("titulo-painel").focus();
  }
  window.addEventListener("load", () => {
    if (!window.google?.accounts?.id) {
      status.textContent = "Não foi possível carregar o login do Google.";
      return;
    }
    google.accounts.id.initialize({
      client_id: "${clientId}",
      callback: async ({ credential }) => {
        status.textContent = "Verificando acesso…";
        try {
          const result = await fetch("/painel", {
            headers: { Authorization: "Bearer " + credential },
            cache: "no-store",
          });
          if (result.ok) {
            showPanel((await result.json()).areas, credential);
            return;
          }
          status.textContent = result.status === 401 ? "Sessão Google inválida ou expirada (401). Tente entrar novamente."
            : result.status === 403 ? "Conta Google diferente da conta proprietária configurada (403)."
            : result.status === 503 ? "Serviço de validação indisponível ou configuração incompleta (503)."
            : "Falha na validação. Código HTTP: " + result.status + ".";
        } catch {
          status.textContent = "Não foi possível conectar ao Ion.";
        }
      },
    });
    google.accounts.id.renderButton(document.getElementById("google-login"), {
      theme: "outline", size: "large", text: "signin_with",
    });
  });
</script>
</html>`, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
      "Cross-Origin-Opener-Policy": "same-origin-allow-popups",
    },
  });
}
