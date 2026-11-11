/**
 * Protege uma rota privada do Ion. Use no servidor, em cada rota de
 * comandos ou relatórios, antes de ler o corpo ou executar qualquer ação.
 *
 * owner é configuração privada do servidor: { issuer, subject }.
 * verifySession deve devolver { issuer, subject } de uma sessão já validada
 * pelo provedor (ou null). Nunca use cabeçalhos ou campos de identidade
 * fornecidos diretamente pelo cliente como prova de autenticação.
 * audit recebe somente eventos de negação, sem credenciais ou conteúdo.
 */
export function protectOwnerRoute({ owner, verifySession, audit }, handler) {
  const { issuer, subject } = owner ?? {};
  if (!validIdentity(issuer, subject) || typeof verifySession !== "function"
      || typeof audit !== "function" || typeof handler !== "function") {
    throw new TypeError("Configure o dono, o verificador de sessão, a auditoria e a rota.");
  }

  return async function ownerRoute(request) {
    let identity;
    try {
      identity = await verifySession(request);
    } catch {
      return deny(audit, 503, "verificador_indisponivel");
    }

    if (!validIdentity(identity?.issuer, identity?.subject)) {
      return deny(audit, 401, "sessao_ausente_ou_invalida");
    }
    if (identity.issuer !== issuer || identity.subject !== subject) {
      return deny(audit, 403, "identidade_sem_permissao");
    }

    const response = await handler(request);
    const headers = new Headers(response.headers);
    headers.set("Cache-Control", "no-store");
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
}

function validIdentity(issuer, subject) {
  return typeof issuer === "string" && issuer.trim() !== ""
    && typeof subject === "string" && subject.trim() !== "";
}

async function deny(audit, status, reason) {
  try {
    await audit({ event: "ion.owner_access_denied", reason });
  } catch {
    // Uma falha no registro não pode liberar a rota.
  }
  return new Response("Acesso indisponível.", {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
