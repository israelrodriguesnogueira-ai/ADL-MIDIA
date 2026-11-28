import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";
import { Script } from "node:vm";
import worker from "../worker-ion/index.mjs";
import { executarMotor } from "../worker-ion/motores-ia.mjs";

const url = "https://ion.example.test/api/video/transito";

test("entrega a voz Faber pela mesma origem e permite apenas os recursos previstos", async t => {
  const downloads = [];
  t.mock.method(globalThis, "fetch", async url => {
    downloads.push(String(url));
    if (String(url).includes("+esm")) {
      return new Response('const base = "https://huggingface.co/diffusionstudio/piper-voices/resolve/main"; import("/npm/onnxruntime-web@1.27.0/wasm/+esm");');
    }
    return new Response("modelo");
  });
  const abrir = (recurso, method) => worker.fetch(new Request("https://ion.example.test/aion-voz/" + recurso, { method }), {});
  assert.equal((await abrir("modelos/outro.onnx")).status, 404);
  assert.equal((await abrir("piper.mjs", "POST")).status, 405);
  assert.deepEqual(downloads, []);
  const modulo = await abrir("piper.mjs");
  assert.match(await modulo.text(), /"\/aion-voz\/modelos"; import\("https:\/\/cdn\.jsdelivr\.net\/npm\//);
  const modelo = await abrir("modelos/pt/pt_BR/faber/medium/pt_BR-faber-medium.onnx");
  assert.equal(modelo.headers.get("Content-Type"), "application/octet-stream");
  assert.equal(await modelo.text(), "modelo");
  assert.equal(downloads.length, 2);
});

test("motores tentam alternativa em caso de falha e param no limite da conta", async () => {
  const chamadas = [];
  const ia = { run: async modelo => {
    chamadas.push(modelo);
    if (chamadas.length === 1) return { response: "" };
    return { choices: [{ message: { content: "Resultado" } }] };
  } };
  assert.equal(await executarMotor(ia, "conversa", {}, texto => texto || null), "Resultado");
  assert.match(chamadas[0], /glm-4.7/);
  assert.match(chamadas[1], /gemma-4/);
  chamadas.length = 0;
  ia.run = async modelo => {
    chamadas.push(modelo);
    throw Object.assign(new Error("daily allocation exceeded"), { status: 429 });
  };
  await assert.rejects(executarMotor(ia, "conversa", {}, texto => texto), /allocation/);
  assert.equal(chamadas.length, 1);
});

test("video endpoint rejects GET", async () => {
  const response = await worker.fetch(new Request(url), {});
  assert.equal(response.status, 405);
  assert.equal(response.headers.get("allow"), "POST");
});

test("video endpoint refuses to run without configured owner", async () => {
  const response = await worker.fetch(new Request(url, { method: "POST" }), {});
  assert.equal(response.status, 503);
  assert.match((await response.json()).erro, /Autenticação/);
});

test("video endpoint refuses invalid Google client id", async () => {
  const response = await worker.fetch(new Request(url, { method: "POST" }), {
    ION_OWNER_EMAIL: "owner@gmail.com",
    ION_GOOGLE_CLIENT_ID: "invalid-client-id",
  });
  assert.equal(response.status, 503);
});

test("login page remains available with configured owner", async () => {
  const response = await worker.fetch(new Request("https://ion.example.test/"), {
    ION_OWNER_EMAIL: "owner@gmail.com",
    ION_GOOGLE_CLIENT_ID: "12345-abc.apps.googleusercontent.com",
  });
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes('/api/video/transito'));
  assert.ok(html.includes('showPanel((await result.json()).areas, credential)'));
});

test("interface separates dictation from message submission", async () => {
  const response = await worker.fetch(new Request("https://ion.example.test/"), {
    ION_OWNER_EMAIL: "owner@gmail.com",
    ION_GOOGLE_CLIENT_ID: "12345-abc.apps.googleusercontent.com",
  });
  const html = await response.text();
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  assert.doesNotThrow(() => new Script(script));
  assert.ok(html.includes('id="pedido-ion"'));
  assert.ok(html.includes('id="voz-ion"'));
  assert.ok(html.includes('id="enviar-ion"'));
  assert.ok(html.includes('id="cancelar-video"'));
  assert.ok(!html.includes('id="transito-ion"'));
  assert.ok(html.includes('Texto reconhecido. Revise e toque em Enviar'));
  assert.ok(!html.includes('help.textContent = "Comando de voz enviado.";'));
  assert.ok(html.includes('signal: recording.signal'));
  assert.ok(html.includes('microphone.setAttribute("aria-label", "Concluir ditado")'));
});

test("conversa do proprietário executa vídeo e jingle e devolve estados reais", async t => {
  const { publicKey, privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const dono = "owner@gmail.com";
  const audiencia = "12345-abc.apps.googleusercontent.com";
  const chave = { ...publicKey.export({ format: "jwk" }), kid: "teste" };
  const base64 = objeto => Buffer.from(JSON.stringify(objeto)).toString("base64url");
  const credencial = email => {
    const payload = base64({ alg: "RS256", kid: chave.kid }) + "." + base64({
      aud: audiencia, iss: "https://accounts.google.com", exp: Date.now() / 1000 + 60,
      email, email_verified: true,
    });
    return "Bearer " + payload + "." + sign("sha256", Buffer.from(payload), privateKey).toString("base64url");
  };
  const pedidos = [];
  let fonteCotacao = "ptax";
  let consultasCotacao = 0;
  const arquivos = new Map();
  const cidadesConsultadas = [];
  const buscasWikipedia = [];
  t.mock.method(globalThis, "fetch", async (url, opcoes) => {
    if (url === "https://www.googleapis.com/oauth2/v3/certs") return Response.json({ keys: [chave] });
    if (new URL(url).hostname === "olinda.bcb.gov.br") {
      consultasCotacao++;
      return fonteCotacao === "ptax"
        ? Response.json({ value: [
          { cotacaoVenda: 5.1, dataHoraCotacao: "2026-11-24 13:00:00.000" },
          { cotacaoVenda: 5.7, dataHoraCotacao: "2026-11-25 13:00:00.000" },
        ] })
        : new Response(null, { status: 503 });
    }
    if (new URL(url).hostname === "api.frankfurter.dev") {
      return fonteCotacao === "alternativa"
        ? Response.json({ base: "USD", date: "2026-11-24", rates: { BRL: 5.6 } })
        : new Response(null, { status: 503 });
    }
    if (new URL(url).hostname === "geocoding-api.open-meteo.com") {
      const cidade = new URL(url).searchParams.get("name");
      cidadesConsultadas.push(cidade);
      return Response.json({ results: [
        { name: "São Paulo", admin1: "São Paulo", country_code: "BR", latitude: -23.55, longitude: -46.63 },
      ] });
    }
    if (new URL(url).hostname === "api.open-meteo.com") {
      return Response.json({ daily: {
        time: ["2026-11-27", "2026-11-28"], temperature_2m_min: [16, 17],
        temperature_2m_max: [22, 23], precipitation_probability_max: [61, 35],
      } });
    }
    if (new URL(url).hostname === "pt.wikipedia.org") {
      buscasWikipedia.push(new URL(url).searchParams.get("q"));
      return Response.json({ pages: [{ title: "Animação", key: "Animação", description: "Técnica audiovisual" }] });
    }
    assert.match(url, /\/actions\/workflows\/aion-video-3d\.yml\/dispatches$/);
    pedidos.push(JSON.parse(opcoes.body));
    return Response.json({ workflow_run_id: 123 });
  });
  const env = {
    ION_OWNER_EMAIL: dono,
    ION_GOOGLE_CLIENT_ID: audiencia,
    ION_GITHUB_ACTIONS_TOKEN: "token-de-teste",
    ION_VIDEO_3D_FREE_ENABLED: "true",
    ION_VIDEOS_DB: {
      prepare: () => ({ bind: (chave, dados, tipo) => ({
        run: async () => {
          arquivos.set(chave, { dados, tipo });
          return { meta: { changes: 1 } };
        },
        first: async () => arquivos.get(chave) ?? null,
      }) }),
    },
  };
  const solicitar = (texto, email = dono, ambiente = env) => worker.fetch(new Request("https://ion.example.test/api/conversa", {
    method: "POST",
    headers: { Authorization: credencial(email) },
    body: JSON.stringify({ mensagens: [{ role: "user", content: texto }] }),
  }), ambiente);

  const consulta = "Qual é a cotação do dólar hoje em reais (USD/BRL)? Informe a fonte e a data e hora.";
  assert.equal((await solicitar(consulta, "outra@gmail.com")).status, 403);
  assert.equal(consultasCotacao, 0);
  const ptax = await solicitar(consulta);
  assert.equal(ptax.status, 200);
  assert.equal(ptax.headers.get("Cache-Control"), "no-store");
  assert.match((await ptax.json()).texto, /5,7000[\s\S]*25\/11\/2026 às 13:00:00[\s\S]*Banco Central do Brasil/);
  fonteCotacao = "alternativa";
  assert.match((await (await solicitar(consulta)).json()).texto, /5,6000[\s\S]*24\/11\/2026[\s\S]*Frankfurter/);
  fonteCotacao = "indisponivel";
  const indisponivel = await solicitar(consulta);
  assert.equal(indisponivel.status, 502);
  assert.match((await indisponivel.json()).erro, /fontes da cotação/);
  assert.equal((await solicitar("Explique a cotação histórica do dólar")).status, 503);
  assert.equal(consultasCotacao, 3);
  const previsao = await solicitar("Qual é a previsão do tempo para amanhã em São Paulo, SP? Informe a fonte.");
  assert.equal(previsao.status, 200);
  assert.match((await previsao.json()).texto, /São Paulo \(28\/11\/2026\)[\s\S]*Open-Meteo/);
  assert.deepEqual(cidadesConsultadas, ["São Paulo"]);

  const comandoPesquisa = "Aion, pesquise na internet sobre como criar vídeo de animação.";
  assert.equal((await solicitar(comandoPesquisa, "outra@gmail.com")).status, 403);
  assert.deepEqual(buscasWikipedia, []);
  const pesquisa = await solicitar(comandoPesquisa);
  assert.equal(pesquisa.status, 200);
  assert.deepEqual(buscasWikipedia, ["como criar vídeo de animação"]);
  assert.match((await pesquisa.json()).texto, /Resultados da Wikipédia[\s\S]*Técnica audiovisual/);

  const comando = "Aion, eu quero que você faça um vídeo 3D vestido preto duração de 15 segundos. O resultado esperado é um vídeo 3D vestido preto vertical com giro contínuo mostrando frente, lateral e costas.";
  assert.equal((await solicitar(comando, "outra@gmail.com")).status, 403);
  const incompativel = await solicitar("Crie um vídeo 3D de um vestido vermelho de 30 segundos");
  assert.equal((await incompativel.json()).status, "indisponivel");
  const bloqueado = await solicitar(comando, dono, { ...env, ION_VIDEO_3D_FREE_ENABLED: "false" });
  assert.equal(bloqueado.status, 503);
  assert.match((await bloqueado.json()).erro, /aguarda ativação/);
  assert.equal(pedidos.length, 0);

  const aceito = await solicitar(comando);
  assert.equal(aceito.status, 202);
  const resultado = await aceito.json();
  assert.equal(resultado.status, "solicitado");
  assert.equal(resultado.tarefa.status, "solicitada");
  assert.match(resultado.texto, /ainda está em produção/);
  assert.match(resultado.acompanhamento, /\/123$/);
  assert.equal(pedidos.length, 1);
  assert.equal(resultado.arquivo, "/?arquivo=" + pedidos[0].inputs.id);
  assert.ok(!JSON.stringify(resultado).includes(pedidos[0].inputs.token));

  const partitura = { titulo: "Bom dia", letra: "Bom dia!", bpm: 120, notas: [[60, 1], [64, 1], [67, 1], [72, 2]] };
  const ambienteMusical = {
    ...env,
    ION_VISION_FREE_ENABLED: "true",
    ION_AI: { run: async () => ({ response: JSON.stringify({ acao: "melodia", ...partitura }) }) },
  };
  const proposta = await solicitar("Crie uma proposta de jingle para a oficina", dono, ambienteMusical);
  assert.deepEqual(await proposta.json(), { partitura });
  assert.equal(arquivos.size, 1);
  const jingle = await solicitar("Crie um jingle instrumental para a oficina", dono, ambienteMusical);
  assert.equal(jingle.status, 200);
  const { tarefa } = await jingle.json();
  assert.equal(tarefa.status, "concluida");
  const arquivo = await worker.fetch(new Request("https://ion.example.test/api/arquivos/" + tarefa.id, {
    headers: { Authorization: credencial(dono) },
  }), env);
  assert.equal(arquivo.headers.get("Content-Type"), "audio/wav");
  const dados = Buffer.from(await arquivo.arrayBuffer());
  assert.equal(dados.toString("ascii", 0, 4), "RIFF");
  assert.equal(dados.toString("ascii", 8, 12), "WAVE");
  assert.equal(dados.readUInt32LE(40), 60000);
  assert.ok(dados.subarray(44).some(amostra => amostra !== 0));
  const transcricao = await worker.fetch(new Request("https://ion.example.test/api/transcricao", {
    method: "POST",
    headers: { Authorization: credencial(dono), "Content-Type": "audio/wav" },
    body: dados,
  }), {
    ...ambienteMusical,
    ION_AI: { run: async (modelo, entrada) => {
      assert.match(modelo, /whisper-large-v3-turbo$/);
      assert.equal(entrada.task, "transcribe");
      assert.deepEqual(Buffer.from(entrada.audio, "base64"), dados);
      return { text: "Transcrição confirmada." };
    } },
  });
  assert.equal(transcricao.status, 200);
  assert.equal((await transcricao.json()).texto, "Transcrição confirmada.");
});


test("o player embute ilustrações animadas e reconhece pedidos de vídeo 3D em português", async () => {
  const resposta = await worker.fetch(new Request("https://ion.example.test/"), {
    ION_OWNER_EMAIL: "owner@gmail.com",
    ION_GOOGLE_CLIENT_ID: "worker-test.apps.googleusercontent.com",
  });
  const html = await resposta.text();
  const script = html.match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  const funcoes = script.slice(script.indexOf("function normalizarPedido"), script.indexOf("function tipoDeProducao"));
  const { pedidoDeVideo3D, pedidoDeVestido3D, desenharVestido3D, desenharTransito } = new Script(
    funcoes + "\n({ pedidoDeVideo3D, pedidoDeVestido3D, desenharVestido3D, desenharTransito });"
  ).runInNewContext();
  assert.equal(pedidoDeVestido3D("Crie um vídeo em 3D do vestido preto com 15s"), "renderizar");
  assert.equal(pedidoDeVideo3D("Quero um vídeo de 3D"), true);
  assert.equal(pedidoDeVideo3D("Como funciona um vídeo em 3D?"), false);
  const quadro = (desenhar, progresso) => {
    const pontos = [];
    const ctx = {
      createLinearGradient: () => ({ addColorStop() {} }),
      fillRect(...args) { pontos.push(args); },
      moveTo(...args) { pontos.push(args); },
      lineTo(...args) { pontos.push(args); },
      arc(...args) { pontos.push(args); },
      beginPath() {}, ellipse() {}, closePath() {}, fill() {}, stroke() {},
    };
    desenhar(ctx, progresso, 0);
    return pontos;
  };
  assert.notDeepEqual(quadro(desenharVestido3D, 0), quadro(desenharVestido3D, 0.25));
  assert.notDeepEqual(quadro(desenharTransito, 0.1), quadro(desenharTransito, 0.7));
});

test("há resposta de timeout sem chamar um segundo modelo depois do prazo", async () => {
  const chamadas = [];
  const ia = { run: modelo => {
    chamadas.push(modelo);
    return new Promise(resolve => setTimeout(() => resolve({ response: "tarde" }), 50));
  } };
  await assert.rejects(executarMotor(ia, "conversa", {}, texto => texto, { prazoMs: 5 }), { name: "TimeoutError" });
  assert.equal(chamadas.length, 1);
});


test("pedidos do histórico produzem propostas locais de carro, vestido e trânsito narrado", async () => {
  const resposta = await worker.fetch(new Request("https://ion.example.test/"), {
    ION_OWNER_EMAIL: "owner@gmail.com",
    ION_GOOGLE_CLIENT_ID: "worker-test.apps.googleusercontent.com",
  });
  const script = (await resposta.text()).match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  const parte = script.slice(script.indexOf("function normalizarPedido"), script.indexOf("function tipoDeProducao"));
  const { propostaVisual, desenharPallas3D } = new Script(parte + "\n({ propostaVisual, desenharPallas3D });").runInNewContext();
  const carro = propostaVisual("Ok faça um vídeo 3D para mim do carro C4 Pallas de 15 segundos com apresentação desse modelo 2010");
  assert.equal(carro.visual, "c4-pallas-3d");
  assert.equal(carro.roteiro.cenas.reduce((soma, cena) => soma + cena.segundos, 0), 15);
  assert.ok(carro.roteiro.cenas.every(cena => cena.fala));
  assert.equal(propostaVisual("Crie um vídeo 3D de outro carro"), null);
  assert.equal(propostaVisual("Crie um vídeo 3D do C4 Pallas 2011"), null);
  assert.equal(propostaVisual("Crie um vídeo 3D do C4 Pallas 2010 de 30 segundos"), null);
  const vestido = propostaVisual("Ok faça um vídeo do vestido preto 3D para mim de 15 segundos frente lá de costas como modelo");
  assert.equal(vestido.visual, "vestido-3d");
  assert.ok(propostaVisual("Ah eu creio para mim um vídeo de trânsito com narração").roteiro.cenas.every(cena => cena.fala));
  assert.equal(propostaVisual("criar um roteiro de 15 segundos sobre segurança no trânsito com três cenas de narração").roteiroApenas, true);
  const frase = propostaVisual("Crie um vídeo vertical de 15 segundos com a frase “O primeiro passo é difícil. Tente mais uma vez.” Use essa frase na narração e na legenda.");
  assert.equal(frase.roteiro.cenas[0].fala, "O primeiro passo é difícil. Tente mais uma vez.");
  assert.equal(frase.roteiro.cenas[0].legenda, frase.roteiro.cenas[0].fala);
  const quadro = progresso => {
    const pontos = [];
    const ctx = { createLinearGradient: () => ({ addColorStop() {} }), fillRect() {}, beginPath() {},
      ellipse() {}, moveTo(...p) { pontos.push(p); }, lineTo(...p) { pontos.push(p); }, closePath() {}, fill() {}, stroke() {} };
    desenharPallas3D(ctx, progresso);
    return pontos;
  };
  assert.notDeepEqual(quadro(0), quadro(0.25));
});


test("link do YouTube usa o ID canônico e metadados sem inventar análise", async t => {
  const resposta = await worker.fetch(new Request("https://ion.example.test/"), {
    ION_OWNER_EMAIL: "owner@gmail.com",
    ION_GOOGLE_CLIENT_ID: "worker-test.apps.googleusercontent.com",
  });
  const html = await resposta.text();
  assert.match(html, /function propostaVisual/);
  const { readFile } = await import("node:fs/promises");
  const fonte = await readFile(new URL("../worker-ion/index.mjs", import.meta.url), "utf8");
  const funcoes = fonte.slice(fonte.indexOf("function idVideoYouTube"), fonte.indexOf("function desenharPallas3D"));
  let consultado;
  const { idVideoYouTube, identificarVideoYouTube } = new Script(
    funcoes + "\n({ idVideoYouTube, identificarVideoYouTube });"
  ).runInNewContext({ URL, AbortSignal, fetch: async url => {
    consultado = new URL(url);
    return Response.json({ title: "Título confirmado", author_name: "Canal confirmado" });
  } });
  assert.equal(idVideoYouTube("https://youtu.be/FjEHsyiX3Ng?is=abc"), "FjEHsyiX3Ng");
  assert.equal(idVideoYouTube("https://youtube.com.exemplo.test/watch?v=FjEHsyiX3Ng"), null);
  const dados = await identificarVideoYouTube("FjEHsyiX3Ng");
  assert.equal(consultado.hostname, "www.youtube.com");
  assert.equal(consultado.searchParams.get("url"), "https://www.youtube.com/watch?v=FjEHsyiX3Ng");
  assert.match(dados, /Título confirmado/);
  assert.match(dados, /envie capturas do vídeo/);
});


test("retomada reconhece a mensagem anterior e mantém a escolha do modelo 3D", async () => {
  const resposta = await worker.fetch(new Request("https://ion.example.test/"), {
    ION_OWNER_EMAIL: "owner@gmail.com",
    ION_GOOGLE_CLIENT_ID: "worker-test.apps.googleusercontent.com",
  });
  const script = (await resposta.text()).match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  const funcoes = script.slice(script.indexOf("const LIMITE_TEXTO_CONVERSA"), script.indexOf("function tipoDeProducao"));
  const { modoDeRetomada, pedidoVisual3DEmContexto, propostaVisual, tituloDaDuracao, montarContextoDaConversa } = new Script(
    funcoes + "\n({ modoDeRetomada, pedidoVisual3DEmContexto, propostaVisual, tituloDaDuracao, montarContextoDaConversa });"
  ).runInNewContext();
  assert.equal(modoDeRetomada("Volta na própria mensagem que você enviou"), "resposta");
  assert.equal(modoDeRetomada("A proposta estava na mensagem logo anterior que você deu"), "proposta");
  assert.equal(modoDeRetomada("Crie uma proposta de roteiro"), null);
  const anterior = "Faça um vídeo em 3D";
  assert.equal(propostaVisual(pedidoVisual3DEmContexto("O carro", anterior)).visual, "c4-pallas-3d");
  assert.equal(propostaVisual(pedidoVisual3DEmContexto("C4 Pallas 2011", anterior)), null);
  assert.equal(propostaVisual(pedidoVisual3DEmContexto("O carro", "Bom dia")), null);
  const historico = [{ who: "Ion", idRetomada: "original", text: "Proposta do C4 Pallas" },
    ...Array.from({ length: 20 }, (_, i) => ({ who: "Você", text: "Mensagem " + i })),
    { who: "Ion", retoma: "original", text: "Retomei a proposta" }];
  assert.equal(montarContextoDaConversa(historico).at(-1).content, "Proposta do C4 Pallas");
  assert.equal(tituloDaDuracao(61000, true), "Trabalhando · 1 min 1 s");
  assert.equal(tituloDaDuracao(61000, false), "Tempo de execução · 1 min 1 s");
});


test("o primeiro modelo lento cede espaço ao segundo dentro do prazo total", async () => {
  const chamadas = [];
  const ia = { run: async modelo => {
    chamadas.push(modelo);
    if (chamadas.length === 1) return new Promise(resolve => setTimeout(() => resolve({ response: "tarde" }), 50));
    return { response: "resposta do modelo alternativo" };
  } };
  const texto = await executarMotor(ia, "conversa", {}, v => v, { prazoMs: 100, prazoPorModeloMs: 5 });
  assert.equal(texto, "resposta do modelo alternativo");
  assert.equal(chamadas.length, 2);
});

test("pesquisa em português consulta uma fonte real e devolve os links sem chamar inferência", async () => {
  const { readFile } = await import("node:fs/promises");
  const fonte = await readFile(new URL("../worker-ion/index.mjs", import.meta.url), "utf8");
  const funcoes = fonte.slice(fonte.indexOf("const ORIGEM_WIKIPEDIA"), fonte.indexOf("async function consultarPrevisao"));
  let chamada;
  let dispo = true;
  const { assuntoDaPesquisa, pesquisarWikipedia } = new Script(
    funcoes + "\n({ assuntoDaPesquisa, pesquisarWikipedia });"
  ).runInNewContext({ URL, AbortSignal, fetch: async url => {
    chamada = new URL(url);
    return dispo ? Response.json({ pages: [{ title: "Citroën C4", key: "Citroën_C4", description: "Modelo de automóvel" }] })
      : new Response(null, { status: 503 });
  } });
  assert.equal(assuntoDaPesquisa("Aion, pesquise na internet sobre o C4 Pallas."), "o C4 Pallas");
  assert.equal(assuntoDaPesquisa("procure pelo comando https://example.org"), "");
  assert.equal(assuntoDaPesquisa("quero que me entregue o resultado"), "");
  const resultado = await pesquisarWikipedia("C4 Pallas");
  assert.equal(chamada.origin, "https://pt.wikipedia.org");
  assert.equal(chamada.searchParams.get("q"), "C4 Pallas");
  assert.equal(resultado.fontesPesquisa[0].url, "https://pt.wikipedia.org/wiki/Citro%C3%ABn_C4");
  dispo = false;
  assert.match((await pesquisarWikipedia("C4 Pallas")).erro, /não respondeu/);
});


test("o renderizador funciona quando o empacotador preserva o nome das funções", async () => {
  const resposta = await worker.fetch(new Request("https://ion.example.test/"), {
    ION_OWNER_EMAIL: "owner@gmail.com",
    ION_GOOGLE_CLIENT_ID: "worker-test.apps.googleusercontent.com",
  });
  const script = (await resposta.text()).match(/<script>\s*([\s\S]*?)<\/script>/)[1];
  const auxiliar = script.split("\n").find(linha => linha.includes("const __name = "));
  assert.ok(auxiliar);
  const inicio = script.indexOf("function desenharPallas3D");
  assert.ok(inicio > 0);
  const fim = script.indexOf("function desenharVestido3D", inicio);
  assert.ok(fim > inicio);
  const desenho = script.slice(inicio, fim).replace("  const perfil =", "  __name(face, \"face\");\n  const perfil =");
  const renderizar = new Script(auxiliar + "\n" + desenho + "\ndesenharPallas3D;").runInNewContext();
  let faces = 0;
  const ctx = {
    createLinearGradient: () => ({ addColorStop() {} }),
    fillRect() {}, beginPath() {}, ellipse() {}, moveTo() {}, lineTo() {}, closePath() {}, stroke() {},
    fill() { faces++; },
  };
  renderizar(ctx, 0.25);
  assert.ok(faces > 10);
});
