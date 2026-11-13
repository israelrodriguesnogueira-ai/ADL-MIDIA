import { protectOwnerRoute } from "../integracoes/ion-controle-dono.mjs";

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
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
          { nome: "ADL Auto", descricao: "Integração pendente" },
        ] })
      : Response.json({ acesso: "proprietario", modo: "validacao" }));

    return verifyOwner(request);
  },
};

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
  #transito-ion, #cancelar-video { justify-self: start; }
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
      <button id="sair" type="button">Sair</button>
    </dialog>
    <ul id="conversa-ion" role="log" aria-label="Conversa com o Ion"></ul>
    <form id="comando-ion">
      <button id="transito-ion" type="button">Criar vídeo de trânsito</button>
      <button id="cancelar-video" type="button" hidden>Cancelar geração</button>
      <div class="ion-compose">
        <button id="mais-ion" type="button" aria-label="Anexar câmera, fotos ou arquivos" aria-expanded="false" aria-controls="anexos-ion">+</button>
        <label for="pedido-ion" class="ion-label">Mensagem para o Ion</label>
        <textarea id="pedido-ion" rows="2" placeholder="Mensagem para o Ion" maxlength="500" required></textarea>
        <button id="voz-ion" type="button" aria-label="Ditar em português">🎙</button>
        <button id="enviar-ion" type="submit">Enviar</button>
      </div>
      <div id="anexos-ion" hidden>
        <button id="escolher-camera" type="button">Câmera</button>
        <button id="escolher-foto" type="button">Fotos</button>
        <button id="escolher-arquivo" type="button">Arquivos</button>
      </div>
      <input type="file" id="camera-ion" accept="image/*" capture="environment" hidden>
      <input type="file" id="foto-ion" accept="image/*" hidden>
      <input type="file" id="arquivo-ion" accept="image/*,.txt,text/plain" hidden>
      <p id="anexo-status" role="status"></p>
      <p id="ajuda-ion" role="status"></p>
    </form>
  </section>
