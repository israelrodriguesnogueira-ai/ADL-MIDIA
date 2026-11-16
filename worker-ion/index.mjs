import { paginaExecutor } from "./executor-javascript.mjs";
import { caminhosSincronismo, scriptSincronismo } from "./catalogo-sincronismo.mjs";
import { protectOwnerRoute } from "../integracoes/ion-controle-dono.mjs";

const LIMITE_TEXTO_CONVERSA = 2000;
const LIMITE_MENSAGENS_RECENTES = 9;
const LIMITE_MENSAGENS_ANTERIORES = 8;
const LIMITE_MENSAGENS_CONVERSA = LIMITE_MENSAGENS_RECENTES + LIMITE_MENSAGENS_ANTERIORES;

function montarContextoDaConversa(conversa) {
  const mensagens = conversa.filter(entrada =>
    (entrada.who === "Você" || entrada.who === "Ion") && entrada.text.trim());
  const recentes = mensagens.slice(-LIMITE_MENSAGENS_RECENTES);
  const anteriores = mensagens.slice(0, -LIMITE_MENSAGENS_RECENTES);
  const inicio = anteriores.slice(0, LIMITE_MENSAGENS_ANTERIORES / 2);
  const retomada = anteriores.slice(inicio.length).slice(-LIMITE_MENSAGENS_ANTERIORES / 2);
  const selecionadas = inicio.concat(retomada, recentes);
  const limiteDasAnteriores = inicio.length + retomada.length;
  return selecionadas.map((entrada, indice) => ({
    role: entrada.who === "Você" ? "user" : "assistant",
    content: entrada.text.trim().slice(0, indice < limiteDasAnteriores ? 500 : LIMITE_TEXTO_CONVERSA),
  }));
}
const LIMITE_PERGUNTA_FOTO_CODIFICADA = 6000;

const ETAPAS_MUDANCA = [
  ["Preparar a alteração permitida", "Preparar a alteração"],
  ["Validar a proposta", "Rodar os testes"],
  ["Disponibilizar versão para revisão", "Disponibilizar a proposta"],
];
const API_GITHUB_AION = "https://api.github.com/repos/israelrodriguesnogueira-ai/ADL-MIDIA";
const WORKFLOW_MUDANCA = "ion-preparar-mudanca.yml";

async function statusMudanca(request, env, id) {
  if (request.method !== "GET") return new Response(null, { status: 405, headers: { Allow: "GET" } });
  const dono = env.ION_OWNER_EMAIL?.trim().toLowerCase();
  const audiencia = env.ION_GOOGLE_CLIENT_ID?.trim();
  if (!dono?.endsWith("@gmail.com") || !/^[a-z0-9-]+\.apps\.googleusercontent\.com$/.test(audiencia ?? "")) {
    return Response.json({ erro: "Autenticação não configurada." }, { status: 503 });
  }
  return protectOwnerRoute({
    owner: { issuer: GOOGLE_ISSUER, subject: dono },
    verifySession: () => verifyGoogleIdentity(request, audiencia),
    audit: ({ actor, ...event }) => console.warn(JSON.stringify(event)),
    action: "acompanhar_mudanca_aion",
    resource: "ion",
  }, async () => {
    const token = env.ION_GITHUB_ACTIONS_TOKEN;
    if (!token) return Response.json({ erro: "Integração indisponível." }, { status: 503 });
    const buscar = (rota, autenticar = true) => fetch(API_GITHUB_AION + rota, {
      headers: {
        ...(autenticar ? { Authorization: "Bearer " + token } : {}),
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "ION-Owner-Worker",
      },
      signal: AbortSignal.timeout(8000),
    });
    try {
      const [resposta, jobs] = await Promise.all([
        buscar("/actions/runs/" + id),
        buscar("/actions/runs/" + id + "/jobs"),
      ]);
      if (!resposta.ok || !jobs.ok) throw new Error("GitHub indisponível");
      const execucao = await resposta.json();
      if (execucao.path?.split("@")[0] !== ".github/workflows/" + WORKFLOW_MUDANCA) {
        return Response.json({ erro: "Execução indisponível." }, { status: 404 });
      }
      const dadosJobs = await jobs.json();
      const etapas = dadosJobs.jobs?.find(job => job.name === "proposta")?.steps ?? [];
      let tentativaParaRevisao = null;
      if (execucao.conclusion === "success" && Number.isSafeInteger(execucao.run_attempt) && execucao.run_attempt > 0) {
        const branch = "aion/proposta-interface-" + id + "-" + execucao.run_attempt;
        const ref = await buscar("/git/ref/heads/" + branch, false).catch(() => null);
        if (ref?.ok) tentativaParaRevisao = execucao.run_attempt;
      }
      return Response.json({
        concluida: execucao.status === "completed",
        conclusao: execucao.conclusion,
        etapas: ETAPAS_MUDANCA.map(([codigo, titulo]) => {
          const etapa = etapas.find(passo => passo.name === codigo);
          const status = etapa?.status === "completed"
            ? (etapa.conclusion === "success" ? "concluída" : etapa.conclusion === "skipped" ? "não executada" : "interrompida")
            : etapa?.status === "in_progress" ? "em andamento" : "aguardando";
          return { titulo, status };
        }),
        tentativaParaRevisao,
      }, { headers: { "Cache-Control": "no-store" } });
    } catch {
      return Response.json({ erro: "Status temporariamente indisponível." }, { status: 502 });
    }
  })(request);
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (path === "/executor-javascript" && request.method === "GET") return paginaExecutor();
    if (path === "/api/conversa") return responderConversa(request, env);
    if (path === "/api/foto") return analisarFoto(request, env);
    const consultaMudanca = path.match(/^\/api\/mudancas\/leitura\/([1-9][0-9]{0,15})$/);
    if (consultaMudanca) return statusMudanca(request, env, consultaMudanca[1]);
    const bento = path === "/api/video/bento";
    const prepararMudanca = path === "/api/mudancas/leitura";
    if (prepararMudanca || bento || path === "/api/video/transito") {
      const workflow = prepararMudanca ? WORKFLOW_MUDANCA : bento ? "ion-animacao-bento.yml" : "ion-video-gratuito.yml";
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
        action: prepararMudanca ? "preparar_mudanca_leitura" : "solicitar_video_transito",
        resource: "ion",
      }, async () => {
        const token = env.ION_GITHUB_ACTIONS_TOKEN;
        if (!token) return Response.json({ erro: "Integração com GitHub Actions indisponível." }, { status: 503 });
        const dispatch = { ref: "main" };
        if (prepararMudanca) {
          const body = await request.text();
          let ajuste, valor;
          try {
            if (body.length <= 100) {
              const dados = JSON.parse(body);
              ajuste = dados.ajuste ?? "velocidade";
              valor = dados.valor ?? dados.velocidade;
            }
          } catch {}
          const permitidos = new Map([
            ["velocidade", ["0.75", "1", "1.25", "1.5", "2"]],
            ["icones", ["14", "16", "18", "20"]],
            ["historico", ["800", "900", "1024"]],
          ]);
          if (!permitidos.get(ajuste)?.includes(valor)) {
            return Response.json({ erro: "Ajuste ou valor indisponível." }, { status: 400 });
          }
          dispatch.inputs = ajuste === "velocidade" ? { ajuste, velocidade: valor } : { ajuste, valor };
          dispatch.return_run_details = true;
        }
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
            body: JSON.stringify(dispatch),
            signal: AbortSignal.timeout(10000),
          });
        } catch {
          return Response.json({ erro: "Não foi possível acionar a tarefa." }, { status: 502 });
        }
        let idDaExecucao = null;
        let acompanhamento = "https://github.com/israelrodriguesnogueira-ai/ADL-MIDIA/actions/workflows/" + workflow;
        if (prepararMudanca && result.status === 200) {
          const execucao = await result.json().catch(() => null);
          if (Number.isSafeInteger(execucao?.workflow_run_id) && execucao.workflow_run_id > 0) {
            idDaExecucao = execucao.workflow_run_id;
            acompanhamento = "https://github.com/israelrodriguesnogueira-ai/ADL-MIDIA/actions/runs/" + idDaExecucao;
          }
        } else if (result.status !== 204) {
          console.warn(JSON.stringify({ event: "ion.workflow_dispatch_failed", workflow, status: result.status }));
          return Response.json({ erro: "O GitHub não aceitou a solicitação.", codigo: result.status }, { status: 502 });
        }
        return Response.json({
          status: "solicitado",
          detalhe: prepararMudanca
            ? "Preparação solicitada. Confira os testes no resumo da execução."
            : "Workflow acionado. O MP4 ainda precisa ser gerado e validado.",
          acompanhamento,
          ...(prepararMudanca ? { idDaExecucao } : {}),
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
          { nome: "Código-fonte do Aion", descricao: "Cópia ZIP da versão usada pelo Aion.", rotulo: "Baixar código do Aion", url: "https://codeload.github.com/israelrodriguesnogueira-ai/ADL-MIDIA/zip/refs/heads/ion/controle-dono" },
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
    if (!pergunta || pergunta.length > LIMITE_PERGUNTA_FOTO_CODIFICADA) return json({ erro: "Pergunta inválida." }, 400);
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
        return json({ erro: "O Cloudflare limitou o uso do modelo. O Aion continua no plano gratuito." }, 429);
      }
      return json({ erro: "O Cloudflare não concluiu a análise da foto." }, 502);
    }
  })(request);
}

