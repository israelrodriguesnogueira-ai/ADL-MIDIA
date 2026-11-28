const MOTORES = {
  conversa: ["@cf/google/gemma-4-26b-a4b-it", "@cf/zai-org/glm-4.7-flash", "@cf/meta/llama-3.1-8b-instruct-fast"],
  proposta: ["@cf/meta/llama-3.3-70b-instruct-fp8-fast", "@cf/meta/llama-3.1-8b-instruct-fast"],
  visao: ["@cf/google/gemma-4-26b-a4b-it", "@cf/meta/llama-4-scout-17b-16e-instruct", "@cf/meta/llama-3.2-11b-vision-instruct"],
  transcricao: ["@cf/openai/whisper-large-v3-turbo"],
};

export function limiteCompartilhado(erro) {
  return /(?:quota|daily limit|daily allocation|neurons)/i.test(String(erro?.message))
    || (Number(erro?.code) !== 3040 && (Number(erro?.status) === 429
      || /rate limit/i.test(String(erro?.message))));
}

export async function executarMotor(ia, tarefa, entrada, aceitar, { prazoMs } = {}) {
  const prazo = prazoMs == null ? null : AbortSignal.timeout(prazoMs);
  let ultimoErro;
  for (const modelo of MOTORES[tarefa]) {
    try {
      const dados = typeof entrada === "function" ? entrada(modelo) : entrada;
      prazo?.throwIfAborted();
      let cancelar;
      try {
        const chamada = ia.run(modelo, dados);
        const resposta = prazo ? await Promise.race([chamada, new Promise((_, reject) => {
          cancelar = () => reject(prazo.reason);
          prazo.addEventListener("abort", cancelar, { once: true });
        })]) : await chamada;
        const conteudo = resposta?.response ?? resposta?.choices?.[0]?.message?.content ?? resposta?.text;
        const resultado = aceitar(conteudo);
        if (resultado != null) return resultado;
        ultimoErro = new Error("O motor devolveu um resultado inválido.");
      } finally {
        if (cancelar) prazo.removeEventListener("abort", cancelar);
      }
    } catch (erro) {
      if (prazo?.aborted) throw prazo.reason;
      if (limiteCompartilhado(erro)) throw erro;
      ultimoErro = erro;
    }
  }
  throw ultimoErro;
}
