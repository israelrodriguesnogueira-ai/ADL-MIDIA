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
</style>
<main>
  <section id="entrada">
  <h1>Validar acesso ao Ion</h1>
  <div id="google-login"></div>
  <p id="status" role="status">Entre com sua Conta Google.</p>
  </section>
  <section id="painel" hidden>
    <h1 id="titulo-painel" tabindex="-1">Painel do Ion</h1>
    <p>Acesso do proprietário confirmado.</p>
    <ul id="areas"></ul>
    <button id="sair" type="button">Sair</button>
  </section>
</main>
<script src="https://accounts.google.com/gsi/client" defer></script>
<script>
  const status = document.getElementById("status");
  document.getElementById("sair").addEventListener("click", () => window.location.reload());

  function showPanel(areas) {
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