function normalizarPedido(texto) {
  return texto.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function tipoDeProducao(texto, projeto) {
  const pedido = normalizarPedido(texto);
  const temaMusical = /\b(?:cantiga|cancao|musica|melodia|jingle|jingles|jingo|vinheta|trilha sonora)\b/.test(pedido)
    || /\baudio\b.*\b(?:letra|musical|cantad[oa]|refr[aã]o)\b/.test(pedido);
  const temaVideo = /\b(?:video|short|storyboard|animacao)\b/.test(pedido);
  const criacao = /\b(?:cri[ae]|criar|faca|faz|fazer|ger[ae]|gerar|produz[ae]|produzir|quero|preciso|gostaria|mont[ae]|planeje|componh[ae]|compor|elabore|prepare|personalize|proposta)\b/.test(pedido);
  const revisao = /\b(?:ajust[ae]|corrij[ae]|corrige|mud[ae]|mud[eoa]r|troc[ae]|troque|revise|refaca|melhore|mantenha|coloque|coloca|poe|inclua|adicione|acrescent[ae]|tir[ae]|remov[ae]|retir[ae]|mais (?:rapido|lento|alegre)|sem (?:voz|letra))\b/.test(pedido);
  if (/\b(?:so|somente|apenas) (?:o codigo|um codigo|a letra|uma letra|uma explicacao)\b/.test(pedido)) return null;
  if ((criacao || revisao) && temaVideo) return "video";
  if (revisao && projeto === "video" && !criacao) return "video";
  if ((criacao || revisao) && temaMusical) return "musica";
  return revisao ? projeto : null;
}

function aprovacaoProducao(texto) {
  const pedido = normalizarPedido(texto).replace(/[“”"‘’.,!?:]/g, " ").trim().replace(/\s+/g, " ");
  const instrucao = pedido.replace(/^(?:aion|ion|ariel) /, "")
    .replace(/^(?:ok|sim|certo|beleza) /, "")
    .replace(/^(?:eu )?(?:quero|preciso) que (?:voce )?/, "")
    .replace(/ (?:agora|por favor)$/, "");
  return /^(?:aprovo|aprovado|execute|executar|pode (?:executar|criar|gerar|produzir|fazer|seguir|continuar|dar (?:sequencia|andamento))|vai em frente|manda ver)(?: (?:isso|a proposta|o roteiro|o video|o jingle|a musica|a melodia|o audio))?(?: agora)?$/.test(instrucao);
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
  const bytes = new Uint8Array(dados.buffer);
  const encoder = new TextEncoder();
  bytes.set(encoder.encode("RIFF"), 0);
  dados.setUint32(4, dados.byteLength - 8, true);
  bytes.set(encoder.encode("WAVEfmt "), 8);
  dados.setUint32(16, 16, true);
  dados.setUint16(20, 1, true);
  dados.setUint16(22, 1, true);
  dados.setUint32(24, taxa, true);
  dados.setUint32(28, taxa * 2, true);
  dados.setUint16(32, 2, true);
  dados.setUint16(34, 16, true);
  bytes.set(encoder.encode("data"), 36);
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

function duracaoSolicitada(texto) {
  if (/\bmeia hora\b/i.test(texto)) return 1800;
  const match = texto.match(/\b(\d{1,4})\s*(segundos?|minutos?)\b/i);
  return match ? Number(match[1]) * (match[2].toLowerCase().startsWith("minuto") ? 60 : 1) : null;
}

function videoValido(p) {
  return p && typeof p.titulo === "string" && p.titulo.trim() && p.titulo.length <= 100
    && Array.isArray(p.cenas) && p.cenas.length >= 1 && p.cenas.length <= 16
    && p.cenas.every(c => c && Number.isInteger(c.segundos) && c.segundos > 0 && c.segundos <= 3600
      && typeof c.visual === "string" && c.visual.trim() && c.visual.length <= 500
      && typeof c.fala === "string" && c.fala.length <= 500
      && typeof c.legenda === "string" && c.legenda.trim() && c.legenda.length <= 100);
}

function textoRoteiro(p) {
  let inicio = 0;
  return p.titulo + "\n\n" + p.cenas.map((c, i) => {
    const fim = inicio + c.segundos;
    const linha = (i + 1) + ". " + inicio + "–" + fim + " s · " + c.legenda
      + "\nCena: " + c.visual + (c.fala ? "\nFala ou narração: " + c.fala : "");
    inicio = fim;
    return linha;
  }).join("\n\n");
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
    if (body.length > 48000) return Response.json({ erro: "Mensagem muito longa." }, { status: 413 });
    let mensagens, ultimaPartitura, ultimoVideo;
    try { ({ mensagens, ultimaPartitura, ultimoVideo } = JSON.parse(body)); } catch {
      return Response.json({ erro: "Solicitação inválida." }, { status: 400 });
    }
    if (!Array.isArray(mensagens) || !mensagens.length || mensagens.length > LIMITE_MENSAGENS_CONVERSA
        || mensagens.some(m => !m || !["user", "assistant"].includes(m.role)
          || typeof m.content !== "string" || !m.content.trim() || m.content.length > LIMITE_TEXTO_CONVERSA)
        || mensagens.at(-1).role !== "user") {
      return Response.json({ erro: "Histórico de conversa inválido." }, { status: 400 });
    }
    if (ultimaPartitura != null && !partituraValida(ultimaPartitura)) {
      return Response.json({ erro: "A versão musical anterior é inválida." }, { status: 400 });
    }
    if (ultimoVideo != null && !videoValido(ultimoVideo)) {
      return Response.json({ erro: "O roteiro anterior é inválido." }, { status: 400 });
    }
    const previsao = await consultarPrevisao(mensagens);
    if (previsao) return Response.json({ texto: previsao }, { headers: { "Cache-Control": "no-store" } });
    if (!env.ION_AI || env.ION_VISION_FREE_ENABLED !== "true") {
      return Response.json({ erro: "Modelo de conversa aguardando ativação no plano gratuito." }, { status: 503 });
    }
    const pedido = mensagens.at(-1).content;
    const anterior = mensagens.at(-3)?.role === "user" ? mensagens.at(-3).content : "";
    const recuperandoMusica = aprovacaoProducao(pedido) && tipoDeProducao(anterior) === "musica";
    const projeto = ultimoVideo ? "video" : ultimaPartitura ? "musica" : null;
    const tipo = recuperandoMusica ? "musica" : tipoDeProducao(pedido, projeto);
    const trabalhoMusical = tipo === "musica";
    const trabalhoVideo = tipo === "video";
    const duracao = duracaoSolicitada(pedido)
      ?? (ultimoVideo ? ultimoVideo.cenas.reduce((total, cena) => total + cena.segundos, 0) : null);
    const instrucaoVideo = trabalhoVideo
      ? " Se o usuário pedir criação ou revisão de um vídeo ou roteiro de vídeo, proponha um roteiro no formato JSON puro: "
        + "{\"acao\":\"roteiro_video\",\"titulo\":\"…\",\"cenas\":[{\"segundos\":3,\"visual\":\"O que se vê e o que acontece\",\"fala\":\"Fala ou narração\",\"legenda\":\"Texto curto na tela\"}]}. "
        + "Adapte a linguagem à idade do público. Use até 16 cenas ou blocos, com 500 caracteres por campo de visual e fala e 100 para legenda. "
        + "Use fala vazia nas cenas em que o usuário pedir sem narração. Para vídeos longos, descreva as ações e falas principais de cada bloco de modo que o roteiro possa ser expandido e produzido."
        + (duracao != null ? " A soma exata das durações deve ser " + duracao + " segundos." : " Escolha uma duração adequada.")
        + (ultimoVideo ? " Preserve as partes aprovadas e revise apenas o que foi pedido neste roteiro: " + JSON.stringify(ultimoVideo) : "")
      : "";
    const instrucaoMusical = trabalhoMusical
      ? " Quando o pedido for criar ou revisar um jingle, uma música, uma cantiga, uma canção ou uma melodia, devolva a partitura estruturada abaixo. Inclua o título, a letra, o ritmo e as notas. A interface mostra a proposta e espera pela aprovação. "
        + "Responda somente com JSON: {\"acao\":\"melodia\",\"titulo\":\"…\",\"letra\":\"…\",\"bpm\":100,\"notas\":[[60,1],[62,1],[64,1],[67,1],[67,1],[64,1],[62,1],[60,2]]}. "
        + "Cada par é [nota MIDI 45 a 86 ou 0 para pausa, duração em tempos 0.25, 0.5, 1, 1.5 ou 2]. Use 8 a 24 notas, bpm entre 55 e 170 e letra original curta. "
        + "Em revisões, preserve o que o usuário não pediu para mudar. A amostra é instrumental e a letra aparece como texto. "
        + "Se pedirem voz cantada ou criticarem a voz e uma gravação própria permitir avançar, responda somente com {\"acao\":\"pedir_gravacao\"}. "
        + (ultimaPartitura ? " A última versão é " + JSON.stringify(ultimaPartitura) + "." : "")
      : "";
    const instrucaoConversa = "Você é o Aion. Responda em português brasileiro. Em pedidos de continuidade, use o projeto que o usuário indicou, preserve as decisões dele e retome a última etapa sustentada pelo histórico. Distinga etapas concluídas de propostas e use as correções mais recentes. Peça só o dado que faltar para avançar. ";
    const orientacaoGeral = "Comece pelo resultado solicitado. Em perguntas simples, responda em poucas frases. Quando pedirem detalhes ou um artefato, entregue o conteúdo necessário. Gere código somente se ele pedir explicitamente código, programação ou um arquivo-fonte. Se o usuário pedir um arquivo final ou a execução de uma tarefa, use a capacidade disponível. Quando faltar uma informação indispensável, faça uma pergunta curta e específica. Quando pedirem código, use um bloco identificado pela linguagem. "
            + "A interface do Aion pode ler respostas em voz alta. Quando perguntarem como ouvir uma resposta, indique o botão de alto-falante abaixo dela ou o comando \"Leia a última resposta\". Nunca afirme que a reprodução começou sem confirmação da interface. "
            + "Para manutenção automotiva, diferencie correia dentada, que sincroniza virabrequim e comando de válvulas, da correia de acessórios, que pode acionar o alternador. "
            + "Para marcas de sincronismo, torques e procedimentos específicos, só dê instruções fundamentadas em documentação técnica aplicável. Se ela não estiver disponível na conversa, peça modelo, ano, código do motor e o manual ou a página relevante. "
            + "Só confirme ações após receber o resultado do sistema. Blocos marcados como javascript ou js podem ser executados pelo usuário no navegador com o botão Executar JavaScript. Quando pedirem código executável no chat, use JavaScript independente, sem bibliotecas ou rede, e mostre o resultado com console.log ou return. Se pedirem para instalar dependências ou executar testes de um projeto, informe que esse executor roda somente JavaScript local. Nunca invente logs, artefatos, links de download ou resultados de testes. Comandos como “Prepare a velocidade padrão da leitura em 1,25x”, “Prepare os ícones em 14 px” e “Prepare o histórico lateral a partir de 800 px” solicitam ajustes para revisão. Só diga que o teste passou se o resultado for confirmado. A publicação requer aprovação no GitHub. Se pedirem para implantar uma nova voz ou alterar a interface, explique o que é possível configurar agora e só confirme mudanças retornadas pelo sistema. Para trocar a voz de leitura disponível, indique Histórico de conversas → Voz de leitura.";
    const instrucaoProducao = instrucaoMusical + instrucaoVideo
      + " Entregue somente a proposta em JSON válido. O Aion usa a proposta para gerar um arquivo após a aprovação. "
      + "Se o pedido for de produção, entregue todos os campos do formato pedido, sem código de exemplo ou tutoriais."
      + (recuperandoMusica ? " Recupere o jingle que o usuário acaba de aprovar. Preserve a letra e o título que já aparecem na conversa." : "");
    try {
      const entrada = {
        ...(tipo ? { response_format: { type: "json_object" } } : {}),
        messages: [{
          role: "system",
          content: instrucaoConversa + (tipo ? instrucaoProducao : orientacaoGeral),
        }, ...mensagens.map(({ role, content }) => ({ role, content }))],
        max_tokens: trabalhoVideo ? 2200 : 1000,
      };
      let resposta = await env.ION_AI.run("@cf/meta/llama-3.1-8b-instruct-fast", entrada);
      const lerProposta = valor => {
        if (valor && typeof valor === "object" && !Array.isArray(valor)) return valor;
        if (typeof valor !== "string" || valor.length > 12000) return null;
        try { return JSON.parse(valor.trim().replace(/^```(?:json)?\s*|\s*```$/gi, "")); }
        catch { return null; }
      };
      const propostaValida = proposta => trabalhoMusical
        ? proposta?.acao === "pedir_gravacao" || (proposta?.acao === "melodia" && partituraValida(proposta))
        : proposta?.acao === "roteiro_video" && videoValido(proposta)
          && (duracao == null || proposta.cenas.reduce((soma, cena) => soma + cena.segundos, 0) === duracao);
      let producao = tipo ? lerProposta(resposta?.response) : null;
      if (tipo && !propostaValida(producao)) {
        entrada.messages[0].content += " Refaça a proposta inteira e confira todos os campos antes de responder. Use o esquema JSON fornecido.";
        resposta = await env.ION_AI.run("@cf/meta/llama-3.1-8b-instruct-fast", entrada);
        producao = lerProposta(resposta?.response);
      }
      const texto = resposta?.response;
      const textoValido = typeof texto === "string" && texto.trim() && texto.length <= 12000;
      const headers = { "Cache-Control": "no-store" };
      if (trabalhoVideo && producao?.acao === "roteiro_video") {
        if (!videoValido(producao) || (duracao != null
            && producao.cenas.reduce((total, cena) => total + cena.segundos, 0) !== duracao)) {
          return Response.json({ erro: "O roteiro saiu incompleto ou com duração diferente. Peça para tentar de novo." }, { status: 502, headers });
        }
        const { titulo, cenas } = producao;
        return Response.json({ roteiroVideo: { titulo, cenas } }, { headers });
      }
      if (trabalhoMusical && producao?.acao === "pedir_gravacao") {
        return Response.json({ pedirGravacao: true }, { headers });
      }
      if (trabalhoMusical && producao?.acao === "melodia") {
        if (!partituraValida(producao)) {
          return Response.json({ erro: "A prévia musical saiu incompleta. Você pode pedir para eu tentar de novo." }, { status: 502, headers });
        }
        const { titulo, letra, bpm, notas } = producao;
        return Response.json({ partitura: { titulo, letra, bpm, notas } }, { headers });
      }
      if (tipo) {
        console.warn(JSON.stringify({ event: "ion.production_proposal_missing" }));
        return Response.json({ erro: "Não consegui montar uma proposta executável para esse pedido. Envie o pedido novamente para eu tentar de novo." }, { status: 502, headers });
      }
      if (!textoValido) throw new Error("invalid_response");
      return Response.json({ texto }, { headers });
    } catch {
      console.warn(JSON.stringify({ event: "ion.conversation_model_unavailable" }));
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
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="theme-color" content="#101827">
<title>Aion</title>
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
  .ion-top { display: flex; align-items: center; gap: .5rem; }
  .ion-top h1 { flex: 1; margin: 0; font-size: 1.25rem; }
  .ion-top button, .ion-compose button, #ion-menu button, #anexos-ion button { border-radius: 999px; border: 1px solid #3b4b66; background: #19253a; color: #f3f6fc; }
  #enviar-ion { padding: 0 .7rem; }
  #conversa-ion { flex: 1; max-height: 62dvh; }
  #comando-ion { position: sticky; bottom: 0; background: #101827; padding: .6rem 0 max(.6rem, env(safe-area-inset-bottom)); margin: 0; }
  #ajuda-ion, #anexo-status { margin: 0; font-size: .85rem; }
  #ion-menu { position: fixed; inset: 0 auto 0 0; margin: 0; width: min(85vw, 24rem); height: 100dvh; max-height: 100dvh; box-sizing: border-box; border: 1px solid #3b4b66; background: #101827; color: #f3f6fc; padding: 1rem; }
  #ion-menu::backdrop, #seguranca-aion::backdrop { background: #0009; }
  #seguranca-aion { box-sizing: border-box; width: min(34rem, calc(100% - 1.5rem)); max-height: 90%; padding: 1rem; border: 1px solid #3b4b66; border-radius: 1rem; background: #101827; color: inherit; }
  #seguranca-aion h2 { margin: 0; font-size: 1.2rem; }
  #seguranca-aion fieldset { display: grid; gap: .45rem; margin: 0 0 1rem; border: 1px solid #3b4b66; border-radius: .65rem; }
  #seguranca-aion label { margin-top: .35rem; }
  #seguranca-aion select, #seguranca-aion button { min-height: 44px; font: inherit; }
  #seguranca-aion select { width: 100%; background: #19253a; color: inherit; }
  #seguranca-aion button { border: 1px solid #3b4b66; border-radius: .65rem; background: #19253a; color: inherit; }
  #seguranca-aion button[type="submit"] { color: #101827; background: #a8d1ff; }
  #seguranca-relatorio { white-space: pre-wrap; overflow-wrap: anywhere; font: inherit; line-height: 1.45; }
  #historico-ion { padding: 0; }
  #historico-ion li { padding: 0; border: 0; background: transparent; }
  #historico-ion button { width: 100%; text-align: left; overflow-wrap: anywhere; border-radius: .75rem; }
  #historico-ion button[aria-current="true"] { background: #243a55; border-color: #a8d1ff; }
  #ion-menu { overflow: auto; padding-bottom: max(1rem, env(safe-area-inset-bottom)); }
  @media (min-width: 900px) {
    main:has(#painel:not([hidden])) { max-width: 86rem; }
    #painel:not([hidden]):has(#ion-menu[open]) {
      display: grid; grid-template-columns: 16rem minmax(0, 1fr);
      grid-template-rows: auto auto minmax(0, 1fr) auto;
      column-gap: 1rem;
    }
    #painel:has(#ion-menu[open]) > .ion-top { grid-area: 1 / 2; }
    #painel:has(#ion-menu[open]) > #leitura-ion { grid-area: 2 / 2; }
    #painel:has(#ion-menu[open]) > #conversa-ion { grid-area: 3 / 2; }
    #painel:has(#ion-menu[open]) > #comando-ion { grid-area: 4 / 2; }
    #ion-menu[open] { grid-area: 1 / 1 / 5 / 2; position: static; width: auto; height: auto; max-height: none; border-radius: 1rem; }
  }
  #anexos-ion:not([hidden]) { display: flex; gap: .5rem; flex-wrap: wrap; }
  .ion-label { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
  #painel:not([hidden]) { height: max(0px, calc(var(--ion-altura-visivel, 100dvh) - .75rem)); min-height: 0; }
  #leitura-ion:not([hidden]) { display: flex; flex-shrink: 0; align-items: center; gap: .25rem; padding: .25rem; border-radius: 1rem; background: #19253a; }
  #leitura-ion audio { flex: 1; min-width: 0; height: 44px; }
  #leitura-ion button { justify-content: center; flex: 0 0 44px; padding: 0; border: 0; border-radius: .75rem; background: transparent; color: inherit; }
  #leitura-ion #leitura-usar-aparelho { flex: 0 1 auto; padding: 0 .5rem; font-size: .8rem; }
  #leitura-status { flex: 1; min-width: 0; margin: 0; padding: .25rem .5rem; font-size: .88rem; overflow-wrap: anywhere; }
  #comando-ion { padding-bottom: max(.6rem, env(safe-area-inset-bottom)); }
  #anexo-status:empty, #ajuda-ion:empty { display: none; }
  .ion-top { padding: .35rem 0; flex-shrink: 0; }
  #conversa-ion { min-height: 0; max-height: none; align-content: start; overscroll-behavior: contain; }
  #conversa-ion li { border: 0; background: transparent; padding: .75rem; }
  #conversa-ion .msg-user { justify-self: end; max-width: 88%; background: #243a55; }
  #comando-ion { position: static; flex-shrink: 0; }
  .ion-compose { display: flex; align-items: flex-end; gap: .15rem; border: 1px solid #3b4b66; background: #151f31; border-radius: 1.65rem; padding: .2rem; }
  .ion-compose #pedido-ion { flex: 1; min-width: 0; min-height: 44px; max-height: min(32dvh, 12rem); margin: 0; padding: .65rem .2rem; border: 0; resize: none; field-sizing: content; background: transparent; color: inherit; font-size: 16px; line-height: 1.4; }
  .ion-compose button { display: inline-grid; place-items: center; width: 44px; height: 44px; min-width: 44px; padding: 0; flex-shrink: 0; border: 0; background: transparent; }
  .ion-compose button svg { width: 23px; height: 23px; }
  #gravar-audio, #enviar-ion { background: #4061e8; color: white; }
  #voz-ion[aria-pressed="true"], #gravar-audio[aria-pressed="true"] { background: #8b3030; color: white; }
  #cancelar-video { background: #8b3030; color: white; }
  button[hidden], .ion-compose button[hidden] { display: none; }
  .ion-resposta-acoes:not([hidden]) { display: flex; gap: .25rem; flex-wrap: wrap; align-items: center; margin-top: .4rem; }
  .ion-resposta-acoes button, .ion-resposta-acoes summary { min-height: 44px; min-width: 40px; border-radius: .5rem; border: 0; background: transparent; color: #bac8da; padding: 0 .35rem; justify-content: center; cursor: pointer; }
  .ion-resposta-acoes summary { display: flex; list-style: none; }
  .ion-resposta-acoes summary::-webkit-details-marker { display: none; }
  .ion-resposta-acoes button:hover, .ion-resposta-acoes [aria-pressed="true"] { background: #243a55; color: #f3f6fc; }
  .ion-resposta-acoes svg { width: 16px; height: 16px; }
  .ion-acoes-dialog { width: min(22rem, calc(100% - 2rem)); max-height: 75dvh; box-sizing: border-box; padding: .75rem; border: 1px solid #3b4b66; border-radius: 1rem; background: #19253a; color: #f3f6fc; }
  .ion-acoes-dialog::backdrop { background: #0009; }
  .ion-acoes-dialog button { width: 100%; text-align: left; justify-content: start; padding: 0 .75rem; }
  #leitura-velocidade { min-height: 44px; max-width: 4rem; background: #19253a; color: inherit; border: 0; font: inherit; }
  .ion-resposta-votos { display: inline-flex; }
</style>
<main>
  <section id="entrada">
  <h1>Validar acesso ao Aion</h1>
  <div id="google-login"></div>
  <p id="status" role="status">Entre com sua Conta Google.</p>
  </section>
  <section id="painel" hidden>
    <header class="ion-top">
      <button id="menu-ion" type="button" aria-label="Histórico de conversas" aria-controls="ion-menu" aria-expanded="false">☰</button>
      <h1 id="titulo-painel" tabindex="-1">Aion</h1>
      <button id="novo-ion" type="button">Nova conversa</button>
    </header>
    <section id="leitura-ion" aria-label="Leitura da resposta" hidden>
      <p id="leitura-status" role="status"></p>
      <button id="leitura-voltar" type="button" aria-label="Voltar 15 segundos" title="Voltar 15 segundos" hidden>−15</button>
      <button id="leitura-avancar" type="button" aria-label="Avançar 15 segundos" title="Avançar 15 segundos" hidden>+15</button>
      <select id="leitura-velocidade" aria-label="Velocidade da leitura" hidden>
        <option value="0.75">0,75×</option><option value="1" selected>1×</option><option value="1.25">1,25×</option><option value="1.5">1,5×</option><option value="2">2×</option>
      </select>
      <button id="leitura-pausa" type="button" aria-label="Pausar leitura" hidden>Ⅱ</button>
      <button id="leitura-usar-aparelho" type="button" hidden>Usar voz do aparelho</button>
      <button id="leitura-fechar" type="button" aria-label="Encerrar leitura" title="Encerrar leitura">×</button>
    </section>
    <dialog id="ion-menu" aria-labelledby="historico-titulo">
      <div class="ion-top"><h2 id="historico-titulo">Conversas</h2><button id="fechar-menu" type="button">Fechar</button></div>
      <ul id="historico-ion"></ul>
      <button id="limpar-ion" type="button">Limpar histórico local</button>
      <details><summary>Áreas do Aion</summary><ul id="areas"></ul></details>
      <div id="preferencia-voz-ion" hidden>
        <label for="voz-leitura-ion">Voz de leitura</label>
        <select id="voz-leitura-ion"></select>
      </div>
      <button id="abrir-seguranca" type="button">Segurança Wi-Fi e Bluetooth</button>
      <button id="sair" type="button">Sair</button>
    </dialog>
    <dialog id="seguranca-aion" aria-labelledby="seguranca-titulo">
      <div class="ion-top">
        <h2 id="seguranca-titulo">Segurança Wi-Fi e Bluetooth</h2>
        <button id="fechar-seguranca" type="button">Fechar</button>
      </div>
      <p>Marque as configurações dos seus equipamentos. As respostas ficam nesta página e você pode baixar o relatório.</p>
      <form id="seguranca-form">
        <fieldset>
          <legend>Wi-Fi</legend>
          <label for="seguranca-0">Proteção da rede</label>
          <select id="seguranca-0" name="resposta-0">
            <option value="">Não sei</option>
            <option value="0">WPA3</option>
            <option value="1">WPA2-AES ou modo misto WPA2/WPA3</option>
            <option value="2">Rede aberta, WEP, WPA antigo ou TKIP</option>
            <option value="na">Não se aplica</option>
          </select>
          <label for="seguranca-1">WPS</label>
          <select id="seguranca-1" name="resposta-1">
            <option value="">Não sei</option>
            <option value="0">Desativado</option>
            <option value="1">Ativado</option>
            <option value="na">Não se aplica</option>
          </select>
          <label for="seguranca-2">Atualizações do roteador</label>
          <select id="seguranca-2" name="resposta-2">
            <option value="">Não sei</option>
            <option value="0">Em dia</option>
            <option value="1">Pendentes</option>
            <option value="2">Roteador sem suporte</option>
            <option value="na">Não se aplica</option>
          </select>
        </fieldset>
        <fieldset>
          <legend>Bluetooth</legend>
          <label for="seguranca-3">Dispositivos pareados</label>
          <select id="seguranca-3" name="resposta-3">
            <option value="">Não sei</option>
            <option value="0">Reconheço e uso todos</option>
            <option value="1">Há dispositivos desconhecidos</option>
            <option value="2">Há dispositivos sem uso</option>
            <option value="na">Não se aplica</option>
          </select>
          <label for="seguranca-4">Visibilidade para novos aparelhos</label>
          <select id="seguranca-4" name="resposta-4">
            <option value="">Não sei</option>
            <option value="0">Somente durante o pareamento ou Bluetooth desligado</option>
            <option value="1">Visível o tempo todo</option>
            <option value="na">Não se aplica</option>
          </select>
        </fieldset>
        <button type="submit">Gerar relatório</button>
      </form>
      <pre id="seguranca-relatorio" tabindex="-1" hidden></pre>
      <button id="baixar-seguranca" type="button" hidden>Baixar relatório</button>
    </dialog>
    <ul id="conversa-ion" role="log" aria-label="Conversa com o Aion"></ul>
    <form id="comando-ion">


      <div class="ion-compose">
        <button id="mais-ion" type="button" aria-label="Anexar câmera, fotos ou arquivos" aria-expanded="false" aria-controls="anexos-ion" title="Anexar">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
        </button>
        <label for="pedido-ion" class="ion-label">Mensagem para o Aion</label>
        <textarea id="pedido-ion" rows="1" placeholder="Mensagem para o Aion" maxlength="${LIMITE_TEXTO_CONVERSA}"></textarea>
        <button id="voz-ion" type="button" aria-label="Iniciar ditado em português" title="Ditar uma mensagem de texto" aria-pressed="false">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v4"/></svg>
        </button>
        <button id="gravar-audio" type="button" aria-label="Gravar áudio para enviar" aria-pressed="false" title="Gravar áudio">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M3 9v6m4-9v12m5-15v18m5-15v12m4-9v6"/></svg>
        </button>
        <button id="enviar-ion" type="submit" aria-label="Enviar mensagem" title="Enviar" hidden>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg>
        </button>
      </div>
      <button id="cancelar-video" type="button" hidden>Parar</button>
      <div id="anexos-ion" hidden>
        <button id="escolher-camera" type="button">Câmera</button>
        <button id="escolher-foto" type="button">Fotos</button>
        <button id="escolher-arquivo" type="button">Arquivos</button>
        <button id="escolher-audio" type="button">Anexar áudio</button>
      </div>
      <input type="file" id="camera-ion" accept="image/*" capture="environment" hidden>
      <input type="file" id="foto-ion" accept="image/*" hidden>
      <input type="file" id="arquivo-ion" accept="image/*,audio/*,.m4a,.mp3,.wav,.ogg,.webm,.txt,text/plain" hidden>
      <input type="file" id="audio-ion" accept="audio/*,.m4a,.mp3,.wav,.ogg,.opus,.webm,.aac,.flac,.amr,.3ga" hidden>
      <p id="anexo-status" role="status"></p>
      <p id="ajuda-ion" role="status"></p>
    </form>
  </section>
</main>
<script src="https://accounts.google.com/gsi/client" defer></script>
<script>
  const caminhosSincronismo = ${JSON.stringify(caminhosSincronismo)};
  ${scriptSincronismo}
  const LIMITE_TEXTO_CONVERSA = ${LIMITE_TEXTO_CONVERSA};
  const LIMITE_MENSAGENS_RECENTES = ${LIMITE_MENSAGENS_RECENTES};
  const LIMITE_MENSAGENS_ANTERIORES = ${LIMITE_MENSAGENS_ANTERIORES};
  ${montarContextoDaConversa.toString()}
  ${partituraValida.toString()}
  ${videoValido.toString()}
  ${textoRoteiro.toString()}
  ${normalizarPedido.toString()}
  ${tipoDeProducao.toString()}
  ${aprovacaoProducao.toString()}
  ${gerarMelodia.toString()}
  ${codificarWav.toString()}
  ${tratarGravacao.toString()}
  const status = document.getElementById("status");
  document.getElementById("sair").addEventListener("click", () => window.location.reload());

  const seguranca = document.getElementById("seguranca-aion");
  const formularioSeguranca = document.getElementById("seguranca-form");
  const relatorioSeguranca = document.getElementById("seguranca-relatorio");
  const baixarSeguranca = document.getElementById("baixar-seguranca");

  document.getElementById("abrir-seguranca").onclick = () => seguranca.showModal();
  document.getElementById("fechar-seguranca").onclick = () => seguranca.close();
  formularioSeguranca.onchange = () => {
    relatorioSeguranca.hidden = baixarSeguranca.hidden = true;
  };
  formularioSeguranca.onsubmit = event => {
    event.preventDefault();
    const respostas = new FormData(formularioSeguranca);
    const regras = [
      ["Wi-Fi · Proteção da rede","Confira o modo de segurança nas configurações do roteador.",[null,["Melhoria","Use WPA3 quando o roteador e os aparelhos forem compatíveis."],["Prioridade alta","Ative WPA3 ou WPA2-AES em todos os pontos de acesso próprios."]]],
      ["Wi-Fi · WPS","Confira se o WPS está desativado.",[null,["Prioridade alta","Desative o WPS nas configurações do roteador."]]],
      ["Wi-Fi · Atualizações do roteador","Confira se o fabricante ainda oferece atualizações para o modelo.",[null,["Melhoria","Instale a atualização indicada pelo fabricante ou provedor."],["Melhoria","Planeje a troca por um roteador que ainda receba atualizações."]]],
      ["Bluetooth · Dispositivos pareados","Abra a lista de dispositivos pareados e confira se reconhece todos.",[null,["Prioridade alta","Revise a lista e remova os pareamentos que você não reconhece."],["Melhoria","Remova os pareamentos dos dispositivos que você não usa mais."]]],
      ["Bluetooth · Visibilidade para novos aparelhos","Confira se o aparelho fica visível apenas durante o pareamento.",[null,["Melhoria","Permita que o aparelho fique visível somente durante um novo pareamento."]]]
    ];
    const acoes = new Map([["Prioridade alta", []], ["Melhoria", []], ["A verificar", []]]);
    let aplicaveis = 0;
    regras.forEach(([titulo, verificar, opcoes], indice) => {
      const resposta = respostas.get("resposta-" + indice);
      if (resposta === "na") return;
      aplicaveis++;
      const item = resposta ? opcoes[Number(resposta)] : ["A verificar", verificar];
      if (item) acoes.get(item[0]).push("• " + titulo + " — " + item[1]);
    });

    const blocos = [];
    for (const [grupo, itens] of acoes) {
      if (itens.length) blocos.push(grupo + "\\n" + itens.join("\\n"));
    }
    const resumo = aplicaveis
      ? "Pontos avaliados: " + aplicaveis + ". Resultado baseado nas configurações informadas."
      : "Nenhum item aplicável foi selecionado.";
    relatorioSeguranca.textContent = ["Relatório de segurança Wi-Fi e Bluetooth", resumo,
      ...(blocos.length ? blocos : aplicaveis ? ["Nenhuma correção foi indicada para as respostas fornecidas."] : [])
    ].join("\\n\\n");
    relatorioSeguranca.hidden = baixarSeguranca.hidden = false;
    relatorioSeguranca.focus();
  };
  baixarSeguranca.onclick = () => {
    const arquivo = new Blob([relatorioSeguranca.textContent], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(arquivo);
    const link = document.createElement("a");
    link.href = url;
    link.download = "relatorio-seguranca-aion.txt";
    document.body.append(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  function connectCommands(areas, credential) {
    const central = areas.find(area => area.nome === "Central 6D" && area.url);
    const input = document.getElementById("pedido-ion");
    const send = document.getElementById("enviar-ion");
    const form = document.getElementById("comando-ion");
    const log = document.getElementById("conversa-ion");
    const get = id => document.getElementById(id);
    const menu = get("ion-menu");
    const menuButton = get("menu-ion");
    const desktop = window.matchMedia("(min-width: 900px)");
    const history = get("historico-ion");
    const help = get("ajuda-ion");
    const attachmentStatus = get("anexo-status");
    const viewport = window.visualViewport;
    if (viewport) {
      const ajustarAltura = () => {
        if (viewport.scale !== 1) return;
        get("painel").style.setProperty("--ion-altura-visivel", viewport.height + "px");
      };
      viewport.addEventListener("resize", ajustarAltura);
      ajustarAltura();
    }
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
      cancelDictation();
      help.textContent = "Interrupção solicitada.";
    };
    const videoUrls = [];
    function saveHistory() {
      const mudouOrdem = current.length && saved[0] !== current;
      if (mudouOrdem) saved = [current, ...saved.filter(chat => chat !== current)].slice(0, 20);
      try { localStorage.setItem(storageKey, JSON.stringify(saved)); }
      catch { help.textContent = "O navegador não conseguiu salvar o histórico."; }
      if (mudouOrdem && menu.open) renderHistory();
    }
    function irParaUltimaMensagem() {
      log.scrollTop = log.scrollHeight;
    }
    function findLastMessage(predicate) {
      for (let index = current.length - 1; index >= 0; index--) {
        if (predicate(current[index])) return current[index];
      }
      return undefined;
    }
    function openConversation(chat) {
      if (send.disabled) return;
      cancelDictation();
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
        if (partituraValida(entry.partitura) && entry.versaoAudio) {
          try {
            apresentarPartitura(item, entry);
          } catch {
            help.textContent = "Não foi possível reabrir o áudio salvo nesta conversa.";
          }
        }
        if (videoValido(entry.roteiroVideo)) apresentarRoteiro(item, entry.roteiroVideo);
        if ((entry.proposta || entry.tentarProposta) && entry === chat[chat.length - 1]) apresentarAprovacao(item, entry);
        const gravacao = audiosDaSessao.get(entry);
        if (gravacao) apresentarAudio(item, gravacao, entry.versaoAudio);
      }
      if (menu.open && !desktop.matches) menu.close();
      atualizarBarra();
      irParaUltimaMensagem();
      return true;
    }
    get("novo-ion").onclick = () => {
      if (openConversation([]) && menu.open) renderHistory();
    };
    function renderHistory() {
      history.replaceChildren();
      for (const chat of saved) {
        const item = document.createElement("li");
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = chat[0]?.text.slice(0, 72) || "Conversa";
        if (chat === current) button.setAttribute("aria-current", "true");
        button.onclick = () => {
          if (!openConversation(chat)) return;
          saveHistory();
          if (desktop.matches) history.querySelector('[aria-current="true"]')?.focus({ preventScroll: true });
        };
        item.append(button);
        history.append(item);
      }
    }
    function exibirHistorico() {
      renderHistory();
      if (desktop.matches) menu.show();
      else menu.showModal();
      menuButton.setAttribute("aria-expanded", "true");
    }
    menuButton.onclick = () => {
      if (menu.open) menu.close();
      else exibirHistorico();
    };
    menu.addEventListener("close", () => menuButton.setAttribute("aria-expanded", String(menu.open)));
    desktop.addEventListener?.("change", () => {
      if (menu.open) menu.close();
      if (desktop.matches) exibirHistorico();
      irParaUltimaMensagem();
    });
    get("fechar-menu").onclick = () => {
      menu.close();
      menuButton.focus({ preventScroll: true });
    };
    get("limpar-ion").onclick = () => {
      if (send.disabled || !window.confirm("Limpar as conversas salvas neste navegador?")) return;
      saved = [];
      openConversation([]);
      saveHistory();
      if (menu.open) renderHistory();
    };

    const attach = get("mais-ion");
    const attachments = get("anexos-ion");
    const audioPicker = get("audio-ion");
    const recordAudio = get("gravar-audio");
    const iconeAudio = recordAudio.firstElementChild.cloneNode(true);
    let audioRecorder;
    let audioTimer;

    function atualizarBarra() {
      const temMensagem = Boolean(input.value.trim() || attachment || textFile || audioFile);
      send.hidden = !temMensagem || Boolean(audioRecorder);
      recordAudio.hidden = temMensagem && !audioRecorder;
      if (!CSS.supports("field-sizing", "content")) {
        input.style.height = "auto";
        input.style.height = input.scrollHeight + "px";
      }
    }
    input.addEventListener("input", atualizarBarra);
    new MutationObserver(atualizarBarra).observe(attachmentStatus, { childList: true });


    function attachAudio(file) {
      if (file.size === 0 || file.size > 20_000_000) {
        help.textContent = "Escolha um áudio com conteúdo e de até 20 MB.";
        return;
      }
      attachment = textFile = null;
      audioFile = file;
      attachmentStatus.textContent = "Áudio pronto para enviar: " + file.name;
      help.textContent = "";
      attachments.hidden = true;
      attach.setAttribute("aria-expanded", "false");
      remove.hidden = false;
    }

    get("escolher-audio").onclick = () => {
      if (!send.disabled) audioPicker.click();
    };
    audioPicker.onchange = () => {
      const file = audioPicker.files[0];
      audioPicker.value = "";
      if (file && !send.disabled) attachAudio(file);
    };

    recordAudio.onclick = async () => {
      if (audioRecorder?.state === "recording") {
        audioRecorder.stop();
        return;
      }
      if (send.disabled) return;
      if (recognition) {
        help.textContent = "Toque em Concluir para terminar o ditado e depois grave o áudio.";
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
        help.textContent = "Este navegador não pode gravar aqui. Use +, Áudio para anexar uma gravação.";
        return;
      }
      send.disabled = microphone.disabled = recordAudio.disabled = true;
      let stream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const recorder = new MediaRecorder(stream);
        const chunks = [];
        function finish() {
          clearTimeout(audioTimer);
          stream.getTracks().forEach(track => track.stop());
          audioRecorder = undefined;
          recordAudio.replaceChildren(iconeAudio.cloneNode(true));
          recordAudio.setAttribute("aria-label", "Gravar áudio para enviar");
          recordAudio.setAttribute("aria-pressed", "false");
          send.disabled = microphone.disabled = recordAudio.disabled = false;
        }
        recorder.ondataavailable = event => {
          if (event.data.size) chunks.push(event.data);
        };
        recorder.onerror = () => {
          if (audioRecorder !== recorder) return;
          finish();
          help.textContent = "A gravação falhou. Tente novamente ou anexe um áudio.";
        };
        recorder.onstop = () => {
          if (audioRecorder !== recorder) return;
          finish();
          const type = chunks[0]?.type || recorder.mimeType || "audio/webm";
          const extension = type.includes("mp4") ? "m4a" : type.includes("ogg") ? "ogg" : "webm";
          attachAudio(new File(chunks, "gravacao." + extension, { type }));
        };
        recorder.start();
        audioRecorder = recorder;
        recordAudio.disabled = false;
        recordAudio.textContent = "■";
        recordAudio.setAttribute("aria-label", "Parar gravação");
        recordAudio.setAttribute("aria-pressed", "true");
        help.textContent = "Gravando… toque em Parar gravação quando terminar.";
        audioTimer = setTimeout(() => {
          if (recorder.state === "recording") recorder.stop();
        }, 119_000);
      } catch {
        stream?.getTracks().forEach(track => track.stop());
        send.disabled = microphone.disabled = recordAudio.disabled = false;
        help.textContent = "Não foi possível usar o microfone. Permita o acesso ou anexe um áudio.";
      }
    };
    attach.onclick = () => {
      attachments.hidden = !attachments.hidden;
      attach.setAttribute("aria-expanded", String(!attachments.hidden));
    };
    for (const [buttonId, inputId] of [["escolher-camera","camera-ion"],["escolher-foto","foto-ion"],["escolher-arquivo","arquivo-ion"]]) {
      const picker = get(inputId);
      get(buttonId).onclick = () => {
        if (!send.disabled) picker.click();
      };
      picker.onchange = async () => {
        const file = picker.files[0];
        picker.value = "";
        if (!file || send.disabled) return;
        attachments.hidden = true;
        attach.setAttribute("aria-expanded", "false");
        if (inputId === "arquivo-ion" && (file.type.startsWith("audio/") || /\\.(?:m4a|mp3|wav|ogg|opus|webm|aac|flac|amr|3ga)$/i.test(file.name))) {
          attachAudio(file);
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
    let prazoDitado;
    const microphoneLabel = microphone.getAttribute("aria-label");
    const iconeMicrofone = microphone.firstElementChild.cloneNode(true);
    function resetDictation() {
      clearTimeout(prazoDitado);
      recognition = null;
      microphone.replaceChildren(iconeMicrofone.cloneNode(true));
      microphone.setAttribute("aria-pressed", "false");
      microphone.setAttribute("aria-label", microphoneLabel);
    }
    function cancelDictation() {
      const session = recognition;
      if (!session) return;
      resetDictation();
      session.abort();
    }
    microphone.onclick = () => {
      if (send.disabled) return;
      if (recognition) {
        recognition.finish();
        return;
      }
      if (!Recognition) {
        help.textContent = "Use o microfone do teclado para ditar.";
        input.focus();
        return;
      }
      const session = new Recognition();
      let finishing = false;
      let startedAt = 0;
      let quickEnds = 0;
      let failure = "";
      recognition = session;
      session.lang = "pt-BR";
      session.continuous = true;
      session.finish = () => {
        if (finishing) return;
        finishing = true;
        help.textContent = "Concluindo ditado…";
        const recuperarDitado = () => {
          if (recognition !== session) return;
          cancelDictation();
          help.textContent = input.value.trim()
            ? "O navegador demorou para concluir. Revise o texto capturado e toque em Enviar."
            : "O navegador demorou para concluir o ditado. Tente o microfone do teclado.";
        };
        prazoDitado = setTimeout(recuperarDitado, 3000);
        try { session.stop(); } catch { recuperarDitado(); }
      };
      session.onresult = event => {
        if (recognition !== session) return;
        for (let index = event.resultIndex; index < event.results.length; index++) {
          const result = event.results[index];
          const transcript = result.isFinal && result[0]?.transcript.trim();
          if (!transcript) continue;
          const separator = input.value && input.value === input.value.trimEnd() ? " " : "";
          input.value = (input.value + separator + transcript).slice(0, input.maxLength);
          input.dispatchEvent(new Event("input", { bubbles: true }));
        }
        if (input.value.length >= input.maxLength) session.finish();
      };
      session.onerror = event => {
        if (recognition !== session || event.error === "no-speech") return;
        failure = "O ditado foi encerrado pelo navegador. Você pode usar o microfone do teclado.";
      };
      const finish = message => {
        resetDictation();
        help.textContent = message;
        input.focus();
      };
      const start = () => {
        try {
          startedAt = Date.now();
          session.start();
        } catch {
          finish("Use o microfone do teclado para ditar.");
        }
      };
      session.onend = () => {
        if (recognition !== session) return;
        if (failure) {
          finish(failure);
          return;
        }
        if (finishing) {
          const proposta = current.at(-1);
          const aprovarPorVoz = !send.disabled && !attachment && !textFile && !audioFile
            && (proposta?.proposta || proposta?.tentarProposta)
            && (partituraValida(proposta.partitura) || videoValido(proposta.roteiroVideo))
            && aprovacaoProducao(input.value.trim());
          finish(aprovarPorVoz ? "Aprovação por voz recebida." : "Texto reconhecido. Revise e toque em Enviar.");
          if (aprovarPorVoz) form.requestSubmit();
          return;
        }
        quickEnds = Date.now() - startedAt < 1000 ? quickEnds + 1 : 0;
        if (quickEnds >= 2) {
          finish("O navegador encerrou o ditado. Toque no microfone para continuar.");
          return;
        }
        start();
      };
      microphone.textContent = "✓";
      microphone.setAttribute("aria-pressed", "true");
      microphone.setAttribute("aria-label", "Concluir ditado");
      help.textContent = "Ouvindo em português… Toque em Concluir quando terminar.";
      start();
    };

    let leitor;
    try { leitor = window.speechSynthesis; } catch {}

    const seletorVoz = get("voz-leitura-ion");
    const chaveVoz = "ion-voz-leitura";
    const vozesBrasileiras = () => leitor?.getVoices().filter(voz => /^pt[-_]br$/i.test(voz.lang)) ?? [];
    let vozEscolhida = "faber";
    try { vozEscolhida = localStorage.getItem(chaveVoz) || "faber"; } catch {}
    const preencherVozes = () => {
      const vozes = vozesBrasileiras();
      get("preferencia-voz-ion").hidden = false;
      seletorVoz.replaceChildren(new Option("Faber · voz neural", "faber"));
      if (leitor && window.SpeechSynthesisUtterance) {
        seletorVoz.append(new Option("Padrão do aparelho", "aparelho"),
          ...vozes.map(voz => new Option(voz.name, voz.voiceURI)));
      }
      seletorVoz.value = Array.from(seletorVoz.options).some(opcao => opcao.value === vozEscolhida) ? vozEscolhida : "faber";
    };
    seletorVoz.onchange = () => {
      vozEscolhida = seletorVoz.value;
      pararLeitura();
      try { localStorage.setItem(chaveVoz, vozEscolhida); } catch {}
    };
    preencherVozes();
    leitor?.addEventListener?.("voiceschanged", preencherVozes);

    const leitoresPorResposta = new WeakMap();
    const barraLeitura = get("leitura-ion");
    const vozImediata = get("leitura-usar-aparelho");
    let ultimoAudioFaber;
    const statusLeitura = get("leitura-status");
    const voltarLeitura = get("leitura-voltar");
    const avancarLeitura = get("leitura-avancar");
    voltarLeitura.onclick = () => deslocarLeitura(-15);
    avancarLeitura.onclick = () => deslocarLeitura(15);
    const velocidadeLeitura = get("leitura-velocidade");
    const pausaLeitura = get("leitura-pausa");
    velocidadeLeitura.onchange = () => {
      if (leitura?.audio) leitura.audio.playbackRate = Number(velocidadeLeitura.value);
    };
    pausaLeitura.onclick = () => {
      const sessao = leitura;
      if (!sessao?.trechos) return;
      sessao.pausada = !sessao.pausada;
      atualizarPausa(sessao);
      if (sessao.pausada) leitor.pause();
      else if (sessao.fala) leitor.resume();
      else lerTrecho(sessao);
    };
    get("leitura-fechar").onclick = pararLeitura;
    let leitura;
    function deslocarLeitura(segundos) {
      const audio = leitura?.audio;
      if (audio && Number.isFinite(audio.duration)) {
        audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + segundos));
        return;
      }
      const sessao = leitura;
      if (!sessao?.trechos) return;
      const indice = Math.max(0, Math.min(sessao.trechos.length - 1, sessao.indice + Math.sign(segundos)));
      if (indice === sessao.indice && segundos > 0) return;
      sessao.indice = indice;
      sessao.fala = null;
      leitor.cancel();
      lerTrecho(sessao);
    }
    function configurarSaltos(porTrecho) {
      voltarLeitura.textContent = porTrecho ? "‹" : "−15";
      avancarLeitura.textContent = porTrecho ? "›" : "+15";
      for (const [controle, titulo] of [
        [voltarLeitura, porTrecho ? "Voltar um trecho" : "Voltar 15 segundos"],
        [avancarLeitura, porTrecho ? "Avançar um trecho" : "Avançar 15 segundos"],
      ]) {
        controle.title = titulo;
        controle.setAttribute("aria-label", titulo);
        controle.hidden = false;
      }
    }
    function atualizarPausa(sessao) {
      pausaLeitura.textContent = sessao.pausada ? "▶" : "Ⅱ";
      pausaLeitura.setAttribute("aria-label", sessao.pausada ? "Continuar leitura" : "Pausar leitura");
    }
    function lerTrecho(sessao) {
      statusLeitura.textContent = (sessao.indice + 1) + " / " + sessao.trechos.length + " · " + sessao.nome;
      if (sessao.pausada) return;
      const fala = new SpeechSynthesisUtterance(sessao.trechos[sessao.indice]);
      fala.lang = "pt-BR";
      if (sessao.voz) fala.voice = sessao.voz;
      sessao.fala = fala;
      fala.onend = () => {
        if (leitura !== sessao || sessao.fala !== fala) return;
        sessao.fala = null;
        sessao.indice++;
        if (sessao.indice < sessao.trechos.length) lerTrecho(sessao);
        else pararLeitura();
      };
      fala.onerror = () => {
        if (leitura !== sessao || sessao.fala !== fala) return;
        pararLeitura();
        help.textContent = "Não foi possível reproduzir a voz neste navegador.";
      };
      if (leitor.paused) leitor.resume();
      leitor.speak(fala);
    }
    function iniciarLeitura(mensagem) {
      statusLeitura.textContent = mensagem;
      statusLeitura.hidden = false;
      barraLeitura.hidden = false;
    }
    function pararLeitura() {
      if (!leitura) return;
      const anterior = leitura;
      leitura = null;
      barraLeitura.hidden = voltarLeitura.hidden = avancarLeitura.hidden = velocidadeLeitura.hidden = pausaLeitura.hidden = true;
      vozImediata.hidden = true;
      vozImediata.onclick = null;
      iconeResposta(anterior.botao, "ouvir");
      anterior.botao.setAttribute("aria-label", "Ler texto da resposta em voz alta");
      if (anterior.audio) {
        anterior.audio.pause();
        anterior.audio.remove();
        URL.revokeObjectURL(anterior.url);
      }
      if (anterior.trechos) leitor.cancel();
    }

    function pedidoDeLeitura(command) {
      return /^(?:(?:voce )?(?:pode|poderia|consegue) )?(?:(?:leia|ler|reproduza|reproduzir|repita|repetir|fale|falar|diga|dizer)(?: em voz alta)? (?:a )?(?:ultima resposta|resposta anterior|essa resposta|esta resposta|(?:a )?resposta|isso|esse texto|este texto)(?: em voz alta)?|(?:leia|ler|repita|repetir|fale|falar|diga|dizer) em voz alta|(?:reproduza|reproduzir|toque|tocar) (?:o )?audio (?:da resposta|da ultima resposta|dessa resposta))$/.test(command);
    }

    function codigoJavaScript(texto) {
      return texto.match(/\`\`\`(?:javascript|js)[ \\t]*\\r?\\n([\\s\\S]*?)\\r?\\n\`\`\`/i)?.[1];
    }

    function executarJavaScript(codigo, botao, resultado) {
      if (codigo.length > 12000) {
        resultado.textContent = "O código pode ter até 12.000 caracteres.";
        return;
      }
      const quadro = document.createElement("iframe");
      quadro.hidden = true;
      quadro.setAttribute("sandbox", "allow-scripts");
      quadro.src = "/executor-javascript";
      botao.disabled = true;
      resultado.textContent = "Executando…";
      const encerrar = texto => {
        clearTimeout(prazo);
        window.removeEventListener("message", receber);
        quadro.remove();
        resultado.textContent = texto;
        botao.disabled = false;
      };
      const receber = evento => {
        if (evento.source === quadro.contentWindow && evento.origin === "null" && typeof evento.data === "string") {
          encerrar(evento.data);
        }
      };
      const prazo = setTimeout(() => encerrar("O executor não respondeu a tempo."), 8000);
      window.addEventListener("message", receber);
      quadro.onload = () => quadro.contentWindow.postMessage(codigo, "*");
      document.body.append(quadro);
    }

    function iconeResposta(botao, nome) {
      const desenhos = {
        ouvir: '<path d="M3 9h4l5-4v14l-5-4H3zM16 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12"/>',
        parar: '<rect x="6" y="6" width="12" height="12" rx="1" fill="currentColor" stroke="none"/>',
        subir: '<path d="M12 15V3m-4 4 4-4 4 4M5 13v7h14v-7"/>',
        positivo: '<path d="M7 10v10H3V10zm0 8 3 2h8a2 2 0 0 0 2-2l1-7a2 2 0 0 0-2-2h-4l1-4a2 2 0 0 0-2-2l-4 7-3 2"/>',
        negativo: '<path transform="rotate(180 12 12)" d="M7 10v10H3V10zm0 8 3 2h8a2 2 0 0 0 2-2l1-7a2 2 0 0 0-2-2h-4l1-4a2 2 0 0 0-2-2l-4 7-3 2"/>',
      };
      botao.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + desenhos[nome] + '</svg>';
    }

    function message(who, content, entrada) {
      const item = document.createElement("li");
      item.className = who === "Você" ? "msg-user" : "msg-ion";
      const label = document.createElement("strong");
      label.textContent = who === "Ion" ? "Aion" : who;
      const body = document.createElement("p");
      body.textContent = content;
      item.append(label, body);
      let ouvir;
      if (who === "Ion") {
        ouvir = document.createElement("button");
        ouvir.type = "button";
        iconeResposta(ouvir, "ouvir");
        ouvir.title = "Ler texto da resposta em voz alta";
        ouvir.setAttribute("aria-label", "Ler texto da resposta em voz alta");
        ouvir.hidden = !content.trim() || content === "Entendendo seu pedido…";
        const reproduzir = async (usarVozLocal = seletorVoz.value !== "faber") => {
          const jaLendo = leitura?.botao === ouvir;
          pararLeitura();
          if (jaLendo) return;
          const texto = body.textContent.replace(/https?:\\/\\/\\S+/g, "").replace(/[*_#]/g, "").trim();
          if (!texto) return;
          const vozes = vozesBrasileiras();
          const preferida = vozes.find(v => v.voiceURI === seletorVoz.value);
          if (!usarVozLocal) {
            const sessao = { botao: ouvir };
            leitura = sessao;
            iconeResposta(ouvir, "parar");
            ouvir.setAttribute("aria-label", "Parar leitura");
            iniciarLeitura("Preparando a voz Faber…");
            if (leitor && window.SpeechSynthesisUtterance) {
              vozImediata.hidden = false;
              vozImediata.onclick = () => {
                if (leitura !== sessao) return;
                pararLeitura();
                reproduzir(true);
              };
            }
            let prazo;
            try {
              const preparar = async () => {
                if (ultimoAudioFaber?.texto === texto) return ultimoAudioFaber.blob;
                const piper = await import("https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/+esm");
                if (leitura !== sessao) return null;
                return piper.predict({ text: texto, voiceId: "pt_BR-faber-medium" }, progresso => {
                  if (leitura === sessao && progresso.total > 0) {
                    statusLeitura.textContent = "Baixando voz Faber… " + Math.min(100, Math.round(progresso.loaded * 100 / progresso.total)) + "%";
                  }
                });
              };
              const audioWav = await Promise.race([preparar(), new Promise((_, reject) => {
                prazo = setTimeout(() => reject(new Error("Tempo de preparação excedido")), 45000);
              })]);
              if (leitura !== sessao) return;
              ultimoAudioFaber = { texto, blob: audioWav };
              vozImediata.hidden = true;
              vozImediata.onclick = null;
              const audio = document.createElement("audio");
              sessao.url = URL.createObjectURL(audioWav);
              sessao.audio = audio;
              audio.controls = true;
              audio.playbackRate = Number(velocidadeLeitura.value);
              velocidadeLeitura.hidden = false;
              audio.src = sessao.url;
              statusLeitura.hidden = true;
              barraLeitura.insertBefore(audio, voltarLeitura);
              audio.onloadedmetadata = () => {
                if (leitura !== sessao) return;
                if (Number.isFinite(audio.duration)) configurarSaltos(false);
              };
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
                help.textContent = "Toque em Reproduzir na barra de leitura.";
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
          const frases = typeof Intl.Segmenter === "function"
            ? Array.from(new Intl.Segmenter("pt-BR", { granularity: "sentence" }).segment(texto), parte => parte.segment.trim())
            : texto.split(/(?<=[.!?])\\s+|\\n+/);
          const trechos = frases.flatMap(frase => frase.trim().match(/.{1,220}(?:\\s|$)|.{1,220}/g) || []);
          if (!trechos.length) return;
          const sessao = { botao: ouvir, voz: preferida, nome: preferida?.name || "Voz do aparelho",
            trechos, indice: 0, pausada: false };
          leitura = sessao;
          iniciarLeitura(sessao.nome);
          configurarSaltos(true);
          pausaLeitura.hidden = false;
          atualizarPausa(sessao);
          iconeResposta(ouvir, "parar");
          ouvir.setAttribute("aria-label", "Parar leitura");
          help.textContent = "";
          lerTrecho(sessao);
        };
        leitoresPorResposta.set(entrada, () => reproduzir());
        ouvir.onclick = () => reproduzir();
      }
      let acoes, executarCodigo;
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
        const resultadoCodigo = document.createElement("pre");
        resultadoCodigo.hidden = true;
        resultadoCodigo.style.whiteSpace = "pre-wrap";
        resultadoCodigo.setAttribute("aria-live", "polite");
        executarCodigo = botao("Executar JavaScript", "Executar o bloco JavaScript no navegador", () => {
          const codigo = codigoJavaScript(body.textContent);
          if (!codigo) return;
          resultadoCodigo.hidden = false;
          executarJavaScript(codigo, executarCodigo, resultadoCodigo);
        });
        executarCodigo.hidden = !codigoJavaScript(content);
        acoes.append(executarCodigo);
        const grupoVotos = document.createElement("div");
        grupoVotos.className = "ion-resposta-votos";
        grupoVotos.setAttribute("role", "group");
        grupoVotos.setAttribute("aria-label", "Avaliar resposta");
        acoes.append(grupoVotos);
        const votos = [["Gostei", "positivo"], ["Não gostei", "negativo"]];
        const atualizarVotos = () => {
          for (const [controle, valor] of controles) {
            controle.setAttribute("aria-pressed", String(entrada.voto === valor));
          }
        };
        const controles = votos.map(([titulo, valor]) => {
          const controle = botao("", titulo, () => {
            entrada.voto = entrada.voto === valor ? null : valor;
            atualizarVotos();
            saveHistory();
          });
          iconeResposta(controle, valor);
          grupoVotos.append(controle);
          return [controle, valor];
        });
        atualizarVotos();
        if (ouvir) acoes.append(ouvir);
        const compartilhar = botao("", "Compartilhar resposta", async () => {
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
        });
        iconeResposta(compartilhar, "subir");
        acoes.append(compartilhar);
        const opcoes = document.createElement("dialog");
        opcoes.className = "ion-acoes-dialog";
        opcoes.setAttribute("aria-label", "Mais ações da resposta");
        const resumo = botao("⋯", "Mais ações da resposta", () => opcoes.showModal());
        resumo.setAttribute("aria-haspopup", "dialog");
        opcoes.addEventListener("click", evento => {
          if (evento.target.closest("button")) opcoes.close();
        }, true);
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
            link.download = "aion-resposta." + extensao;
            item.append(link);
            link.click();
            link.remove();
            setTimeout(() => URL.revokeObjectURL(url), 30000);
          }),
          botao("Buscar na web", "Abrir busca na web", () => {
            const termo = window.prompt("Revise os termos que serão enviados ao Google.", pedidoDaResposta());
            if (!termo?.trim()) return;
            const busca = new URL("https://www.google.com/search");
            busca.searchParams.set("q", termo.trim());
            window.open(busca.href, "_blank", "noopener,noreferrer");
          }),
          botao("Fechar", "Fechar ações da resposta", () => {})
        );
        acoes.append(resumo, opcoes);
        item.append(acoes, resultadoCodigo);
      }
      log.append(item);
      if (entrada?.mudanca) {
        linkDaMudanca(item, entrada);
        acompanharMudanca(item, body, entrada, texto => {
          body.textContent = entrada.text = texto;
          if (ouvir) ouvir.hidden = false;
          if (acoes) acoes.hidden = false;
          saveHistory();
        });
      }
      log.scrollTop = log.scrollHeight;
      return { item, body, ouvir, acoes, executarCodigo };
    }

    const githubMudancas = "https://github.com/israelrodriguesnogueira-ai/ADL-MIDIA";
    function linkDaMudanca(item, record) {
      const progresso = record.mudanca;
      if (!progresso) return;
      let link = item.querySelector(".ion-link-mudanca");
      if (!link) {
        link = document.createElement("a");
        link.className = "ion-link-mudanca";
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        item.append(link);
      }
      if (Number.isSafeInteger(progresso.id) && progresso.id > 0) {
        const tentativa = progresso.tentativa;
        if (Number.isSafeInteger(tentativa) && tentativa > 0) {
          link.href = githubMudancas + "/compare/ion/controle-dono...aion/proposta-interface-" + progresso.id + "-" + tentativa + "?expand=1";
          link.textContent = "Abrir proposta para revisão";
        } else {
          link.href = githubMudancas + "/actions/runs/" + progresso.id;
          link.textContent = "Abrir execução no GitHub";
        }
      } else {
        link.href = githubMudancas + "/actions/workflows/ion-preparar-mudanca.yml";
        link.textContent = "Abrir execuções no GitHub";
      }
    }

    async function acompanharMudanca(item, body, record, update) {
      const progresso = record.mudanca;
      if (!Number.isSafeInteger(progresso.id) || progresso.id <= 0 || progresso.concluida) return;
      body.setAttribute("aria-live", "polite");
      let falhas = 0;
      for (let consulta = 0; consulta < 60 && item.isConnected; consulta++) {
        try {
          const resposta = await fetch("/api/mudancas/leitura/" + progresso.id, {
            headers: { Authorization: "Bearer " + credential },
            cache: "no-store",
            signal: AbortSignal.timeout(10000),
          });
          if (!item.isConnected) return;
          if (resposta.status === 401 || resposta.status === 403) {
            update("A sessão expirou. Entre novamente para retomar o acompanhamento ou abra a execução no GitHub.");
            return;
          }
          if (!resposta.ok) throw new Error();
          const estado = await resposta.json();
          if (!item.isConnected) return;
          falhas = 0;
          const etapas = estado.etapas.map(etapa => etapa.titulo + " · " + etapa.status).join("\\n");
          if (estado.concluida) {
            progresso.concluida = true;
            progresso.tentativa = estado.tentativaParaRevisao;
            const resumo = estado.conclusao !== "success"
              ? "A execução terminou sem preparar a proposta. Abra a execução para ver o motivo."
              : progresso.tentativa
                ? "Proposta pronta para revisão. Sua aprovação no GitHub libera a publicação."
                : "Execução concluída. Abra o resultado para conferir se já estava configurado.";
            update(etapas + "\\n\\n" + resumo);
            linkDaMudanca(item, record);
            return;
          }
          if (record.text !== etapas) update(etapas);
        } catch {
          if (!item.isConnected) return;
          falhas++;
          if (falhas >= 3) {
            update(record.text + "\\n\\nNão consegui atualizar as etapas. Abra a execução no GitHub ou reabra a conversa para retomar.");
            return;
          }
        }
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
      if (item.isConnected) update(record.text + "\\n\\nA execução segue no GitHub. Abra o link para acompanhar.");
    }

    function parseCommand(request) {
      const [instruction, ...scriptParts] = request
        .replace(/^(ion|i on|aion|ai on|ariel) *: */i, "$1 ")
        .split(":");
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
      baixar.download = "aion-audio-v" + versao + ".wav";
      baixar.textContent = "Baixar áudio · versão " + versao;
      item.append(audio, baixar);
    }

    function apresentarAprovacao(item, entrada) {
      const executar = document.createElement("button");
      executar.type = "button";
      executar.className = "ion-executar-proposta";
      executar.textContent = entrada.tentarProposta ? "Tentar novamente" : "Executar proposta";
      executar.onclick = () => {
        if (send.disabled) return;
        if (current[current.length - 1] !== entrada) {
          help.textContent = "Peça ao Ariel para reapresentar esta proposta antes de executar.";
          return;
        }
        if (input.value.trim() || attachment || textFile || audioFile) {
          help.textContent = "Envie ou limpe o que está no campo de mensagem antes de executar.";
          return;
        }
        input.value = "Pode executar";
        form.requestSubmit();
      };
      item.append(executar);
    }

    async function gerarClipeDoRoteiro(item, body, record, roteiro, update) {
      record.roteiroVideo = roteiro;
      apresentarRoteiro(item, roteiro);
      const segundos = roteiro.cenas.reduce((total, cena) => total + cena.segundos, 0);
      if (segundos > 60 || roteiro.cenas.length > 10) {
        update("Roteiro aprovado · " + segundos + " segundos. O renderizador local atende até 60 segundos e 10 cenas. Baixe o roteiro aprovado para seguir com a produção.");
        return;
      }
      send.disabled = microphone.disabled = true;
      recording = new AbortController();
      cancelVideo.hidden = false;
      const signal = recording.signal;
      let contexto;
      let etapa = "Preparar narração";
      const temNarracao = roteiro.cenas.some(cena => cena.fala.trim());
      try {
        let falas;
        if (temNarracao) {
          body.textContent = etapa + " · voz Faber…";
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          contexto = new AudioContext();
          await aguardarAudio(contexto.resume(), signal, 6000);
          const piper = await aguardarAudio(
            import("https://cdn.jsdelivr.net/npm/@mintplex-labs/piper-tts-web@1.0.5/+esm"), signal);
          falas = [];
          for (const [indice, cena] of roteiro.cenas.entries()) {
            signal.throwIfAborted();
            body.textContent = etapa + " · cena " + (indice + 1) + "/" + roteiro.cenas.length;
            if (!cena.fala.trim()) {
              falas.push(null);
              continue;
            }
            const wav = await aguardarAudio(piper.predict({ text: cena.fala, voiceId: "pt_BR-faber-medium" }), signal);
            const audio = await contexto.decodeAudioData(await wav.arrayBuffer());
            if (audio.duration > cena.segundos * 1.25) {
              throw new Error("A fala da cena " + (indice + 1) + " precisa ser mais curta ou a cena precisa durar mais.");
            }
            falas.push(audio);
          }
        }
        etapa = "Renderizar clipe";
        const { blob, extension } = await renderSample(roteiro.cenas.map(cena => cena.legenda),
          progress => { body.textContent = etapa + " · " + progress + "%"; },
          null, signal, roteiro.cenas.map(cena => cena.segundos * 1000), contexto, falas);
        etapa = "Disponibilizar arquivo";
        const url = URL.createObjectURL(blob);
        videoUrls.push(url);
        const video = document.createElement("video");
        video.controls = video.playsInline = true;
        video.preload = "metadata";
        video.src = url;
        const baixar = document.createElement("a");
        baixar.href = url;
        baixar.download = "aion-clipe." + extension;
        baixar.textContent = "Baixar clipe";
        item.append(video, baixar);
        update("Clipe de legendas " + (temNarracao ? "com narração Faber" : "sem narração")
          + " · " + segundos + " s · " + extension.toUpperCase() + ". Abra ou baixe o arquivo nesta sessão.");
      } catch (error) {
        record.tentarProposta = true;
        apresentarAprovacao(item, record);
        update(signal.aborted ? "Produção cancelada." : etapa + " · " + error.message
          + " O roteiro está abaixo. Diga “pode executar” para tentar novamente.");
      } finally {
        if (contexto) void contexto.close().catch(() => {});
        recording = undefined;
        cancelVideo.hidden = true;
        send.disabled = microphone.disabled = false;
      }
    }

    async function aguardarAudio(promessa, signal, limite = 45000) {
      signal.throwIfAborted();
      let prazo;
      let abortar;
      try {
        return await Promise.race([promessa, new Promise((_, reject) => {
          prazo = setTimeout(() => reject(new Error("A preparação do áudio excedeu o tempo esperado.")), limite);
          abortar = () => reject(signal.reason);
          signal.addEventListener("abort", abortar, { once: true });
        })]);
      } finally {
        clearTimeout(prazo);
        signal.removeEventListener("abort", abortar);
      }
    }

    function apresentarRoteiro(item, roteiro) {
      const baixar = document.createElement("a");
      const url = URL.createObjectURL(new Blob([textoRoteiro(roteiro)], { type: "text/plain;charset=utf-8" }));
      videoUrls.push(url);
      baixar.href = url;
      baixar.download = "aion-roteiro.txt";
      baixar.textContent = "Baixar roteiro";
      item.append(baixar);
    }

    function apresentarPartitura(item, entrada) {
      const { amostras, taxa } = gerarMelodia(entrada.partitura);
      apresentarAudio(item, codificarWav(amostras, taxa), entrada.versaoAudio);
    }

    function entregarMelodia(item, record, partitura, versao, update) {
      try {
        apresentarPartitura(item, { partitura, versaoAudio: versao });
        record.partitura = partitura;
        record.versaoAudio = versao;
        update(partitura.titulo + " · Áudio instrumental gerado\\nOuça ou baixe o WAV abaixo."
          + (partitura.letra ? "\\n\\n" + partitura.letra : ""));
      } catch {
        record.partitura = partitura;
        record.tentarProposta = true;
        apresentarAprovacao(item, record);
        update("Não consegui gerar o WAV neste aparelho. Toque em Tentar novamente.");
      }
    }

    openConversation(current);
    if (desktop.matches) exibirHistorico();
    requestAnimationFrame(irParaUltimaMensagem);
    form.onsubmit = async event => {
      event.preventDefault();
      if (recognition) {
        recognition.finish();
        return;
      }
      const request = input.value.trim();
      const file = attachment || textFile || audioFile;
      if (attachment) ultimaFotoPorConversa.set(current, attachment);
      if ((!request && !file) || send.disabled) return;
      help.textContent = "";
      if (request.length > input.maxLength) {
        help.textContent = "A mensagem pode ter até " + input.maxLength + " caracteres.";
        input.focus();
        return;
      }
      let { command, videoRequest, trafficRequest, scriptParts } = parseCommand(request);
      if (!file && !scriptParts.length && pedidoDeLeitura(command)) {
        const ultimaResposta = findLastMessage(entry => entry.who === "Ion" && entry.text.trim());
        const lerResposta = leitoresPorResposta.get(ultimaResposta);
        input.value = "";
        atualizarBarra();
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
        download.textContent = attachment ? "Baixar foto" : audioFile ? "Baixar áudio original" : "Baixar arquivo";
        if (audioFile) {
          const original = document.createElement("audio");
          original.controls = true;
          original.preload = "metadata";
          original.src = url;
          sent.append(original);
        }
        sent.append(download);
        log.scrollTop = log.scrollHeight;
      }
      current.push({who: "Você", text: request || file.name});
      saveHistory();
      input.value = "";
      atualizarBarra();
      const record = {who: "Ion", text: ""};
      const { item, body, ouvir, acoes, executarCodigo } = message("Ion", "Entendendo seu pedido…", record);
      current.push(record);
      const update = (reply) => {
        if (typeof reply !== "string" || !reply.trim()) reply = "O Aion recebeu uma resposta vazia. Use Repetir pedido para tentar novamente.";
        const pertoDoFim = log.scrollHeight - log.scrollTop - log.clientHeight <= 48;
        body.textContent = reply;
        if (ouvir) ouvir.hidden = !reply.trim();
        if (acoes) acoes.hidden = !reply.trim();
        if (executarCodigo) executarCodigo.hidden = !codigoJavaScript(reply);
        record.text = reply;
        if (pertoDoFim) irParaUltimaMensagem();
        saveHistory();
      };
      const pedidoInterface = normalizarPedido(request).replace(/^(?:aion|ion)[, ]+/, "");
      const ajustesInterface = [
        ["velocidade", /^prepar(?:e|ar) a velocidade (?:para )?padrao (?:da|de) leitura (?:em|para|de) (0[.,]75|1(?:[.,](?:25|5))?|2)\\s*[x×]?\\s*[.!]?$/],
        ["icones", /^prepar(?:e|ar) (?:os icones|o tamanho dos icones) em (14|16|18|20)\\s*(?:px)?\\s*[.!]?$/],
        ["historico", /^prepar(?:e|ar) o historico lateral (?:a partir de|em) (800|900|1024)\\s*(?:px)?\\s*[.!]?$/],
      ];
      const ajusteSolicitado = !file && ajustesInterface
        .map(([ajuste, padrao]) => ({ ajuste, valor: padrao.exec(pedidoInterface)?.[1] }))
        .find(opcao => opcao.valor);
      if (ajusteSolicitado) {
        send.disabled = microphone.disabled = true;
        body.textContent = "Identifiquei o ajuste. Enviando para preparação…";
        try {
          const response = await fetch("/api/mudancas/leitura", {
            method: "POST",
            headers: { Authorization: "Bearer " + credential, "Content-Type": "application/json" },
            body: JSON.stringify({ ajuste: ajusteSolicitado.ajuste, valor: ajusteSolicitado.valor.replace(",", ".") }),
            signal: AbortSignal.timeout(15000),
          });
          const payload = await response.json();
          if (!response.ok) {
            update(payload.erro || "O GitHub não aceitou a preparação.");
            return;
          }
          record.mudanca = { id: payload.idDaExecucao, concluida: false };
          update(payload.idDaExecucao
            ? "Pedido recebido pelo GitHub. Aguardando o início da preparação…"
            : "Pedido recebido pelo GitHub. Abra o link para conferir a execução.");
          linkDaMudanca(item, record);
          acompanharMudanca(item, body, record, update);
          irParaUltimaMensagem();
        } catch {
          update("Falha de conexão ao solicitar a preparação.");
        } finally {
          send.disabled = microphone.disabled = false;
        }
        return;
      }
      const versaoAnterior = findLastMessage(entrada => Number.isInteger(entrada.versaoAudio))?.versaoAudio || 0;
      const respostaAnteriorDoProjeto = current[current.length - 3];
      const ultimaProposta = respostaAnteriorDoProjeto?.proposta || respostaAnteriorDoProjeto?.tentarProposta
        ? respostaAnteriorDoProjeto
        : null;
      const revisaoComAprovacao = !file && request.match(/^(.*?)\s*[,.;!?]?\s+e\s+(?:agora\s+)?(pode\s+(?:executar|fazer|gerar|produzir))[.!?]*$/i);
      const revisaoDoVideo = revisaoComAprovacao && videoValido(respostaAnteriorDoProjeto?.roteiroVideo)
        && tipoDeProducao(revisaoComAprovacao[1], "video") === "video" ? revisaoComAprovacao[1] : null;
      const aprovou = aprovacaoProducao(request);
      const mensagemAnterior = current[current.length - 4];
      const recuperarJingle = !file && aprovou && !ultimaProposta
        && mensagemAnterior?.who === "Você" && tipoDeProducao(mensagemAnterior.text) === "musica";
      if (!file && aprovou && !ultimaProposta && !recuperarJingle) {
        update("Ainda não encontrei uma proposta para executar nesta conversa. Peça a criação do áudio ou do vídeo que você quer.");
        return;
      }
      if (!file && aprovou && ultimaProposta) {
        if (partituraValida(ultimaProposta.partitura)) {
          entregarMelodia(item, record, ultimaProposta.partitura, versaoAnterior + 1, update);
          return;
        }
        const roteiro = ultimaProposta.roteiroVideo;
        if (videoValido(roteiro)) {
          await gerarClipeDoRoteiro(item, body, record, roteiro, update);
          return;
        }
      }
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
          remove.click();
          update("O áudio original está anexado acima. Não consegui ajustar a gravação. Para tentar o ajuste, envie um M4A, MP3 ou WAV de até dois minutos.");
        } finally {
          send.disabled = microphone.disabled = false;
        }
        return;
      }
      if (!file && /^(?:baixar|baixe|quero baixar) (?:o )?(?:codigo(?: fonte)?|projeto|repositorio) (?:do ion|do aion|do adl midia|adl midia)$/.test(command)) {
        const codigo = areas.find(area => area.rotulo === "Baixar código do Aion");
        if (codigo?.url) {
          const link = document.createElement("a");
          link.href = codigo.url;
          link.textContent = codigo.rotulo;
          item.append(link);
          update("Aqui está a cópia ZIP do código que o Aion usa. Você também pode baixá-la no menu, em Áreas do Aion.");
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
      const anteriorWhatsApp = current[current.length - 3];
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
      const pedidoAnterior = current[current.length - 4]?.who === "Você" ? current[current.length - 4].text : "";
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
            ? "Permita a localização para o Aion nas configurações do navegador e tente novamente."
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
      const respostaAnterior = current[current.length - 3];
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
          const perguntaFoto = encodeURIComponent(confirmaFoto ? "O que aparece nesta foto?" : request);
          if (perguntaFoto.length > ${LIMITE_PERGUNTA_FOTO_CODIFICADA}) {
            update("Esta pergunta é longa demais para uma foto. Envie uma pergunta mais curta.");
            return;
          }
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
                "X-ION-Pergunta": perguntaFoto,
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
      const projetoDeVideo = !file && (
        /\\b(?:crie|cria|criar|faca|faz|fazer|gere|gera|gerar|produza|produzir|quero|monte|planeje|anim[eia])\\b.*\\b(?:video|short|roteiro|animacao)\\b/.test(command)
        || videoValido(respostaAnteriorDoProjeto?.roteiroVideo));
      if (recuperarJingle || projetoDeVideo || (!videoRequest && !trafficRequest && !bentoRequest)) {
        send.disabled = microphone.disabled = true;
        const sinalConversa = AbortSignal.timeout(45000);
        const avisoDeEspera = setTimeout(() => {
          body.textContent = "Pedido enviado. Aguardando o núcleo de conversa…";
        }, 5000);
        try {
          const mensagens = montarContextoDaConversa(current);
          if (revisaoDoVideo) mensagens.at(-1).content = revisaoDoVideo;
          const ultimaPartitura = findLastMessage(entrada => partituraValida(entrada.partitura))?.partitura;
          const ultimoVideo = findLastMessage(entrada => videoValido(entrada.roteiroVideo))?.roteiroVideo;
          const response = await fetch("/api/conversa", {
            method: "POST",
            headers: { Authorization: "Bearer " + credential, "Content-Type": "application/json" },
            body: JSON.stringify({ mensagens, ultimaPartitura, ultimoVideo }),
            signal: sinalConversa,
          });
          const payload = await response.json();
          if (recuperarJingle && response.ok && partituraValida(payload.partitura)) {
            entregarMelodia(item, record, payload.partitura, versaoAnterior + 1, update);
          } else if (response.ok && partituraValida(payload.partitura)) {
            record.partitura = payload.partitura;
            record.proposta = true;
            const duracao = Math.round(record.partitura.notas.reduce((total, nota) => total + nota[1], 0) * 60 / record.partitura.bpm);
            apresentarAprovacao(item, record);
            update(record.partitura.titulo + " · Proposta de melodia instrumental"
              + "\\nRitmo: " + record.partitura.bpm + " BPM · Duração: " + duracao + " s"
              + (record.partitura.letra ? "\\n\\n" + record.partitura.letra : "")
              + "\\n\\nPeça um ajuste ou diga “pode executar” para gerar o áudio.");
          } else if (response.ok && videoValido(payload.roteiroVideo)) {
            record.roteiroVideo = payload.roteiroVideo;
            record.proposta = true;
            if (revisaoDoVideo) {
              record.proposta = false;
              await gerarClipeDoRoteiro(item, body, record, record.roteiroVideo, update);
              return;
            }
            apresentarRoteiro(item, record.roteiroVideo);
            apresentarAprovacao(item, record);
            update(textoRoteiro(record.roteiroVideo)
              + "\\n\\nPeça um ajuste ou diga “pode executar” para aprovar este roteiro.");
          } else if (response.ok && payload.pedirGravacao) {
            update("Toque em Áudio para gravar a letra. Depois de parar a gravação, toque em Enviar. Para usar um áudio já gravado, toque em + e escolha Anexar áudio. Vou ajustar a clareza e o volume da sua gravação.");
          } else {
            update(response.ok ? payload.texto : payload.erro);
          }
        } catch {
          update(sinalConversa.aborted
            ? "O núcleo de conversa demorou para responder. Seu pedido ficou no histórico. Use Repetir pedido para tentar novamente."
            : "Falha de conexão com o núcleo de conversa.");
        } finally {
          clearTimeout(avisoDeEspera);
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
        download.download = (title === "Trânsito seguro" ? "aion-transito-seguro." : scenes.length ? "aion-meu-video." : "aion-a-coragem-de-recomecar.") + extension;
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

  async function renderSample(customScenes, onProgress, photo, signal, tempos, contexto, falas) {
    const canvas = document.createElement("canvas");
    canvas.width = 540;
    canvas.height = 960;
    if (!window.MediaRecorder || !canvas.captureStream) {
      throw new Error("Abra o Aion no Safari ou no Chrome atualizado.");
    }
    const formatos = contexto
      ? ["video/mp4", "video/webm;codecs=vp8,opus", "video/webm"]
      : ["video/mp4;codecs=avc1.42E01E", "video/mp4", "video/webm;codecs=vp8", "video/webm"];
    const mime = formatos.find(type => MediaRecorder.isTypeSupported(type));
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
    const fontes = [];
    try {
      const destino = contexto?.createMediaStreamDestination();
      if (destino) destino.stream.getAudioTracks().forEach(track => stream.addTrack(track));
      recorder = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: 1800000 });
      const chunks = [];
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      await new Promise((resolve, reject) => {
        recorder.onstop = resolve;
        recorder.onerror = () => reject(new Error("Falha na gravação."));
        let duration = 0;
        const cortes = scenes.map((_, i) => (duration += tempos?.[i] ?? 3000));
        const start = performance.now();
        let lastProgress = -1;
        function draw() {
          const elapsed = Math.min(performance.now() - start, duration);
          const proximo = cortes.findIndex(corte => elapsed < corte);
          const index = proximo < 0 ? scenes.length - 1 : proximo;
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
        if (destino) {
          const inicioAudio = contexto.currentTime;
          for (const [indice, fala] of falas.entries()) {
            if (!fala) continue;
            const fonte = contexto.createBufferSource();
            fonte.buffer = fala;
            fonte.playbackRate.value = Math.max(1, fala.duration / (tempos[indice] / 1000));
            fonte.connect(destino);
            fontes.push(fonte);
            fonte.start(inicioAudio + (cortes[indice - 1] ?? 0) / 1000);
          }
        }
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
      fontes.forEach(fonte => {
        fonte.stop();
        fonte.disconnect();
      });
      stream.getTracks().forEach(track => track.stop());
    }
  }

  function showPanel(areas, credential) {
    document.getElementById("entrada").hidden = true;
    document.getElementById("painel").hidden = false;
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
    document.getElementById("titulo-painel").focus({ preventScroll: true });
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
          status.textContent = "Não foi possível conectar ao Aion.";
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