</main>
<script src="https://accounts.google.com/gsi/client" defer></script>
<script>
  const status = document.getElementById("status");
  document.getElementById("sair").addEventListener("click", () => window.location.reload());

  function connectCommands(areas) {
    const central = areas.find(area => area.nome === "Central 6D" && area.url);
    const input = document.getElementById("pedido-ion");
    const send = document.getElementById("enviar-ion");
    const form = document.getElementById("comando-ion");
    const trafficButton = document.getElementById("transito-ion");
    trafficButton.onclick = () => {
      input.value = "Crie um vídeo educativo de trânsito";
      form.requestSubmit();
    };
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
    let recording;
    const cancelVideo = get("cancelar-video");
    cancelVideo.onclick = () => recording?.abort();
    const videoUrls = [];
    function saveHistory() {
      if (current.length) saved = [current, ...saved.filter(chat => chat !== current)].slice(0, 20);
      try { localStorage.setItem(storageKey, JSON.stringify(saved)); }
      catch { help.textContent = "O navegador não conseguiu salvar o histórico."; }
    }
    function openConversation(chat) {
      if (send.disabled) return;
      current = chat;
      attachment = null;
      attachmentStatus.textContent = "";
      remove.hidden = true;
      input.value = "";
      log.replaceChildren();
      videoUrls.splice(0).forEach(url => URL.revokeObjectURL(url));
      for (const entry of chat) message(entry.who, entry.text);
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
        if (file.type.startsWith("image/") && file.size <= 10_000_000) {
          attachment = file;
          attachmentStatus.textContent = "Foto escolhida: " + file.name;
          remove.hidden = false;
          return;
        }
        if (/\\.txt$/i.test(file.name) && file.size <= 4_000) {
          const script = (await file.text()).trim();
          if (script.length && script.length <= 480) {
            input.value = "Crie um vídeo: " + script;
            return;
          }
        }
        help.textContent = "Use uma foto de até 10 MB ou um arquivo TXT com até 480 caracteres.";
      };
    }
    const remove = document.createElement("button");
    remove.type = "button";
    remove.hidden = true;
    remove.textContent = "Remover foto";
    attachmentStatus.after(remove);
    remove.onclick = () => { attachment = null; attachmentStatus.textContent = ""; remove.hidden = true; };

    const microphone = get("voz-ion");
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    microphone.onclick = () => {
      if (recognition) { recognition.stop(); return; }
      if (!Recognition) {
        help.textContent = "Use o microfone do teclado. O navegador não oferece ditado na página.";
        input.focus();
        return;
      }
      const session = new Recognition();
      recognition = session;
      session.lang = "pt-BR";
      session.onresult = event => {
        input.value = (input.value + " " + event.results[0][0].transcript).trim().slice(0, 500);
        help.textContent = "Confira a transcrição e toque em Enviar.";
      };
      session.onerror = () => { help.textContent = "O ditado falhou. Você pode usar o microfone do teclado."; };
      session.onend = () => {
        recognition = null;
        microphone.setAttribute("aria-pressed", "false");
      };
      try {
        session.start();
        microphone.setAttribute("aria-pressed", "true");
        help.textContent = "Ouvindo em português…";
      } catch {
        recognition = null;
        help.textContent = "Use o microfone do teclado para ditar.";
      }
    };

    function message(who, content) {
      const item = document.createElement("li");
      item.className = who === "Você" ? "msg-user" : "msg-ion";
      const label = document.createElement("strong");
      label.textContent = who;
      const body = document.createElement("p");
      body.textContent = content;
      item.append(label, body);
      log.append(item);
      log.scrollTop = log.scrollHeight;
      return { item, body };
    }

    openConversation(current);
    form.onsubmit = async event => {
      event.preventDefault();
      const request = input.value.trim();
      if (!request || send.disabled) return;
      message("Você", request);
      current.push({who: "Você", text: request});
      saveHistory();
      input.value = "";
      const { item, body } = message("Ion", "Entendendo seu pedido…");
      const record = {who: "Ion", text: ""};
      current.push(record);
      const update = (reply) => {
        body.textContent = reply;
        record.text = reply;
        saveHistory();
      };
      const [instruction, ...scriptParts] = request.split(":");
      const command = instruction.normalize("NFD").replace(/[\\u0300-\\u036f]/g, "")
        .toLowerCase().replace(/[.,!?]/g, " ").trim().replace(/\\s+/g, " ")
        .replace(/^(?:ion|i on|aion|ai on) /, "")
        .replace(/^por favor /, "").replace(/ por favor$/, "");
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
      const videoRequest = /^(?:quero(?: que voce)? |(?:voce )?(?:pode|poderia|consegue) )?(?:gere|gera|gerar|faca|faz|fazer|crie|cria|criar|produza|produzir|criom|criou) (?:para mim )?(?:um )?(?:video|short)(?: vertical)?(?: para mim)?(?: (.+))?$/.exec(command);
      // Dictation can add words before the verb and move modifiers after the topic.
      const trafficRequest = !scriptParts.length
        && /\\b(?:gere|gera|gerar|faca|faz|fazer|crie|cria|criar|produza|produzir|criom|criacao)\\b/.test(command)
        && /\\b(?:video|short)\\b/.test(command)
        && /\\b(?:transito|seguranca viaria)\\b/.test(command)
        && !/\\b(?:nao|sem|cancele)\\b/.test(command);
      if (!videoRequest && !trafficRequest) {
        update("Posso criar um vídeo de teste ou montar um vídeo com suas frases. Exemplo: Crie um vídeo para mim: O primeiro passo é difícil. Tente mais uma vez.");
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
          "Trânsito seguro começa com atenção.",
          "Ao dirigir, mantenha o celular guardado.",
          "Reduza a velocidade perto das faixas de pedestres.",
          "A pé, espere os veículos pararem antes de atravessar.",
          "Use o cinto em todos os assentos.",
          "Respeite a sinalização. Cuidar no trânsito protege vidas.",
        ];
      }
      send.disabled = trafficButton.disabled = true;
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
        send.disabled = trafficButton.disabled = false;
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
      stream.getTracks().forEach(track => track.stop());
    }
  }

  function showPanel(areas) {
    connectCommands(areas);
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
        link.textContent = "Abrir " + area.nome;
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
            showPanel((await result.json()).areas);
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
