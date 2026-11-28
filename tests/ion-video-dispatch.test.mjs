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
  assert.match(chamadas[0], /gemma-4/);
  assert.match(chamadas[1], /glm-4/);
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
