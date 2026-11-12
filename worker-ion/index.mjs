import { protectOwnerRoute } from "../integracoes/ion-controle-dono.mjs";

export default {
  async fetch(request, env, ctx) {
    const path = new URL(request.url).pathname;
    if (path !== "/verificar-acesso") {
      return new Response("Rota indisponível.", { status: 404 });
    }
    if (request.method !== "GET") {
      return new Response("Método indisponível.", { status: 405, headers: { Allow: "GET" } });
    }

    const ownerEmail = env.ION_OWNER_EMAIL?.trim().toLowerCase();
    const audience = env.ION_ACCESS_AUDIENCE?.trim();
    if (!ownerEmail || !audience) {
      return new Response("Validação ainda indisponível.", {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      });
    }

    const verifyOwner = protectOwnerRoute({
      owner: { issuer: audience, subject: ownerEmail },
      verifySession: async () => {
        if (ctx.access?.aud !== audience) return null;
        const identity = await ctx.access.getIdentity();
        const email = identity?.email?.trim().toLowerCase();
        return email ? { issuer: audience, subject: email } : null;
      },
      audit: ({ actor, ...event }) => console.warn(JSON.stringify(event)),
      action: "verificar_acesso",
      resource: "ion",
    }, () => Response.json({ acesso: "proprietario", modo: "validacao" }));

    return verifyOwner(request);
  },
};
